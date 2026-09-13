import { address } from "@solana/kit";

import { getServerEnv } from "@/lib/server/env";
import { HttpError, apiError, apiSuccess, requestIdFrom } from "@/lib/server/http";
import { clientAddress, enforceRateLimit } from "@/lib/server/rate-limit";
import { createDevnetDemoPayment } from "@/lib/server/payments/public";
import { assertTrustedOrigin } from "@/lib/server/security/origin";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request);
  try {
    assertTrustedOrigin(request);
    const env = getServerEnv();
    const recipientWallet = env.DEMO_RECIPIENT_WALLET;
    if (env.SOLANA_NETWORK !== "devnet" || !env.ENABLE_DEVNET_DEMO || !recipientWallet) {
      throw new HttpError(404, "DEMO_UNAVAILABLE", "The live devnet demo is unavailable.");
    }
    let recipient: string;
    try {
      recipient = address(recipientWallet);
    } catch {
      throw new HttpError(503, "DEMO_UNAVAILABLE", "The live devnet demo is unavailable.");
    }
    await enforceRateLimit({
      key: `payments:demo:${clientAddress(request)}`,
      limit: 5,
      windowSeconds: 60 * 60,
    });
    const payment = await createDevnetDemoPayment({
      recipientWallet: recipient,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    return apiSuccess(payment, requestId, 201);
  } catch (error) {
    return apiError(error, requestId);
  }
}
