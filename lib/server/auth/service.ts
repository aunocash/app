import { createHash, randomBytes } from "node:crypto";

import type { SolanaSignInInput } from "@solana/wallet-standard-features";
import { address } from "@solana/kit";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { db } from "../db/client";
import { authChallenges, merchants, sessions } from "../db/schema";
import { getServerEnv } from "../env";
import { HttpError } from "../http";
import {
  createSiwsChallenge,
  decodeSignInSubmission,
  type SignInSubmission,
  verifySiwsChallenge,
} from "./siws";

export const SESSION_COOKIE = "auno_session";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function validateWalletAddress(value: string): string {
  try {
    return address(value);
  } catch {
    throw new HttpError(400, "INVALID_WALLET", "Wallet address is invalid.");
  }
}

export async function issueChallenge(walletAddress: string) {
  const wallet = validateWalletAddress(walletAddress);
  const challenge = createSiwsChallenge({ walletAddress: wallet, origin: getServerEnv().APP_ORIGIN });
  const [stored] = await db
    .insert(authChallenges)
    .values({
      walletAddress: wallet,
      nonce: challenge.input.nonce!,
      message: challenge.message,
      domain: challenge.input.domain,
      uri: challenge.input.uri!,
      chainId: challenge.input.chainId!,
      issuedAt: new Date(challenge.input.issuedAt!),
      expiresAt: challenge.expiresAt,
    })
    .returning({ id: authChallenges.id });

  return { id: stored.id, input: challenge.input, message: challenge.message };
}

export async function createSessionFromChallenge(
  challengeId: string,
  submission: SignInSubmission,
) {
  const now = new Date();
  const env = getServerEnv();
  const output = decodeSignInSubmission(submission);

  return db.transaction(async (tx) => {
    const [challenge] = await tx
      .select()
      .from(authChallenges)
      .where(
        and(
          eq(authChallenges.id, challengeId),
          isNull(authChallenges.consumedAt),
          gt(authChallenges.expiresAt, now),
        ),
      )
      .for("update");
    if (!challenge) {
      throw new HttpError(401, "CHALLENGE_INVALID", "Challenge is expired, consumed, or unknown.");
    }

    const input: SolanaSignInInput & Required<Pick<SolanaSignInInput, "domain" | "address">> = {
      domain: challenge.domain,
      address: challenge.walletAddress,
      statement: "Sign in to AUNO.",
      uri: challenge.uri,
      version: "1",
      chainId: challenge.chainId,
      nonce: challenge.nonce,
      issuedAt: challenge.issuedAt.toISOString(),
      expirationTime: challenge.expiresAt.toISOString(),
    };
    if (!verifySiwsChallenge(input, output, now)) {
      throw new HttpError(401, "SIGNATURE_INVALID", "Wallet signature could not be verified.");
    }

    const [merchant] = await tx
      .insert(merchants)
      .values({ walletAddress: challenge.walletAddress })
      .onConflictDoUpdate({
        target: merchants.walletAddress,
        set: { updatedAt: now },
      })
      .returning({ id: merchants.id, walletAddress: merchants.walletAddress });

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + env.SESSION_TTL_SECONDS * 1000);
    await tx.insert(sessions).values({ merchantId: merchant.id, tokenHash: hashToken(token), expiresAt });
    await tx
      .update(authChallenges)
      .set({ consumedAt: now, updatedAt: now })
      .where(eq(authChallenges.id, challenge.id));

    return { token, expiresAt, merchant };
  });
}

export type AuthenticatedMerchant = { id: string; walletAddress: string };

export async function getAuthenticatedMerchant(
  request: NextRequest,
): Promise<AuthenticatedMerchant | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [session] = await db
    .select({ id: merchants.id, walletAddress: merchants.walletAddress })
    .from(sessions)
    .innerJoin(merchants, eq(sessions.merchantId, merchants.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return session ?? null;
}

export async function requireAuthenticatedMerchant(
  request: NextRequest,
): Promise<AuthenticatedMerchant> {
  const merchant = await getAuthenticatedMerchant(request);
  if (!merchant) throw new HttpError(401, "UNAUTHENTICATED", "A valid merchant session is required.");
  return merchant;
}

export async function revokeRequestSession(request: NextRequest): Promise<void> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}
