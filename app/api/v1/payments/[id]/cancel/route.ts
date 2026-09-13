import type { NextRequest } from "next/server";

import { requireAuthenticatedMerchant } from "@/lib/server/auth/service";
import { apiError, apiSuccess, requestIdFrom } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { cancelOwnedPayment } from "@/lib/server/payments/service";
import { assertTrustedOrigin } from "@/lib/server/security/origin";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = requestIdFrom(request);
  try {
    assertTrustedOrigin(request);
    const merchant = await requireAuthenticatedMerchant(request);
    await enforceRateLimit({ key: `payments:cancel:${merchant.id}`, limit: 30, windowSeconds: 60 });
    return apiSuccess(await cancelOwnedPayment(merchant, (await context.params).id), requestId);
  } catch (error) {
    return apiError(error, requestId);
  }
}
