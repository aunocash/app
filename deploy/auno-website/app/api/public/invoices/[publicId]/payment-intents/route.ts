import { createInvoicePayment, invoiceHandled } from "@/lib/invoices/server";
export async function POST(req: Request, ctx: { params: Promise<{ publicId: string }> }) { const { publicId } = await ctx.params; return invoiceHandled(() => createInvoicePayment(req, publicId)); }
