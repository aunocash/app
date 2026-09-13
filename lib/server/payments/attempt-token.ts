import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createPreparedAttemptToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function matchesPreparedAttemptToken(token: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashToken(token), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}
