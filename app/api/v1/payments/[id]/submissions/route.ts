import { z } from "zod";

import { apiError, apiSuccess, readJson, requestIdFrom } from "@/lib/server/http";
import { clientAddress, enforceRateLimit } from "@/lib/server/rate-limit";
import { submitPaymentTransaction } from "@/lib/server/payments/transactions";
import { assertTrustedOrigin } from "@/lib/server/security/origin";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    transactionId: z.string().min(1).max(80),
    signature: z.string().min(80).max(100),
  })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = requestIdFrom(request);
  try {
    assertTrustedOrigin(request);
    const paymentId = (await context.params).id;
    await enforceRateLimit({
      key: `payments:submit:${paymentId}:${clientAddress(request)}`,
      limit: 30,
      windowSeconds: 60,
    });
    const body = bodySchema.parse(await readJson(request));
    return apiSuccess(
      await submitPaymentTransaction(paymentId, body.transactionId, body.signature),
      requestId,
      202,
    );
  } catch (error) {
    return apiError(error, requestId);
  }
}
