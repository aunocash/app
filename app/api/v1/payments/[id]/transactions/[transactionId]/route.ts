import { z } from "zod";

import { apiError, apiSuccess, readJson, requestIdFrom } from "@/lib/server/http";
import { clientAddress, enforceRateLimit } from "@/lib/server/rate-limit";
import { abandonPreparedPaymentTransaction } from "@/lib/server/payments/attempts";
import { assertTrustedOrigin } from "@/lib/server/security/origin";

export const runtime = "nodejs";

const bodySchema = z.object({ abandonToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; transactionId: string }> },
): Promise<Response> {
  const requestId = requestIdFrom(request);
  try {
    assertTrustedOrigin(request);
    const { id: paymentId, transactionId } = await context.params;
    await enforceRateLimit({
      key: `payments:abandon:${paymentId}:${clientAddress(request)}`,
      limit: 15,
      windowSeconds: 60,
    });
    const body = bodySchema.parse(await readJson(request));
    return apiSuccess(
      await abandonPreparedPaymentTransaction(paymentId, transactionId, body.abandonToken),
      requestId,
    );
  } catch (error) {
    return apiError(error, requestId);
  }
}
