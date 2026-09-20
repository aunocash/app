import { invoiceHandled, voidInvoice } from "@/lib/invoices/server";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) { const { id } = await ctx.params; return invoiceHandled(() => voidInvoice(req, id)); }
