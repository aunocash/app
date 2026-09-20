import { publicInvoiceReceipt, invoiceHandled } from "@/lib/invoices/server";
export async function GET(_: Request, ctx: { params: Promise<{ publicId: string }> }) { const { publicId } = await ctx.params; return invoiceHandled(() => publicInvoiceReceipt(publicId)); }
