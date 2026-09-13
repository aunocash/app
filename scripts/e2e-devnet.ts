import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import {
  address,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  generateKeyPairSigner,
  getBase64EncodedWireTransaction,
  getBase64Encoder,
  getTransactionDecoder,
  signTransaction,
} from "@solana/kit";

import { DEVNET_USDC_MINT } from "../lib/server/env";
import { buildUnsignedPaymentTransaction, deriveRecipientTokenAccounts } from "../lib/server/solana/transaction";

if (process.env.AUNO_E2E !== "1") throw new Error("Set AUNO_E2E=1 to authorize devnet transactions.");
const keypairPath = process.env.AUNO_E2E_KEYPAIR;
if (!keypairPath) throw new Error("AUNO_E2E_KEYPAIR must point to a local 64-byte Solana keypair JSON file.");

const baseUrl = process.env.AUNO_E2E_BASE_URL ?? "http://localhost:3000";
const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const signer = await createKeyPairSignerFromBytes(
  new Uint8Array(JSON.parse(await readFile(keypairPath, "utf8"))),
  true,
);
const rpc = createSolanaRpc(rpcUrl);
let sessionCookie = "";

async function api(path: string, init: RequestInit = {}, expected = [200, 201, 202]) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      origin: new URL(baseUrl).origin,
      "content-type": "application/json",
      ...(sessionCookie ? { cookie: sessionCookie } : {}),
      ...init.headers,
    },
  });
  const body = await response.json();
  if (!expected.includes(response.status)) {
    throw new Error(`${init.method ?? "GET"} ${path} returned ${response.status}: ${JSON.stringify(body)}`);
  }
  return { response, body };
}

async function authenticate() {
  const challenge = await api("/api/v1/auth/challenges", {
    method: "POST",
    body: JSON.stringify({ walletAddress: signer.address }),
  });
  const message = new TextEncoder().encode(challenge.body.data.message);
  const [signatures] = await signer.signMessages([{ content: message, signatures: {} }]);
  const signature = signatures[signer.address];
  const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", signer.keyPair.publicKey));
  const session = await api("/api/v1/auth/sessions", {
    method: "POST",
    body: JSON.stringify({
      challengeId: challenge.body.data.id,
      accountAddress: signer.address,
      publicKey: Buffer.from(publicKey).toString("base64"),
      signedMessage: Buffer.from(message).toString("base64"),
      signature: Buffer.from(signature).toString("base64"),
    }),
  });
  sessionCookie = session.response.headers.get("set-cookie")?.split(";")[0] ?? "";
  if (!sessionCookie) throw new Error("Session cookie was not issued.");
}

async function signSendAndSubmit(paymentId: string, prepared: Record<string, string>) {
  const transaction = getTransactionDecoder().decode(
    getBase64Encoder().encode(prepared.serializedTransaction),
  );
  const signed = await signTransaction([signer.keyPair], transaction);
  const signature = await rpc
    .sendTransaction(getBase64EncodedWireTransaction(signed), {
      encoding: "base64",
      skipPreflight: false,
      preflightCommitment: "confirmed",
    })
    .send();
  const submission = { transactionId: prepared.transactionId, signature };
  await api(`/api/v1/payments/${paymentId}/submissions`, {
    method: "POST",
    body: JSON.stringify(submission),
  });
  await api(`/api/v1/payments/${paymentId}/submissions`, {
    method: "POST",
    body: JSON.stringify(submission),
  });
  return signature;
}

async function waitForReceipt(paymentId: string) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const result = await api(`/api/v1/payments/${paymentId}/receipt`, {}, [200, 404]);
    if (result.response.status === 200) return result.body.data;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`Timed out waiting for receipt ${paymentId}.`);
}

async function waitForPaymentStatus(paymentId: string, expected: string) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const result = await api(`/api/v1/payments/${paymentId}`);
    if (result.body.data.status === expected) return result.body.data;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`Timed out waiting for payment ${paymentId} to become ${expected}.`);
}

async function tokenBalance(owner: string): Promise<bigint> {
  const [ata] = await deriveRecipientTokenAccounts(
    [{ address: owner, amountBaseUnits: 1n }],
    DEVNET_USDC_MINT,
  );
  try {
    const { value } = await rpc.getTokenAccountBalance(address(ata), { commitment: "confirmed" }).send();
    return BigInt(value.amount);
  } catch {
    return 0n;
  }
}

