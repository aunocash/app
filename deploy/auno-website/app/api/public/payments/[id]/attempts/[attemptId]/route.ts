import { handled, publicAttempt } from '@/lib/payments/server';
export async function GET(req: Request, ctx: { params: Promise<{ id: string; attemptId: string }> }) { return handled(async () => { const { id, attemptId } = await ctx.params; return publicAttempt(req, id, attemptId); }); }
