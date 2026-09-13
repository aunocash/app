"use client";

import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiClientError } from "@/lib/client/api";
import { previewRecipientAllocations } from "@/lib/client/payment-form";
import { allocationToBasisPoints } from "@/lib/client/payment-ui";
import type { Asset } from "@/lib/contracts/payments";

type Recipient = { address: string; percentage: string };
const formSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(120, "Use 120 characters or fewer."),
  description: z.string().trim().max(1_000, "Use 1,000 characters or fewer."),
  amount: z.string().regex(/^\d+(?:\.\d+)?$/, "Enter a valid amount."),
  asset: z.enum(["SOL", "USDC"]),
  reference: z.string().trim().max(100, "Use 100 characters or fewer."),
  expiry: z.enum(["none", "1h", "24h", "7d", "custom"]),
  customExpiresAt: z.string(),
});
type ExpiryChoice = "none" | "1h" | "24h" | "7d" | "custom";

function expiryAt(value: ExpiryChoice, customExpiresAt: string): string | undefined {
  if (value === "custom") {
    const date = new Date(customExpiresAt);
    if (!customExpiresAt || Number.isNaN(date.getTime()) || date <= new Date()) throw new Error("Choose a future custom expiry.");
    return date.toISOString();
  }
  const hours = value === "1h" ? 1 : value === "24h" ? 24 : value === "7d" ? 168 : 0;
  return hours ? new Date(Date.now() + hours * 60 * 60 * 1_000).toISOString() : undefined;
}
function newKey() { return crypto.randomUUID(); }

