import type { NextRequest } from "next/server";
import { z } from "zod";

import { ASSETS, PAYMENT_STATUSES } from "@/lib/contracts/payments";
import { requireAuthenticatedMerchant } from "@/lib/server/auth/service";
import { apiError, apiSuccess, readJson, requestIdFrom } from "@/lib/server/http";
import { clientAddress, enforceRateLimit } from "@/lib/server/rate-limit";
import { assertTrustedOrigin } from "@/lib/server/security/origin";
import { createPayment, listOwnedPayments } from "@/lib/server/payments/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const listSchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(PAYMENT_STATUSES).optional(),
  asset: z.enum(ASSETS).optional(),
  search: z.string().trim().min(1).max(100).optional(),
});

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = requestIdFrom(request);
  try {
    assertTrustedOrigin(request);
    const merchant = await requireAuthenticatedMerchant(request);
    await enforceRateLimit({ key: `payments:create:${merchant.id}`, limit: 30, windowSeconds: 60 });
    const payment = await createPayment(
      merchant,
      (await readJson(request)) as never,
      request.headers.get("idempotency-key"),
    );
    return apiSuccess(payment, requestId, 201);
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = requestIdFrom(request);
  try {
    const merchant = await requireAuthenticatedMerchant(request);
    await enforceRateLimit({
      key: `payments:list:${merchant.id}:${clientAddress(request)}`,
      limit: 120,
      windowSeconds: 60,
    });
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    return apiSuccess(await listOwnedPayments(merchant, listSchema.parse(searchParams)), requestId);
  } catch (error) {
    return apiError(error, requestId);
  }
}
