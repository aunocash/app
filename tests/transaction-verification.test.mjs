import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import bs58 from "bs58";

import { DEVNET_USDC_MINT } from "../lib/server/env.ts";
import { buildUnsignedPaymentTransaction } from "../lib/server/solana/transaction.ts";
import { verifyFinalizedTransaction } from "../lib/server/verification/verify-transaction.ts";

const key = () => bs58.encode(randomBytes(32));

function observationFrom(payer, blockhash, instructions) {
  const accountKeys = [payer];
  const add = (value) => {
    if (!accountKeys.includes(value)) accountKeys.push(value);
    return accountKeys.indexOf(value);
  };
  const rawInstructions = instructions.map((instruction) => ({
    programIdIndex: add(instruction.programAddress),
    accounts: instruction.accounts.map((account) => add(account.address)),
    data: bs58.encode(instruction.data),
  }));
  return {
    slot: 42n,
    meta: { err: null },
    transaction: {
      signatures: ["signature"],
      message: {
        accountKeys,
        header: { numRequiredSignatures: 1 },
        recentBlockhash: blockhash,
        instructions: rawInstructions,
      },
    },
  };
}

test("accepts an exact finalized SOL split and rejects reference or amount mismatches", async () => {
  const payer = key();
  const reference = key();
  const blockhash = key();
  const expectedTransfers = [
    { recipient: key(), amountBaseUnits: "10" },
    { recipient: key(), amountBaseUnits: "20" },
  ];
  const built = await buildUnsignedPaymentTransaction({
    asset: "SOL",
    payer,
    reference,
    recipients: expectedTransfers.map((item) => ({
      address: item.recipient,
      amountBaseUnits: BigInt(item.amountBaseUnits),
    })),
    lifetime: { blockhash, lastValidBlockHeight: 100n },
    usdcMint: DEVNET_USDC_MINT,
    existingTokenAccounts: new Set(),
  });
  const observation = observationFrom(payer, blockhash, built.instructions);
  const base = {
    observation,
    signature: "signature",
    payer,
    asset: "SOL",
    reference,
    recentBlockhash: blockhash,
    expectedTransfers,
    usdcMint: DEVNET_USDC_MINT,
  };

  assert.deepEqual(await verifyFinalizedTransaction(base), { ok: true, slot: 42n });
  assert.deepEqual(await verifyFinalizedTransaction({ ...base, reference: key() }), {
    ok: false,
    code: "REFERENCE_MISMATCH",
  });
  assert.deepEqual(
    await verifyFinalizedTransaction({
      ...base,
      expectedTransfers: [{ ...expectedTransfers[0], amountBaseUnits: "11" }, expectedTransfers[1]],
    }),
    { ok: false, code: "TRANSFER_MISMATCH" },
  );
  const malformed = structuredClone(observation);
  malformed.transaction.message.instructions[0].data = "***";
  assert.deepEqual(await verifyFinalizedTransaction({ ...base, observation: malformed }), {
    ok: false,
    code: "MALFORMED_TRANSACTION",
  });
});

test("accepts exact USDC TransferChecked destinations and rejects duplicate transfers", async () => {
  const payer = key();
  const reference = key();
  const blockhash = key();
  const expectedTransfers = [{ recipient: key(), amountBaseUnits: "1000000" }];
  const built = await buildUnsignedPaymentTransaction({
    asset: "USDC",
    payer,
    reference,
    recipients: [{ address: expectedTransfers[0].recipient, amountBaseUnits: 1_000_000n }],
    lifetime: { blockhash, lastValidBlockHeight: 100n },
    usdcMint: DEVNET_USDC_MINT,
    existingTokenAccounts: new Set(),
  });
  const base = {
    observation: observationFrom(payer, blockhash, built.instructions),
    signature: "signature",
    payer,
    asset: "USDC",
    reference,
    recentBlockhash: blockhash,
    expectedTransfers,
    usdcMint: DEVNET_USDC_MINT,
  };

  assert.deepEqual(await verifyFinalizedTransaction(base), { ok: true, slot: 42n });
  const duplicated = {
    ...base,
    observation: observationFrom(payer, blockhash, [
      ...built.instructions,
      built.instructions.at(-1),
    ]),
  };
  assert.deepEqual(await verifyFinalizedTransaction(duplicated), {
    ok: false,
    code: "TRANSFER_MISMATCH",
  });
});
