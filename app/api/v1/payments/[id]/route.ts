import type { NextRequest } from "next/server";

import { requireAuthenticatedMerchant } from "@/lib/server/auth/service";
import { apiError, apiSuccess, requestIdFrom } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getOwnedPayment } from "@/lib/server/payments/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = requestIdFrom(request);
  try {
    const merchant = await requireAuthenticatedMerchant(request);
    await enforceRateLimit({ key: `payments:read:${merchant.id}`, limit: 120, windowSeconds: 60 });
    return apiSuccess(await getOwnedPayment(merchant, (await context.params).id), requestId);
  } catch (error) {
    return apiError(error, requestId);
  }
}
