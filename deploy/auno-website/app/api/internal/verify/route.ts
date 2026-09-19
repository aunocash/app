import { assertVerifierAuthorization, handled, verifyPendingPayments } from '@/lib/payments/server';

export async function POST(req: Request) {
  return handled(async () => {
    assertVerifierAuthorization(req);
    return verifyPendingPayments();
  });
}
