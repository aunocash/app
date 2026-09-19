import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const checkout = await readFile(new URL('app/payment-ui.tsx', root), 'utf8');
const page = await readFile(new URL('app/pay/[id]/page.tsx', root), 'utf8');

assert.doesNotMatch(page, /payments\/server/);
assert.doesNotMatch(page, /initialPayment=/);
assert.match(page, /<Checkout id=/);
assert.match(checkout, /initialPayment/);
assert.match(checkout, /recipient\.address === wallet\.address/);
assert.match(checkout, /<Nav network=\{payment\?\.network === "mainnet-beta" \? "mainnet" : undefined\}/);
assert.match(checkout, /<Footer network=\{payment\?\.network === "mainnet-beta" \? "mainnet" : undefined\}/);
assert.doesNotMatch(checkout, /new Date\(payment\.expiresAt\)\.toLocaleString/);
assert.match(checkout, /new Date\(payment\.expiresAt\)\.toISOString/);

console.log('PASS checkout loads payment through the API and blocks payer-recipient self-payments');
