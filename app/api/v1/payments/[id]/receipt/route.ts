import { apiError, apiSuccess, requestIdFrom } from "@/lib/server/http";
import { getPaymentReceipt } from "@/lib/server/payments/receipts";
import { clientAddress, enforceRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = requestIdFrom(request);
  try {
    const paymentId = (await context.params).id;
    await enforceRateLimit({
      key: `payments:receipt:${paymentId}:${clientAddress(request)}`,
      limit: 120,
      windowSeconds: 60,
    });
    return apiSuccess(await getPaymentReceipt(paymentId), requestId);
  } catch (error) {
    return apiError(error, requestId);
  }
}
