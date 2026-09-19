import { handled, publicSplitReceipt } from "@/lib/payments/server";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handled(async () => publicSplitReceipt((await ctx.params).id));
}
