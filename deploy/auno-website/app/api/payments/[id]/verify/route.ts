import { handled,verifyPayment,jsonBody,sameOrigin } from '@/lib/payments/server';
export async function POST(req:Request,ctx:{params:Promise<{id:string}>}){return handled(async()=>{sameOrigin(req);const body=await jsonBody(req);return verifyPayment((await ctx.params).id,body.attemptId,body.attemptToken);});}
