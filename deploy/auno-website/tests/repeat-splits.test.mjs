import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
import { Keypair, Connection, Transaction, SystemProgram, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

mkdirSync('work/saved-split-tests', { recursive: true });
for (const file of ['model', 'policy', 'server', 'repeat', 'repeat-splits']) {
  const source = readFileSync(`lib/payments/${file}.ts`, 'utf8')
    .replace("import { env } from 'cloudflare:workers';", 'const env = globalThis.__REPEAT_TEST_ENV__;')
    .replaceAll("from './model'", "from './model.mjs'")
    .replaceAll("from './policy'", "from './policy.mjs'").replaceAll("from './repeat-splits'", "from './repeat-splits.mjs'");
  writeFileSync(`work/saved-split-tests/${file}.mjs`, ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText);
}
const databasePath = `work/saved-split-tests/${crypto.randomUUID()}.sqlite`;
let sqlite = new DatabaseSync(databasePath);
for (const name of ['0000_lush_the_executioner', '0001_secure_atomic_split', '0002_mainnet_beta', '0003_invoices', '0004_repeat_splits']) {
  sqlite.exec(readFileSync(`drizzle/${name}.sql`, 'utf8'));
}
function statement(sql, args = []) {
  return { bind(...values) { return statement(sql, values); },
    async first() { return sqlite.prepare(sql).get(...args) ?? null; },
    async all() { return { results: sqlite.prepare(sql).all(...args) }; },
    async run() { return { meta: { changes: sqlite.prepare(sql).run(...args).changes } }; } };
}
globalThis.__REPEAT_TEST_ENV__ = { DB: { prepare: statement }, SOLANA_NETWORK: 'mainnet-beta',
  AUNO_MAINNET_ENABLED: 'true', AUNO_MAINNET_SPLITS_ENABLED: 'true', AUNO_PUBLIC_ORIGIN: 'https://auno.cash' };
const server = await import('../work/saved-split-tests/server.mjs');
const model = await import('../work/saved-split-tests/model.mjs');
const { repeatDraft, repeatHref } = await import('../work/saved-split-tests/repeat.mjs');
const merchant = Keypair.generate(), payer = Keypair.generate(), stranger = Keypair.generate();
const recipients = [Keypair.generate(), Keypair.generate()];
const origin = 'https://auno.cash';
function signedCreate(input, owner = merchant) {
  const payload = JSON.stringify({ merchantWallet: owner.publicKey.toBase58(), reference: '', description: '',
    timestamp: Date.now(), expiresAt: Date.now() + 3_600_000, origin, ...input });
  const signature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(model.creationMessage(payload, 'mainnet-beta')), owner.secretKey));
  return new Request(`${origin}/api/payments`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ payload, signature }) });
}
function historyRequest(wallet, signer = wallet, timestamp = Date.now()) {
  const address = wallet.publicKey.toBase58();
  const signature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(model.historyMessage(address, timestamp, origin, 'mainnet-beta')), signer.secretKey));
  return new Request(`${origin}/api/payments?wallet=${address}`, { headers: { 'x-auno-timestamp': String(timestamp), 'x-auno-signature': signature } });
}

