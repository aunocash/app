export type InvoiceItem = { description: string; quantity: string; unitPrice: string; lineTotal: string };
export type InvoiceRecord = {
  id: string; publicId: string; merchantWallet: string; invoiceNumber: string; title: string; description: string;
  customerName: string; customerEmail: string; accountingCurrency: "SOL" | "USDC"; subtotal: string; discountType: string;
  discountValue: string; discountAmount: string; taxLabel: string; taxRate: string; taxAmount: string; additionalFees: string;
  totalAmount: string; items: InvoiceItem[]; recipientWallet: string; acceptedAssets: ("SOL" | "USDC")[]; status: "DRAFT" | "UNPAID" | "PAID" | "VOIDED";
  issueDate: string; dueDate: string; terms: string; notes: string; createdAt: number; updatedAt: number; publishedAt: number | null; paidAt: number | null; paidPaymentId: string | null;
};
