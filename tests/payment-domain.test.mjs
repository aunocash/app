import assert from "node:assert/strict";
import test from "node:test";

import {
  allocateByBasisPoints,
  parseDisplayAmount,
} from "../lib/server/payments/domain.ts";

test("parses SOL and USDC display amounts without floating point arithmetic", () => {
  assert.equal(parseDisplayAmount("1.000000001", 9), 1_000_000_001n);
  assert.equal(parseDisplayAmount("100.000001", 6), 100_000_001n);
});

test("rejects zero, excess precision, scientific notation, and int8 overflow", () => {
  for (const value of ["0", "1.0000001", "1e2", "-1", "9223372036854.775808"])
    assert.throws(() => parseDisplayAmount(value, 6));
});

test("allocates indivisible split remainders by largest remainder then input order", () => {
  assert.deepEqual(allocateByBasisPoints(10n, [3333, 3333, 3334]), [3n, 3n, 4n]);
  assert.deepEqual(allocateByBasisPoints(2n, [5000, 5000]), [1n, 1n]);
  assert.deepEqual(allocateByBasisPoints(1n, [5000, 5000]), [1n, 0n]);
});

test("rejects invalid split cardinality, totals, and non-positive shares", () => {
  for (const allocations of [[10_000, 0], [5000, 4000], [2500, 2500, 2500, 2500, 1, -1]])
    assert.throws(() => allocateByBasisPoints(100n, allocations));
});
