import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import { parseTransferSolInstruction } from "@solana-program/system";
import { parseTransferCheckedInstruction } from "@solana-program/token";
import bs58 from "bs58";

import { DEVNET_USDC_MINT } from "../lib/server/env.ts";
import { buildUnsignedPaymentTransaction } from "../lib/server/solana/transaction.ts";

const key = () => bs58.encode(randomBytes(32));
const lifetime = { blockhash: key(), lastValidBlockHeight: 123456n };

test("builds an unsigned referenced SOL split transaction", async () => {
  const payer = key();
  const reference = key();
  const recipients = [
    { address: key(), amountBaseUnits: 2_000_000n },
    { address: key(), amountBaseUnits: 3_000_000n },
  ];
  const result = await buildUnsignedPaymentTransaction({
    asset: "SOL",
    payer,
    reference,
    recipients,
    lifetime,
    usdcMint: DEVNET_USDC_MINT,
    existingTokenAccounts: new Set(),
  });

  assert.equal(result.instructions.length, 2);
  assert.deepEqual(
    result.instructions.map((instruction) => parseTransferSolInstruction(instruction).data.amount),
    [2_000_000n, 3_000_000n],
  );
  assert.ok(result.instructions.every((instruction) => instruction.accounts.at(-1).address === reference));
  assert.ok(Buffer.from(result.serializedTransaction, "base64").length <= 1232);
});

test("builds TransferChecked USDC instructions and only creates missing recipient ATAs", async () => {
  const payer = key();
  const first = key();
  const second = key();
  const firstBuild = await buildUnsignedPaymentTransaction({
    asset: "USDC",
    payer,
    reference: key(),
    recipients: [
      { address: first, amountBaseUnits: 1_500_000n },
      { address: second, amountBaseUnits: 2_500_000n },
    ],
    lifetime,
    usdcMint: DEVNET_USDC_MINT,
    existingTokenAccounts: new Set(),
  });
  const existingAta = firstBuild.recipientTokenAccounts[0];
  const result = await buildUnsignedPaymentTransaction({
    asset: "USDC",
    payer,
    reference: key(),
    recipients: [
      { address: first, amountBaseUnits: 1_500_000n },
      { address: second, amountBaseUnits: 2_500_000n },
    ],
    lifetime,
    usdcMint: DEVNET_USDC_MINT,
    existingTokenAccounts: new Set([existingAta]),
  });

  assert.equal(result.instructions.length, 3);
  const transfers = result.instructions.filter((instruction) => instruction.programAddress.endsWith("Q5DA"));
  assert.deepEqual(
    transfers.map((instruction) => parseTransferCheckedInstruction(instruction).data.amount),
    [1_500_000n, 2_500_000n],
  );
  assert.ok(transfers.every((instruction) => parseTransferCheckedInstruction(instruction).data.decimals === 6));
});
