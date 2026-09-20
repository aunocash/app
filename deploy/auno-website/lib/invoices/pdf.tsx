import React from "react";
import { render } from "takumi-pdf";
import { PageNumber, TotalPages } from "takumi-pdf/primitives";
import { PdfWatermark } from "@/components/pdf/watermark";
import type { InvoiceRecord } from "./types";

const E = React.createElement;
const Box = "div" as unknown as React.ElementType;
const text = (value: string, tw?: string) => E("div", tw ? { tw } : null, value);

export async function renderInvoicePdf(invoice: InvoiceRecord) {
  const rows = invoice.items.map((item, index) => E(Box, { key: index, tw: "flex flex-row border-b border-slate-200 px-4 py-4 text-sm text-slate-800" },
    E("div", { tw: "flex-1" }, item.description),
    E("div", { tw: "w-24 text-right" }, item.quantity),
    E("div", { tw: "w-32 text-right" }, item.lineTotal + " " + invoice.accountingCurrency)));
  const children = [
    E(PdfWatermark, { key: "watermark", text: invoice.status === "PAID" ? "PAID" : "AUNO INVOICE", opacity: 0.08, fontSize: 62, angle: -28, position: "center", fixed: true }),
    E(Box, { key: "header", tw: "flex flex-row items-start justify-between border-b-2 border-slate-900 pb-6" }, [
      E(Box, { key: "brand", tw: "flex flex-col" }, [text("AUNO.CASH", "text-3xl font-bold text-slate-950"), text("Solana payment invoice", "mt-2 text-sm text-slate-500")]),
      E(Box, { key: "number", tw: "flex flex-col items-end" }, [text(invoice.invoiceNumber, "text-xl font-bold text-slate-950"), text(invoice.status, "mt-2 text-sm text-slate-500"), text("Issued " + invoice.issueDate, "mt-1 text-sm text-slate-500")]),
    ]),
    E(Box, { key: "parties", tw: "mt-8 flex flex-row justify-between" }, [
      E(Box, { key: "customer", tw: "flex flex-col" }, [text("Bill to", "text-xs font-bold uppercase text-slate-500"), text(invoice.customerName || "Customer", "mt-2 text-base font-bold text-slate-950"), invoice.customerEmail ? text(invoice.customerEmail, "mt-1 text-sm text-slate-600") : null]),
      E(Box, { key: "recipient", tw: "flex flex-col items-end" }, [text("Pay to", "text-xs font-bold uppercase text-slate-500"), text(invoice.recipientWallet, "mt-2 text-sm text-slate-700")]),
    ]),
    E(Box, { key: "title", tw: "mt-8 flex flex-col" }, [text(invoice.title, "text-2xl font-bold text-slate-950"), invoice.description ? text(invoice.description, "mt-2 text-sm text-slate-600") : null]),
    E(Box, { key: "items", tw: "mt-8 flex flex-col border border-slate-200" }, [
      E(Box, { key: "head", tw: "flex flex-row border-b border-slate-200 bg-slate-100 px-4 py-3 text-xs font-bold uppercase text-slate-600" }, [text("Description", "flex-1"), text("Qty", "w-24 text-right"), text("Amount", "w-32 text-right")]),
      rows,
    ]),
    E(Box, { key: "totals", tw: "mt-6 flex flex-col items-end" }, [
      E(Box, { key: "subtotal", tw: "flex flex-row justify-between w-64 border-b border-slate-200 py-2 text-sm text-slate-600" }, [text("Subtotal"), text(invoice.subtotal + " " + invoice.accountingCurrency)]),
      invoice.discountAmount !== "0" ? E(Box, { key: "discount", tw: "flex flex-row justify-between w-64 border-b border-slate-200 py-2 text-sm text-slate-600" }, [text("Discount"), text("-" + invoice.discountAmount)]) : null,
      invoice.taxAmount !== "0" ? E(Box, { key: "tax", tw: "flex flex-row justify-between w-64 border-b border-slate-200 py-2 text-sm text-slate-600" }, [text(invoice.taxLabel || "Tax"), text(invoice.taxAmount)]) : null,
      E(Box, { key: "total", tw: "flex flex-row justify-between w-64 py-3 text-xl font-bold text-slate-950" }, [text("Total"), text(invoice.totalAmount + " " + invoice.accountingCurrency)]),
    ]),
    E(Box, { key: "footer", tw: "mt-12 flex flex-col border-t border-slate-200 pt-5 text-xs text-slate-500" }, [
      text("Due " + invoice.dueDate),
      invoice.terms ? text(invoice.terms, "mt-2") : null,
      text(invoice.status === "PAID" ? "Payment verified at finalized commitment." : "Payment status: unpaid", "mt-3 font-bold text-slate-700"),
    ]),
    E(Box, { key: "page", tw: "mt-8 flex flex-row justify-end text-xs text-slate-400" }, [E(PageNumber), " / ", E(TotalPages)]),
  ];
  return render(E("main", { tw: "relative flex flex-col p-12 text-slate-950", style: { minHeight: "100%" } }, children), { size: "a4" });
}
