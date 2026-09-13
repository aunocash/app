import { z } from "zod";

import { apiError, apiSuccess, readJson, requestIdFrom } from "@/lib/server/http";
import { clientAddress, enforceRateLimit } from "@/lib/server/rate-limit";
import { preparePaymentTransaction } from "@/lib/server/payments/transactions";
import { assertTrustedOrigin } from "@/lib/server/security/origin";

export const runtime = "nodejs";

const bodySchema = z.object({ payerWallet: z.string().min(32).max(44) }).strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = requestIdFrom(request);
  try {
    assertTrustedOrigin(request);
    const paymentId = (await context.params).id;
    await enforceRateLimit({
      key: `payments:prepare:${paymentId}:${clientAddress(request)}`,
      limit: 15,
      windowSeconds: 60,
    });
    const body = bodySchema.parse(await readJson(request));
    return apiSuccess(await preparePaymentTransaction(paymentId, body.payerWallet, request.headers.get("idempotency-key")), requestId, 201);
  } catch (error) {
    return apiError(error, requestId);
  }
}
