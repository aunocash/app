import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
import { Keypair, Connection, Transaction, SystemProgram, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

mkdirSync('work/contacts-tests', { recursive: true });
for (const file of ['model', 'policy', 'server', 'repeat', 'repeat-splits', 'saved-recipients']) {
  const source = readFileSync(`lib/payments/${file}.ts`, 'utf8')
    .replace("import { env } from 'cloudflare:workers';", 'const env = globalThis.__REPEAT_TEST_ENV__;')
    .replaceAll("from './model'", "from './model.mjs'")
    .replaceAll("from './policy'", "from './policy.mjs'").replaceAll("from './repeat-splits'", "from './repeat-splits.mjs'").replaceAll("from './saved-recipients'", "from './saved-recipients.mjs'");
  writeFileSync(`work/contacts-tests/${file}.mjs`, ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText);
}
const databasePath = `work/contacts-tests/${crypto.randomUUID()}.sqlite`;
let sqlite = new DatabaseSync(databasePath);
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
const server = await import('../work/contacts-tests/server.mjs');
const model = await import('../work/contacts-tests/model.mjs');
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

const { repeatSplitMessage } = await import('../work/contacts-tests/repeat-splits.mjs');
function templateRequest(action, data = {}, owner = payer, signer = owner) {
  const payload = JSON.stringify({ action, wallet: owner.publicKey.toBase58(), origin, timestamp: Date.now(), nonce: crypto.randomUUID(), ...data });
  const signature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(repeatSplitMessage(payload, 'mainnet-beta')), signer.secretKey));
  return new Request(`${origin}/api/repeat-splits`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ payload, signature }) });
}

const contacts = await import('../work/contacts-tests/saved-recipients.mjs');
function contactRequest(action, data = {}, owner = payer, signer = owner) {
  const payload = JSON.stringify({ action, wallet: owner.publicKey.toBase58(), origin, timestamp: Date.now(), nonce: crypto.randomUUID(), ...data });
  const signature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(contacts.recipientMessage(payload, 'mainnet-beta')), signer.secretKey));
  return new Request(`${origin}/api/saved-recipients`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ payload, signature }) });
}
const input = { name: '  Private recipient  ', address: recipients[0].publicKey.toBase58(), note: 'Private note; never publish' };
const create = contactRequest('create', { config: input });
const replay = create.clone();
let contact = await server.savedRecipientsRequest(create);
assert.equal(contact.name, 'Private recipient');
await assert.rejects(() => server.savedRecipientsRequest(replay), e => e.status === 409);
sqlite.close(); sqlite = new DatabaseSync(databasePath);
assert.equal((await server.savedRecipientsRequest(contactRequest('get', { id: contact.id }))).address, input.address);
await assert.rejects(() => server.savedRecipientsRequest(contactRequest('create', { config: input })), e => e.message === 'This wallet is already saved.');
await server.savedRecipientsRequest(contactRequest('create', { config: input }, stranger));
for (const action of ['get','update','delete']) await assert.rejects(() => server.savedRecipientsRequest(contactRequest(action, { id: contact.id, revision: contact.revision, config: input }, stranger)), e => e.status === 404);
assert.equal((await server.savedRecipientsRequest(contactRequest('list', {}, merchant))).recipients.length, 0);
await assert.rejects(() => server.savedRecipientsRequest(contactRequest('list', {}, payer, stranger)));
await assert.rejects(() => server.savedRecipientsRequest(contactRequest('list', { timestamp: Date.now() - 301000 })), e => e.status === 401);
await assert.rejects(() => server.savedRecipientsRequest(contactRequest('list', { origin: 'https://evil.example' })), e => e.status === 401);
globalThis.__REPEAT_TEST_ENV__.SOLANA_NETWORK = 'devnet';
await assert.rejects(() => server.savedRecipientsRequest(contactRequest('list')));
globalThis.__REPEAT_TEST_ENV__.SOLANA_NETWORK = 'mainnet-beta';
for (const bad of [{ name: ' ' }, { name: 'x'.repeat(81) }, { address: 'bad' }, { note: 'x'.repeat(201) }]) {
  assert.throws(() => contacts.validateContact({ ...input, ...bad }));
  await assert.rejects(() => server.savedRecipientsRequest(contactRequest('create', { config: { ...input, ...bad } })), e => e.status === 400);
}
const [offCurve] = PublicKey.findProgramAddressSync([Buffer.from('recipient-test')], SystemProgram.programId);
assert.throws(() => contacts.validateContact({ ...input, address: offCurve.toBase58() }), /valid.*on-curve/);
assert.equal(contacts.matchingContacts([contact], 'PRIVATE').length, 1);
assert.equal(contacts.matchingContacts([contact], contact.address).length, 1);
const altered = [...contact.address].map(c => c.toUpperCase() === c ? c.toLowerCase() : c.toUpperCase()).join('');
assert.equal(contacts.matchingContacts([contact], altered).length, 0);
const scope = new contacts.ContactRequestScope();
const previousWallet = scope.begin();
scope.invalidate();
const nextWallet = scope.begin();
assert.equal(scope.current(previousWallet), false);
assert.equal(scope.current(nextWallet), true);
scope.invalidate(); assert.equal(scope.current(nextWallet), false);

