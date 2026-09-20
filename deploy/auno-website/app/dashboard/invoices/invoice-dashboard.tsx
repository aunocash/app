"use client";

import { useEffect, useState } from "react";
import { FiArrowRight, FiPlus } from "react-icons/fi";
import { toast } from "sonner";
import { AppShell, WalletButton } from "../../payment-ui";
import type { NetworkId } from "@/lib/payments/model";
import { useSiteNetwork } from '../../network-context';
import { readWalletSession, restoreWallet, type WalletSession } from "@/lib/payments/wallet";
import type { InvoiceRecord } from "@/lib/invoices/types";

function message(network: NetworkId, wallet: string, timestamp: number, origin: string) { return "AUNO " + network + " invoice history\n" + origin + "\n" + wallet + "\n" + timestamp; }
function errorText(error: unknown) { return error instanceof Error ? error.message : "Could not load invoices."; }

export default function InvoiceDashboard() {
  const [wallet, setWallet] = useState<WalletSession | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const network = useSiteNetwork();

  useEffect(() => {
    const saved = readWalletSession();
    if (saved) setWallet(restoreWallet(saved.name, saved.address, saved.chain));
  }, []);

  useEffect(() => {
    let active = true;
    if (!wallet) { setLoading(false); return; }
    setLoading(true);
    const timestamp = Date.now();
    wallet.signMessage(message(network, wallet.address, timestamp, window.location.origin)).then((signature) =>
      fetch("/api/invoices?wallet=" + encodeURIComponent(wallet.address), { headers: { "x-auno-timestamp": String(timestamp), "x-auno-signature": signature } })
    ).then(async (response) => {
      const result = await response.json() as { invoices?: InvoiceRecord[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Could not load invoices.");
      if (active) setInvoices(result.invoices || []);
    }).catch((error) => { if (active) toast.error(errorText(error)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [wallet, network]);

  return <AppShell title="Invoices" subtitle="Create, publish, and track customer invoices with verified Solana settlement.">
    <section className="invoice-toolbar">
      <div><span className="eyebrow">MERCHANT WORKSPACE</span><p className="detail-note">Totals are fixed on the server when you sign and publish an invoice.</p></div>
      <a className="button" href="/dashboard/invoices/new"><FiPlus aria-hidden="true" /> New invoice</a>
    </section>
    {!wallet ? <section className="panel invoice-empty"><h2>Connect your merchant wallet</h2><p>Invoice records are private to the wallet that created them.</p><WalletButton session={wallet} onChange={setWallet} /></section> :
      loading ? <section className="panel invoice-empty"><p>Loading invoices...</p></section> :
      invoices.length === 0 ? <section className="panel invoice-empty"><h2>No invoices yet</h2><p>Create your first invoice and share a public payment page.</p><a className="button" href="/dashboard/invoices/new">Create invoice <FiArrowRight aria-hidden="true" /></a></section> :
      <section className="panel invoice-list"><div className="invoice-list-head"><span>Invoice</span><span>Status</span><span>Total</span><span /></div>{invoices.map((invoice) => <a className="invoice-row" href={"/dashboard/invoices/" + invoice.id} key={invoice.id}><span><strong>{invoice.invoiceNumber}</strong><small>{invoice.title} � Due {invoice.dueDate}</small></span><span className={"invoice-status " + invoice.status.toLowerCase()}>{invoice.status}</span><span>{invoice.totalAmount} {invoice.accountingCurrency}</span><FiArrowRight aria-hidden="true" /></a>)}</section>}
  </AppShell>;
}
