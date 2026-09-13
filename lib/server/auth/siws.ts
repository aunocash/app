import { randomBytes } from "node:crypto";

import type { SolanaSignInInput, SolanaSignInOutput } from "@solana/wallet-standard-features";
import { createSignInMessageText, verifySignIn } from "@solana/wallet-standard-util";
import bs58 from "bs58";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export type SiwsChallenge = {
  input: SolanaSignInInput & Required<Pick<SolanaSignInInput, "domain" | "address">>;
  message: string;
  expiresAt: Date;
};

export type SignInSubmission = {
  accountAddress: string;
  publicKey: string;
  signedMessage: string;
  signature: string;
};

function decodeBase64(value: string, field: string): Uint8Array {
  if (!BASE64_PATTERN.test(value)) throw new Error(`${field} must be valid base64.`);
  return Buffer.from(value, "base64");
}

export function createSiwsChallenge(options: {
  walletAddress: string;
  origin: string;
  nonce?: string;
  now?: Date;
}): SiwsChallenge {
  const now = options.now ?? new Date();
  const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS);
  const origin = new URL(options.origin);
  const input = {
    domain: origin.host,
    address: options.walletAddress,
    statement: "Sign in to AUNO.",
    uri: origin.href,
    version: "1",
    chainId: "solana:devnet",
    nonce: options.nonce ?? randomBytes(16).toString("base64url"),
    issuedAt: now.toISOString(),
    expirationTime: expiresAt.toISOString(),
  } satisfies SiwsChallenge["input"];

  return { input, message: createSignInMessageText(input), expiresAt };
}

export function decodeSignInSubmission(submission: SignInSubmission): SolanaSignInOutput {
  const publicKey = decodeBase64(submission.publicKey, "publicKey");
  if (publicKey.length !== 32) throw new Error("publicKey must contain 32 bytes.");
  const signature = decodeBase64(submission.signature, "signature");
  if (signature.length !== 64) throw new Error("signature must contain 64 bytes.");

  return {
    account: {
      address: submission.accountAddress,
      publicKey,
      chains: ["solana:devnet"],
      features: ["solana:signIn"],
    },
    signedMessage: decodeBase64(submission.signedMessage, "signedMessage"),
    signature,
    signatureType: "ed25519",
  };
}

export function verifySiwsChallenge(
  input: SiwsChallenge["input"],
  output: SolanaSignInOutput,
  now = new Date(),
): boolean {
  if (!input.expirationTime || new Date(input.expirationTime) <= now) return false;
  if (!input.issuedAt || new Date(input.issuedAt) > now) return false;
  if (input.chainId !== "solana:devnet") return false;
  if (output.account.address !== input.address) return false;
  if (bs58.encode(new Uint8Array(output.account.publicKey)) !== input.address) return false;
  return verifySignIn(input, output);
}
