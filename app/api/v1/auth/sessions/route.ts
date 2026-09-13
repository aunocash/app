import { cookies } from "next/headers";
import { z } from "zod";

import { createSessionFromChallenge, SESSION_COOKIE } from "@/lib/server/auth/service";
import { getServerEnv } from "@/lib/server/env";
import { apiError, apiSuccess, readJson, requestIdFrom } from "@/lib/server/http";
import { clientAddress, enforceRateLimit } from "@/lib/server/rate-limit";
import { assertTrustedOrigin } from "@/lib/server/security/origin";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    challengeId: z.string().min(1).max(80),
    accountAddress: z.string().min(32).max(44),
    publicKey: z.string().min(40).max(48),
    signedMessage: z.string().min(1).max(4_096),
    signature: z.string().min(80).max(96),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request);
  try {
    assertTrustedOrigin(request);
    await enforceRateLimit({
      key: `auth:session:${clientAddress(request)}`,
      limit: 10,
      windowSeconds: 60,
    });
    const body = bodySchema.parse(await readJson(request));
    const { token, expiresAt, merchant } = await createSessionFromChallenge(body.challengeId, body);
    const env = getServerEnv();
    (await cookies()).set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: env.SESSION_COOKIE_SECURE,
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
    return apiSuccess({ merchant, expiresAt: expiresAt.toISOString() }, requestId, 201);
  } catch (error) {
    return apiError(error, requestId);
  }
}
