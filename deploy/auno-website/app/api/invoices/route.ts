import { createInvoice, listInvoices, invoiceHandled } from "@/lib/invoices/server";
export async function GET(req: Request) { return invoiceHandled(() => listInvoices(req)); }
export async function POST(req: Request) { return invoiceHandled(() => createInvoice(req)); }
