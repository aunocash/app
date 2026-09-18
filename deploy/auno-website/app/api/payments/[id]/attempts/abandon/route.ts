import { abandonAttempt, handled } from '@/lib/payments/server';
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) { return handled(async () => abandonAttempt(req, (await ctx.params).id)); }
