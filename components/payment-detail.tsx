"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CircleAlert, Copy, ExternalLink, ReceiptText, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AlertDialog } from "./ui/alert-dialog";
import { api, ApiClientError } from "@/lib/client/api";
import { formatBaseUnits, paymentStatusPresentation } from "@/lib/client/payment-ui";

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "No expiry";
}

export function PaymentDetail({ paymentId }: { paymentId: string }) {
  const client = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const payment = useQuery({ queryKey: ["payment", paymentId], queryFn: () => api.payment(paymentId), refetchInterval: (query) => query.state.data && paymentStatusPresentation(query.state.data.status).shouldPoll ? 3_000 : false });
  const cancel = useMutation({
    mutationFn: () => api.cancelPayment(paymentId),
    onSuccess: async () => { setConfirmCancel(false); await client.invalidateQueries({ queryKey: ["payment", paymentId] }); await client.invalidateQueries({ queryKey: ["payments"] }); await client.invalidateQueries({ queryKey: ["payment-summary"] }); },
    onError: (caught) => setError(caught instanceof ApiClientError ? `${caught.message} (Request ${caught.requestId})` : "Cancellation failed."),
  });
  const receipt = useQuery({ queryKey: ["receipt", paymentId], queryFn: () => api.receipt(paymentId), enabled: payment.data?.receiptAvailable === true });

  if (payment.isPending) return <Skeleton className="detail-skeleton" aria-label="Loading payment details" />;
  if (payment.isError || !payment.data) return <Card className="empty-state border-[var(--product-line)] bg-[#fffefa]" role="alert"><CardContent className="flex flex-col items-center gap-3 p-8"><CircleAlert size={30} /><CardTitle>Payment details could not be loaded.</CardTitle><Button variant="ghost" type="button" onClick={() => payment.refetch()}>Retry</Button></CardContent></Card>;

  const item = payment.data;
  const status = paymentStatusPresentation(item.status);
  const share = `${window.location.origin}/pay/${item.id}`;
  const canCancel = item.status === "ACTIVE" || item.status === "FAILED";
  return (
    <section className="payment-detail" aria-labelledby="payment-title">
      <div className="detail-heading"><div><div className="eyebrow">PAYMENT REQUEST · DEVNET</div><h1 id="payment-title">{item.title}</h1><p>{item.description || "No description was provided."}</p></div><Badge variant="outline" className={`status-chip status-${status.tone}`}>{status.label}</Badge></div>
      <div className="detail-grid">
        <Card className="detail-card border-[var(--product-line)] bg-[#fffefa]"><CardHeader className="p-0"><span className="soft-label">TOTAL</span><CardTitle className="detail-amount">{item.amount} {item.asset}</CardTitle></CardHeader><CardContent className="p-0"><dl><div><dt>Created</dt><dd>{formatDate(item.createdAt)}</dd></div><div><dt>Expires</dt><dd>{formatDate(item.expiresAt)}</dd></div><div><dt>Reference</dt><dd>{item.reference || "—"}</dd></div></dl></CardContent></Card>
        <Card className="detail-card border-[var(--product-line)] bg-[#fffefa]"><CardHeader className="p-0"><span className="soft-label">STATUS</span><CardTitle>{status.label}</CardTitle></CardHeader><CardContent className="space-y-3 p-0"><p>{status.detail}</p>{item.failureCode && <p className="error-message">{item.failureCode}</p>}{receipt.data && <Button variant="secondary" render={<a href={receipt.data.explorerUrl} target="_blank" rel="noreferrer" />}><ReceiptText size={15} /> View verified receipt <ExternalLink size={14} /></Button>}</CardContent></Card>
      </div>
      <Card className="detail-card border-[var(--product-line)] bg-[#fffefa]"><CardHeader className="detail-subheading p-0"><div><span className="soft-label">RECIPIENTS</span><CardTitle>Exact settlement allocations</CardTitle></div><span>{item.recipients.length === 1 ? "Standard" : `${item.recipients.length}-way split`}</span></CardHeader><CardContent className="p-0"><div className="recipient-detail-list">{item.recipients.map((recipient) => <div key={recipient.address}><code>{recipient.address}</code><span>{(recipient.allocationBps / 100).toFixed(2)}%</span><strong>{formatBaseUnits(recipient.amountBaseUnits, item.asset)} {item.asset}</strong></div>)}</div></CardContent></Card>
      <div className="detail-actions"><Button className="button primary" render={<Link href={`/pay/${item.id}`} />}>Open checkout</Button><Button variant="secondary" type="button" onClick={async () => { try { await navigator.clipboard.writeText(share); setCopied(true); } catch { setError("Copy failed. Select the checkout URL manually."); } }}><Copy size={15} /> {copied ? "Copied" : "Copy link"}</Button>{canCancel && <Button variant="ghost" className="danger-button" type="button" disabled={cancel.isPending} onClick={() => setConfirmCancel(true)}><XCircle size={15} /> Cancel payment</Button>}</div>
      <AlertDialog open={confirmCancel} title="Cancel this payment?" description="Cancellation is final. AUNO will refuse it if an unresolved transaction attempt exists." confirmLabel="Cancel payment" pending={cancel.isPending} onCancel={() => setConfirmCancel(false)} onConfirm={() => cancel.mutate()} />
      {error && <p className="error-message" role="alert">{error}</p>}
    </section>
  );
}