"use client";

import { useState, type ChangeEvent } from "react";
import { FiArrowLeft, FiCheck, FiPlus } from "react-icons/fi";
import { toast } from "sonner";
import { AppShell, WalletButton } from "../../payment-ui";
import { networkForOrigin } from "@/lib/payments/model";
import { readWalletSession, restoreWallet, type WalletSession } from "@/lib/payments/wallet";
import { useEffect } from "react";
import type { InvoiceRecord } from "@/lib/invoices/types";

type Item = { description: string; quantity: string; unitPrice: string };
function errorText(error: unknown) { return error instanceof Error ? error.message : "Invoice operation failed."; }
async function post(path: string, body: unknown) { const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}); const result=await response.json() as { error?: string } & Partial<InvoiceRecord>; if(!response.ok) throw new Error(result.error || "Invoice operation failed."); return result; }
function value(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) { return event.target.value; }

export default function InvoiceForm() {
  const [wallet, setWallet] = useState<WalletSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [currency, setCurrency] = useState<"SOL"|"USDC">("SOL");
  const [title, setTitle] = useState(""); const [description, setDescription] = useState("");
  const [customerName, setCustomerName] = useState(""); const [customerEmail, setCustomerEmail] = useState("");
  const [recipientWallet, setRecipientWallet] = useState(""); const [dueDate, setDueDate] = useState(new Date(Date.now()+7*86400000).toISOString().slice(0,10));
  const [discountType, setDiscountType] = useState("none"); const [discountValue, setDiscountValue] = useState("0"); const [taxRate, setTaxRate] = useState("0"); const [fees, setFees] = useState("0"); const [terms, setTerms] = useState("");
  const [items, setItems] = useState<Item[]>([{description:"",quantity:"1",unitPrice:""}]);
  useEffect(() => { const saved=readWalletSession(); if(saved) setWallet(restoreWallet(saved.name,saved.address,saved.chain)); }, []);

  function update(index:number, key:keyof Item, next:string) { setItems((current)=>current.map((item,i)=>i===index?{...item,[key]:next}:item)); }
  async function submit(publish:boolean) {
    if(!wallet) { toast.error("Connect the merchant wallet first."); return; }
    setBusy(true); const origin=window.location.origin; const network=networkForOrigin(origin); const timestamp=Date.now();
    try {
      const input={merchantWallet:wallet.address,origin,timestamp,title,description,customerName,customerEmail,recipientWallet,accountingCurrency:currency,acceptedAssets:[currency],items,discountType,discountValue,taxRate,additionalFees:fees,dueDate,terms};
      const payload=JSON.stringify(input); const signature=await wallet.signMessage("AUNO "+network+" invoice creation\n"+payload);
      const invoice=await post("/api/invoices",{payload,signature}) as InvoiceRecord;
      if(publish) {
        const action={merchantWallet:wallet.address,origin,timestamp:Date.now(),id:invoice.id,action:"publish"};
        const actionPayload=JSON.stringify(action); const actionSignature=await wallet.signMessage("AUNO "+network+" invoice creation\n"+actionPayload);
        await post("/api/invoices/"+invoice.id+"/publish",{payload:actionPayload,signature:actionSignature});
      }
      toast.success(publish ? "Invoice published." : "Draft saved."); window.location.assign("/dashboard/invoices");
    } catch(error) { toast.error(errorText(error)); } finally { setBusy(false); }
  }
  return <AppShell title="New invoice" subtitle="Set the exact amount and terms before sharing a payment page.">
    <a className="invoice-back" href="/dashboard/invoices"><FiArrowLeft aria-hidden="true" /> All invoices</a>
    <section className="invoice-form-layout">
      <form className="panel invoice-form" onSubmit={(event)=>{event.preventDefault();void submit(true);}}>
        <div className="invoice-form-section"><span className="eyebrow">INVOICE DETAILS</span><label>Title<input value={title} onChange={(e)=>setTitle(value(e))} required placeholder="Website development" /></label><label>Description<textarea value={description} onChange={(e)=>setDescription(value(e))} placeholder="What is this invoice for?" /></label></div>
        <div className="invoice-form-section"><span className="eyebrow">CUSTOMER</span><div className="invoice-two-col"><label>Name<input value={customerName} onChange={(e)=>setCustomerName(value(e))} placeholder="Customer name" /></label><label>Email<input type="email" value={customerEmail} onChange={(e)=>setCustomerEmail(value(e))} placeholder="customer@example.com" /></label></div></div>
        <div className="invoice-form-section"><div className="invoice-section-heading"><span className="eyebrow">LINE ITEMS</span><button className="button light small" type="button" onClick={()=>setItems((current)=>[...current,{description:"",quantity:"1",unitPrice:""}])}><FiPlus /> Add item</button></div>{items.map((item,index)=><div className="invoice-item-edit" key={index}><input value={item.description} onChange={(e)=>update(index,"description",value(e))} placeholder="Description" required /><input value={item.quantity} onChange={(e)=>update(index,"quantity",value(e))} inputMode="decimal" placeholder="Qty" required /><input value={item.unitPrice} onChange={(e)=>update(index,"unitPrice",value(e))} inputMode="decimal" placeholder="Unit price" required /></div>)}</div>
        <div className="invoice-form-section"><span className="eyebrow">PAYMENT</span><div className="invoice-two-col"><label>Currency<select value={currency} onChange={(e)=>setCurrency(value(e) as "SOL"|"USDC")}><option value="SOL">SOL</option><option value="USDC">USDC</option></select></label><label>Recipient wallet<input value={recipientWallet} onChange={(e)=>setRecipientWallet(value(e))} placeholder="Full Solana wallet address" required /></label></div><label>Due date<input type="date" value={dueDate} onChange={(e)=>setDueDate(value(e))} required /></label><div className="invoice-three-col"><label>Discount type<select value={discountType} onChange={(e)=>setDiscountType(value(e))}><option value="none">None</option><option value="fixed">Fixed</option><option value="percentage">Percentage</option></select></label><label>Discount<input value={discountValue} onChange={(e)=>setDiscountValue(value(e))} inputMode="decimal" /></label><label>Tax %<input value={taxRate} onChange={(e)=>setTaxRate(value(e))} inputMode="decimal" /></label></div><label>Additional fees<input value={fees} onChange={(e)=>setFees(value(e))} inputMode="decimal" /></label></div>
        <div className="invoice-form-section"><span className="eyebrow">TERMS</span><textarea value={terms} onChange={(e)=>setTerms(value(e))} placeholder="Payment terms, refund policy, or notes" /></div>
        <div className="invoice-actions"><button type="button" className="button light" disabled={busy} onClick={()=>void submit(false)}>Save draft</button><button type="submit" className="button" disabled={busy}>{busy ? "Signing..." : <><FiCheck /> Publish invoice</>}</button></div>
      </form>
      <aside className="panel invoice-preview"><span className="eyebrow">PREVIEW</span><h2>{title || "Your invoice"}</h2><p>{description || "A clean public invoice page with a verified checkout."}</p><div className="invoice-preview-total">{items.reduce((sum,item)=>sum + (Number(item.quantity)||0)*(Number(item.unitPrice)||0),0).toFixed(2)} <small>{currency}</small></div><p className="detail-note">The server recalculates totals from the signed data before saving.</p>{wallet ? <p className="detail-note">Merchant: {wallet.address}</p> : <WalletButton session={wallet} onChange={setWallet} />}</aside>
    </section>
  </AppShell>;
}
