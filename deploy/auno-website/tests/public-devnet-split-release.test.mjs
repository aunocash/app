import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const server = read('../lib/payments/server.ts');
const ui = read('../app/payment-ui.tsx');
const compose = read('../compose.yaml');
const receiptRoute = read('../app/api/public/payments/[id]/receipt/route.ts');

assert.match(server, /AUNO_DEVNET_SPLITS_ENABLED/);
assert.match(server, /publicSplitReceipt/);
assert.match(server, /getAssociatedTokenAddress/);
assert.match(server, /Each USDC recipient requires the expected token-account instruction/);
assert.match(server, /USDC recipient token-account ownership could not be verified/);
assert.match(server, /splitChecked/);
assert.match(compose, /verifier:/);
assert.match(compose, /AUNO_DEVNET_SPLITS_ENABLED: \$\{AUNO_DEVNET_SPLITS_ENABLED:-false\}/);
assert.match(compose, /AUNO_VERIFIER_TOKEN/);
assert.match(receiptRoute, /publicSplitReceipt/);
assert.match(ui, /\/receipt\/\$\{settlement\.paymentId\}/);
assert.match(ui, /navigator\.clipboard\.writeText/);
assert.match(ui, /window\.setInterval\(\(\) => void loadReceipt\(\), 10_000\)/);

console.log('PASS public Devnet split release wires gated settlement, verifier, receipt read, copy, and refresh states');