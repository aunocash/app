"use client";

import { useEffect, useState } from "react";
import { FiArrowLeft, FiExternalLink } from "react-icons/fi";
import { toast } from "sonner";
import { AppShell, WalletButton } from "../../payment-ui";
import { networkForOrigin } from "@/lib/payments/model";
import { readWalletSession, restoreWallet, type WalletSession } from "@/lib/payments/wallet";
import type { InvoiceRecord } from "@/lib/invoices/types";

export default function InvoiceDetail({ id }: { id: string }) {
  const [wallet,setWallet]=useState<WalletSession|null>(null); const [invoice,setInvoice]=useState<InvoiceRecord|null>(null); const [loading,setLoading]=useState(true);
  useEffect(()=>{const saved=readWalletSession();if(saved)setWallet(restoreWallet(saved.name,saved.address,saved.chain));},[]);
  useEffect(()=>{if(!wallet)return;const origin=window.location.origin;const stamp=Date.now();wallet.signMessage("AUNO "+networkForOrigin(origin)+" invoice history\n"+origin+"\n" +wallet.address+"\n" +stamp).then((signature)=>fetch("/api/invoices/"+id+"?wallet="+encodeURIComponent(wallet.address),{headers:{"x-auno-timestamp":String(stamp),"x-auno-signature":signature}})).then(async(r)=>{const data=await r.json() as InvoiceRecord & { error?: string };if(!r.ok)throw new Error(data.error||"Could not load invoice.");setInvoice(data);}).catch((e)=>toast.error(e instanceof Error?e.message:"Could not load invoice.")).finally(()=>setLoading(false));},[id,wallet]);
  return <AppShell title="Invoice detail" subtitle="Review the signed invoice record and share its public page."><a className="invoice-back" href="/dashboard/invoices"><FiArrowLeft /> All invoices</a>{!wallet?<section className="panel invoice-empty"><h2>Connect your merchant wallet</h2><WalletButton session={wallet} onChange={setWallet}/></section>:loading?<section className="panel invoice-empty"><p>Loading invoice...</p></section>:invoice?<section className="panel invoice-detail"><div className="invoice-detail-head"><div><span className="eyebrow">{invoice.invoiceNumber}</span><h2>{invoice.title}</h2><p>{invoice.description}</p></div><span className={"invoice-status "+invoice.status.toLowerCase()}>{invoice.status}</span></div><div className="invoice-detail-grid"><div><span>Customer</span><strong>{invoice.customerName||"Not provided"}</strong></div><div><span>Total</span><strong>{invoice.totalAmount} {invoice.accountingCurrency}</strong></div><div><span>Due</span><strong>{invoice.dueDate}</strong></div><div><span>Recipient</span><strong>{invoice.recipientWallet}</strong></div></div>{invoice.publicId&&invoice.status!=="DRAFT"&&<div className="invoice-share"><a className="text-link" href={"/invoice/"+invoice.publicId} target="_blank" rel="noreferrer">Open public invoice <FiExternalLink /></a><a className="text-link" href={"/api/public/invoices/"+invoice.publicId+"/pdf"}>Download PDF</a></div>}</section>:null}</AppShell>;
}
