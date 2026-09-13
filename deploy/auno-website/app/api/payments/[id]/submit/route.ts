import { handled,submitPayment } from '@/lib/payments/server';
export async function POST(req:Request,ctx:{params:Promise<{id:string}>}){return handled(async()=>submitPayment(req,(await ctx.params).id));}