async function runPayment(asset: "SOL" | "USDC", split: boolean) {
  const recipients = await Promise.all(
    Array.from({ length: split ? 2 : 1 }, () => generateKeyPairSigner()),
  );
  const amount = asset === "SOL" ? (split ? "0.000001001" : "0.000001") : split ? "0.000002" : "0.000001";
  const recipientInput = recipients.map((recipient) => ({
    address: recipient.address,
    allocationBps: split ? 5_000 : 10_000,
  }));
  const before = await Promise.all(
    recipients.map(async (recipient) =>
      asset === "SOL"
        ? (await rpc.getBalance(recipient.address, { commitment: "confirmed" }).send()).value
        : tokenBalance(recipient.address),
    ),
  );
  const created = await api("/api/v1/payments", {
    method: "POST",
    headers: { "idempotency-key": `e2e-${asset}-${split}-${randomUUID()}` },
    body: JSON.stringify({
      title: `E2E ${split ? "split " : ""}${asset}`,
      asset,
      amount,
      recipients: recipientInput,
    }),
  });
  const payment = created.body.data;
  const prepared = await api(`/api/v1/payments/${payment.id}/transactions`, {
    method: "POST",
    body: JSON.stringify({ payerWallet: signer.address }),
  });
  const signature = await signSendAndSubmit(payment.id, prepared.body.data);
  const receipt = await waitForReceipt(payment.id);
  assert(receipt.signature === signature, "Receipt signature mismatch.");

  const after = await Promise.all(
    recipients.map(async (recipient) =>
      asset === "SOL"
        ? (await rpc.getBalance(recipient.address, { commitment: "confirmed" }).send()).value
        : tokenBalance(recipient.address),
    ),
  );
  payment.recipients.forEach((recipient: { amountBaseUnits: string }, index: number) => {
    assert(after[index] - before[index] === BigInt(recipient.amountBaseUnits), "Recipient balance delta mismatch.");
  });
  console.info(JSON.stringify({ scenario: `${split ? "split-" : "standard-"}${asset}`, paymentId: payment.id, signature }));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

await authenticate();
await api("/api/v1/payments", {
  method: "POST",
  body: JSON.stringify({
    title: "Invalid recipient",
    asset: "SOL",
    amount: "0.000001",
    recipients: [{ address: "invalid", allocationBps: 10_000 }],
  }),
}, [400]);

const expiring = await api("/api/v1/payments", {
  method: "POST",
  body: JSON.stringify({
    title: "Expiring payment",
    asset: "SOL",
    amount: "0.000001",
    expiresAt: new Date(Date.now() + 1_000).toISOString(),
    recipients: [{ address: (await generateKeyPairSigner()).address, allocationBps: 10_000 }],
  }),
});
await new Promise((resolve) => setTimeout(resolve, 1_100));
await api(`/api/v1/payments/${expiring.body.data.id}/transactions`, {
  method: "POST",
  body: JSON.stringify({ payerWallet: signer.address }),
}, [410]);

for (const asset of ["SOL", "USDC"] as const) {
  await runPayment(asset, false);
  await runPayment(asset, true);
}

const mismatchRecipient = await generateKeyPairSigner();
const mismatch = await api("/api/v1/payments", {
  method: "POST",
  body: JSON.stringify({
    title: "Transaction mismatch",
    asset: "SOL",
    amount: "0.000001",
    recipients: [{ address: mismatchRecipient.address, allocationBps: 10_000 }],
  }),
});
const mismatchPrepared = await api(`/api/v1/payments/${mismatch.body.data.id}/transactions`, {
  method: "POST",
  body: JSON.stringify({ payerWallet: signer.address }),
});
await api(`/api/v1/payments/${mismatch.body.data.id}/submissions`, {
  method: "POST",
  body: JSON.stringify({ transactionId: mismatchPrepared.body.data.transactionId }),
}, [400]);
const wrongTransaction = await buildUnsignedPaymentTransaction({
  asset: "SOL",
  payer: signer.address,
  reference: mismatchPrepared.body.data.reference,
  recipients: [{ address: mismatchRecipient.address, amountBaseUnits: 1n }],
  lifetime: {
    blockhash: mismatchPrepared.body.data.recentBlockhash,
    lastValidBlockHeight: BigInt(mismatchPrepared.body.data.lastValidBlockHeight),
  },
  usdcMint: DEVNET_USDC_MINT,
  existingTokenAccounts: new Set(),
});
const wrongDecoded = getTransactionDecoder().decode(
  getBase64Encoder().encode(wrongTransaction.serializedTransaction),
);
const wrongSigned = await signTransaction([signer.keyPair], wrongDecoded);
const wrongSignature = await rpc
  .sendTransaction(getBase64EncodedWireTransaction(wrongSigned), {
    encoding: "base64",
    skipPreflight: false,
    preflightCommitment: "confirmed",
  })
  .send();
await api(`/api/v1/payments/${mismatch.body.data.id}/submissions`, {
  method: "POST",
  body: JSON.stringify({
    transactionId: mismatchPrepared.body.data.transactionId,
    signature: wrongSignature,
  }),
});
await waitForPaymentStatus(mismatch.body.data.id, "FAILED");
console.info("Devnet E2E scenarios passed, including finalized receipts and a rejected mismatch.");
