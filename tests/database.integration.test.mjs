import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes, sign } from "node:crypto";
import test from "node:test";

import bs58 from "bs58";

const enabled = process.env.RUN_DB_INTEGRATION === "true";
const key = () => bs58.encode(randomBytes(32));

test("PostgreSQL auth, ownership, idempotency, constraints, and SKIP LOCKED claims", { skip: !enabled }, async () => {
  process.env.NODE_ENV = "test";
  process.env.APP_ORIGIN = "http://localhost:3000";
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://auno:auno@localhost:5432/auno";
  process.env.SOLANA_NETWORK = "devnet";
  process.env.SOLANA_RPC_URL = "https://api.devnet.solana.com";

  const [{ db, pool }, schema, auth, payments, worker] = await Promise.all([
    import("../lib/server/db/client.ts"),
    import("../lib/server/db/schema.ts"),
    import("../lib/server/auth/service.ts"),
    import("../lib/server/payments/service.ts"),
    import("../lib/server/verification/worker-service.ts"),
  ]);

  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyBytes = publicKey.export({ type: "spki", format: "der" }).subarray(-32);
  const walletAddress = bs58.encode(publicKeyBytes);
  const challenge = await auth.issueChallenge(walletAddress);
  const signedMessage = new TextEncoder().encode(challenge.message);
  const submission = {
    accountAddress: walletAddress,
    publicKey: Buffer.from(publicKeyBytes).toString("base64"),
    signedMessage: Buffer.from(signedMessage).toString("base64"),
    signature: sign(null, signedMessage, privateKey).toString("base64"),
  };
  const session = await auth.createSessionFromChallenge(challenge.id, submission);
  await assert.rejects(
    () => auth.createSessionFromChallenge(challenge.id, submission),
    (error) => error.code === "CHALLENGE_INVALID",
  );

  const [otherMerchant] = await db
    .insert(schema.merchants)
    .values({ walletAddress: key() })
    .returning({ id: schema.merchants.id, walletAddress: schema.merchants.walletAddress });
  const recipient = key();
  const input = {
    title: "Integration payment",
    asset: "SOL",
    amount: "0.000001",
    recipients: [{ address: recipient, allocationBps: 10_000 }],
  };
  const created = await payments.createPayment(session.merchant, input, "integration-create");
  const replayed = await payments.createPayment(session.merchant, input, "integration-create");
  assert.equal(replayed.id, created.id);
  await assert.rejects(
    () => payments.createPayment(session.merchant, { ...input, amount: "0.000002" }, "integration-create"),
    (error) => error.code === "IDEMPOTENCY_CONFLICT",
  );
  await assert.rejects(
    () => payments.getOwnedPayment(otherMerchant, created.id),
    (error) => error.code === "PAYMENT_NOT_FOUND",
  );

  const now = new Date();
  const [attempt] = await db
    .insert(schema.paymentTransactions)
    .values({
      paymentId: created.id,
      payerWallet: key(),
      network: "devnet",
      asset: "SOL",
      referenceAddress: key(),
      status: "PREPARED",
      expectedTransfers: [{ recipient, amountBaseUnits: "1000" }],
      recentBlockhash: key(),
      lastValidBlockHeight: 999999999n,
      nextVerificationAt: now,
    })
    .returning();
  const [firstClaims, secondClaims] = await Promise.all([
    worker.claimVerificationAttempts("integration-worker-a", 1),
    worker.claimVerificationAttempts("integration-worker-b", 1),
  ]);
  assert.equal([...firstClaims, ...secondClaims].filter((item) => item.id === attempt.id).length, 1);

  await db
    .update(schema.paymentTransactions)
    .set({ status: "FAILED", lockedAt: null, lockedBy: null })
    .where((await import("drizzle-orm")).eq(schema.paymentTransactions.id, attempt.id));
  const cancelled = await payments.cancelOwnedPayment(session.merchant, created.id);
  assert.equal(cancelled.status, "CANCELLED");

  await assert.rejects(
    () => db.insert(schema.merchants).values({ walletAddress }).returning(),
    (error) => error.code === "23505",
  );

  await pool.end();
});
