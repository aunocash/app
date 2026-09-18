import { env } from 'cloudflare:workers';
import { ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { ASSETS, DEVNET_RPC, MEMO_PROGRAM, allocate, creationMessage, historyMessage, toBaseUnits, validateRecipients, type Asset, type PaymentIntent, type Recipient, type SplitRecipient } from './model';
import { paymentPolicy } from './policy';

export class PaymentError extends Error { constructor(message: string, public status = 400) { super(message); } }
type Runtime = Record<string, unknown> & { DB?: D1Database; SOLANA_RPC_URL?: string; SOLANA_NETWORK?: string; AUNO_TRUSTED_CLIENT_HEADER?: string };
type Attempt = { id: string; payment_id: string; payer: string; message_hash: string; attempt_token_hash: string; last_valid_block_height: number; signature: string | null; status: string };

function runtime() { return env as unknown as Runtime; }
function policy() { try { return paymentPolicy(runtime()); } catch { throw new PaymentError('Payment deployment settings are invalid.', 503); } }
export function db(): D1Database { const database = runtime().DB; if (!database) throw new PaymentError('Payment storage is unavailable. Please try again later.', 503); return database; }
export function connection() {
  if (runtime().SOLANA_NETWORK && runtime().SOLANA_NETWORK !== 'devnet') throw new PaymentError('Mainnet is disabled in this release.', 503);
  return new Connection(runtime().SOLANA_RPC_URL || DEVNET_RPC, { commitment: 'confirmed', disableRetryOnRateLimit: true, fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }) });
}
export async function assertDevnet(c: Connection) { if (await c.getGenesisHash() !== 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG') throw new PaymentError('RPC network mismatch. Devnet is required.', 503); }
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
  const expected = isLocal(requestUrl) ? requestUrl.origin : 'https://auno.cash';
  if (origin !== expected) throw new PaymentError('This request must originate from AUNO.', 403);
  return expected;
}
function publicOrigin(req: Request) { return isLocal(new URL(req.url)) ? new URL(req.url).origin : 'https://auno.cash'; }
function sourceBucket(req: Request) {
  const header = runtime().AUNO_TRUSTED_CLIENT_HEADER;
  if (typeof header === 'string' && /^[a-z0-9-]{1,64}$/i.test(header)) return req.headers.get(header) || 'anonymous';
  return 'anonymous';
}
async function sha256(value: Uint8Array | string) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
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
  return { id: row.id as string, merchantWallet: row.merchant_wallet as string, title: row.title as string, description: row.description as string, asset: row.asset as Asset, amount: row.amount as string, amountBaseUnits: row.amount_base_units as string, recipients, reference: row.reference as string, expiresAt: row.expires_at as number, status: row.status as PaymentIntent['status'], transactionSignature: row.transaction_signature as string | null, payer: row.payer as string | null, createdAt: row.created_at as number, updatedAt: row.updated_at as number, paidAt: row.paid_at as number | null };
}
export function checkoutPayment(payment: PaymentIntent) {
  return { id: payment.id, title: payment.title, description: payment.description, asset: payment.asset, amount: payment.amount, amountBaseUnits: payment.amountBaseUnits, recipients: payment.recipients, reference: payment.reference, expiresAt: payment.expiresAt, status: payment.status, transactionSignature: payment.transactionSignature, payer: payment.payer, createdAt: payment.createdAt, paidAt: payment.paidAt };
}
export async function getPayment(id: string) {
  const row = await db().prepare('SELECT * FROM payments WHERE id=?').bind(id).first<Record<string, unknown>>();
  if (!row) throw new PaymentError('Payment not found.', 404);
  if (Number(row.expires_at) <= Date.now() && row.status === 'ACTIVE') await db().prepare("UPDATE payments SET status='EXPIRED',updated_at=? WHERE id=? AND status='ACTIVE'").bind(Date.now(), id).run();
  const current = await db().prepare('SELECT * FROM payments WHERE id=?').bind(id).first<Record<string, unknown>>();
  return deserialize(current!);
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
  const body = await jsonBody(req);
  if (typeof body.payload !== 'string' || typeof body.signature !== 'string') throw new PaymentError('A signed payment request is required.');
  let input: Record<string, unknown>;
  try { input = JSON.parse(body.payload) as Record<string, unknown>; } catch { throw new PaymentError('Invalid payment request.'); }
  const merchant = address(input.merchantWallet);
  verifySignature(merchant, creationMessage(body.payload), body.signature);
  const existing = await db().prepare('SELECT id FROM payments WHERE creation_key=?').bind(body.signature).first<{ id: string }>();
  if (existing) return getPayment(existing.id);
  if (input.origin !== origin || !Number.isSafeInteger(input.timestamp) || Math.abs(Date.now() - Number(input.timestamp)) > 300_000) throw new PaymentError('Request expired. Sign a fresh request.');
  const limits = policy();
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > limits.maxTitleLength) throw new PaymentError('A title is required and exceeds the allowed length.');
  if (typeof input.description !== 'string' || input.description.length > limits.maxDescriptionLength) throw new PaymentError('Description exceeds the allowed length.');
  if (typeof input.reference !== 'string' || input.reference.length > limits.maxReferenceLength) throw new PaymentError('Reference exceeds the allowed length.');
  if (input.asset !== 'SOL' && input.asset !== 'USDC') throw new PaymentError('Choose SOL or USDC.');
  const asset = input.asset as Asset;
  let amount: bigint;
  try { amount = toBaseUnits(String(input.amount), ASSETS[asset].decimals); } catch (error) { throw new PaymentError(error instanceof Error ? error.message : 'Invalid payment amount.'); }
  const recipients = recipientsFromInput(input, amount);
  const now = Date.now();
  if (!Number.isSafeInteger(input.expiresAt) || Number(input.expiresAt) < now + limits.minExpiryMs || Number(input.expiresAt) > now + limits.maxExpiryMs) throw new PaymentError('Expiration is outside the permitted range.');
  await enforceRateLimit('create:' + merchant, limits.creationPerHour, 3_600_000);
  const id = crypto.randomUUID();
  await db().prepare('INSERT INTO payments (id,merchant_wallet,title,description,asset,amount,amount_base_units,recipients,reference,expires_at,status,created_at,updated_at,creation_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(creation_key) DO NOTHING')
    .bind(id, merchant, input.title.trim(), input.description, asset, String(input.amount), amount.toString(), JSON.stringify(recipients), input.reference, input.expiresAt, 'ACTIVE', now, now, body.signature).run();
  const saved = await db().prepare('SELECT id FROM payments WHERE creation_key=?').bind(body.signature).first<{ id: string }>();
  if (!saved) throw new PaymentError('Payment could not be stored.', 503);
  return getPayment(saved.id);
}
export async function listPayments(req: Request) {
  const wallet = address(new URL(req.url).searchParams.get('wallet'));
  const stamp = Number(req.headers.get('x-auno-timestamp'));
  if (!Number.isSafeInteger(stamp) || Math.abs(Date.now() - stamp) > 300_000) throw new PaymentError('Connect and authorize payment history again.', 401);
  verifySignature(wallet, historyMessage(wallet, stamp, publicOrigin(req)), req.headers.get('x-auno-signature') || '');
  const rows = await db().prepare('SELECT * FROM payments WHERE merchant_wallet=? ORDER BY created_at DESC LIMIT 200').bind(wallet).all<Record<string, unknown>>();
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
export async function preparePayment(req: Request, id: string) {
  sameOrigin(req);
  const body = await jsonBody(req);
  const payer = address(body.payer);
  const payment = await getPayment(id);
  if (payment.status !== 'ACTIVE') throw new PaymentError('This payment is not available for a new attempt.', 409);
  if (payment.recipients.some((recipient) => recipient.address === payer)) throw new PaymentError('Payer and recipient must be different wallets.');
  const limits = policy();
  await enforceRateLimit('attempt:payment:' + id, limits.attemptsPerPaymentWindow, limits.attemptWindowMs);
  await enforceRateLimit('attempt:payer:' + payer, limits.attemptsPerPayerWindow, limits.attemptWindowMs);
  await enforceRateLimit('attempt:source:' + sourceBucket(req), limits.attemptsPerSourceWindow, limits.attemptWindowMs);
  const c = connection();
  await assertDevnet(c);
  const attemptId = crypto.randomUUID();
  const secret = attemptToken();
  const block = await c.getLatestBlockhash('confirmed');
  const transaction = await buildTransaction(payment, payer, attemptId, block.blockhash);
  const messageHash = await sha256(transaction.serializeMessage());
  const now = Date.now();
  await db().prepare('INSERT INTO payment_attempts (id,payment_id,payer,message_hash,attempt_token_hash,last_valid_block_height,created_at,updated_at,status) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(attemptId, id, payer, messageHash, await sha256(secret), block.lastValidBlockHeight, now, now, 'PREPARED').run();
  return { attemptId, attemptToken: secret, transaction: transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64'), network: 'devnet', lastValidBlockHeight: block.lastValidBlockHeight };
}
export async function submitPayment(req: Request, id: string) {
  sameOrigin(req);
  const body = await jsonBody(req);
  if (typeof body.transaction !== 'string' || body.transaction.length > 8_000) throw new PaymentError('Invalid signed transaction.');
  const attempt = await getAttempt(id, body.attemptId, body.attemptToken);
  const payment = await getPayment(id);
  if (payment.status !== 'ACTIVE') throw new PaymentError('This payment is no longer available.', 409);
  if (attempt.status !== 'PREPARED') throw new PaymentError('This attempt is no longer ready for submission.', 409);
  let transaction: Transaction;
  try {
    transaction = Transaction.from(Buffer.from(body.transaction, 'base64'));
    if (!transaction.verifySignatures() || await sha256(transaction.serializeMessage()) !== attempt.message_hash) throw new Error();
  } catch { throw new PaymentError('Signed transaction differs from the prepared payment.', 409); }
  const c = connection();
  await assertDevnet(c);
  if (await c.getBlockHeight('confirmed') > attempt.last_valid_block_height) {
    await db().prepare("UPDATE payment_attempts SET status='EXPIRED',updated_at=? WHERE id=? AND status='PREPARED'").bind(Date.now(), attempt.id).run();
    throw new PaymentError('This prepared transaction has expired. Start a fresh attempt.', 409);
  }
  const signature = bs58.encode(transaction.signature!);
  const claim = await db().prepare("UPDATE payment_attempts SET signature=?,status='SUBMITTED',updated_at=? WHERE id=? AND status='PREPARED'").bind(signature, Date.now(), attempt.id).run();
  if (!claim.meta.changes) throw new PaymentError('This attempt has already been submitted.', 409);
  try { await c.sendRawTransaction(transaction.serialize(), { skipPreflight: false, maxRetries: 2 }); }
  catch (error) { return { attemptId: attempt.id, signature, status: 'SUBMITTED', message: relayFailureMessage(error) }; }
  return { attemptId: attempt.id, signature, status: 'SUBMITTED' };
}
function checkInstructions(payment: PaymentIntent, attempt: Attempt, parsed: { transaction: { message: { accountKeys: Array<{ pubkey: PublicKey; signer: boolean }>; instructions: Array<{ programId: PublicKey; parsed?: unknown }> } }; meta: { postTokenBalances?: Array<{ accountIndex: number; owner?: string; mint?: string }> | null } }) {
  const instructions = parsed.transaction.message.instructions;
  const payer = attempt.payer;
  const allowed = payment.asset === 'SOL' ? new Set([SystemProgram.programId.toBase58(), MEMO_PROGRAM]) : new Set([TOKEN_PROGRAM_ID.toBase58(), ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(), MEMO_PROGRAM]);
  if (instructions.some((instruction) => !allowed.has(instruction.programId.toBase58()))) throw new PaymentError('Transaction includes an unexpected instruction.');
  const expectedCount = payment.asset === 'SOL' ? payment.recipients.length + 1 : payment.recipients.length * 2 + 1;
  if (instructions.length !== expectedCount) throw new PaymentError('Transaction instruction count is invalid.');
  const signers = parsed.transaction.message.accountKeys.filter((key) => key.signer).map((key) => key.pubkey.toBase58());
  if (signers.length !== 1 || signers[0] !== payer || parsed.transaction.message.accountKeys[0]?.pubkey.toBase58() !== payer) throw new PaymentError('Transaction payer or signer set is invalid.');
  const memo = 'auno:' + payment.id + ':' + attempt.id;
  if (instructions.filter((instruction) => instruction.programId.toBase58() === MEMO_PROGRAM && instruction.parsed === memo).length !== 1) throw new PaymentError('Payment reference is missing.');
  const transfers = instructions.filter((instruction) => instruction.programId.toBase58() === (payment.asset === 'SOL' ? SystemProgram.programId.toBase58() : TOKEN_PROGRAM_ID.toBase58()));
  if (transfers.length !== payment.recipients.length) throw new PaymentError('Expected transfers are missing.');
  for (const recipient of payment.recipients) {
    const found = transfers.filter((instruction) => {
      const parsedInstruction = instruction.parsed as { type?: string; info?: Record<string, unknown> };
      const info = parsedInstruction?.info || {};
      if (payment.asset === 'SOL') return parsedInstruction.type === 'transfer' && info.source === payer && info.destination === recipient.address && String(info.lamports) === recipient.amountBaseUnits;
      return parsedInstruction.type === 'transferChecked' && info.authority === payer && info.mint === ASSETS.USDC.mint && String((info.tokenAmount as { amount?: string } | undefined)?.amount) === recipient.amountBaseUnits && Number((info.tokenAmount as { decimals?: number } | undefined)?.decimals) === ASSETS.USDC.decimals;
    });
    if (found.length !== 1) throw new PaymentError('Each recipient must receive exactly one intended transfer.');
  }
}
export async function verifyPayment(id: string, attemptId: unknown, token: unknown) {
  const attempt = await getAttempt(id, attemptId, token);
  const payment = await getPayment(id);
  if (payment.status === 'PAID') return checkoutPayment(payment);
  if (!attempt.signature) return { status: attempt.status, signature: null };
  const c = connection();
  await assertDevnet(c);
  const parsed = await c.getParsedTransaction(attempt.signature, { commitment: 'finalized', maxSupportedTransactionVersion: 0 });
  if (!parsed) {
    const status = await c.getSignatureStatus(attempt.signature, { searchTransactionHistory: true });
    const nextStatus = status.value?.err ? 'REJECTED' : 'CONFIRMING';
    await db().prepare('UPDATE payment_attempts SET status=?,updated_at=? WHERE id=?').bind(nextStatus, Date.now(), attempt.id).run();
    return { status: nextStatus, signature: attempt.signature };
  }
  if (parsed.meta?.err || !parsed.meta || !parsed.blockTime || parsed.blockTime * 1_000 < payment.createdAt - 60_000 || parsed.blockTime * 1_000 > payment.expiresAt + 30_000) throw new PaymentError('Transaction failed or falls outside the payment window.');
  const raw = await c.getTransaction(attempt.signature, { commitment: 'finalized', maxSupportedTransactionVersion: 0 });
  const rawMessage = raw?.transaction.message as unknown as { serialize?: () => Uint8Array };
  if (!rawMessage?.serialize || await sha256(rawMessage.serialize()) !== attempt.message_hash) throw new PaymentError('Finalized transaction differs from the prepared payment.');
  checkInstructions(payment, attempt, parsed as unknown as Parameters<typeof checkInstructions>[2]);
  const paid = await db().prepare("UPDATE payments SET status='PAID',transaction_signature=?,payer=?,paid_at=?,updated_at=? WHERE id=? AND status='ACTIVE'").bind(attempt.signature, attempt.payer, parsed.blockTime * 1_000, Date.now(), id).run();
  if (paid.meta.changes) await db().prepare("UPDATE payment_attempts SET status='VERIFIED',updated_at=? WHERE id=?").bind(Date.now(), attempt.id).run();
  return checkoutPayment(await getPayment(id));
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
