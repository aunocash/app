import { handled,preparePayment } from '@/lib/payments/server';
export async function POST(req:Request,ctx:{params:Promise<{id:string}>}){return handled(async()=>preparePayment(req,(await ctx.params).id));}
