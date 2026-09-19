import { env } from 'cloudflare:workers';
import { ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { ASSETS, NETWORKS, MEMO_PROGRAM, allocate, creationMessage, displayUnits, explorer, historyMessage, toBaseUnits, validateRecipients, type Asset, type NetworkId, type PaymentIntent, type Recipient, type SplitRecipient } from './model';
import { paymentPolicy } from './policy';

export class PaymentError extends Error { constructor(message: string, public status = 400) { super(message); } }
type Runtime = Record<string, unknown> & { DB?: D1Database; SOLANA_RPC_URL?: string; SOLANA_NETWORK?: string; AUNO_PUBLIC_ORIGIN?: string; AUNO_TRUSTED_CLIENT_HEADER?: string; AUNO_MAINNET_ENABLED?: string; AUNO_MAINNET_SPLITS_ENABLED?: string; AUNO_DEVNET_SPLITS_ENABLED?: string; AUNO_MAX_SOL_LAMPORTS?: string; AUNO_VERIFIER_BATCH_SIZE?: string; AUNO_VERIFIER_TOKEN?: string };
type Attempt = { id: string; payment_id: string; payer: string; message_hash: string; attempt_token_hash: string; last_valid_block_height: number; signature: string | null; status: string };
const CANONICAL_BLOCKHASH = '11111111111111111111111111111111';
const COMPUTE_BUDGET_PROGRAM = 'ComputeBudget111111111111111111111111111111';
const MAX_COMPUTE_UNIT_LIMIT = 1_400_000;
const DEFAULT_COMPUTE_UNIT_LIMIT = 200_000n;
const MAX_COMPUTE_HEAP_BYTES = 256 * 1024;
const MAX_LOADED_ACCOUNTS_DATA_BYTES = 64 * 1024 * 1024;
const MAX_PRIORITY_FEE_LAMPORTS = 10_000_000n;

function runtime() { return env as unknown as Runtime; }
function policy() { try { return paymentPolicy(runtime()); } catch { throw new PaymentError('Payment deployment settings are invalid.', 503); } }
export function db(): D1Database { const database = runtime().DB; if (!database) throw new PaymentError('Payment storage is unavailable. Please try again later.', 503); return database; }
export function paymentNetwork(): NetworkId {
  const configured = runtime().SOLANA_NETWORK || 'devnet';
  if (configured !== 'devnet' && configured !== 'mainnet-beta') throw new PaymentError('Payment network deployment setting is invalid.', 503);
  return configured;
}
function logEvent(event: string, details: Record<string, unknown> = {}) { console.info(JSON.stringify({ event, network: paymentNetwork(), ...details })); }
function logSplitEvent(network: NetworkId, event: string, details: Record<string, unknown> = {}) { if (Number(details.recipientCount || 0) < 2) return; console.info(JSON.stringify({ event: (network === "mainnet-beta" ? "mainnet" : "devnet") + "_split_" + event, network, ...details })); }
function logSplitValidationFailure(network: NetworkId, reason: string, details: Record<string, unknown> = {}) { console.info(JSON.stringify({ event: "split_validation_failed", network, reason, ...details })); if (network === "mainnet-beta") console.info(JSON.stringify({ event: "mainnet_split_rejected", network, reason, ...details })); }
function configuredOrigin() {
  const network = paymentNetwork();
  const allowedHosts = network === 'mainnet-beta' ? ['auno.cash', 'mainnet.auno.cash'] : ['auno.cash', 'devnet.auno.cash', 'localhost'];
  const fallback = network === 'mainnet-beta' ? 'https://auno.cash' : 'https://auno.cash';
  const configured = runtime().AUNO_PUBLIC_ORIGIN || fallback;
  try {
    const origin = new URL(configured);
    if (origin.origin !== configured || origin.protocol !== 'https:' || !allowedHosts.includes(origin.hostname)) throw new Error();
    return origin.origin;
  } catch { throw new PaymentError('Payment origin deployment setting is invalid.', 503); }
}
export function mainnetEnabled() { return runtime().AUNO_MAINNET_ENABLED === 'true'; }
export function mainnetSplitsEnabled() { return mainnetEnabled() && runtime().AUNO_MAINNET_SPLITS_ENABLED === 'true'; }
function devnetSplitsEnabled() { const token = runtime().AUNO_VERIFIER_TOKEN; return runtime().AUNO_DEVNET_SPLITS_ENABLED === 'true' && typeof token === 'string' && token.length >= 32; }
export function publicCapabilities() { const network = paymentNetwork(); return { network, mainnetEnabled: network === 'mainnet-beta' && mainnetEnabled(), mainnetSplitsEnabled: network === 'mainnet-beta' && mainnetSplitsEnabled(), devnetSplitsEnabled: network === 'devnet' && devnetSplitsEnabled() }; }
function isSplitPayment(payment: Pick<PaymentIntent, 'recipients'>) { return payment.recipients.length > 1; }
function assertSettlementEnabled(payment?: Pick<PaymentIntent, 'network' | 'recipients'>) {
  if (paymentNetwork() === 'mainnet-beta' && !mainnetEnabled()) throw new PaymentError('Mainnet Beta settlement is not enabled.', 503);
  if (payment?.network === 'devnet' && isSplitPayment(payment) && !devnetSplitsEnabled()) throw new PaymentError('Devnet split settlement is not enabled yet.', 503);
  if (payment?.network === 'mainnet-beta' && isSplitPayment(payment) && !mainnetSplitsEnabled()) throw new PaymentError('Mainnet split settlement is not enabled yet.', 503);
}
function mainnetMaxSolLamports() {
  const configured = runtime().AUNO_MAX_SOL_LAMPORTS || '100000000';
  if (!/^\d+$/.test(configured)) throw new PaymentError('Mainnet SOL limit deployment setting is invalid.', 503);
  const value = BigInt(configured);
  if (value <= 0n || value > 100_000_000n) throw new PaymentError('Mainnet SOL limit deployment setting exceeds the beta maximum.', 503);
  return value;
}
export function connection() {
  const network = NETWORKS[paymentNetwork()];
  const endpoint = runtime().SOLANA_RPC_URL || network.defaultRpc;
  if (!endpoint) throw new PaymentError('A dedicated mainnet RPC endpoint is required.', 503);
  return new Connection(endpoint, { commitment: 'confirmed', disableRetryOnRateLimit: true, fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(30_000) }) });
}
export async function assertNetwork(c: Connection) {
  const network = NETWORKS[paymentNetwork()];
  if (await c.getGenesisHash() !== network.genesisHash) {
    console.error(JSON.stringify({ event: 'payment_rpc_network_mismatch', network: network.id }));
    throw new PaymentError(`RPC network mismatch. ${network.label} is required.`, 503);
  }
}
export function address(input: unknown): string {
  try {
    if (typeof input !== 'string') throw new Error();
    const key = new PublicKey(input);
    if (!PublicKey.isOnCurve(key.toBytes())) throw new Error();
    return key.toBase58();
  } catch { throw new PaymentError('Enter a valid on-curve Solana wallet address.'); }
}
function verifySignature(wallet: string, message: string, signature: string) {
  try { if (!nacl.sign.detached.verify(new TextEncoder().encode(message), bs58.decode(signature), new PublicKey(wallet).toBytes())) throw new Error(); }
  catch { throw new PaymentError('Wallet signature could not be verified.', 401); }
}
export async function jsonBody(req: Request) {
  const limit = policy().maxBodyBytes;
  if (Number(req.headers.get('content-length') || 0) > limit) throw new PaymentError('Request is too large.', 413);
  const text = await req.text();
  if (text.length > limit) throw new PaymentError('Request is too large.', 413);
  try { return JSON.parse(text) as Record<string, unknown>; } catch { throw new PaymentError('Invalid JSON request.'); }
}
function isLocal(url: URL) { return url.hostname === 'localhost' || url.hostname === '127.0.0.1'; }
export function sameOrigin(req: Request) {
  const requestUrl = new URL(req.url);
  const origin = req.headers.get('origin');
  const expected = isLocal(requestUrl) ? requestUrl.origin : configuredOrigin();
  if (origin !== expected) throw new PaymentError('This request must originate from AUNO.', 403);
  return expected;
}
function publicOrigin(req: Request) { return isLocal(new URL(req.url)) ? new URL(req.url).origin : configuredOrigin(); }
function sourceBucket(req: Request) {
  const header = runtime().AUNO_TRUSTED_CLIENT_HEADER;
  if (typeof header === 'string' && /^[a-z0-9-]{1,64}$/i.test(header)) return req.headers.get(header) || 'anonymous';
  return 'anonymous';
}
export function assertVerifierAuthorization(req: Request) {
  const token = runtime().AUNO_VERIFIER_TOKEN;
  if (typeof token !== 'string' || token.length < 32 || req.headers.get('authorization') !== `Bearer ${token}`) throw new PaymentError('Not found.', 404);
}
async function sha256(value: Uint8Array | string) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
function instructionSignatures(transaction: Transaction) {
  return transaction.instructions
    .filter((instruction) => instruction.programId.toBase58() !== COMPUTE_BUDGET_PROGRAM)
    .map((instruction) => JSON.stringify({
      programId: instruction.programId.toBase58(),
      keys: instruction.keys.map((key) => key.pubkey.toBase58()),
      data: bs58.encode(instruction.data),
    }))
    .sort();
}
function paymentMessage(transaction: Transaction) {
  const message = { payer: transaction.feePayer?.toBase58() || '', instructions: instructionSignatures(transaction) };
  return new TextEncoder().encode(JSON.stringify(message));
}
async function preparedMessageHash(transaction: Transaction) { return `v4:${await sha256(paymentMessage(transaction))}`; }
const JITO_TIP_ACCOUNTS = new Set([
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pivKeVBBWhHW7YPBUAQB',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
]);
function isSafeWalletExtra(instruction: TransactionInstruction, payer: string): boolean {
  const programId = instruction.programId.toBase58();
  if (programId === MEMO_PROGRAM) return true;
  if (programId !== SystemProgram.programId.toBase58()) return false;
  const data = Uint8Array.from(instruction.data);
  if (data.length !== 12) return false;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint32(0, true) !== 2) return false;
  if (instruction.keys.length < 2) return false;
  if (instruction.keys[0].pubkey.toBase58() !== payer) return false;
  return JITO_TIP_ACCOUNTS.has(instruction.keys[1].pubkey.toBase58());
}
async function matchesPreparedMessage(payment: PaymentIntent, attempt: Attempt, transaction: Transaction) {
  if (transaction.feePayer?.toBase58() !== attempt.payer) return false;
  const expected = await buildTransaction(payment, attempt.payer, attempt.id, CANONICAL_BLOCKHASH);
  const expectedSigs = new Set(instructionSignatures(expected));
  const recipientAddresses = new Set(payment.recipients.map((recipient) => recipient.address));
  const actualNonCompute = transaction.instructions.filter((instruction) => instruction.programId.toBase58() !== COMPUTE_BUDGET_PROGRAM);
  const actualSigs = new Set<string>();
  for (const instruction of actualNonCompute) {
    const signature = JSON.stringify({
      programId: instruction.programId.toBase58(),
      keys: instruction.keys.map((key) => key.pubkey.toBase58()),
      data: bs58.encode(instruction.data),
    });
    if (expectedSigs.has(signature)) { actualSigs.add(signature); continue; }
    if (!isSafeWalletExtra(instruction, attempt.payer)) return false;
  }
  void recipientAddresses;
  for (const signature of expectedSigs) {
    if (!actualSigs.has(signature)) return false;
  }
  return true;
}
function littleEndian(data: Uint8Array) {
  let value = 0n;
  for (let position = data.length - 1; position >= 0; position -= 1) value = (value << 8n) + BigInt(data[position]);
  return value;
}
function validateComputeBudget(transaction: Transaction) {
  const seen = new Set<number>();
  let unitLimit = DEFAULT_COMPUTE_UNIT_LIMIT;
  let unitPrice = 0n;
  for (const instruction of transaction.instructions) {
    if (instruction.programId.toBase58() !== COMPUTE_BUDGET_PROGRAM) continue;
    const data = Uint8Array.from(instruction.data);
    const kind = data[0];
    if (instruction.keys.length || seen.has(kind)) throw new PaymentError('Wallet added an invalid compute-budget instruction.', 422);
    seen.add(kind);
    const value = littleEndian(data.slice(1));
    if (kind === 0 && data.length === 9) {
      const requestedUnits = littleEndian(data.slice(1, 5));
      const requestedFee = littleEndian(data.slice(5));
      if (!requestedUnits || requestedUnits > BigInt(MAX_COMPUTE_UNIT_LIMIT) || requestedFee > MAX_PRIORITY_FEE_LAMPORTS) throw new PaymentError('Wallet requested an excessive priority fee.', 422);
      unitLimit = requestedUnits;
      continue;
    }
    if (kind === 1 && data.length === 5 && value >= 32_768n && value <= BigInt(MAX_COMPUTE_HEAP_BYTES) && (value & (value - 1n)) === 0n) continue;
    if (kind === 2 && data.length === 5 && value > 0n && value <= BigInt(MAX_COMPUTE_UNIT_LIMIT)) {
      unitLimit = value;
      continue;
    }
    if (kind === 3 && data.length === 9) {
      unitPrice = value;
      continue;
    }
    if (kind === 4 && data.length === 5 && value > 0n && value <= BigInt(MAX_LOADED_ACCOUNTS_DATA_BYTES)) continue;
    throw new PaymentError('Wallet requested unsupported compute or priority-fee settings.', 422);
  }
  if ((unitLimit * unitPrice) / 1_000_000n > MAX_PRIORITY_FEE_LAMPORTS) throw new PaymentError('Wallet requested an excessive priority fee.', 422);
}
type SignedPaymentTransaction = { transaction: Transaction; signature: Uint8Array; serialized: Uint8Array };
function transactionFromMessage(message: Parameters<typeof TransactionMessage.decompile>[0]) {
  const decompiled = TransactionMessage.decompile(message);
  const transaction = new Transaction({ feePayer: decompiled.payerKey, recentBlockhash: decompiled.recentBlockhash });
  transaction.add(...decompiled.instructions);
  return transaction;
}
function decodeSignedPaymentTransaction(encoded: string): SignedPaymentTransaction {
  const serialized = Uint8Array.from(Buffer.from(encoded, 'base64'));
  try {
    const versioned = VersionedTransaction.deserialize(serialized);
    if (versioned.version === 0) {
      const message = versioned.message;
      const signature = versioned.signatures[0];
      const payer = message.staticAccountKeys[0];
      if (message.addressTableLookups.length || message.header.numRequiredSignatures !== 1 || versioned.signatures.length !== 1 || !signature || !payer || !nacl.sign.detached.verify(message.serialize(), signature, payer.toBytes())) throw new PaymentError('Wallet returned an invalid signed transaction.', 422);
      return { transaction: transactionFromMessage(message), signature, serialized };
    }
    if (versioned.version !== 'legacy') throw new PaymentError('Wallet returned an unsupported transaction version.', 422);
    const transaction = Transaction.from(Buffer.from(serialized));
    if (!transaction.verifySignatures() || !transaction.signature) throw new PaymentError('Wallet returned an invalid signed transaction.', 422);
    return { transaction, signature: Uint8Array.from(transaction.signature), serialized };
  } catch (error) {
    if (error instanceof PaymentError) throw error;
    throw new PaymentError('Wallet returned an invalid signed transaction.', 422);
  }
}
function attemptToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export function relayFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/insufficient funds for rent/i.test(message)) return 'A new recipient wallet needs a larger SOL allocation to meet Solana’s rent-exempt minimum. Increase that recipient’s amount or use an existing wallet.';
  if (/insufficient funds/i.test(message)) return 'The payer wallet does not have enough SOL for this payment and its network fee.';
  if (/blockhash|expired/i.test(message)) return 'The prepared transaction expired before Solana accepted it. Start a new payment attempt.';
  if (/rate limit|429/i.test(message)) return 'The configured Solana RPC is rate limited. Wait a moment, then retry this payment attempt.';
  return 'Solana did not acknowledge this submission yet. Check finalization before creating a new payment attempt.';
}
async function enforceRateLimit(bucket: string, limit: number, windowMs: number) {
  const now = Date.now();
  await db().prepare('INSERT INTO payment_rate_limits (bucket,window_started_at,count) VALUES (?,?,1) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN window_started_at<? THEN 1 ELSE count+1 END, window_started_at=CASE WHEN window_started_at<? THEN ? ELSE window_started_at END')
    .bind(bucket, now, now - windowMs, now - windowMs, now).run();
  const row = await db().prepare('SELECT count FROM payment_rate_limits WHERE bucket=?').bind(bucket).first<{ count: number }>();
  if (!row || row.count > limit) throw new PaymentError('Rate limit reached. Please try again later.', 429);
}
export async function handled(fn: () => Promise<unknown>) {
  try { return Response.json(await fn(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) {
    const known = error instanceof PaymentError;
    console.error(JSON.stringify({ event: 'payment_error', kind: known ? 'validation' : 'service', message: known ? error.message : 'payment service failed' }));
    return Response.json({ error: known ? error.message : 'The payment service is unavailable. Your payment is not marked paid.' }, { status: known ? error.status : 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
function deserialize(row: Record<string, unknown>): PaymentIntent {
  const recipients = (JSON.parse(row.recipients as string) as Array<Partial<Recipient>>).map((recipient, position) => ({
    position: Number.isInteger(recipient.position) ? Number(recipient.position) : position,
    label: typeof recipient.label === 'string' ? recipient.label : 'Recipient',
    address: String(recipient.address),
    percentageBps: Number(recipient.percentageBps),
    amountBaseUnits: String(recipient.amountBaseUnits),
  }));
  const network = row.network === 'mainnet-beta' ? 'mainnet-beta' : 'devnet';
  return { id: row.id as string, network, merchantWallet: row.merchant_wallet as string, title: row.title as string, description: row.description as string, asset: row.asset as Asset, amount: row.amount as string, amountBaseUnits: row.amount_base_units as string, recipients, reference: row.reference as string, expiresAt: row.expires_at as number, status: row.status as PaymentIntent['status'], transactionSignature: row.transaction_signature as string | null, payer: row.payer as string | null, createdAt: row.created_at as number, updatedAt: row.updated_at as number, paidAt: row.paid_at as number | null };
}
export function checkoutPayment(payment: PaymentIntent) {
  const verification = payment.status === 'PAID' && payment.transactionSignature ? { verified: true as const, commitment: 'finalized' as const, signature: payment.transactionSignature, explorerUrl: explorer(payment.transactionSignature, payment.network), verifiedAt: payment.paidAt } : null;
  return { id: payment.id, network: payment.network, title: payment.title, description: payment.description, asset: payment.asset, amount: payment.amount, amountBaseUnits: payment.amountBaseUnits, recipients: payment.recipients, reference: payment.reference, expiresAt: payment.expiresAt, status: payment.status, transactionSignature: payment.transactionSignature, payer: payment.payer, createdAt: payment.createdAt, paidAt: payment.paidAt, verification };
}
export async function publicSplitReceipt(id: string) {
  const payment = await getPayment(id);
  if (!isSplitPayment(payment) || payment.status !== 'PAID' || !payment.transactionSignature || !payment.payer) throw new PaymentError('Verified split receipt not found.', 404);
  return checkoutPayment(payment);
}
export async function getPayment(id: string) {
  const row = await db().prepare('SELECT * FROM payments WHERE id=?').bind(id).first<Record<string, unknown>>();
  if (!row) throw new PaymentError('Payment not found.', 404);
  if (deserialize(row).network !== paymentNetwork()) throw new PaymentError('Payment not found.', 404);
  if (Number(row.expires_at) <= Date.now() && row.status === 'ACTIVE') await db().prepare("UPDATE payments SET status='EXPIRED',updated_at=? WHERE id=? AND status='ACTIVE'").bind(Date.now(), id).run();
  const current = await db().prepare('SELECT * FROM payments WHERE id=?').bind(id).first<Record<string, unknown>>();
  const payment = deserialize(current!);
  if (payment.network !== paymentNetwork()) throw new PaymentError('Payment not found.', 404);
  return payment;
}
function recipientsFromInput(input: Record<string, unknown>, total: bigint): Recipient[] {
  const requested: SplitRecipient[] = Array.isArray(input.recipients)
    ? input.recipients.map((recipient) => {
      if (!recipient || typeof recipient !== 'object') throw new PaymentError('Recipients must be valid objects.');
      const value = recipient as Record<string, unknown>;
      if (typeof value.label !== 'string' || typeof value.wallet !== 'string' || !Number.isInteger(value.bps)) throw new PaymentError('Recipients must include a label, wallet, and integer basis-point allocation.');
      return { label: value.label, wallet: value.wallet, bps: value.bps as number };
    })
    : [{ label: 'Recipient', wallet: input.recipient as string, bps: 10_000 }];
  let normalized: SplitRecipient[];
  try { normalized = validateRecipients(requested); } catch (error) { throw new PaymentError(error instanceof Error ? error.message : 'Invalid recipient allocation.'); }
  const allocated = allocate(total, normalized.map((recipient) => recipient.bps));
  return normalized.map((recipient, position) => ({ position, label: recipient.label, address: recipient.wallet, percentageBps: recipient.bps, amountBaseUnits: allocated[position].toString() }));
}
export async function createPayment(req: Request) {
  const origin = sameOrigin(req);
  const network = paymentNetwork();
  assertSettlementEnabled();
  const body = await jsonBody(req);
  if (typeof body.payload !== 'string' || typeof body.signature !== 'string') throw new PaymentError('A signed payment request is required.');
  let input: Record<string, unknown>;
  try { input = JSON.parse(body.payload) as Record<string, unknown>; } catch { throw new PaymentError('Invalid payment request.'); }
  const merchant = address(input.merchantWallet);
  verifySignature(merchant, creationMessage(body.payload, network), body.signature);
  const existing = await db().prepare('SELECT id FROM payments WHERE creation_key=?').bind(body.signature).first<{ id: string }>();
  if (existing) return getPayment(existing.id);
  if (input.origin !== origin || !Number.isSafeInteger(input.timestamp) || Math.abs(Date.now() - Number(input.timestamp)) > 300_000) throw new PaymentError('Request expired. Sign a fresh request.');
  const limits = policy();
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > limits.maxTitleLength) throw new PaymentError('A title is required and exceeds the allowed length.');
  if (typeof input.description !== 'string' || input.description.length > limits.maxDescriptionLength) throw new PaymentError('Description exceeds the allowed length.');
  if (typeof input.reference !== 'string' || input.reference.length > limits.maxReferenceLength) throw new PaymentError('Reference exceeds the allowed length.');
  if (input.asset !== 'SOL' && input.asset !== 'USDC') throw new PaymentError('Choose SOL or USDC.');
  const asset = input.asset as Asset;
  if (!NETWORKS[network].supportsUsdc && asset !== 'SOL') throw new PaymentError('Mainnet Beta currently supports SOL payment links only.', 422);
  let amount: bigint;
  try { amount = toBaseUnits(String(input.amount), ASSETS[asset].decimals); } catch (error) { throw new PaymentError(error instanceof Error ? error.message : 'Invalid payment amount.'); }
  if (network === 'mainnet-beta' && amount > mainnetMaxSolLamports()) throw new PaymentError('Mainnet Beta payment links are limited to 0.1 SOL.', 422);
  let recipients: Recipient[];
  try { recipients = recipientsFromInput(input, amount); } catch (error) {
    if (Array.isArray(input.recipients)) logSplitValidationFailure(network, 'invalid_recipients');
    throw error;
  }
  assertSettlementEnabled({ network, recipients });
  const now = Date.now();
  if (!Number.isSafeInteger(input.expiresAt) || Number(input.expiresAt) < now + limits.minExpiryMs || Number(input.expiresAt) > now + limits.maxExpiryMs) throw new PaymentError('Expiration is outside the permitted range.');
  await enforceRateLimit('create:' + merchant, limits.creationPerHour, 3_600_000);
  const id = crypto.randomUUID();
  await db().prepare('INSERT INTO payments (id,network,merchant_wallet,title,description,asset,amount,amount_base_units,recipients,reference,expires_at,status,created_at,updated_at,creation_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(creation_key) DO NOTHING')
    .bind(id, network, merchant, input.title.trim(), input.description, asset, String(input.amount), amount.toString(), JSON.stringify(recipients), input.reference, input.expiresAt, 'ACTIVE', now, now, body.signature).run();
  const saved = await db().prepare('SELECT id FROM payments WHERE creation_key=?').bind(body.signature).first<{ id: string }>();
  if (!saved) throw new PaymentError('Payment could not be stored.', 503);
  logEvent('payment_created', { paymentId: id, asset, amount: amount.toString(), recipientCount: recipients.length, split: recipients.length > 1 });
  logSplitEvent(network, 'created', { paymentId: saved.id, asset, amount: amount.toString(), recipientCount: recipients.length, split: recipients.length > 1 });
  return getPayment(saved.id);
}
export async function listPayments(req: Request) {
  const wallet = address(new URL(req.url).searchParams.get('wallet'));
  const stamp = Number(req.headers.get('x-auno-timestamp'));
  if (!Number.isSafeInteger(stamp) || Math.abs(Date.now() - stamp) > 300_000) throw new PaymentError('Connect and authorize payment history again.', 401);
  verifySignature(wallet, historyMessage(wallet, stamp, publicOrigin(req), paymentNetwork()), req.headers.get('x-auno-signature') || '');
  const rows = await db().prepare('SELECT * FROM payments WHERE merchant_wallet=? AND network=? ORDER BY created_at DESC LIMIT 200').bind(wallet, paymentNetwork()).all<Record<string, unknown>>();
  return { payments: rows.results.map(deserialize) };
}
async function getAttempt(id: string, attemptId: unknown, token: unknown) {
  if (typeof attemptId !== 'string' || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new PaymentError('A valid attempt secret is required.', 401);
  const attempt = await db().prepare('SELECT * FROM payment_attempts WHERE id=? AND payment_id=?').bind(attemptId, id).first<Attempt>();
  if (!attempt || await sha256(token) !== attempt.attempt_token_hash) throw new PaymentError('Payment attempt not found.', 404);
  return attempt;
}
async function buildTransaction(payment: PaymentIntent, payer: string, attemptId: string, blockhash: string) {
  const from = new PublicKey(payer);
  const transaction = new Transaction();
  if (payment.asset === 'SOL') {
    for (const recipient of payment.recipients) transaction.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: new PublicKey(recipient.address), lamports: BigInt(recipient.amountBaseUnits) }));
  } else {
    const mint = new PublicKey(ASSETS.USDC.mint);
    for (const recipient of payment.recipients) {
      const owner = new PublicKey(recipient.address);
      const destination = await getAssociatedTokenAddress(mint, owner);
      const source = await getAssociatedTokenAddress(mint, from);
      transaction.add(createAssociatedTokenAccountIdempotentInstruction(from, destination, owner, mint));
      transaction.add(createTransferCheckedInstruction(source, mint, destination, from, BigInt(recipient.amountBaseUnits), ASSETS.USDC.decimals));
    }
  }
  transaction.add(new TransactionInstruction({ programId: new PublicKey(MEMO_PROGRAM), keys: [{ pubkey: from, isSigner: true, isWritable: false }], data: Buffer.from('auno:' + payment.id + ':' + attemptId) }));
  transaction.feePayer = from;
  transaction.recentBlockhash = blockhash;
  return transaction;
}
async function assertPayerHasFeeBudget(c: Connection, payment: PaymentIntent, payer: string, transaction: Transaction) {
  const fee = await c.getFeeForMessage(transaction.compileMessage(), 'confirmed');
  if (fee.value === null) throw new PaymentError('Could not estimate the Solana network fee. Please retry.', 503);
  const requiredLamports = BigInt(fee.value) + (payment.asset === 'SOL' ? BigInt(payment.amountBaseUnits) : 0n);
  const availableLamports = BigInt(await c.getBalance(new PublicKey(payer), 'confirmed'));
  if (availableLamports < requiredLamports) {
    throw new PaymentError(`Insufficient SOL. This payment needs at least ${displayUnits(requiredLamports, ASSETS.SOL.decimals)} SOL including network fees; the connected wallet has ${displayUnits(availableLamports, ASSETS.SOL.decimals)} SOL.`, 422);
  }
}
export async function preparePayment(req: Request, id: string) {
  sameOrigin(req);
  assertSettlementEnabled();
  const body = await jsonBody(req);
  const payer = address(body.payer);
  const payment = await getPayment(id);
  assertSettlementEnabled(payment);
  if (payment.status !== 'ACTIVE') throw new PaymentError('This payment is not available for a new attempt.', 409);
  if (payment.recipients.some((recipient) => recipient.address === payer)) {
    logSplitValidationFailure(payment.network, 'payer_is_recipient', { paymentId: id, payer, recipientCount: payment.recipients.length });
    throw new PaymentError('Payer and recipient must be different wallets.');
  }
  const limits = policy();
  await enforceRateLimit('attempt:payment:' + id, limits.attemptsPerPaymentWindow, limits.attemptWindowMs);
  await enforceRateLimit('attempt:payer:' + payer, limits.attemptsPerPayerWindow, limits.attemptWindowMs);
  await enforceRateLimit('attempt:source:' + sourceBucket(req), limits.attemptsPerSourceWindow, limits.attemptWindowMs);
  const c = connection();
  await assertNetwork(c);
  const attemptId = crypto.randomUUID();
  const secret = attemptToken();
  const block = await c.getLatestBlockhash('confirmed');
  const transaction = await buildTransaction(payment, payer, attemptId, block.blockhash);
  await assertPayerHasFeeBudget(c, payment, payer, transaction);
  const messageHash = await preparedMessageHash(transaction);
  const now = Date.now();
  await db().prepare('INSERT INTO payment_attempts (id,payment_id,payer,message_hash,attempt_token_hash,last_valid_block_height,created_at,updated_at,status) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(attemptId, id, payer, messageHash, await sha256(secret), block.lastValidBlockHeight, now, now, 'PREPARED').run();
  logEvent('payment_prepared', { paymentId: id, attemptId, recipientCount: payment.recipients.length, split: isSplitPayment(payment) });
  logSplitEvent(payment.network, 'prepared', { paymentId: id, attemptId, recipientCount: payment.recipients.length, split: isSplitPayment(payment) });
  return { attemptId, attemptToken: secret, transaction: transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64'), network: payment.network, lastValidBlockHeight: block.lastValidBlockHeight };
}
export async function submitPayment(req: Request, id: string) {
  sameOrigin(req);
  assertSettlementEnabled();
  const body = await jsonBody(req);
  if (typeof body.transaction !== 'string' || body.transaction.length > 8_000) throw new PaymentError('Invalid signed transaction.');
  const attempt = await getAttempt(id, body.attemptId, body.attemptToken);
  const payment = await getPayment(id);
  assertSettlementEnabled(payment);
  if (payment.status !== 'ACTIVE') throw new PaymentError('This payment is no longer available.', 409);
  if (attempt.status !== 'PREPARED') throw new PaymentError('This attempt is no longer ready for submission.', 409);
  let signed: SignedPaymentTransaction;
  try {
    signed = decodeSignedPaymentTransaction(body.transaction);
    if (!await matchesPreparedMessage(payment, attempt, signed.transaction)) throw new Error();
    validateComputeBudget(signed.transaction);
  } catch (error) {
    logEvent('payment_submission_rejected', { paymentId: id, attemptId: attempt.id, reason: error instanceof PaymentError ? 'wallet_validation' : 'prepared_message_mismatch' });
    if (error instanceof PaymentError) throw error;
    throw new PaymentError('Signed transaction differs from the prepared payment.', 422);
  }
  const transaction = signed.transaction;
  const c = connection();
  await assertNetwork(c);
  if (await c.getBlockHeight('confirmed') > attempt.last_valid_block_height) {
    await db().prepare("UPDATE payment_attempts SET status='EXPIRED',updated_at=? WHERE id=? AND status='PREPARED'").bind(Date.now(), attempt.id).run();
    throw new PaymentError('This prepared transaction has expired. Start a fresh attempt.', 409);
  }
  await assertPayerHasFeeBudget(c, payment, attempt.payer, transaction);
  const signature = bs58.encode(signed.signature);
  const claim = await db().prepare("UPDATE payment_attempts SET signature=?,status='SUBMITTED',updated_at=? WHERE id=? AND status='PREPARED'").bind(signature, Date.now(), attempt.id).run();
  if (!claim.meta.changes) throw new PaymentError('This attempt has already been submitted.', 409);
  try { await c.sendRawTransaction(signed.serialized, { skipPreflight: false, maxRetries: 2 }); }
  catch (error) { logEvent('payment_submission_uncertain', { paymentId: id, attemptId: attempt.id, recipientCount: payment.recipients.length, split: isSplitPayment(payment) }); logSplitEvent(payment.network, 'submitted', { paymentId: id, attemptId: attempt.id, signature, recipientCount: payment.recipients.length, split: isSplitPayment(payment), relay: 'uncertain' }); return { attemptId: attempt.id, signature, status: 'SUBMITTED', message: relayFailureMessage(error) }; }
  logEvent('payment_submitted', { paymentId: id, attemptId: attempt.id, signature, recipientCount: payment.recipients.length, split: isSplitPayment(payment) });
  logSplitEvent(payment.network, 'submitted', { paymentId: id, attemptId: attempt.id, signature, recipientCount: payment.recipients.length, split: isSplitPayment(payment) });
  return { attemptId: attempt.id, signature, status: 'SUBMITTED' };
}
async function checkInstructions(payment: PaymentIntent, attempt: Attempt, parsed: { transaction: { message: { accountKeys: Array<{ pubkey: PublicKey; signer: boolean }>; instructions: Array<{ programId: PublicKey; parsed?: unknown }> } }; meta: { postTokenBalances?: Array<{ accountIndex: number; owner?: string; mint?: string }> | null } }) {
  const instructions = parsed.transaction.message.instructions;
  const payer = attempt.payer;
  const allowed = payment.asset === 'SOL' ? new Set([SystemProgram.programId.toBase58(), MEMO_PROGRAM, COMPUTE_BUDGET_PROGRAM]) : new Set([TOKEN_PROGRAM_ID.toBase58(), ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(), MEMO_PROGRAM, COMPUTE_BUDGET_PROGRAM]);
  if (instructions.some((instruction) => !allowed.has(instruction.programId.toBase58()))) throw new PaymentError('Transaction includes an unexpected instruction.');
  const computeInstructions = instructions.filter((instruction) => instruction.programId.toBase58() === COMPUTE_BUDGET_PROGRAM);
  if (computeInstructions.length > 4) throw new PaymentError('Transaction instruction count is invalid.');
  let unitLimit = DEFAULT_COMPUTE_UNIT_LIMIT;
  let unitPrice = 0n;
  const seenComputeTypes = new Set<string>();
  for (const instruction of computeInstructions) {
    const parsedInstruction = instruction.parsed as { type?: string; info?: Record<string, unknown> };
    const type = parsedInstruction?.type || '';
    const info = parsedInstruction?.info || {};
    if (!type || seenComputeTypes.has(type)) throw new PaymentError('Wallet requested unsupported or unsafe compute settings.');
    seenComputeTypes.add(type);
    if (type === 'setComputeUnitLimit') {
      const units = BigInt(Number(info.units) || 0);
      if (units <= 0n || units > BigInt(MAX_COMPUTE_UNIT_LIMIT)) throw new PaymentError('Wallet requested unsupported or unsafe compute settings.');
      unitLimit = units;
      continue;
    }
    if (type === 'setComputeUnitPrice') {
      const price = BigInt(String(info.microLamports || '0'));
      if (price < 0n) throw new PaymentError('Wallet requested unsupported or unsafe compute settings.');
      unitPrice = price;
      continue;
    }
    if (type === 'requestHeapFrame') {
      const bytes = BigInt(Number(info.bytes) || 0);
      if (bytes < 32_768n || bytes > BigInt(MAX_COMPUTE_HEAP_BYTES) || (bytes & (bytes - 1n)) !== 0n) throw new PaymentError('Wallet requested unsupported or unsafe compute settings.');
      continue;
    }
    if (type === 'setLoadedAccountsDataSizeLimit') {
      const bytes = BigInt(Number(info.accountDataSizeLimitBytes) || 0);
      if (bytes <= 0n || bytes > BigInt(MAX_LOADED_ACCOUNTS_DATA_BYTES)) throw new PaymentError('Wallet requested unsupported or unsafe compute settings.');
      continue;
    }
    if (type === 'requestUnits' || type === 'requestUnitsDeprecated') {
      const units = BigInt(Number(info.units) || 0);
      const additionalFee = BigInt(Number(info.additionalFee) || 0);
      if (units <= 0n || units > BigInt(MAX_COMPUTE_UNIT_LIMIT) || additionalFee > MAX_PRIORITY_FEE_LAMPORTS) throw new PaymentError('Wallet requested unsupported or unsafe compute settings.');
      unitLimit = units;
      continue;
    }
    throw new PaymentError('Wallet requested unsupported or unsafe compute settings.');
  }
  if ((unitLimit * unitPrice) / 1_000_000n > MAX_PRIORITY_FEE_LAMPORTS) throw new PaymentError('Wallet requested unsupported or unsafe compute settings.');
  const signers = parsed.transaction.message.accountKeys.filter((key) => key.signer).map((key) => key.pubkey.toBase58());
  if (signers.length !== 1 || signers[0] !== payer || parsed.transaction.message.accountKeys[0]?.pubkey.toBase58() !== payer) throw new PaymentError('Transaction payer or signer set is invalid.');
  const memo = 'auno:' + payment.id + ':' + attempt.id;
  if (instructions.filter((instruction) => instruction.programId.toBase58() === MEMO_PROGRAM && instruction.parsed === memo).length < 1) throw new PaymentError('Payment reference is missing.');
  const transfers = instructions.filter((instruction) => instruction.programId.toBase58() === (payment.asset === 'SOL' ? SystemProgram.programId.toBase58() : TOKEN_PROGRAM_ID.toBase58()));
  const associatedCreations = instructions.filter((instruction) => instruction.programId.toBase58() === ASSOCIATED_TOKEN_PROGRAM_ID.toBase58());
  if (transfers.length < payment.recipients.length) throw new PaymentError('Expected transfers are missing.');
  if (payment.asset === 'SOL') {
    const recipientAddresses = new Set(payment.recipients.map((recipient) => recipient.address));
    const recipientAmounts = new Map(payment.recipients.map((recipient) => [recipient.address, recipient.amountBaseUnits]));
    for (const instruction of transfers) {
      const parsedInstruction = instruction.parsed as { type?: string; info?: Record<string, unknown> };
      const info = parsedInstruction?.info || {};
      if (parsedInstruction.type !== 'transfer') throw new PaymentError('Transaction includes an unexpected transfer instruction.');
      if (info.source !== payer) throw new PaymentError('Transaction includes an unexpected transfer instruction.');
      const destination = String(info.destination);
      if (recipientAddresses.has(destination)) {
        if (String(info.lamports) !== recipientAmounts.get(destination)) throw new PaymentError('Recipient transfer amount is incorrect.');
      } else if (!JITO_TIP_ACCOUNTS.has(destination)) {
        throw new PaymentError('Transaction includes an unexpected transfer instruction.');
      }
    }
  } else if (transfers.length !== payment.recipients.length) throw new PaymentError('Expected transfers are missing.');
  for (const recipient of payment.recipients) {
    const destination = payment.asset === 'USDC' ? await getAssociatedTokenAddress(new PublicKey(ASSETS.USDC.mint), new PublicKey(recipient.address)) : null;
    const source = payment.asset === 'USDC' ? await getAssociatedTokenAddress(new PublicKey(ASSETS.USDC.mint), new PublicKey(payer)) : null;
    const found = transfers.filter((instruction) => {
      const parsedInstruction = instruction.parsed as { type?: string; info?: Record<string, unknown> };
      const info = parsedInstruction?.info || {};
      if (payment.asset === 'SOL') return parsedInstruction.type === 'transfer' && info.source === payer && info.destination === recipient.address && String(info.lamports) === recipient.amountBaseUnits;
      return parsedInstruction.type === 'transferChecked' && info.source === source!.toBase58() && info.destination === destination!.toBase58() && info.authority === payer && info.mint === ASSETS.USDC.mint && String((info.tokenAmount as { amount?: string } | undefined)?.amount) === recipient.amountBaseUnits && Number((info.tokenAmount as { decimals?: number } | undefined)?.decimals) === ASSETS.USDC.decimals;
    });
    if (found.length !== 1) throw new PaymentError('Each recipient must receive exactly one intended transfer.');
    if (payment.asset === 'USDC') {
      const creation = associatedCreations.filter((instruction) => {
        const parsedInstruction = instruction.parsed as { type?: string; info?: Record<string, unknown> };
        const info = parsedInstruction?.info || {};
        return parsedInstruction.type === 'createIdempotent' && info.source === payer && info.account === destination!.toBase58() && info.wallet === recipient.address && info.mint === ASSETS.USDC.mint;
      });
      if (creation.length !== 1) throw new PaymentError('Each USDC recipient requires the expected token-account instruction.');
      const accountIndex = parsed.transaction.message.accountKeys.findIndex((key) => key.pubkey.toBase58() === destination!.toBase58());
      const balance = parsed.meta.postTokenBalances?.filter((entry) => entry.accountIndex === accountIndex && entry.owner === recipient.address && entry.mint === ASSETS.USDC.mint) || [];
      if (accountIndex < 0 || balance.length !== 1) throw new PaymentError('USDC recipient token-account ownership could not be verified.');
    }
  }
}
async function rpcWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); }
  catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!/abort|timeout|fetch failed|ETIMEDOUT|ECONNRESET/i.test(message)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    return fn();
  }
}
async function verifyAttempt(payment: PaymentIntent, attempt: Attempt) {
  if (payment.status === 'PAID') return checkoutPayment(payment);
  if (!attempt.signature) return { status: attempt.status, signature: null };
  const c = connection();
  await assertNetwork(c);
  const parsed = await rpcWithRetry(() => c.getParsedTransaction(attempt.signature!, { commitment: 'finalized', maxSupportedTransactionVersion: 0 }));
  if (!parsed) {
    const status = await c.getSignatureStatus(attempt.signature, { searchTransactionHistory: true });
    const nextStatus = status.value?.err ? 'REJECTED' : 'CONFIRMING';
    await db().prepare('UPDATE payment_attempts SET status=?,updated_at=? WHERE id=?').bind(nextStatus, Date.now(), attempt.id).run();
    if (nextStatus === 'REJECTED') {
      logEvent('payment_rejected', { paymentId: payment.id, attemptId: attempt.id });
      logSplitEvent(payment.network, 'rejected', { paymentId: payment.id, attemptId: attempt.id, recipientCount: payment.recipients.length, split: isSplitPayment(payment), reason: 'onchain_failure' });
    }
    return { status: nextStatus, signature: attempt.signature };
  }
  if (parsed.meta?.err || !parsed.meta || !parsed.blockTime || parsed.blockTime * 1_000 < payment.createdAt - 60_000 || parsed.blockTime * 1_000 > payment.expiresAt + 30_000) {
    await db().prepare("UPDATE payment_attempts SET status='REJECTED',updated_at=? WHERE id=? AND status IN ('SUBMITTED','CONFIRMING')").bind(Date.now(), attempt.id).run();
    logEvent('payment_rejected', { paymentId: payment.id, attemptId: attempt.id });
    logSplitEvent(payment.network, 'rejected', { paymentId: payment.id, attemptId: attempt.id, recipientCount: payment.recipients.length, split: isSplitPayment(payment), reason: 'outside_payment_window' });
    throw new PaymentError('Transaction failed or falls outside the payment window.');
  }
  const raw = await rpcWithRetry(() => c.getTransaction(attempt.signature!, { commitment: 'finalized', maxSupportedTransactionVersion: 0 }));
  let finalized: Transaction | null = null;
  try { if (raw?.transaction) finalized = transactionFromMessage(raw.transaction.message); } catch { /* rejected below */ }
  if (!finalized || !await matchesPreparedMessage(payment, attempt, finalized)) {
    await db().prepare("UPDATE payment_attempts SET status='REJECTED',updated_at=? WHERE id=? AND status IN ('SUBMITTED','CONFIRMING')").bind(Date.now(), attempt.id).run();
    logEvent('payment_rejected', { paymentId: payment.id, attemptId: attempt.id });
    logSplitEvent(payment.network, 'rejected', { paymentId: payment.id, attemptId: attempt.id, recipientCount: payment.recipients.length, split: isSplitPayment(payment), reason: 'prepared_message_mismatch' });
    throw new PaymentError('Finalized transaction differs from the prepared payment.');
  }
  try {
    await checkInstructions(payment, attempt, parsed as unknown as Parameters<typeof checkInstructions>[2]);
  } catch (error) {
    await db().prepare("UPDATE payment_attempts SET status='REJECTED',updated_at=? WHERE id=? AND status IN ('SUBMITTED','CONFIRMING')").bind(Date.now(), attempt.id).run();
    logEvent('payment_rejected', { paymentId: payment.id, attemptId: attempt.id, recipientCount: payment.recipients.length, split: isSplitPayment(payment) });
    logSplitEvent(payment.network, 'rejected', { paymentId: payment.id, attemptId: attempt.id, recipientCount: payment.recipients.length, split: isSplitPayment(payment), reason: error instanceof PaymentError ? error.message : 'instruction_validation' });
    throw error;
  }
  const paid = await db().prepare("UPDATE payments SET status='PAID',transaction_signature=?,payer=?,paid_at=?,updated_at=? WHERE id=? AND status='ACTIVE'").bind(attempt.signature, attempt.payer, parsed.blockTime * 1_000, Date.now(), payment.id).run();
  if (paid.meta.changes) await db().prepare("UPDATE payment_attempts SET status='VERIFIED',updated_at=? WHERE id=?").bind(Date.now(), attempt.id).run();
  if (paid.meta.changes) {
    logEvent('payment_verified', { paymentId: payment.id, attemptId: attempt.id, signature: attempt.signature, recipientCount: payment.recipients.length, split: isSplitPayment(payment), commitment: 'finalized' });
    logSplitEvent(payment.network, 'verified', { paymentId: payment.id, attemptId: attempt.id, signature: attempt.signature, recipientCount: payment.recipients.length, split: isSplitPayment(payment), commitment: 'finalized' });
  }
  return checkoutPayment(await getPayment(payment.id));
}
export async function verifyPayment(id: string, attemptId: unknown, token: unknown) {
  const attempt = await getAttempt(id, attemptId, token);
  return verifyAttempt(await getPayment(id), attempt);
}
function verifierBatchSize() {
  const configured = runtime().AUNO_VERIFIER_BATCH_SIZE || '25';
  if (!/^\d+$/.test(configured)) throw new PaymentError('Verifier batch deployment setting is invalid.', 503);
  const value = Number(configured);
  if (!Number.isSafeInteger(value) || value < 1 || value > 100) throw new PaymentError('Verifier batch deployment setting is invalid.', 503);
  return value;
}
export async function verifyPendingPayments() {
  const attempts = await db().prepare("SELECT payment_attempts.* FROM payment_attempts INNER JOIN payments ON payments.id=payment_attempts.payment_id WHERE payments.network=? AND payment_attempts.signature IS NOT NULL AND payment_attempts.status IN ('SUBMITTED','CONFIRMING') ORDER BY payment_attempts.updated_at ASC LIMIT ?").bind(paymentNetwork(), verifierBatchSize()).all<Attempt>();
  let verified = 0;
  let failed = 0;
  let splitChecked = 0;
  let splitVerified = 0;
  let splitFailed = 0;
  for (const attempt of attempts.results) {
    try {
      const payment = await getPayment(attempt.payment_id);
      const split = isSplitPayment(payment);
      if (split) splitChecked += 1;
      const result = await verifyAttempt(payment, attempt);
      if (result.status === 'PAID') {
        verified += 1;
        if (split) splitVerified += 1;
      }
    } catch (error) {
      failed += 1;
      const payment = await getPayment(attempt.payment_id).catch(() => null);
      if (payment && isSplitPayment(payment)) splitFailed += 1;
      console.error(JSON.stringify({ event: 'payment_verifier_failure', network: paymentNetwork(), paymentId: attempt.payment_id, attemptId: attempt.id, message: error instanceof PaymentError ? error.message : 'verification failed' }));
    }
  }
  logEvent('payment_verifier_completed', { checked: attempts.results.length, verified, failed, splitChecked, splitVerified, splitFailed });
  return { checked: attempts.results.length, verified, failed, splitChecked, splitVerified, splitFailed };
}
export async function publicAttempt(req: Request, id: string, attemptId: string) {
  const token = new URL(req.url).searchParams.get('attemptToken') || req.headers.get('x-auno-attempt-token');
  const attempt = await getAttempt(id, attemptId, token);
  if (attempt.status === 'SUBMITTED' || attempt.status === 'CONFIRMING') return verifyPayment(id, attemptId, token);
  return { attemptId: attempt.id, status: attempt.status, signature: attempt.signature };
}
export async function abandonAttempt(req: Request, id: string) {
  sameOrigin(req);
  const body = await jsonBody(req);
  const attempt = await getAttempt(id, body.attemptId, body.attemptToken);
  if (attempt.status !== 'PREPARED') throw new PaymentError('Only unsigned prepared attempts can be abandoned.', 409);
  await db().prepare("UPDATE payment_attempts SET status='ABANDONED',updated_at=? WHERE id=? AND status='PREPARED'").bind(Date.now(), attempt.id).run();
  return { attemptId: attempt.id, status: 'ABANDONED' };
}