const { repeatSplitMessage } = await import('../work/saved-split-tests/repeat-splits.mjs');
function templateRequest(action, data = {}, owner = payer, signer = owner) {
  const payload = JSON.stringify({ action, wallet: owner.publicKey.toBase58(), origin, timestamp: Date.now(), nonce: crypto.randomUUID(), ...data });
  const signature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(repeatSplitMessage(payload, 'mainnet-beta')), signer.secretKey));
  return new Request(`${origin}/api/repeat-splits`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ payload, signature }) });
}
const config = { name: 'Monthly team', description: 'Unit test only', allocationType: 'percentage', asset: 'SOL', amount: '0.01', recipients: recipients.map((key, i) => ({ label: `Recipient ${i}`, wallet: key.publicKey.toBase58(), bps: 5000 })) };
const create = templateRequest('create', { config });
const duplicate = create.clone();
let saved = await server.repeatSplitsRequest(create);
sqlite.close();
sqlite = new DatabaseSync(databasePath);
await assert.rejects(() => server.repeatSplitsRequest(duplicate), e => e.status === 409);
assert.equal(saved.executionCount, 0);
assert.equal(saved.lastUsedAt, null);
assert.deepEqual((await server.repeatSplitsRequest(templateRequest('get', { id: saved.id }))).recipients, config.recipients);
assert.equal((await server.repeatSplitsRequest(templateRequest('list'))).splits.length, 1);
assert.equal((await server.repeatSplitsRequest(templateRequest('list', {}, stranger))).splits.length, 0);
for (const action of ['get', 'update', 'delete']) await assert.rejects(() => server.repeatSplitsRequest(templateRequest(action, { id: saved.id, revision: saved.revision, config }, stranger)), e => e.status === 404);
await assert.rejects(() => server.repeatSplitsRequest(templateRequest('list', {}, payer, stranger)));
await assert.rejects(() => server.repeatSplitsRequest(templateRequest('list', { timestamp: Date.now() - 301000 })), e => e.status === 401);
await assert.rejects(() => server.repeatSplitsRequest(templateRequest('list', { origin: 'https://evil.example' })), e => e.status === 401);
for (const broken of [ { recipients: [{ ...config.recipients[0], bps: 1 }, config.recipients[1]] }, { recipients: [config.recipients[0], config.recipients[0]] }, { recipients: [{ ...config.recipients[0], wallet: 'bad' }, config.recipients[1]] }, { asset: 'BTC' }, { amount: '0' }, { name: '' } ]) {
  await assert.rejects(() => server.repeatSplitsRequest(templateRequest('create', { config: { ...config, ...broken } })), e => e.status === 400);
}
globalThis.__REPEAT_TEST_ENV__.SOLANA_NETWORK = 'devnet';
await assert.rejects(() => server.repeatSplitsRequest(templateRequest('get', { id: saved.id })));
globalThis.__REPEAT_TEST_ENV__.SOLANA_NETWORK = 'mainnet-beta';
const paymentInput = (item) => ({ title: item.name, description: item.description, asset: item.asset, amount: item.amount, recipients: item.recipients, repeatSplitId: item.id, repeatSplitRevision: item.revision });
await assert.rejects(() => server.createPayment(signedCreate(paymentInput(saved), stranger)), e => e.status === 404);
await assert.rejects(() => server.createPayment(signedCreate({ ...paymentInput(saved), recipients: [...saved.recipients].reverse() }, payer)), e => e.status === 409);
let payment = await server.createPayment(signedCreate(paymentInput(saved), payer));
assert.equal(payment.repeatSplitId, saved.id);
assert.equal(payment.status, 'ACTIVE');
function request(body) { return new Request(`${origin}/api/payments`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
await assert.rejects(() => server.preparePayment(request({ payer: stranger.publicKey.toBase58() }), payment.id), e => e.status === 403);
// Only RPC responses are controlled in this isolated test. The actual production
// prepare, signed-transaction checks, submission and finalized verifier all run.
globalThis.__REPEAT_TEST_ENV__.SOLANA_RPC_URL = 'https://rpc.example.test';
globalThis.fetch = async (_url, init) => {
  const rpc = JSON.parse(init.body);
  assert.equal(rpc.method, 'getBlockHeight', 'Unexpected RPC in isolated test');
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result: 10 }), { headers: { 'Content-Type': 'application/json' } });
};
Connection.prototype.getGenesisHash = async () => model.NETWORKS['mainnet-beta'].genesisHash;
Connection.prototype.getLatestBlockhash = async () => ({ blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: 999999 });
Connection.prototype.getFeeForMessage = async () => ({ value: 5000 });
Connection.prototype.getBalance = async () => 1000000000;
Connection.prototype.getBlockHeight = async () => 10;
Connection.prototype.sendRawTransaction = async bytes => bs58.encode(Transaction.from(bytes).signature);
async function execute(item, fail = false) {
  const prepared = await server.preparePayment(request({ payer: payer.publicKey.toBase58() }), item.id);
  const transaction = Transaction.from(Buffer.from(prepared.transaction, 'base64'));
  transaction.sign(payer);
  const submitted = await server.submitPayment(request({ attemptId: prepared.attemptId, attemptToken: prepared.attemptToken, transaction: transaction.serialize().toString('base64') }), item.id);
  assert.equal(submitted.status, 'SUBMITTED');
  Connection.prototype.getParsedTransaction = async () => null;
  Connection.prototype.getSignatureStatus = async () => ({ value: null });
  assert.equal((await server.verifyPayment(item.id, prepared.attemptId, prepared.attemptToken)).status, 'CONFIRMING');
  const before = (await server.repeatSplitsRequest(templateRequest('get', { id: saved.id }))).executionCount;
  Connection.prototype.getParsedTransaction = async () => ({ blockTime: Math.floor(Date.now() / 1000), meta: { err: fail ? { InstructionError: [0, 'failed'] } : null }, transaction: { message: { accountKeys: [{ pubkey: payer.publicKey, signer: true }], instructions: [
    ...item.recipients.map(r => ({ programId: SystemProgram.programId, parsed: { type: 'transfer', info: { source: payer.publicKey.toBase58(), destination: r.address, lamports: Number(r.amountBaseUnits) } } })),
    { programId: new PublicKey(model.MEMO_PROGRAM), parsed: `auno:${item.id}:${prepared.attemptId}` },
  ] } } });
  if (fail) { await assert.rejects(() => server.verifyPayment(item.id, prepared.attemptId, prepared.attemptToken)); assert.equal((await server.repeatSplitsRequest(templateRequest('get', { id: saved.id }))).executionCount, before); return; }
  const receipt = await server.verifyPayment(item.id, prepared.attemptId, prepared.attemptToken);
  assert.equal(receipt.status, 'PAID');
  assert.equal(receipt.transactionSignature, submitted.signature);
  await server.verifyPayment(item.id, prepared.attemptId, prepared.attemptToken);
  const after = await server.repeatSplitsRequest(templateRequest('get', { id: saved.id }));
  assert.equal(after.executionCount, before + 1);
  assert.equal(after.lastUsedAt, receipt.paidAt);
}
await execute(payment);
const original = JSON.stringify(await server.getPayment(payment.id));
const changed = { ...config, name: 'Edited team', recipients: config.recipients.map((r, i) => ({ ...r, label: `Edited ${i}`, bps: i === 0 ? 4000 : 6000 })) };
saved = await server.repeatSplitsRequest(templateRequest('update', { id: saved.id, revision: saved.revision, config: changed }));
await assert.rejects(() => server.repeatSplitsRequest(templateRequest('update', { id: saved.id, revision: 1, config })), e => e.status === 409);
const second = await server.createPayment(signedCreate(paymentInput(saved), payer));
assert.notEqual(second.id, payment.id);
await execute(second);
assert.equal(JSON.stringify(await server.getPayment(payment.id)), original);
const failed = await server.createPayment(signedCreate(paymentInput(saved), payer));
await execute(failed, true);
assert.equal((await server.repeatSplitsRequest(templateRequest('get', { id: saved.id }))).executionCount, 2);
const history = await server.listPayments(historyRequest(payer));
assert.equal(history.payments.filter(p => p.status === 'PAID' && p.repeatSplitId === saved.id).length, 2);
await server.repeatSplitsRequest(templateRequest('delete', { id: saved.id, revision: saved.revision }));
assert.equal((await server.repeatSplitsRequest(templateRequest('list'))).splits.length, 0);
assert.equal(JSON.stringify(await server.getPayment(payment.id)), original);
await assert.rejects(() => server.createPayment(signedCreate(paymentInput(saved), payer)), e => e.status === 404);
const usdc = await server.repeatSplitsRequest(templateRequest('create', { config: { ...config, asset: 'USDC', amount: '2.50' } }));
const usdcPayment = await server.createPayment(signedCreate(paymentInput(usdc), payer));
assert.equal(usdcPayment.asset, 'USDC');
assert.deepEqual(usdcPayment.recipients.map(r => r.amountBaseUnits), ['1250000','1250000']);
console.log('PASS Repeat Split persistence, ownership, signed CRUD, replay/origin/network protection, validation, exact prefill, actual prepare/submit/verify with isolated RPC fixtures, idempotent counts, edited execution, immutable history and deletion');
sqlite.close();
unlinkSync(databasePath);
