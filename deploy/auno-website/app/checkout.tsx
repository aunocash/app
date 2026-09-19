"use client";

import { Transaction } from "@solana/web3.js";
import { Wallet } from "lucide-react";
import { FiArrowLeft, FiExternalLink } from "react-icons/fi";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Footer, Nav } from "./ui";
import { NETWORKS, explorer, networkForOrigin, type PaymentIntent } from "@/lib/payments/model";
import type { WalletSession } from "@/lib/payments/wallet";

export type CheckoutPayment = Omit<PaymentIntent, "merchantWallet" | "updatedAt">;

async function api<T = PaymentIntent>(path: string, body?: unknown, headers?: Record<string, string>) {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let result: T & { error?: string };
  try { result = await response.json() as T & { error?: string }; }
  catch { throw new Error(`AUNO returned an unreadable response (${response.status}). Please retry.`); }
  if (!response.ok) throw new Error(result.error || "Request failed. Please try again.");
  return result;
}

function errorText(error: unknown) {
  if (!(error instanceof Error)) return "Operation failed. Please try again.";
  if (error.message === "Failed to fetch") return "Could not reach AUNO. Check your connection and try again.";
  return error.message;
}

function browserNetwork() {
  return networkForOrigin(typeof window === "undefined" ? "https://auno.cash" : window.location.origin);
}

function walletChain(): "solana:devnet" | "solana:mainnet" {
  return browserNetwork() === "mainnet-beta" ? "solana:mainnet" : "solana:devnet";
}

type CheckoutProgress = {
  attempt: { id: string; token: string } | null;
  signature: string;
};

function checkoutProgressKey(id: string) {
  return "auno:checkout:" + id;
}

function readCheckoutProgress(id: string): CheckoutProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(checkoutProgressKey(id)) || "null");
    if (!value || typeof value !== "object") return null;
    const record = value as { attempt?: unknown; signature?: unknown };
    const savedAttempt = record.attempt as { id?: unknown; token?: unknown } | null;
    const attempt = savedAttempt && typeof savedAttempt.id === "string" && typeof savedAttempt.token === "string"
      ? { id: savedAttempt.id, token: savedAttempt.token }
      : null;
    const signature = typeof record.signature === "string" ? record.signature : "";
    return attempt || signature ? { attempt, signature } : null;
  } catch {
    return null;
  }
}

function writeCheckoutProgress(id: string, progress: CheckoutProgress) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(checkoutProgressKey(id), JSON.stringify(progress));
  } catch {
    // Private browsing or a full browser quota must not interrupt a payment.
  }
}

function clearCheckoutProgress(id: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(checkoutProgressKey(id));
  } catch {
    // Ignore unavailable session storage after settlement.
  }
}

