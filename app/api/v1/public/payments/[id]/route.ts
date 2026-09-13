import { apiError, apiSuccess, requestIdFrom } from "@/lib/server/http";
import { clientAddress, enforceRateLimit } from "@/lib/server/rate-limit";
import { getPublicPayment } from "@/lib/server/payments/public";

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
      key: `payments:public:${paymentId}:${clientAddress(request)}`,
      limit: 120,
      windowSeconds: 60,
    });
    return apiSuccess(await getPublicPayment(paymentId), requestId);
  } catch (error) {
    return apiError(error, requestId);
  }
}
