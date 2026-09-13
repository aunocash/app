"use client";

import { getBase58Decoder } from "@solana/codecs-strings";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { useSignAndSendTransaction } from "@solana/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, CircleAlert, ExternalLink, LoaderCircle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { api, ApiClientError, type PreparedTransaction } from "@/lib/client/api";
import { formatBaseUnits, paymentStatusPresentation } from "@/lib/client/payment-ui";
import { WalletButton } from "./wallet-button";
import { aunoWalletClient } from "./wallet-provider";

type StoredAttempt = { transactionId: string; abandonToken?: string; signature?: string };
function decodeBase64(value: string): Uint8Array { const raw = window.atob(value); return Uint8Array.from(raw, (char) => char.charCodeAt(0)); }
function checkoutStorageKey(paymentId: string) { return `auno:attempt:${paymentId}`; }
function readStoredAttempt(paymentId: string): StoredAttempt | null { try { const value: unknown = JSON.parse(sessionStorage.getItem(checkoutStorageKey(paymentId)) ?? "null"); if (!value || typeof value !== "object" || !("transactionId" in value) || typeof value.transactionId !== "string") return null; return value as StoredAttempt; } catch { return null; } }

function CheckoutSigner({ attempt, onSubmitted, onRejected }: { attempt: PreparedTransaction; onSubmitted: (signature: string) => Promise<void>; onRejected: () => Promise<void> }) {
  const connected = useConnectedWallet(aunoWalletClient);
  const signAndSend = useSignAndSendTransaction(connected!.account, "solana:devnet");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  return <div className="space-y-3"><Button className="button primary payment-button w-full" type="button" disabled={sending} onClick={async () => { setSending(true); setError(null); try { const output = await signAndSend({ transaction: decodeBase64(attempt.serializedTransaction) }); await onSubmitted(getBase58Decoder().decode(output.signature)); } catch { await onRejected(); setError("Wallet approval was not completed. A new attempt will be available after this blockhash expires."); } finally { setSending(false); } }}>{sending ? <LoaderCircle className="spin" size={16} /> : "Approve and send"}</Button>{error && <p className="error-message" role="alert">{error}</p>}</div>;
}