function WalletButton({ session, onChange }: { session: WalletSession | null; onChange: (session: WalletSession | null) => void }) {
  const [names, setNames] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function openWalletOptions() {
    let detected: string[];
    try {
      const { availableWallets } = await import("@/lib/payments/wallet");
      detected = availableWallets(walletChain()).map((wallet) => wallet.name);
    } catch {
      setOpen(false);
      toast.error("Wallet detection failed.", { description: "Reload the page, then try connecting your wallet again." });
      return;
    }
    setNames(detected);
    if (!detected.length) {
      setOpen(false);
      toast.error("No compatible wallet detected.", {
        description: "Install a Wallet Standard Solana wallet for this network, then reload.",
        action: {
          label: "Get Phantom",
          onClick: () => window.open("https://phantom.com/download", "_blank", "noopener,noreferrer"),
        },
      });
      return;
    }
    setOpen((current) => !current);
  }

  async function connect(name: string) {
    setBusy(true);
    const notification = toast.loading(`Connecting ${name}…`);
    try {
      const { connectWallet } = await import("@/lib/payments/wallet");
      onChange(await connectWallet(name, walletChain()));
      setOpen(false);
      toast.success(`${name} connected.`, { id: notification });
    } catch (error) {
      toast.error(errorText(error), { id: notification });
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!session) return;
    setBusy(true);
    const notification = toast.loading("Disconnecting wallet…");
    try {
      await session.disconnect();
      onChange(null);
      toast.success("Wallet disconnected.", { id: notification });
    } catch (error) {
      toast.error(errorText(error), { id: notification });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wallet-control">
      {session ? (
        <button className="button outline" disabled={busy} onClick={disconnect}>
          {session.address.slice(0, 4)}…{session.address.slice(-4)} · Disconnect
        </button>
      ) : (
        <button className="button outline" disabled={busy} onClick={() => void openWalletOptions()}>
          {busy ? "Connecting…" : "Connect Wallet"}
        </button>
      )}
      {open && (
        <div className="wallet-options" aria-label="Detected wallets">
          {names.map((name) => (
            <button key={name} className="wallet-option" disabled={busy} onClick={() => connect(name)} aria-label={`Connect ${name}`}>
              <Wallet size={18} aria-hidden="true" />
              <span>{name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Checkout({ id, initialPayment = null, embedded = false, onBack }: { id: string; initialPayment?: CheckoutPayment | null; embedded?: boolean; onBack?: () => void }) {
  const [payment, setPayment] = useState<CheckoutPayment | null>(initialPayment);
  const [wallet, setWallet] = useState<WalletSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState(initialPayment?.status ?? "Loading payment…");
  const [signature, setSignature] = useState(initialPayment?.transactionSignature || "");
  const [attempt, setAttempt] = useState<{ id: string; token: string } | null>(null);

  useEffect(() => {
    const saved = readCheckoutProgress(id);
    if (!saved) return;
    setAttempt(saved.attempt);
    setSignature((current) => current || saved.signature);
    if (saved.signature) setState("Submitted. Verify settlement below.");
  }, [id]);

  useEffect(() => {
    if (initialPayment) {
      setPayment(initialPayment);
      setSignature((current) => initialPayment.transactionSignature || current);
      setState(initialPayment.status);
      return;
    }
    let active = true;
    const notification = toast.loading("Loading payment…");
    api<CheckoutPayment>(`/api/payments/${id}`).then((nextPayment) => {
      if (!active) return;
      setPayment(nextPayment);
      setSignature((current) => nextPayment.transactionSignature || current);
      setState(nextPayment.status);
      toast.dismiss(notification);
    }).catch((error) => {
      if (!active) return;
      setState("Unavailable");
      toast.error(errorText(error), { id: notification });
    });
    return () => { active = false; toast.dismiss(notification); };
  }, [id, initialPayment]);

  useEffect(() => {
    if (!attempt && !signature) return;
    writeCheckoutProgress(id, { attempt, signature });
  }, [attempt, id, signature]);

  useEffect(() => {
    if (payment?.status === "PAID") clearCheckoutProgress(id);
  }, [id, payment?.status]);

  async function verify(nextSignature = signature) {
    if (!nextSignature) return;
    setBusy(true);
    setState("Confirming on Solana…");
    const notification = toast.loading("Confirming payment on Solana…");
    try {
      if (!attempt) throw new Error("This browser session no longer has the attempt secret. Start a fresh payment attempt.");
      const nextPayment = await api(`/api/payments/${id}/verify`, { attemptId: attempt.id, attemptToken: attempt.token });
      setPayment(nextPayment);
      const nextState = nextPayment.status === "PAID" ? "Payment Confirmed" : "Confirming on Solana…";
      setState(nextState);
      if (nextPayment.status === "PAID") toast.success("Payment verified.", { id: notification });
      else toast.info(nextState, { id: notification });
    } catch (error) {
      toast.error(errorText(error), { id: notification });
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!wallet || !payment) {
      toast.error("Connect a wallet before paying.");
      return;
    }
    if (payment.recipients.some((recipient) => recipient.address === wallet.address)) {
      setState("Choose a different payer wallet.");
      toast.error("Payer and recipient cannot be the same wallet.", { description: "Connect a different wallet before paying." });
      return;
    }
    setBusy(true);
    const transactionNetwork = payment.network === "mainnet-beta" ? "Mainnet Beta" : "Devnet";
    setState(`Preparing your ${transactionNetwork} transaction…`);
    const notification = toast.loading(`Preparing your ${transactionNetwork} transaction…`);
    try {
      const prepared = await api<{ transaction: string; attemptId: string; attemptToken: string }>(`/api/payments/${id}/prepare`, { payer: wallet.address });
      setAttempt({ id: prepared.attemptId, token: prepared.attemptToken });
      setState("Awaiting Signature");
      toast.loading("Awaiting wallet signature…", { id: notification });
      const signed = await wallet.signTransaction(prepared.transaction);
      setState("Submitting to Solana…");
      toast.loading("Submitting to Solana…", { id: notification });
      const result = await api<{ signature: string; message?: string }>(`/api/payments/${id}/submissions`, { attemptId: prepared.attemptId, attemptToken: prepared.attemptToken, transaction: signed });
      setSignature(result.signature);
      if (result.message) {
        setState("Submission needs confirmation");
        toast.error("Solana has not accepted the payment yet.", { id: notification, description: result.message, duration: 6_000 });
      } else {
        setState("Submitted. Verify settlement below.");
        toast.success("Payment submitted. Verify settlement below.", { id: notification });
      }
    } catch (error) {
      setState("Payment not confirmed");
      toast.error(errorText(error), { id: notification });
    } finally {
      setBusy(false);
    }
  }

  const networkLabel = payment ? NETWORKS[payment.network].label : "Solana";
  const networkBadge = payment?.network === "mainnet-beta" ? "MAINNET BETA" : "DEVNET";
  const card = <div className={embedded ? "checkout panel checkout-embedded" : "checkout panel"} role={embedded ? "dialog" : undefined} aria-modal={embedded || undefined} aria-label={embedded ? "Payment checkout" : undefined}>{embedded && onBack && <button className="checkout-back" type="button" onClick={onBack}><FiArrowLeft aria-hidden="true" /> Back to payment link</button>}<div className="panel-title">AUNO CHECKOUT <span className="badge">{networkBadge}</span></div>{payment ? <><h1>{payment.title}</h1><p>{payment.description}</p><div className="amount">{payment.amount}<span>{payment.asset}</span></div><div className="receipt-details"><div><span>Recipient</span><strong>{payment.recipients[0].address}</strong></div><div><span>Network</span><strong>{networkLabel}</strong></div><div><span>Expires</span><strong>{new Date(payment.expiresAt).toISOString()}</strong></div>{payment.reference && <div><span>Reference</span><strong>{payment.reference}</strong></div>}</div><div className="notice" role="status">{state.replaceAll("_", " ")}</div>{payment.status === "PAID" ? <><h2>Payment Confirmed</h2><p>Independently verified at finalized commitment.</p><div className="receipt-details"><div><span>Payment ID</span><strong>{payment.id}</strong></div><div><span>Payer</span><strong>{payment.payer}</strong></div><div><span>Settled</span><strong>{payment.paidAt ? new Date(payment.paidAt).toISOString() : ""}</strong></div><div><span>Signature</span><strong>{payment.transactionSignature}</strong></div></div><a className="button wide" style={{ marginTop: 25 }} href={explorer(payment.transactionSignature!, payment.network)} target="_blank" rel="noreferrer">View verified transaction <FiExternalLink className="inline-icon action-icon" aria-hidden="true" /></a></> : <>{!signature && payment.status !== "EXPIRED" && <><WalletButton session={wallet} onChange={setWallet} />{wallet && <><p className="detail-note break">Paying from {wallet.address}. You will send {payment.amount} {payment.asset} on {networkLabel} to the recipient above, plus network fees{payment.asset === "USDC" ? " and any required recipient token-account rent" : ""}.</p><button className="button wide" disabled={busy} onClick={pay}>{busy ? "Payment in progress…" : `Pay ${payment.amount} ${payment.asset} on ${networkLabel}`}</button></>}</>}{signature && <><p className="break">Submitted signature: <a className="text-link" href={explorer(signature, payment.network)} target="_blank" rel="noreferrer">{signature}</a></p><button className="button wide" disabled={busy} onClick={() => verify()}>{busy ? "Verifying…" : "Verify Payment"}</button><p className="detail-note">Finalization can take time. Retry verification before attempting another payment.</p></>}</>}<p className="detail-note">{payment.network === "mainnet-beta" ? "Public Mainnet Beta · Non-custodial" : "Developer preview · Test assets only · No custody"}</p></> : <p>{state}</p>}</div>;
  return embedded ? card : <><Nav network={payment?.network === "mainnet-beta" ? "mainnet" : undefined} /><main className="page-shell">{card}</main><Footer network={payment?.network === "mainnet-beta" ? "mainnet" : undefined} /></>;
}

