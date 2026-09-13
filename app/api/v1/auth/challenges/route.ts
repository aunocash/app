import { z } from "zod";

import { issueChallenge } from "@/lib/server/auth/service";
import { apiError, apiSuccess, readJson, requestIdFrom } from "@/lib/server/http";
import { clientAddress, enforceRateLimit } from "@/lib/server/rate-limit";
import { assertTrustedOrigin } from "@/lib/server/security/origin";

export const runtime = "nodejs";

const bodySchema = z.object({ walletAddress: z.string().min(32).max(44) }).strict();

export async function POST(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request);
  try {
    assertTrustedOrigin(request);
    await enforceRateLimit({
      key: `auth:challenge:${clientAddress(request)}`,
      limit: 10,
      windowSeconds: 60,
    });
    const body = bodySchema.parse(await readJson(request));
    return apiSuccess(await issueChallenge(body.walletAddress), requestId, 201);
  } catch (error) {
    return apiError(error, requestId);
  }
}
