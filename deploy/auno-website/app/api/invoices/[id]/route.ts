import { getInvoice, invoiceHandled } from "@/lib/invoices/server";
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) { const { id } = await ctx.params; return invoiceHandled(() => getInvoice(id, req)); }
