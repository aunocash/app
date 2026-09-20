import { getPublicInvoice } from "@/lib/invoices/server";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import type { InvoiceRecord } from "@/lib/invoices/types";

export async function GET(_: Request, ctx: { params: Promise<{ publicId: string }> }) {
  try {
    const invoice = await getPublicInvoice((await ctx.params).publicId);
    const pdf = await renderInvoicePdf(invoice as InvoiceRecord);
    const filename = "AUNO-Invoice-" + invoice.invoiceNumber + ".pdf";
    return new Response(pdf as BodyInit, { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(filename), "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invoice PDF unavailable.";
    const status = message === "Invoice not found." ? 404 : 503;
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
