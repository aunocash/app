import assert from "node:assert/strict";
import test from "node:test";
import {
  validAddress,
  validatePayment,
  encodePayment,
  decodePayment,
} from "../lib/payments.ts";
const address = "11111111111111111111111111111111";
const payment = {
  title: "Website design — English",
  amount: "100.000001",
  asset: "USDC",
  recipient: address,
  splits: [],
};
test("public links preserve Unicode and the complete request", () => {
  assert.deepEqual(decodePayment(encodePayment(payment)), payment);
});
test("addresses must decode to exactly 32 bytes", () => {
  assert.equal(validAddress(address), true);
  assert.equal(validAddress("1".repeat(33)), false);
  assert.equal(validAddress("z".repeat(44)), false);
  assert.equal(validAddress("0".repeat(32)), false);
});
test("rejects invalid amount, precision, and unsupported assets", () => {
  for (const amount of ["0", "-1", "1e2", "NaN", "1.0000001", "1000000000"])
    assert.ok(validatePayment({ ...payment, amount }));
  assert.equal(
    validatePayment({ ...payment, asset: "SOL", amount: "0.000000001" }),
    null,
  );
  assert.ok(
    validatePayment({ ...payment, asset: "SOL", amount: "0.0000000001" }),
  );
  assert.ok(validatePayment({ ...payment, asset: "ETH" }));
});
test("rejects malformed and oversized links without throwing", () => {
  for (const id of [
    "",
    "%%%bad",
    "a".repeat(2401),
    "bnVsbA",
    "e30",
    "WyJ1bnRydXN0ZWQiXQ",
  ])
    assert.equal(decodePayment(id), null);
  assert.equal(
    decodePayment(encodePayment({ ...payment, amount: "-1" })),
    null,
  );
});
test("splits require unique recipients, correct merchant, and a total of 100", () => {
  const recipients = [
    address,
    "11111111111111111111111111111112",
    "11111111111111111111111111111113",
  ];
  const splits = recipients.map((recipient, i) => ({
    recipient,
    percent: [80, 15, 5][i],
  }));
  assert.equal(validatePayment({ ...payment, splits }), null);
  assert.ok(
    validatePayment({
      ...payment,
      splits: splits.map((s) => ({ ...s, percent: 10 })),
    }),
  );
  assert.ok(
    validatePayment({
      ...payment,
      splits: splits.map((s) => ({ ...s, recipient: address })),
    }),
  );
  assert.ok(validatePayment({ ...payment, recipient: recipients[1], splits }));
  assert.ok(validatePayment({ ...payment, splits: [null, null, null] }));
});
