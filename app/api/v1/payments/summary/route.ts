import type { NextRequest } from "next/server";

import { requireAuthenticatedMerchant } from "@/lib/server/auth/service";
import { apiError, apiSuccess, requestIdFrom } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getOwnedPaymentSummary } from "@/lib/server/payments/public";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = requestIdFrom(request);
  try {
    const merchant = await requireAuthenticatedMerchant(request);
    await enforceRateLimit({
      key: `payments:summary:${merchant.id}`,
      limit: 60,
      windowSeconds: 60,
    });
    return apiSuccess(await getOwnedPaymentSummary(merchant), requestId);
  } catch (error) {
    return apiError(error, requestId);
  }
}
