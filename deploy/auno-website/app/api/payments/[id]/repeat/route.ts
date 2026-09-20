import { getRepeatPayment, handled } from '@/lib/payments/server';

// Read-only: returns the same public terms as checkout, only after finalization.
// Creation and signing continue through the existing authenticated payment flow.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handled(async () => getRepeatPayment((await ctx.params).id));
}