export function LiveCheckout({ paymentId }: { paymentId: string }) {
  const client = useQueryClient();
  const connected = useConnectedWallet(aunoWalletClient);
  const [attempt, setAttempt] = useState<PreparedTransaction | null>(null);
  const [recovery, setRecovery] = useState<StoredAttempt | null>(() => typeof window === "undefined" ? null : readStoredAttempt(paymentId));
  const [prepareIdempotencyKey, setPrepareIdempotencyKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const payment = useQuery({ queryKey: ["public-payment", paymentId], queryFn: () => api.publicPayment(paymentId), refetchInterval: (query) => query.state.data && paymentStatusPresentation(query.state.data.status).shouldPoll ? 3_000 : false });
  const receipt = useQuery({ queryKey: ["public-receipt", paymentId], queryFn: () => api.receipt(paymentId), enabled: payment.data?.receiptAvailable === true });
  const prepare = useMutation({ mutationFn: () => api.prepareTransaction(paymentId, connected!.account.address, prepareIdempotencyKey), onSuccess: (prepared) => { setAttempt(prepared); const stored = { transactionId: prepared.transactionId, abandonToken: prepared.abandonToken }; setRecovery(stored); sessionStorage.setItem(checkoutStorageKey(paymentId), JSON.stringify(stored)); }, onError: (caught) => setError(caught instanceof ApiClientError ? `${caught.message} (Request ${caught.requestId})` : "Transaction preparation failed.") });
  useEffect(() => { if (payment.data?.status === "PAID") sessionStorage.removeItem(checkoutStorageKey(paymentId)); }, [payment.data?.status, paymentId]);
  useEffect(() => { if (payment.data?.status !== "AWAITING_SIGNATURE" || !recovery?.signature) return; let cancelled = false; void api.submitTransaction(paymentId, recovery.transactionId, recovery.signature).then(() => { if (!cancelled) void client.invalidateQueries({ queryKey: ["public-payment", paymentId] }); }).catch((caught) => !cancelled && setError(caught instanceof ApiClientError ? `${caught.message} (Request ${caught.requestId})` : "Saved signature could not be submitted.")); return () => { cancelled = true; }; }, [client, payment.data?.status, paymentId, recovery]);
  if (payment.isPending) return <Skeleton className="checkout-skeleton" aria-label="Loading checkout" />;
  if (payment.isError || !payment.data) return <Card className="auth-gate mx-auto my-8 max-w-2xl border-[var(--product-line)] bg-[#fffefa] text-center" role="alert"><CardContent className="flex flex-col items-center gap-3 p-8"><CircleAlert size={24} /><CardTitle>This checkout is unavailable.</CardTitle><p>It may have expired, been cancelled, or the link is invalid.</p></CardContent></Card>;
  const item = payment.data;
  const status = paymentStatusPresentation(item.status);
  const submit = async (signature: string) => { if (!attempt) return; const stored = { transactionId: attempt.transactionId, abandonToken: attempt.abandonToken, signature }; setRecovery(stored); sessionStorage.setItem(checkoutStorageKey(paymentId), JSON.stringify(stored)); try { await api.submitTransaction(paymentId, attempt.transactionId, signature); setAttempt(null); await client.invalidateQueries({ queryKey: ["public-payment", paymentId] }); } catch (caught) { setError(caught instanceof ApiClientError ? `${caught.message} (Request ${caught.requestId})` : "Signature submission failed. Keep the signature for support."); } };
  const abandon = async (stored: StoredAttempt) => { if (!stored.abandonToken) return; try { await api.abandonTransaction(paymentId, stored.transactionId, stored.abandonToken); setPrepareIdempotencyKey(crypto.randomUUID()); } catch { setError("Attempt cleanup was unavailable. A new attempt will be available after blockhash expiry."); } finally { setAttempt(null); sessionStorage.removeItem(checkoutStorageKey(paymentId)); await client.invalidateQueries({ queryKey: ["public-payment", paymentId] }); } };
  return (
    <section className="checkout-live" aria-labelledby="checkout-title">
      <div className="checkout-heading"><div className="eyebrow">AUNO CHECKOUT · SOLANA DEVNET</div><h1 id="checkout-title">{item.title}</h1>{item.description && <p>{item.description}</p>}</div>
      <Card className="checkout-card border-[var(--product-line)] bg-[#fffefa] shadow-[var(--product-shadow)]">
        <CardHeader className="p-0"><Badge variant="outline" className={`status-chip status-${status.tone} w-fit`}>{status.label}</Badge><CardTitle className="checkout-amount">{item.amount} {item.asset}</CardTitle></CardHeader>
        <CardContent className="space-y-4 p-0"><p className="checkout-warning"><ShieldCheck size={16} /> You are approving a devnet transaction. Check the wallet, recipients, and amounts below.</p><div className="checkout-recipients">{item.recipients.map((recipient) => <div key={recipient.address}><code>{recipient.address}</code><span>{(recipient.allocationBps / 100).toFixed(2)}%</span><strong>{formatBaseUnits(recipient.amountBaseUnits, item.asset)} {item.asset}</strong></div>)}</div>{item.expiresAt && <p className="checkout-expiry">Expires {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.expiresAt))}</p>}
          {item.status === "PAID" && receipt.data ? <div className="receipt-success"><CheckCircle2 size={22} /><div><strong>Payment verified</strong><p>Finalized on Solana devnet. Your receipt is ready.</p><Button variant="link" className="inline-link px-0" render={<a href={receipt.data.explorerUrl} target="_blank" rel="noreferrer" />}>View Explorer transaction <ExternalLink size={14} /></Button></div></div> : item.canPay ? <div className="checkout-action">{!connected ? <WalletButton mode="payer" /> : !attempt ? <Button className="button primary payment-button w-full" type="button" disabled={prepare.isPending} onClick={() => prepare.mutate()}>{prepare.isPending ? "Preparing transaction…" : "Prepare secure transaction"}</Button> : <CheckoutSigner attempt={attempt} onSubmitted={submit} onRejected={() => abandon(attempt)} />}</div> : item.status === "AWAITING_SIGNATURE" && recovery?.abandonToken ? <div className="checkout-action"><p className="status-detail">A previous unsigned wallet request is still active.</p><Button variant="secondary" type="button" onClick={() => abandon(recovery)}>Abandon unsigned attempt</Button></div> : <p className="status-detail">{status.detail}</p>}{error && <p className="error-message" role="alert">{error}</p>}
        </CardContent>
      </Card>
    </section>
  );
}