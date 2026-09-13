"use client";

import { WalletIcon } from "@web3icons/react/dynamic";
import { Wallet } from "lucide-react";
import { FiArrowRight, FiArrowUpRight, FiExternalLink, FiX } from "react-icons/fi";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Footer, Nav } from "./ui";
import {
  ASSETS,
  allocate,
  creationMessage,
  displayUnits,
  explorer,
  historyMessage,
  toBaseUnits,
  type Asset,
  type PaymentIntent,
} from "@/lib/payments/model";
import { availableWallets, connectWallet, type WalletSession } from "@/lib/payments/wallet";

async function api<T = PaymentIntent>(path: string, body?: unknown, headers?: Record<string, string>) {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(result.error || "Request failed. Please try again.");
  return result;
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Operation failed. Please try again.";
}

function WalletButton({ session, onChange }: { session: WalletSession | null; onChange: (session: WalletSession | null) => void }) {
  const [names, setNames] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  function openWalletOptions() {
    const detected = availableWallets().map((wallet) => wallet.name);
    setNames(detected);
    if (!detected.length) {
      setOpen(false);
      toast.error("No compatible wallet detected.", {
        description: "Install a Wallet Standard Solana wallet with Devnet support, then reload.",
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
      onChange(await connectWallet(name));
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
        <button className="button outline" disabled={busy} onClick={openWalletOptions}>
          {busy ? "Connecting…" : "Connect Wallet"}
        </button>
      )}
      {open && (
        <div className="wallet-options" aria-label="Detected wallets">
          {names.map((name) => (
            <button key={name} className="wallet-option" disabled={busy} onClick={() => connect(name)} aria-label={`Connect ${name}`}>
              <WalletIcon
                name={name}
                variant="branded"
                size={28}
                fallback={<span className="wallet-icon-fallback"><Wallet size={18} aria-hidden="true" /></span>}
              />
              <span>{name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppShell({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle: string }) {
  return (
    <>
      <Nav />
      <main className="page-shell">
        <div className="page-header">
          <div>
            <div className="eyebrow">AUNO APP <span className="badge">DEVNET · DEVELOPER PREVIEW</span></div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
        </div>
        <nav className="app-tabs">
          <a href="/dashboard/create">Create Payment</a>
          <a href="/dashboard/payments">Payment History</a>
          <a href="/split">Split Calculator</a>
          <a href="/docs">Help</a>
        </nav>
        {children}
      </main>
      <Footer />
    </>
  );
}

function validationError({ title, amount, recipient, asset }: { title: string; amount: string; recipient: string; asset: Asset }) {
  if (!title.trim()) return "Enter a payment title.";
  if (!amount.trim()) return "Enter a payment amount.";
  if (!recipient.trim()) return "Enter a recipient wallet address.";
  try {
    toBaseUnits(amount, ASSETS[asset].decimals);
    return null;
  } catch (error) {
    return errorText(error);
  }
}

export function CreatePayment() {
  const [wallet, setWallet] = useState<WalletSession | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState<Asset>("SOL");
  const [recipient, setRecipient] = useState("");
  const [hours, setHours] = useState("24");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<PaymentIntent | null>(null);

  function changeWallet(nextWallet: WalletSession | null) {
    setWallet(nextWallet);
    if (nextWallet && !recipient) setRecipient(nextWallet.address);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!wallet) {
      toast.error("Connect your merchant wallet first.");
      return;
    }
    const invalid = validationError({ title, amount, recipient, asset });
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setBusy(true);
    const notification = toast.loading("Requesting wallet signature…");
    try {
      const payload = JSON.stringify({
        merchantWallet: wallet.address,
        title,
        description,
        amount,
        asset,
        recipient,
        reference,
        expiresAt: Date.now() + Number(hours) * 3600000,
        timestamp: Date.now(),
        origin: location.origin,
      });
      const signature = await wallet.signMessage(creationMessage(payload));
      setCreated(await api("/api/payments", { payload, signature }));
      toast.success("Payment link created.", { id: notification });
    } catch (error) {
      toast.error(errorText(error), { id: notification });
    } finally {
      setBusy(false);
    }
  }

  const url = created ? `${typeof window === "undefined" ? "" : location.origin}/pay/${created.id}` : "";
  return (
    <AppShell title="Create a payment." subtitle="Define the amount. Choose the destination. Share one link.">
      <div className="app-grid">
        <div className="panel">
          <div className="panel-title">Payment details <span className="badge">DEVNET</span></div>
          <WalletButton session={wallet} onChange={changeWallet} />
          <form noValidate onSubmit={submit}>
            <label style={{ marginTop: 25 }}>Title<input required maxLength={120} placeholder="Website Development" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label>Description <span className="muted">(optional)</span><textarea maxLength={1000} placeholder="What is this payment for?" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
            <div className="two">
              <label>Amount<input required inputMode="decimal" placeholder="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
              <label>Asset<select value={asset} onChange={(event) => setAsset(event.target.value as Asset)}><option>SOL</option><option>USDC</option></select></label>
            </div>
            <label>Recipient wallet<input required spellCheck={false} placeholder="Full Solana wallet address" value={recipient} onChange={(event) => setRecipient(event.target.value)} /></label>
            <div className="two">
              <label>Expires in<select value={hours} onChange={(event) => setHours(event.target.value)}><option value="1">1 hour</option><option value="24">24 hours</option><option value="168">7 days</option><option value="720">30 days</option></select></label>
              <label>Reference (optional)<input maxLength={120} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="INV-001" /></label>
            </div>
            <button className="button wide" disabled={busy}>{busy ? "Approve the message in your wallet…" : <>Create Payment Link <FiArrowUpRight className="button-icon" aria-hidden="true" /></>}</button>
            <p className="detail-note">Creating a link requests a wallet message signature. It does not transfer funds.</p>
          </form>
          {created && <div className="notice"><strong>Share your payment link</strong><p className="break">{url}</p><div className="actions"><button className="button small" onClick={async () => { try { await navigator.clipboard.writeText(url); toast.success("Payment link copied."); } catch { toast.error("Copy failed. Select and copy the link above."); } }}>Copy Link</button><a className="text-link" href={`/pay/${created.id}`}>Open Checkout <FiArrowRight className="inline-icon action-icon" aria-hidden="true" /></a></div></div>}
        </div>
        <aside>
          <div className="panel"><div className="eyebrow">CHECKOUT PREVIEW</div><h2>{title || "Your payment title"}</h2><p>{description || "Payment description appears here."}</p><div className="amount">{amount || "0.00"}<span>{asset}</span></div><div className="receipt-details"><div><span>Recipient</span><strong>{recipient || "Not selected"}</strong></div><div><span>Network</span><strong>Solana Devnet</strong></div><div><span>Settlement</span><strong>Direct to recipient</strong></div></div></div>
          <div className="notice">Use test assets only. SOL and USDC signing flows are implemented but have not passed real wallet end-to-end acceptance testing. Never enter a seed phrase or private key.</div>
          <a className="text-link" href="/docs#getting-started">How to get devnet test assets <FiArrowRight className="inline-icon action-icon" aria-hidden="true" /></a>
        </aside>
      </div>
    </AppShell>
  );
}

export function Checkout({ id }: { id: string }) {
  const [payment, setPayment] = useState<PaymentIntent | null>(null);
  const [wallet, setWallet] = useState<WalletSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState("Loading payment…");
  const [signature, setSignature] = useState("");

  useEffect(() => {
    let active = true;
    const notification = toast.loading("Loading payment…");
    api(`/api/payments/${id}`).then((nextPayment) => {
      if (!active) return;
      setPayment(nextPayment);
      setSignature(nextPayment.transactionSignature || "");
      setState(nextPayment.status);
      toast.dismiss(notification);
    }).catch((error) => {
      if (!active) return;
      setState("Unavailable");
      toast.error(errorText(error), { id: notification });
    });
    return () => { active = false; toast.dismiss(notification); };
  }, [id]);

  async function verify(nextSignature = signature) {
    if (!nextSignature) return;
    setBusy(true);
    setState("Confirming on Solana…");
    const notification = toast.loading("Confirming payment on Solana…");
    try {
      const nextPayment = await api(`/api/payments/${id}/verify`, { signature: nextSignature });
      setPayment(nextPayment);
      const nextState = nextPayment.status === "PAID" ? "Payment Confirmed" : nextPayment.status === "FAILED" ? "Payment failed" : "Confirming on Solana…";
      setState(nextState);
      if (nextPayment.status === "PAID") toast.success("Payment verified.", { id: notification });
      else if (nextPayment.status === "FAILED") toast.error("Payment verification failed.", { id: notification });
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
    setBusy(true);
    setState("Preparing your devnet transaction…");
    const notification = toast.loading("Preparing your Devnet transaction…");
    try {
      const prepared = await api<{ transaction: string; attemptId: string }>(`/api/payments/${id}/prepare`, { payer: wallet.address });
      setState("Awaiting Signature");
      toast.loading("Awaiting wallet signature…", { id: notification });
      const signed = await wallet.signTransaction(prepared.transaction);
      setState("Submitting to Solana…");
      toast.loading("Submitting to Solana…", { id: notification });
      const result = await api<{ signature?: string; transactionSignature: string; message?: string }>(`/api/payments/${id}/submit`, { attemptId: prepared.attemptId, transaction: signed });
      setSignature(result.signature || result.transactionSignature);
      setState("Submitted. Verify settlement below.");
      toast.success("Payment submitted. Verify settlement below.", { id: notification });
      if (result.message) toast.info(result.message);
    } catch (error) {
      setState("Payment not confirmed");
      toast.error(errorText(error), { id: notification });
    } finally {
      setBusy(false);
    }
  }

  return <><Nav /><main className="page-shell"><div className="checkout panel"><div className="panel-title">AUNO CHECKOUT <span className="badge">DEVNET</span></div>{payment ? <><h1>{payment.title}</h1><p>{payment.description}</p><div className="amount">{payment.amount}<span>{payment.asset}</span></div><div className="receipt-details"><div><span>Recipient</span><strong>{payment.recipients[0].address}</strong></div><div><span>Network</span><strong>Solana Devnet</strong></div><div><span>Expires</span><strong>{new Date(payment.expiresAt).toLocaleString("en-US")}</strong></div>{payment.reference && <div><span>Reference</span><strong>{payment.reference}</strong></div>}</div><div className="notice" role="status">{state.replaceAll("_", " ")}</div>{payment.status === "PAID" ? <><h2>Payment Confirmed</h2><p>Independently verified at finalized commitment.</p><div className="receipt-details"><div><span>Payment ID</span><strong>{payment.id}</strong></div><div><span>Payer</span><strong>{payment.payer}</strong></div><div><span>Settled</span><strong>{payment.paidAt ? new Date(payment.paidAt).toISOString() : ""}</strong></div><div><span>Signature</span><strong>{payment.transactionSignature}</strong></div></div><a className="button wide" style={{ marginTop: 25 }} href={explorer(payment.transactionSignature!)} target="_blank" rel="noreferrer">View verified transaction <FiExternalLink className="inline-icon action-icon" aria-hidden="true" /></a></> : <>{!signature && payment.status !== "EXPIRED" && <><WalletButton session={wallet} onChange={setWallet} />{wallet && <><p className="detail-note break">Paying from {wallet.address}. You will send {payment.amount} {payment.asset} on Devnet to the recipient above, plus network fees{payment.asset === "USDC" ? " and any required recipient token-account rent" : ""}.</p><button className="button wide" disabled={busy} onClick={pay}>{busy ? "Payment in progress…" : `Pay ${payment.amount} ${payment.asset} on Devnet`}</button></>}</>}{signature && <><p className="break">Submitted signature: <a className="text-link" href={explorer(signature)} target="_blank" rel="noreferrer">{signature}</a></p><button className="button wide" disabled={busy} onClick={() => verify()}>{busy ? "Verifying…" : "Verify Payment"}</button><p className="detail-note">Finalization can take time. Retry verification before attempting another payment.</p></>}</>}<p className="detail-note">Developer preview · Test assets only · No custody</p></> : <p>{state}</p>}</div></main><Footer /></>;
}

export function PaymentHistory() {
  const [wallet, setWallet] = useState<WalletSession | null>(null);
  const [payments, setPayments] = useState<PaymentIntent[] | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!wallet) {
      toast.error("Connect your merchant wallet first.");
      return;
    }
    setBusy(true);
    const notification = toast.loading("Authorizing payment history…");
    try {
      const timestamp = Date.now();
      const signature = await wallet.signMessage(historyMessage(wallet.address, timestamp, location.origin));
      const data = await api<{ payments: PaymentIntent[] }>(`/api/payments?wallet=${wallet.address}`, undefined, { "x-auno-signature": signature, "x-auno-timestamp": String(timestamp) });
      setPayments(data.payments);
      toast.success(`${data.payments.length} payment${data.payments.length === 1 ? "" : "s"} loaded.`, { id: notification });
    } catch (error) {
      toast.error(errorText(error), { id: notification });
    } finally {
      setBusy(false);
    }
  }

  const visible = (payments || []).filter((payment) => (filter === "ALL" || payment.status === filter) && `${payment.title} ${payment.id}`.toLowerCase().includes(search.toLowerCase()));
  return <AppShell title="Your payment history." subtitle="Actual payment requests, with settlement verified on Solana."><div className="actions"><WalletButton session={wallet} onChange={(nextWallet) => { setWallet(nextWallet); setPayments(null); }} />{wallet && <button className="button" disabled={busy} onClick={load}>{busy ? "Authorizing…" : "Authorize & Load History"}</button>}</div>{payments === null ? <div className="empty"><h2>Your payments belong here.</h2><p>Connect your merchant wallet and sign a message to view payment requests.</p></div> : <><div className="history-tools"><input aria-label="Search payments" placeholder="Search title or payment ID" value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label="Filter status" value={filter} onChange={(event) => setFilter(event.target.value)}>{["ALL", "ACTIVE", "SUBMITTED", "CONFIRMING", "PAID", "FAILED", "EXPIRED"].map((status) => <option key={status}>{status}</option>)}</select></div>{visible.length ? <div className="table-wrap"><table><thead><tr><th>Payment</th><th>Amount</th><th>Status</th><th>Created</th><th>Transaction</th></tr></thead><tbody>{visible.map((payment) => <tr key={payment.id}><td><a href={`/pay/${payment.id}`}>{payment.title} <FiArrowUpRight className="inline-icon action-icon" aria-hidden="true" /></a></td><td>{payment.amount} {payment.asset}</td><td><span className="badge">{payment.status}</span></td><td>{new Date(payment.createdAt).toLocaleDateString("en-US")}</td><td>{payment.transactionSignature ? <a href={explorer(payment.transactionSignature)} target="_blank" rel="noreferrer">Explorer <FiExternalLink className="inline-icon action-icon" aria-hidden="true" /></a> : "—"}</td></tr>)}</tbody></table></div> : <div className="empty"><h2>No payments found.</h2><p>Create your first payment link or adjust your filters.</p><a className="button" href="/dashboard/create">Create Payment <FiArrowUpRight className="inline-icon action-icon" aria-hidden="true" /></a></div>}<p className="detail-note">Up to 200 most recent requests. No sample transactions.</p></>}</AppShell>;
}

export function SplitCalculator() {
  const [amount, setAmount] = useState("100");
  const [asset, setAsset] = useState<Asset>("USDC");
  const [rows, setRows] = useState([{ name: "Merchant", bps: "8000" }, { name: "Affiliate", bps: "1500" }, { name: "Treasury", bps: "500" }]);
  const previousError = useRef("");
  let error = "";
  let values: bigint[] = [];
  try {
    values = allocate(toBaseUnits(amount, ASSETS[asset].decimals), rows.map((row) => Number(row.bps)));
  } catch (nextError) {
    error = errorText(nextError);
  }

  useEffect(() => {
    if (error && error !== previousError.current) toast.error(error);
    previousError.current = error;
  }, [error]);

  return <AppShell title="One payment. Many destinations." subtitle="Preview exact allocations. This calculator does not create or send a payment."><div className="app-grid"><div className="panel"><div className="panel-title">Split calculator <span className="badge">PREVIEW ONLY</span></div><div className="two"><label>Amount<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Asset<select value={asset} onChange={(event) => setAsset(event.target.value as Asset)}><option>USDC</option><option>SOL</option></select></label></div><div className="split-row"><span>Recipient label</span><span>BPS</span></div>{rows.map((row, index) => <div className="split-row" key={index}><input aria-label={`Recipient ${index + 1} label`} value={row.name} onChange={(event) => setRows(rows.map((current, currentIndex) => currentIndex === index ? { ...current, name: event.target.value } : current))} /><input aria-label={`Recipient ${index + 1} basis points`} inputMode="numeric" value={row.bps} onChange={(event) => setRows(rows.map((current, currentIndex) => currentIndex === index ? { ...current, bps: event.target.value } : current))} /><button aria-label={`Remove recipient ${index + 1}`} disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, currentIndex) => currentIndex !== index))}><FiX aria-hidden="true" /></button></div>)}<button className="button outline" disabled={rows.length >= 5} onClick={() => setRows([...rows, { name: "Recipient", bps: "0" }])}>Add Recipient</button><p className="detail-note">100 BPS = 1%. Total must equal 10,000 BPS. Fractional base units are rounded down; the first recipient receives any remainder.</p></div><div className="panel"><h2>Allocation preview</h2>{error ? <p className="muted">Adjust the values to calculate an allocation.</p> : <><div className="allocation-bar">{rows.map((row, index) => <span key={index} style={{ width: `${Number(row.bps) / 100}%`, background: ["#7489b8", "#a2b2d4", "#c0b9d8", "#c9d8e7", "#8d9eb8"][index] }} />)}</div><div className="receipt-details">{rows.map((row, index) => <div key={index}><span>{row.name} · {Number(row.bps) / 100}%</span><strong>{displayUnits(values[index], ASSETS[asset].decimals)} {asset}</strong></div>)}</div></>}<div className="notice">Split settlement is planned. Standard SOL and USDC payments must pass real devnet acceptance tests before live split flows are enabled.</div></div></div></AppShell>;
}
