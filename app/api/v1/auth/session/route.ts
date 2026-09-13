import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

import {
  getAuthenticatedMerchant,
  revokeRequestSession,
  SESSION_COOKIE,
} from "@/lib/server/auth/service";
import { apiError, apiSuccess, requestIdFrom } from "@/lib/server/http";
import { assertTrustedOrigin } from "@/lib/server/security/origin";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = requestIdFrom(request);
  try {
    return apiSuccess({ merchant: await getAuthenticatedMerchant(request) }, requestId);
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function DELETE(request: NextRequest): Promise<Response> {
  const requestId = requestIdFrom(request);
  try {
    assertTrustedOrigin(request);
    await revokeRequestSession(request);
    (await cookies()).delete(SESSION_COOKIE);
    return apiSuccess({ revoked: true }, requestId);
  } catch (error) {
    return apiError(error, requestId);
  }
}