const config = { name: 'Snapshot team', description: '', allocationType: 'percentage', asset: 'SOL', amount: '0.01', recipients: [
 { label: 'Recipient 1', wallet: contact.address, bps: 5000, contactId: contact.id },
 { label: 'Recipient 2', wallet: recipients[1].publicKey.toBase58(), bps: 5000 },
] };
let saved = await server.repeatSplitsRequest(templateRequest('create', { config }));
await assert.rejects(() => server.repeatSplitsRequest(templateRequest('create', { config }, stranger)), e => e.status === 409);
const paymentInput = item => ({ title: item.name, description: item.description, asset: item.asset, amount: item.amount, recipients: item.recipients.map(({ label, wallet, bps }) => ({ label, wallet, bps })), repeatSplitId: item.id, repeatSplitRevision: item.revision });
const payment = await server.createPayment(signedCreate(paymentInput(saved), payer));
assert.equal(payment.recipients[0].address, contact.address);
const publicJson = JSON.stringify(server.checkoutPayment(payment));
for (const secret of [contact.name, contact.note, contact.id]) assert.equal(publicJson.includes(secret), false);
globalThis.__REPEAT_TEST_ENV__.SOLANA_RPC_URL = 'https://rpc.example.test';
Connection.prototype.getGenesisHash = async () => model.NETWORKS['mainnet-beta'].genesisHash;
Connection.prototype.getLatestBlockhash = async () => ({ blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: 999999 });
Connection.prototype.getFeeForMessage = async () => ({ value: 5000 });
Connection.prototype.getBalance = async () => 1000000000;
function req(body) { return new Request(`${origin}/api/payments`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
const prepared = await server.preparePayment(req({ payer: payer.publicKey.toBase58() }), payment.id);
const tx = Transaction.from(Buffer.from(prepared.transaction, 'base64'));
assert.equal(tx.instructions[0].keys[1].pubkey.toBase58(), contact.address);
tx.sign(payer);
assert.equal(Transaction.from(tx.serialize()).instructions[0].keys[1].pubkey.toBase58(), contact.address);
const before = JSON.stringify(await server.getPayment(payment.id));
const newAddress = Keypair.generate().publicKey.toBase58();
await assert.rejects(() => server.savedRecipientsRequest(contactRequest('update', { id: contact.id, revision: contact.revision, config: { ...input, address: newAddress } })), e => e.status === 409);
contact = await server.savedRecipientsRequest(contactRequest('update', { id: contact.id, revision: contact.revision, config: { ...input, address: newAddress }, confirmAddressChange: true }));
await assert.rejects(() => server.savedRecipientsRequest(contactRequest('update', { id: contact.id, revision: 1, config: input, confirmAddressChange: true })), e => e.status === 409);
let snapshot = await server.repeatSplitsRequest(templateRequest('get', { id: saved.id }));
assert.equal(snapshot.recipients[0].wallet, input.address);
assert.equal(snapshot.contactStatuses[0].currentAddress, newAddress);
assert.equal(snapshot.contactStatuses[0].snapshotAddress, input.address);
assert.equal(JSON.stringify(await server.getPayment(payment.id)), before);
assert.equal(Transaction.from(Buffer.from(prepared.transaction, 'base64')).instructions[0].keys[1].pubkey.toBase58(), input.address);
// Explicit template update uses the selected new address, with a fresh revision.
saved = await server.repeatSplitsRequest(templateRequest('update', { id: saved.id, revision: saved.revision, config: { ...config, recipients: config.recipients.map((r,i) => i === 0 ? { ...r, wallet: newAddress } : r) } }));
assert.equal(saved.recipients[0].wallet, newAddress);
const usdc = await server.repeatSplitsRequest(templateRequest('create', { config: { ...config, asset: 'USDC', amount: '1', recipients: config.recipients.map((r,i) => i === 0 ? { ...r, wallet: newAddress } : r) } }));
const usdcPayment = await server.createPayment(signedCreate(paymentInput(usdc), payer));
const usdcPrepared = await server.preparePayment(req({ payer: payer.publicKey.toBase58() }), usdcPayment.id);
const usdcTx = Transaction.from(Buffer.from(usdcPrepared.transaction, 'base64'));
assert.equal(usdcTx.instructions[0].keys[2].pubkey.toBase58(), newAddress, 'ATA owner must match the explicitly selected wallet');
// Historical fixture only: no on-chain payment is asserted by this test.
sqlite.prepare("UPDATE payments SET status='PAID',payer=?,transaction_signature=?,paid_at=? WHERE id=?").run(payer.publicKey.toBase58(), `contact-history-fixture-${payment.id}`, Date.now(), payment.id);
const historyBefore = JSON.stringify(await server.listPayments(historyRequest(payer)));
await server.savedRecipientsRequest(contactRequest('delete', { id: contact.id, revision: contact.revision }));
snapshot = await server.repeatSplitsRequest(templateRequest('get', { id: saved.id }));
assert.equal(snapshot.recipients[0].wallet, newAddress);
assert.equal(snapshot.contactStatuses[0].deleted, true);
assert.equal(JSON.stringify(await server.listPayments(historyRequest(payer))), historyBefore);
assert.equal((await server.savedRecipientsRequest(contactRequest('list'))).recipients.length, 0);
await server.repeatSplitsRequest(templateRequest('update', { id: saved.id, revision: saved.revision, config: { ...saved, name: 'Still usable after deletion' } }));
const storage = globalThis.__REPEAT_TEST_ENV__.DB;
globalThis.__REPEAT_TEST_ENV__.DB = { prepare() { throw new Error('Storage unavailable'); } };
const failure = await server.handled(() => server.savedRecipientsRequest(contactRequest('list')));
assert.equal(failure.status, 503);
globalThis.__REPEAT_TEST_ENV__.DB = storage;
console.log('PASS signed recipient CRUD, persistence, ownership, duplicates, replay, address validation, case-sensitive address search, wallet-response isolation, private metadata, immutable snapshots/history, explicit updates, deleted contacts and exact SOL/USDC destinations');
sqlite.close(); unlinkSync(databasePath);
