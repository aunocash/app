import { invoiceHandled, publishInvoice } from "@/lib/invoices/server";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) { const { id } = await ctx.params; return invoiceHandled(() => publishInvoice(req, id)); }
