import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";

import bs58 from "bs58";

import {
  createSiwsChallenge,
  decodeSignInSubmission,
  verifySiwsChallenge,
} from "../lib/server/auth/siws.ts";

function createSignedChallenge(now = new Date("2026-09-13T00:00:00.000Z")) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyBytes = publicKey.export({ type: "spki", format: "der" }).subarray(-32);
  const walletAddress = bs58.encode(publicKeyBytes);
  const challenge = createSiwsChallenge({
    walletAddress,
    origin: "https://auno.test",
    nonce: "nonce-12345678",
    now,
  });
  const signedMessage = new TextEncoder().encode(challenge.message);

  return {
    challenge,
    submission: {
      accountAddress: walletAddress,
      publicKey: Buffer.from(publicKeyBytes).toString("base64"),
      signedMessage: Buffer.from(signedMessage).toString("base64"),
      signature: sign(null, signedMessage, privateKey).toString("base64"),
    },
  };
}

test("creates a five-minute devnet SIWS challenge and verifies its signature", () => {
  const now = new Date("2026-09-13T00:00:00.000Z");
  const { challenge, submission } = createSignedChallenge(now);

  assert.equal(challenge.input.domain, "auno.test");
  assert.equal(challenge.input.uri, "https://auno.test/");
  assert.equal(challenge.input.chainId, "solana:devnet");
  assert.equal(challenge.input.expirationTime, "2026-09-13T00:05:00.000Z");
  assert.equal(
    verifySiwsChallenge(challenge.input, decodeSignInSubmission(submission), now),
    true,
  );
});

test("rejects expired, mismatched, and malformed SIWS submissions", () => {
  const now = new Date("2026-09-13T00:00:00.000Z");
  const { challenge, submission } = createSignedChallenge(now);

  assert.equal(
    verifySiwsChallenge(
      challenge.input,
      decodeSignInSubmission(submission),
      new Date("2026-09-13T00:05:00.000Z"),
    ),
    false,
  );
  assert.equal(
    verifySiwsChallenge(
      challenge.input,
      decodeSignInSubmission({ ...submission, accountAddress: "mismatch" }),
      now,
    ),
    false,
  );
  assert.throws(
    () => decodeSignInSubmission({ ...submission, signature: "***" }),
    /base64/i,
  );
});
