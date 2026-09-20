import { ASSETS, displayUnits, explorer, type Asset, type NetworkId, toBaseUnits } from "@/lib/payments/model";
import { address, db, getPayment, handled, jsonBody, paymentNetwork, sameOrigin, verifyWalletSignature, PaymentError } from "@/lib/payments/server";

type InvoiceStatus = "DRAFT" | "UNPAID" | "PAID" | "VOIDED";
type InvoiceItem = { description: string; quantity: string; unitPrice: string; lineTotal: string };
type InvoiceRecord = { id: string; publicId: string; merchantWallet: string; invoiceNumber: string; title: string; description: string; customerName: string; customerEmail: string; accountingCurrency: Asset; subtotal: string; discountType: string; discountValue: string; discountAmount: string; taxLabel: string; taxRate: string; taxAmount: string; additionalFees: string; totalAmount: string; items: InvoiceItem[]; recipientWallet: string; acceptedAssets: Asset[]; status: InvoiceStatus; issueDate: string; dueDate: string; terms: string; notes: string; createdAt: number; updatedAt: number; publishedAt: number | null; paidAt: number | null; paidPaymentId: string | null };

function parseRow(row: Record<string, unknown>): InvoiceRecord {
  let items: InvoiceItem[] = []; let assets: Asset[] = [];
  try { items = JSON.parse(String(row.items)); } catch {}
  try { assets = JSON.parse(String(row.accepted_assets)); } catch {}
  return { id:String(row.id), publicId:String(row.public_id), merchantWallet:String(row.merchant_wallet), invoiceNumber:String(row.invoice_number), title:String(row.title), description:String(row.description || ""), customerName:String(row.customer_name || ""), customerEmail:String(row.customer_email || ""), accountingCurrency:row.accounting_currency === "USDC" ? "USDC" : "SOL", subtotal:String(row.subtotal), discountType:String(row.discount_type || "none"), discountValue:String(row.discount_value || "0"), discountAmount:String(row.discount_amount || "0"), taxLabel:String(row.tax_label || ""), taxRate:String(row.tax_rate || "0"), taxAmount:String(row.tax_amount || "0"), additionalFees:String(row.additional_fees || "0"), totalAmount:String(row.total_amount), items, recipientWallet:String(row.recipient_wallet), acceptedAssets:assets.length ? assets : ["SOL"], status:(row.status === "PAID" || row.status === "VOIDED" || row.status === "UNPAID") ? row.status : "DRAFT", issueDate:String(row.issue_date), dueDate:String(row.due_date), terms:String(row.terms || ""), notes:String(row.notes || ""), createdAt:Number(row.created_at), updatedAt:Number(row.updated_at), publishedAt:row.published_at == null ? null : Number(row.published_at), paidAt:row.paid_at == null ? null : Number(row.paid_at), paidPaymentId:row.paid_payment_id == null ? null : String(row.paid_payment_id) };
}
function publicInvoice(invoice: InvoiceRecord) { const { merchantWallet: _merchantWallet, notes: _notes, ...safe } = invoice; return safe; }
function fixed(value: unknown, label: string): bigint {
  const raw = String(value ?? "0").trim();
  if (!/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(raw) || raw.length > 32) throw new PaymentError(label + " must be a non-negative decimal with up to 6 places.");
  const [whole, fraction = ""] = raw.split(".");
  return BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, "0"));
}
function money(value: bigint) { return displayUnits(value, 6); }
function requestInput(input: Record<string, unknown>) {
  const itemsRaw = Array.isArray(input.items) ? input.items : [];
  if (!itemsRaw.length || itemsRaw.length > 100) throw new PaymentError("Add at least one invoice item.");
  const items: InvoiceItem[] = []; let subtotal = 0n;
  for (const raw of itemsRaw) {
    if (!raw || typeof raw !== "object") throw new PaymentError("Invoice items are invalid.");
    const item = raw as Record<string, unknown>; const description = typeof item.description === "string" ? item.description.trim() : "";
    if (!description || description.length > 240) throw new PaymentError("Each item needs a description.");
    const quantity = fixed(item.quantity, "Quantity"); const unitPrice = fixed(item.unitPrice, "Unit price");
    if (!quantity || !unitPrice) throw new PaymentError("Quantity and unit price must be greater than zero.");
    const lineTotal = quantity * unitPrice / 1000000n;
    if (!lineTotal) throw new PaymentError("Each item must have a non-zero total.");
    subtotal += lineTotal; items.push({ description, quantity:money(quantity), unitPrice:money(unitPrice), lineTotal:money(lineTotal) });
  }
  const discountType = input.discountType === "percentage" ? "percentage" : input.discountType === "fixed" ? "fixed" : "none";
  const discountValue = fixed(input.discountValue, "Discount");
  const discountAmount = discountType === "percentage" ? subtotal * discountValue / 100000000n : discountValue;
  if (discountAmount > subtotal) throw new PaymentError("Discount cannot exceed the subtotal.");
  const taxable = subtotal - discountAmount; const taxRate = fixed(input.taxRate, "Tax rate");
  const taxAmount = taxable * taxRate / 100000000n; const fees = fixed(input.additionalFees, "Additional fees"); const total = taxable + taxAmount + fees;
  if (!total) throw new PaymentError("Invoice total must be greater than zero.");
  const currency = input.accountingCurrency === "USDC" ? "USDC" : input.accountingCurrency === "SOL" ? "SOL" : null;
  if (!currency) throw new PaymentError("Choose SOL or USDC as the invoice currency.");
  const accepted = Array.isArray(input.acceptedAssets) ? input.acceptedAssets.filter((value): value is Asset => value === "SOL" || value === "USDC") : [currency];
  if (accepted.length !== 1 || accepted[0] !== currency) throw new PaymentError("Invoice currency and payment asset must match. Exchange rates are not supported.");
  const dueDate = typeof input.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ? input.dueDate : "";
  if (!dueDate) throw new PaymentError("Choose a valid due date.");
  return { title:typeof input.title === "string" ? input.title.trim().slice(0,140) : "", description:typeof input.description === "string" ? input.description.trim().slice(0,1000) : "", customerName:typeof input.customerName === "string" ? input.customerName.trim().slice(0,160) : "", customerEmail:typeof input.customerEmail === "string" ? input.customerEmail.trim().slice(0,240) : "", recipientWallet:address(input.recipientWallet), accountingCurrency:currency, acceptedAssets:accepted, items, subtotal:money(subtotal), discountType, discountValue:money(discountValue), discountAmount:money(discountAmount), taxLabel:typeof input.taxLabel === "string" ? input.taxLabel.trim().slice(0,80) : "", taxRate:money(taxRate), taxAmount:money(taxAmount), additionalFees:money(fees), totalAmount:money(total), dueDate, issueDate:typeof input.issueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.issueDate) ? input.issueDate : new Date().toISOString().slice(0,10), terms:typeof input.terms === "string" ? input.terms.trim().slice(0,2000) : "", notes:typeof input.notes === "string" ? input.notes.trim().slice(0,2000) : "" };
}
function invoiceMessage(payload: string, network: NetworkId) { return "AUNO " + network + " invoice creation\n" + payload; }
function authPayload(body: Record<string, unknown>, origin: string) {
  if (typeof body.payload !== "string" || typeof body.signature !== "string") throw new PaymentError("A signed invoice request is required.");
  let input: Record<string, unknown>; try { input = JSON.parse(body.payload); } catch { throw new PaymentError("Invalid invoice request."); }
  const wallet = address(input.merchantWallet); const network = paymentNetwork();
  verifyWalletSignature(wallet, invoiceMessage(body.payload, network), body.signature);
  if (input.origin !== origin || !Number.isSafeInteger(input.timestamp) || Math.abs(Date.now() - Number(input.timestamp)) > 300000) throw new PaymentError("Request expired. Sign a fresh request.");
  return { input, wallet, signature: body.signature };
}
async function merchantInvoice(id: string, wallet: string) {
  const row = await db().prepare("SELECT * FROM invoices WHERE id=? AND merchant_wallet=?").bind(id, wallet).first<Record<string, unknown>>();
  if (!row) throw new PaymentError("Invoice not found.",404); return parseRow(row);
}
export async function createInvoice(req: Request) {
  const origin = sameOrigin(req); const body = await jsonBody(req); const { input, wallet, signature } = authPayload(body, origin); const data = requestInput(input);
  if (!data.title) throw new PaymentError("Invoice title is required.");
  const existing = await db().prepare("SELECT id FROM invoices WHERE creation_key=?").bind(signature).first<{id:string}>();
  if (existing) return merchantInvoice(existing.id,wallet);
  const now = Date.now(); const id = crypto.randomUUID(); const number = "INV-" + new Date(now).getUTCFullYear() + "-" + now.toString(36).toUpperCase();
  await db().prepare("INSERT INTO invoices (id,public_id,merchant_wallet,invoice_number,title,description,customer_name,customer_email,accounting_currency,subtotal,discount_type,discount_value,discount_amount,tax_label,tax_rate,tax_amount,additional_fees,total_amount,items,recipient_wallet,accepted_assets,status,issue_date,due_date,terms,notes,created_at,updated_at,creation_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,crypto.randomUUID(),wallet,number,data.title,data.description,data.customerName,data.customerEmail,data.accountingCurrency,data.subtotal,data.discountType,data.discountValue,data.discountAmount,data.taxLabel,data.taxRate,data.taxAmount,data.additionalFees,data.totalAmount,JSON.stringify(data.items),data.recipientWallet,JSON.stringify(data.acceptedAssets),"DRAFT",data.issueDate,data.dueDate,data.terms,data.notes,now,now,signature).run();
  console.info(JSON.stringify({event:"invoice_created",network:paymentNetwork(),invoiceId:id,merchantWallet:wallet})); return merchantInvoice(id,wallet);
}
async function signedAction(req: Request,id:string,action:string) {
  const origin = sameOrigin(req); const body = await jsonBody(req); const { input, wallet } = authPayload(body,origin);
  if (input.id !== id || input.action !== action) throw new PaymentError("Invoice action does not match this record."); return {wallet};
}
export async function publishInvoice(req: Request,id:string) {
  const {wallet}=await signedAction(req,id,"publish"); const invoice=await merchantInvoice(id,wallet);
  if (invoice.status !== "DRAFT") throw new PaymentError("Only draft invoices can be published.");
  const now=Date.now(); await db().prepare("UPDATE invoices SET status='UNPAID',published_at=?,updated_at=? WHERE id=? AND merchant_wallet=? AND status='DRAFT'").bind(now,now,id,wallet).run(); return merchantInvoice(id,wallet);
}
export async function voidInvoice(req: Request,id:string) {
  const {wallet}=await signedAction(req,id,"void"); const invoice=await merchantInvoice(id,wallet);
  if (invoice.status === "PAID") throw new PaymentError("Paid invoices cannot be voided.");
  await db().prepare("UPDATE invoices SET status='VOIDED',voided_at=?,updated_at=? WHERE id=? AND merchant_wallet=? AND status IN ('DRAFT','UNPAID')").bind(Date.now(),Date.now(),id,wallet).run(); return merchantInvoice(id,wallet);
}
export async function listInvoices(req: Request) {
  const origin=sameOrigin(req); const wallet=address(new URL(req.url).searchParams.get("wallet")); const stamp=Number(req.headers.get("x-auno-timestamp"));
  if (!Number.isSafeInteger(stamp)||Math.abs(Date.now()-stamp)>300000) throw new PaymentError("Connect and authorize invoices again.",401);
  verifyWalletSignature(wallet,"AUNO "+paymentNetwork()+" invoice history\n"+origin+"\n"+wallet+"\n"+stamp,req.headers.get("x-auno-signature")||"");
  const rows=await db().prepare("SELECT * FROM invoices WHERE merchant_wallet=? ORDER BY created_at DESC LIMIT 200").bind(wallet).all<Record<string,unknown>>(); return {invoices:rows.results.map(parseRow)};
}
export async function getInvoice(id:string,req:Request) {
  const origin=sameOrigin(req); const wallet=address(new URL(req.url).searchParams.get("wallet")); const stamp=Number(req.headers.get("x-auno-timestamp"));
  if (!Number.isSafeInteger(stamp)||Math.abs(Date.now()-stamp)>300000) throw new PaymentError("Connect and authorize invoices again.",401);
  verifyWalletSignature(wallet,"AUNO "+paymentNetwork()+" invoice history\n"+origin+"\n"+wallet+"\n"+stamp,req.headers.get("x-auno-signature")||""); return merchantInvoice(id,wallet);
}
export async function getPublicInvoice(publicId:string) {
  const row=await db().prepare("SELECT * FROM invoices WHERE public_id=? AND published_at IS NOT NULL").bind(publicId).first<Record<string,unknown>>();
  if (!row) throw new PaymentError("Invoice not found.",404); return publicInvoice(parseRow(row));
}
export async function createInvoicePayment(req:Request,publicId:string) {
  sameOrigin(req); const body=await jsonBody(req); const asset=body.asset==="USDC"?"USDC":body.asset==="SOL"?"SOL":null;
  if (!asset) throw new PaymentError("Choose SOL or USDC.");
  const row=await db().prepare("SELECT * FROM invoices WHERE public_id=? AND published_at IS NOT NULL").bind(publicId).first<Record<string,unknown>>(); if (!row) throw new PaymentError("Invoice not found.",404);
  const invoice=parseRow(row); if (invoice.status==="PAID") throw new PaymentError("This invoice has already been paid.",409); if (invoice.status==="VOIDED") throw new PaymentError("This invoice is voided.",409);
  if (!invoice.acceptedAssets.includes(asset)) throw new PaymentError("This invoice does not accept that asset.");
  const base=toBaseUnits(invoice.totalAmount,ASSETS[asset].decimals); if (paymentNetwork()==="mainnet-beta"&&asset==="SOL"&&base>100000000n) throw new PaymentError("Mainnet invoice amounts are limited to 0.1 SOL.",422);
  const key="invoice:"+invoice.id+":"+asset; const existing=await db().prepare("SELECT id FROM payments WHERE creation_key=?").bind(key).first<{id:string}>(); if (existing) return {paymentId:existing.id};
  const paymentId=crypto.randomUUID(); const now=Date.now(); const due=new Date(invoice.dueDate+"T23:59:59.999Z").getTime(); const expires=Math.max(now+3600000,Math.min(due,now+86400000));
  await db().prepare("INSERT INTO payments (id,network,merchant_wallet,title,description,asset,amount,amount_base_units,recipients,reference,expires_at,status,created_at,updated_at,creation_key,invoice_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(paymentId,paymentNetwork(),invoice.recipientWallet,invoice.invoiceNumber,invoice.description,asset,invoice.totalAmount,base.toString(),JSON.stringify([{position:0,label:"Invoice recipient",address:invoice.recipientWallet,percentageBps:10000,amountBaseUnits:base.toString()}]),"invoice:"+invoice.publicId,expires,"ACTIVE",now,now,key,invoice.id).run();
  console.info(JSON.stringify({event:"invoice_payment_intent_created",network:paymentNetwork(),invoiceId:invoice.id,paymentId,asset})); return {paymentId};
}
export async function publicInvoiceReceipt(publicId:string) {
  const row=await db().prepare("SELECT * FROM invoices WHERE public_id=? AND status='PAID' AND paid_payment_id IS NOT NULL").bind(publicId).first<Record<string,unknown>>(); if (!row) throw new PaymentError("Invoice receipt not found.",404);
  const invoice=parseRow(row); return {invoice:publicInvoice(invoice),payment:await getPayment(invoice.paidPaymentId!)};
}
export async function invoiceHandled(fn:()=>Promise<unknown>){return handled(fn);}