export function PaymentCreateForm({ merchantWallet, initialSplit = false }: { merchantWallet: string; initialSplit?: boolean }) {
  const client = useQueryClient();
  const [split, setSplit] = useState(initialSplit);
  const [recipients, setRecipients] = useState<Recipient[]>(initialSplit ? [{ address: merchantWallet, percentage: "80" }, { address: "", percentage: "20" }] : [{ address: merchantWallet, percentage: "100" }]);
  const [idempotencyKey, setIdempotencyKey] = useState(newKey);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const form = useForm({
    defaultValues: { title: "", description: "", amount: "", asset: "USDC" as Asset, reference: "", expiry: "24h" as ExpiryChoice, customExpiresAt: "" },
    onSubmit: async ({ value }) => {
      setError(null);
      const parsed = formSchema.safeParse(value);
      if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check the form fields."); return; }
      let expiresAt: string | undefined;
      try { expiresAt = expiryAt(parsed.data.expiry, parsed.data.customExpiresAt); } catch (caught) { setError(caught instanceof Error ? caught.message : "Check the expiry."); return; }
      let allocations: number[];
      try { allocations = recipients.map((recipient) => allocationToBasisPoints(recipient.percentage)); } catch (caught) { setError(caught instanceof Error ? caught.message : "Check recipient allocations."); return; }
      const addresses = recipients.map((recipient) => recipient.address.trim());
      if (addresses.some((address) => address.length < 32 || address.length > 44)) { setError("Each recipient must be a valid Solana address."); return; }
      if (new Set(addresses).size !== addresses.length) { setError("Recipients must be unique."); return; }
      if (allocations.reduce((total, item) => total + item, 0) !== 10_000) { setError("Recipient allocations must total exactly 100.00%."); return; }
      if (!split && (addresses.length !== 1 || allocations[0] !== 10_000)) { setError("A standard payment has one recipient allocated 100.00%."); return; }
      try {
        const payment = await api.createPayment({ title: parsed.data.title, description: parsed.data.description || undefined, amount: parsed.data.amount, asset: parsed.data.asset, reference: parsed.data.reference || undefined, expiresAt, recipients: addresses.map((address, index) => ({ address, allocationBps: allocations[index] })) }, idempotencyKey);
        setCreatedId(payment.id);
        setIdempotencyKey(newKey());
        await client.invalidateQueries({ queryKey: ["payments"] });
        await client.invalidateQueries({ queryKey: ["payment-summary"] });
      } catch (caught) { setError(caught instanceof ApiClientError ? `${caught.message} (Request ${caught.requestId})` : "Payment could not be created. Retry to reuse this request safely."); }
    },
  });

  const preview = useMemo(() => {
    try {
      const asset = form.state.values.asset;
      const amounts = previewRecipientAllocations(form.state.values.amount || "0", asset, recipients.map((item) => allocationToBasisPoints(item.percentage)));
      return { amounts, total: recipients.reduce((total, item) => total + allocationToBasisPoints(item.percentage), 0) };
    } catch { return { amounts: [] as string[], total: 0 }; }
  }, [form.state.values.amount, form.state.values.asset, recipients]);
  function updateRecipient(index: number, next: Partial<Recipient>) { setRecipients((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item)); }
  function setSplitMode(next: boolean) { setSplit(next); setRecipients(next ? [{ address: merchantWallet, percentage: "80" }, { address: "", percentage: "20" }] : [{ address: merchantWallet, percentage: "100" }]); }

  if (createdId) {
    const checkout = `${window.location.origin}/pay/${createdId}`;
    return (
      <Card className="success-panel mx-auto max-w-3xl border-[var(--product-line)] bg-[#fffefa] text-center shadow-[var(--product-shadow)]">
        <CardHeader className="items-center p-8 pb-2 sm:p-12 sm:pb-3"><span className="success-icon"><Check size={22} /></span><div className="eyebrow">LIVE PAYMENT CREATED</div><CardTitle className="text-2xl text-[var(--product-ink)]">Your checkout link is ready.</CardTitle><CardDescription className="max-w-xl text-[var(--product-muted)]">It is active on Solana devnet. Share it only when the recipients and allocation look right.</CardDescription></CardHeader>
        <CardContent className="space-y-4 px-8 pb-8 sm:px-12 sm:pb-12"><div className="checkout-link"><code>{checkout}</code><Button variant="ghost" size="icon-sm" type="button" aria-label="Copy checkout link" onClick={async () => { try { await navigator.clipboard.writeText(checkout); setCopied(true); } catch { setError("Copy failed. Select the link and copy it manually."); } }}><Copy size={16} /></Button></div>{copied && <p className="success-message">Checkout link copied.</p>}<div className="button-row"><Button className="button primary" render={<Link href={`/pay/${createdId}`} />}><Link2 size={15} /> Open checkout</Button><Button variant="secondary" render={<Link href={`/dashboard/payments/${createdId}`} />}>Payment details</Button><Button variant="ghost" type="button" onClick={() => setCreatedId(null)}>Create another</Button></div>{error && <p className="error-message" role="alert">{error}</p>}</CardContent>
      </Card>
    );
  }

  return (
    <Card className="form-panel live-form mx-auto max-w-4xl border-[var(--product-line)] bg-[#fffefa] shadow-[var(--product-shadow)]">
      <CardHeader><div className="eyebrow">NEW DEVNET REQUEST</div><CardTitle className="text-2xl text-[var(--product-ink)]">Set terms. Share once.</CardTitle><CardDescription className="text-[var(--product-muted)]">The payer sees these exact recipients and amounts before approving their wallet transaction.</CardDescription></CardHeader>
      <CardContent>
        <form onSubmit={(event) => { event.preventDefault(); void form.handleSubmit(); }} noValidate>
          <div className="form-grid">
            <form.Field name="title">{(field) => <div><Label htmlFor="payment-title" className="mb-2 text-[var(--product-ink)]">Title</Label><Input id="payment-title" value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} placeholder="Design retainer" required /></div>}</form.Field>
            <form.Field name="amount">{(field) => <div><Label htmlFor="payment-amount" className="mb-2 text-[var(--product-ink)]">Amount</Label><Input id="payment-amount" inputMode="decimal" value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} placeholder="0.00" required /></div>}</form.Field>
            <form.Field name="description">{(field) => <div className="wide"><Label htmlFor="payment-description" className="mb-2 text-[var(--product-ink)]">Description <span>optional</span></Label><Textarea id="payment-description" value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} placeholder="What is this payment for?" rows={3} /></div>}</form.Field>
            <form.Field name="asset">{(field) => <div><Label className="mb-2 text-[var(--product-ink)]">Asset</Label><Select value={field.state.value} onValueChange={(value) => field.handleChange((value ?? "USDC") as Asset)}><SelectTrigger aria-label="Asset" className="min-h-10 w-full border-[var(--product-line)] bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USDC">USDC</SelectItem><SelectItem value="SOL">SOL</SelectItem></SelectContent></Select></div>}</form.Field>
            <form.Field name="expiry">{(field) => <div><Label className="mb-2 text-[var(--product-ink)]">Expiry</Label><Select value={field.state.value} onValueChange={(value) => field.handleChange((value ?? "24h") as ExpiryChoice)}><SelectTrigger aria-label="Expiry" className="min-h-10 w-full border-[var(--product-line)] bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1h">1 hour</SelectItem><SelectItem value="24h">24 hours</SelectItem><SelectItem value="7d">7 days</SelectItem><SelectItem value="custom">Custom date</SelectItem><SelectItem value="none">No expiry</SelectItem></SelectContent></Select></div>}</form.Field>
            {form.state.values.expiry === "custom" && <form.Field name="customExpiresAt">{(field) => <div className="wide"><Label htmlFor="custom-expiry" className="mb-2 text-[var(--product-ink)]">Custom expiry</Label><Input id="custom-expiry" type="datetime-local" value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} required /></div>}</form.Field>}
            <form.Field name="reference">{(field) => <div className="wide"><Label htmlFor="payment-reference" className="mb-2 text-[var(--product-ink)]">Reference <span>optional, private</span></Label><Input id="payment-reference" value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} placeholder="Internal invoice ID" /></div>}</form.Field>
          </div>
          <div className="recipient-heading"><div><Badge variant="outline" className="soft-label w-fit">RECIPIENTS</Badge><p>{split ? "Split payment between 2–5 unique wallets." : "A standard payment sends 100% to one wallet."}</p></div><Button variant={split ? "secondary" : "outline"} type="button" aria-pressed={split} onClick={() => setSplitMode(!split)}>{split ? "Split payment" : "Standard payment"}</Button></div>
          <div className="recipient-list">{recipients.map((recipient, index) => <div className="recipient-row" key={`${index}-${recipient.address}`}><div><Label htmlFor={`recipient-${index}`} className="mb-2 text-[var(--product-ink)]">Wallet address</Label><Input id={`recipient-${index}`} value={recipient.address} onChange={(event) => updateRecipient(index, { address: event.target.value })} placeholder="Recipient Solana address" /></div><div className="relative"><Label htmlFor={`allocation-${index}`} className="mb-2 text-[var(--product-ink)]">Allocation</Label><Input id={`allocation-${index}`} inputMode="decimal" value={recipient.percentage} onChange={(event) => updateRecipient(index, { percentage: event.target.value })} aria-label={`Recipient ${index + 1} allocation`} className="pr-8" /><span>%</span></div><output>{preview.amounts[index] ? `${preview.amounts[index]} ${form.state.values.asset}` : "—"}</output>{split && recipients.length > 2 && <Button variant="ghost" size="icon-sm" type="button" aria-label="Remove recipient" onClick={() => setRecipients((items) => items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} /></Button>}</div>)}</div>
          <div className={`allocation-total ${preview.total === 10_000 ? "is-valid" : ""}`}>Allocation total <strong>{(preview.total / 100).toFixed(2)}%</strong></div>
          {split && recipients.length < 5 && <Button variant="ghost" type="button" className="add-recipient" onClick={() => setRecipients((items) => [...items, { address: "", percentage: "0" }])}><Plus size={15} /> Add recipient</Button>}
          {error && <p className="error-message" role="alert">{error}</p>}
          <Button className="button primary submit-payment" type="submit" disabled={form.state.isSubmitting}>{form.state.isSubmitting ? "Creating payment…" : "Create live payment"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}