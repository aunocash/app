import { handled,getPayment } from '@/lib/payments/server';
export async function GET(req:Request,ctx:{params:Promise<{id:string}>}){return handled(async()=>getPayment((await ctx.params).id));}
