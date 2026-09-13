import { handled,createPayment,listPayments } from '@/lib/payments/server';
export async function POST(req:Request){return handled(()=>createPayment(req));}
export async function GET(req:Request){return handled(()=>listPayments(req));}
