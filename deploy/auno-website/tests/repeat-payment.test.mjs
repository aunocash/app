import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

mkdirSync('work/repeat-tests', { recursive: true });
for (const file of ['model', 'policy', 'server', 'repeat', 'repeat-splits', 'saved-recipients']) {
  const source = readFileSync(`lib/payments/${file}.ts`, 'utf8')
    .replace("import { env } from 'cloudflare:workers';", 'const env = globalThis.__REPEAT_TEST_ENV__;')
    .replaceAll("from './model'", "from './model.mjs'")
    .replaceAll("from './policy'", "from './policy.mjs'").replaceAll("from './repeat-splits'", "from './repeat-splits.mjs'").replaceAll("from './saved-recipients'", "from './saved-recipients.mjs'");
  writeFileSync(`work/repeat-tests/${file}.mjs`, ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText);
}
const sqlite = new DatabaseSync(':memory:');
for (const name of ['0000_lush_the_executioner', '0001_secure_atomic_split', '0002_mainnet_beta', '0003_invoices', '0004_repeat_splits', '0005_saved_recipients']) {
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
const server = await import('../work/repeat-tests/server.mjs');
const model = await import('../work/repeat-tests/model.mjs');
const { repeatDraft, repeatHref } = await import('../work/repeat-tests/repeat.mjs');
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

for (const asset of ['SOL', 'USDC']) for (const count of [1, 2]) {
  const payment = await server.createPayment(signedCreate({ title: `${asset} ${count} recipients`, asset,
    amount: '0.01', recipients: recipients.slice(0, count).map((key, index) => ({ label: `Recipient ${index + 1}`,
      wallet: key.publicKey.toBase58(), bps: count === 1 ? 10000 : index === 0 ? 3333 : 6667 })) }));
  await assert.rejects(() => server.getRepeatPayment(payment.id), error => error.status === 409);
  assert.throws(() => repeatDraft(payment, 'mainnet-beta'), /finalized/);
  // Controlled database fixture, not an on-chain transaction. The existing
  // payment suite separately exercises finalized transaction verification.
  sqlite.prepare("UPDATE payments SET status='PAID', payer=?, transaction_signature=?, paid_at=? WHERE id=?")
    .run(payer.publicKey.toBase58(), `fixture-${payment.id}`, Date.now(), payment.id);
  const finalized = await server.getRepeatPayment(payment.id);
  const snapshot = JSON.stringify(await server.getPayment(payment.id));
  const draft = repeatDraft(finalized, 'mainnet-beta');
  assert.equal(draft.amount, '0.01');
  assert.equal(draft.asset, asset);
  assert.equal(draft.recipients.length, count);
  assert.equal(draft.recipients[0].bps, count === 1 ? 10000 : 3333);
  assert.equal(draft.recipients[0].wallet, recipients[0].publicKey.toBase58());
  for (const field of ['status', 'signature', 'transactionSignature', 'payer', 'expiresAt', 'reference', 'attemptToken', 'verification', 'merchantWallet']) assert.equal(field in draft, false);
  assert.throws(() => repeatDraft(finalized, 'devnet'), /different network/);
  assert.throws(() => repeatDraft({ ...finalized, transactionSignature: null }, 'mainnet-beta'), /finalized/);
  assert.throws(() => repeatDraft({ ...finalized, amount: '0.02' }, 'mainnet-beta'), /amount/);
  assert.throws(() => repeatDraft({ ...finalized, recipients: [] }, 'mainnet-beta'));
  assert.equal(repeatHref(finalized), `${count > 1 ? '/split' : '/dashboard/create'}?repeat=${payment.id}`);
  const repeated = await server.createPayment(signedCreate({ title: draft.title, description: draft.description,
    amount: draft.amount, asset: draft.asset, recipients: draft.recipients }, payer));
  assert.notEqual(repeated.id, payment.id);
  assert.equal(repeated.status, 'ACTIVE');
  assert.equal(repeated.transactionSignature, null);
  assert.equal(repeated.payer, null);
  assert.deepEqual(repeated.recipients, payment.recipients);
  assert.equal(JSON.stringify(await server.getPayment(payment.id)), snapshot);
  const history = await server.listPayments(historyRequest(payer));
  assert.equal(history.payments.filter(item => item.id === payment.id).length, 1);
  assert.equal(history.payments.filter(item => item.id === repeated.id).length, 1);
  const ownerHistory = await server.listPayments(historyRequest(merchant));
  assert.ok(ownerHistory.payments.some(item => item.id === payment.id));
  assert.equal((await server.listPayments(historyRequest(stranger))).payments.length, 0);
  console.log(`PASS ${asset} ${count}-recipient record, exact repeat, immutable original and wallet-scoped history`);
}
await assert.rejects(() => server.listPayments(historyRequest(payer, stranger)));
await assert.rejects(() => server.listPayments(historyRequest(payer, payer, Date.now() - 301_000)), error => error.status === 401);
const first = (await server.listPayments(historyRequest(payer))).payments.find(item => item.status === 'PAID');
globalThis.__REPEAT_TEST_ENV__.AUNO_MAINNET_ENABLED = 'false';
await assert.rejects(() => server.getRepeatPayment(first.id), error => error.status === 503);
globalThis.__REPEAT_TEST_ENV__.AUNO_MAINNET_ENABLED = 'true';
globalThis.__REPEAT_TEST_ENV__.SOLANA_NETWORK = 'devnet';
await assert.rejects(() => server.getRepeatPayment(first.id), error => error.status === 404);
globalThis.__REPEAT_TEST_ENV__.SOLANA_NETWORK = 'mainnet-beta';
const unpaid = await server.createPayment(signedCreate({ title: 'Unresolved fixture', asset: 'SOL', amount: '0.001', recipient: recipients[0].publicKey.toBase58() }));
sqlite.prepare('UPDATE payments SET payer=? WHERE id=?').run(payer.publicKey.toBase58(), unpaid.id);
assert.ok(!(await server.listPayments(historyRequest(payer))).payments.some(item => item.id === unpaid.id));
console.log('PASS invalid authorization, expired authorization, network isolation, kill switch and unresolved-payment exclusion');
sqlite.close();
