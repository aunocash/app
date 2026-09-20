"use client";

import { WalletIcon } from "@web3icons/react/dynamic";
import { Wallet } from "lucide-react";
import { FiAlertCircle, FiArrowRight, FiArrowUpRight, FiBarChart2, FiCheckCircle, FiClock, FiCopy, FiDollarSign, FiExternalLink, FiGitBranch, FiHelpCircle, FiInfo, FiLayers, FiFileText, FiPercent, FiPlus, FiPlusCircle, FiTrash2, FiUsers, FiX } from "react-icons/fi";
import { usePathname } from "next/navigation";
import { lazy, Suspense, useCallback, useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { toast } from "sonner";
import { MainnetBetaRibbon, Footer, Nav, useMainnetSplitsCapability } from "./ui";
import {
  ASSETS,
  NETWORKS,
  allocate,
  creationMessage,
  displayUnits,
  explorer,
  historyMessage,
  networkForOrigin,
  percentToBps,
  toBaseUnits,
  validateSplitRecipients,
  type Asset,
  type NetworkId,
  type PaymentIntent,
  type SplitRecipient,
} from "@/lib/payments/model";
import { availableWallets, clearWalletSession, connectWallet, saveWalletSession, type WalletSession } from "@/lib/payments/wallet";

const EmbeddedCheckout = lazy(async () => {
  const checkoutModule = await import("./checkout");
  return { default: checkoutModule.Checkout };
});

type SplitSettlement = {
  paymentId: string;
  attemptId: string;
  attemptToken: string;
  signature: string;
  status: string;
  relayMessage?: string;
  error?: string;
  receipt?: PaymentIntent;
};

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

function useBrowserNetwork() {
  return useSyncExternalStore<NetworkId>(
    () => () => undefined,
    () => networkForOrigin(window.location.origin),
    () => "devnet",
  );
}

function walletChain(): "solana:devnet" | "solana:mainnet" {
  return browserNetwork() === "mainnet-beta" ? "solana:mainnet" : "solana:devnet";
}

export function WalletButton({ session, onChange }: { session: WalletSession | null; onChange: (session: WalletSession | null) => void }) {
  const [names, setNames] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  function openWalletOptions() {
    let detected: string[];
    try {
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
      const nextWallet = await connectWallet(name, walletChain());
      saveWalletSession(nextWallet);
      onChange(nextWallet);
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
      clearWalletSession();
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
  const pathname = usePathname();
  const network = useBrowserNetwork();
  const mainnetSplits = useMainnetSplitsCapability(network === "mainnet-beta");
  const tabs = [
    { href: "/dashboard/create", label: "Create Payment", icon: FiPlusCircle },
    { href: "/dashboard/payments", label: "Payment History", icon: FiClock },
    { href: "/dashboard/invoices", label: "Invoices", icon: FiFileText },
    ...(network === "devnet" || mainnetSplits ? [{ href: "/split", label: "Split Payment", icon: FiGitBranch }] : []),
    { href: "/docs", label: "Help", icon: FiHelpCircle },
  ];

  return (
    <>

      <Nav />
      <main className="page-shell">
        <div className="page-header">
          <div>
            <div className="eyebrow">AUNO APP <span className="badge">{network === "mainnet-beta" ? "MAINNET BETA · PUBLIC" : "DEVNET · DEVELOPER PREVIEW"}</span></div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
        </div>
        <nav className="app-tabs" aria-label="Payment app navigation">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return <a href={href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined} key={href}><Icon aria-hidden="true" /><span>{label}</span></a>;
          })}
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
  const [checkoutVisited, setCheckoutVisited] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const network = useBrowserNetwork();
  const mainnet = network === "mainnet-beta";
  const mainnetSplits = useMainnetSplitsCapability(mainnet);

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
      const signature = await wallet.signMessage(creationMessage(payload, network));
      const nextPayment = await api("/api/payments", { payload, signature });
      setCreated(nextPayment);
      setCheckoutVisited(false);
      setShowCheckout(false);
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
          <div className="panel-title">Payment details <span className="badge">{mainnet ? "MAINNET BETA" : "DEVNET"}</span></div>
          <WalletButton session={wallet} onChange={changeWallet} />
          <form noValidate onSubmit={submit}>
            <label style={{ marginTop: 25 }}>Title<input required maxLength={120} placeholder={mainnet ? "AUNO Mainnet Payment" : "AUNO Test Payment"} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label>Description <span className="muted">(optional)</span><textarea maxLength={1000} placeholder={mainnet ? "Mainnet Beta payment link" : "Testing AUNO Payment Link on Solana Devnet"} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
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
          {created && (
            <div className="payment-ready-backdrop">
              {checkoutVisited && (
                <div hidden={!showCheckout}>
                  <Suspense fallback={<section className="checkout panel checkout-embedded" role="status">Loading secure checkout…</section>}>
                    <EmbeddedCheckout id={created.id} initialPayment={created} embedded onBack={() => setShowCheckout(false)} />
                  </Suspense>
                </div>
              )}
              {!showCheckout && (
                <section className="payment-ready-panel" role="dialog" aria-modal="true" aria-labelledby="payment-ready-title">
                  <button className="payment-ready-close" type="button" aria-label="Close payment link panel" onClick={() => { setCreated(null); setCheckoutVisited(false); setShowCheckout(false); }}><FiX aria-hidden="true" /></button>
                  <div className="eyebrow">PAYMENT LINK CREATED <span className="badge">{created.asset}</span></div>
                  <h2 id="payment-ready-title">Payment link ready.</h2>
                  <p>Keep editing this request or open its checkout when you are ready.</p>
                  <div className="receipt-details payment-ready-details">
                    <div><span>Amount</span><strong>{created.amount} {created.asset}</strong></div>
                    <div><span>Recipient</span><strong>{created.recipients[0]?.address}</strong></div>
                  </div>
                  <code className="payment-ready-link">{url}</code>
                  <div className="payment-ready-actions">
                    <button className="button" type="button" onClick={async () => { try { await navigator.clipboard.writeText(url); toast.success("Payment link copied."); } catch { toast.error("Copy failed. Select and copy the link above."); } }}>Copy Link <FiCopy className="inline-icon action-icon" aria-hidden="true" /></button>
                    <button className="button light" type="button" onClick={() => { setCheckoutVisited(true); setShowCheckout(true); }}>Open Checkout <FiArrowRight className="inline-icon action-icon" aria-hidden="true" /></button>
                  </div>
                  <button className="payment-ready-stay" type="button" onClick={() => { setCreated(null); setCheckoutVisited(false); setShowCheckout(false); }}>Keep editing</button>
                </section>
              )}
            </div>
          )}
        </div>
        <aside>
          <div className="panel"><div className="eyebrow">CHECKOUT PREVIEW</div><h2>{title || "Your payment title"}</h2><p>{description || "Payment description appears here."}</p><div className="amount">{amount || "0.00"}<span>{asset}</span></div><div className="receipt-details"><div><span>Recipient</span><strong>{recipient || "Not selected"}</strong></div><div><span>Network</span><strong>{NETWORKS[network].label}</strong></div><div><span>Settlement</span><strong>Direct to recipient</strong></div></div></div>
          <div className="notice">{mainnet ? "Public Mainnet Beta · SOL and USDC · 0.1 SOL / 100 USDC maximum. Never enter a seed phrase or private key." : "Use test assets only. SOL and USDC signing flows are implemented but have not passed real wallet end-to-end acceptance testing. Never enter a seed phrase or private key."}</div>
          {mainnet && !mainnetSplits && <MainnetBetaRibbon features="Split payments" />}
          {!mainnet && <a className="text-link" href="/docs#getting-started">How to get devnet test assets <FiArrowRight className="inline-icon action-icon" aria-hidden="true" /></a>}
        </aside>
      </div>
    </AppShell>
  );
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
      const signature = await wallet.signMessage(historyMessage(wallet.address, timestamp, location.origin, browserNetwork()));
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
  return (
    <AppShell title="Your payment history." subtitle="Actual payment requests, with settlement verified on Solana.">
      <div className="actions">
        <WalletButton session={wallet} onChange={(nextWallet) => { setWallet(nextWallet); setPayments(null); }} />
        {wallet && <button className="button" disabled={busy} onClick={load}>{busy ? "Authorizing…" : "Authorize & Load History"}</button>}
      </div>
      {payments === null ? (
        <div className="empty"><h2>Your payments belong here.</h2><p>Connect your merchant wallet and sign a message to view payment requests.</p></div>
      ) : (
        <>
          <div className="history-tools">
            <input aria-label="Search payments" placeholder="Search title or payment ID" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select aria-label="Filter status" value={filter} onChange={(event) => setFilter(event.target.value)}>
              {["ALL", "ACTIVE", "PAID", "EXPIRED", "CANCELLED"].map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>
          {visible.length ? (
            <div className="table-wrap"><table><thead><tr><th>Payment</th><th>Amount</th><th>Status</th><th>Created</th><th>Transaction</th></tr></thead><tbody>
              {visible.map((payment) => <tr key={payment.id}><td><a href={"/pay/" + payment.id}>{payment.title} <FiArrowUpRight className="inline-icon action-icon" aria-hidden="true" /></a></td><td>{payment.amount} {payment.asset}</td><td><span className="badge">{payment.status}</span></td><td>{new Date(payment.createdAt).toLocaleDateString("en-US")}</td><td>{payment.transactionSignature ? <a href={explorer(payment.transactionSignature, payment.network)} target="_blank" rel="noreferrer">Explorer <FiExternalLink className="inline-icon action-icon" aria-hidden="true" /></a> : "—"}</td></tr>)}
            </tbody></table></div>
          ) : (
            <div className="empty"><h2>No payments found.</h2><p>Create your first payment link or adjust your filters.</p><a className="button" href="/dashboard/create">Create Payment <FiArrowUpRight className="inline-icon action-icon" aria-hidden="true" /></a></div>
          )}
          <p className="detail-note">Up to 200 most recent requests. No sample transactions.</p>
        </>
      )}
    </AppShell>
  );
}

function SplitReceipt({ receipt }: { receipt: PaymentIntent }) {
  const decimals = ASSETS[receipt.asset].decimals;
  const mainnet = receipt.network === "mainnet-beta";
  const verification = receipt.verification;
  return (
    <section className="notice split-receipt" role="status" aria-live="polite">
      <div className="split-receipt-heading">
        <FiCheckCircle aria-hidden="true" />
        <div><strong>Verified payment receipt</strong><p>Every destination was paid in one finalized {mainnet ? "Mainnet Beta" : "Devnet"} transaction.</p></div>
      </div>
      <div className="receipt-details">
        <div><span>Payment ID</span><strong>{receipt.id}</strong></div>
        <div><span>Payer</span><strong>{receipt.payer}</strong></div>
        <div><span>Settled</span><strong>{receipt.paidAt ? new Date(receipt.paidAt).toISOString() : ""}</strong></div>
        <div><span>Network</span><strong>{mainnet ? "Solana Mainnet Beta" : "Solana Devnet"}</strong></div>
        <div><span>Signature</span><strong>{receipt.transactionSignature}</strong></div>
        <div><span>Verification</span><strong>{verification?.verified && verification.commitment === "finalized" ? "Finalized on-chain" : "Verified"}</strong></div>
      </div>
      <div className="split-allocation-list split-receipt-list">
        {receipt.recipients.map((recipient) => (
          <div className="split-allocation-item" key={recipient.address}>
            <span className="split-allocation-label"><i aria-hidden="true" /><span><strong>{recipient.label}</strong><small>{recipient.address}</small></span></span>
            <strong>{displayUnits(BigInt(recipient.amountBaseUnits), decimals)} {receipt.asset}</strong>
          </div>
        ))}
      </div>
      <a className="button small" href={explorer(receipt.transactionSignature!, receipt.network)} target="_blank" rel="noreferrer">
        View verified transaction <FiExternalLink className="inline-icon action-icon" aria-hidden="true" />
      </a>
    </section>
  );
}

const DEMO_SPLIT_ROWS = [
  { label: "Olivia Bennett", wallet: "", bps: "80" },
  { label: "Noah Williams", wallet: "", bps: "15" },
  { label: "Ava Mitchell", wallet: "", bps: "5" },
];

export function SplitCalculator({ network = "devnet" }: { network?: NetworkId } = {}) {
  const mainnet = network === "mainnet-beta";
  const settlementLabel = mainnet ? "Mainnet Beta" : "Devnet";
  const [amount, setAmount] = useState(mainnet ? "0.01" : "100");
  const [asset, setAsset] = useState<Asset>(mainnet ? "SOL" : "USDC");
  const [rows, setRows] = useState(DEMO_SPLIT_ROWS);
  const [step, setStep] = useState<"configure" | "review">("configure");
  const [wallet, setWallet] = useState<WalletSession | null>(null);
  const [settling, setSettling] = useState(false);
  const [settlement, setSettlement] = useState<SplitSettlement | null>(null);
  let error = "";
  let values: bigint[] = [];
  let recipients: SplitRecipient[] = [];
  try {
    recipients = validateSplitRecipients(rows.map((row) => ({ ...row, bps: percentToBps(row.bps) })));
    values = allocate(toBaseUnits(amount, ASSETS[asset].decimals), recipients.map((recipient) => recipient.bps));
    if (mainnet && asset === "SOL" && toBaseUnits(amount, ASSETS.SOL.decimals) > 100000000n) throw new Error("Mainnet Beta split payments are limited to 0.1 SOL.");
    if (mainnet && asset === "USDC" && toBaseUnits(amount, ASSETS.USDC.decimals) > 100000000n) throw new Error("Mainnet Beta split payments are limited to 100 USDC.");
  } catch (nextError) {
    error = errorText(nextError);
  }

  let enteredTotalPercent = 0;
  for (const row of rows) {
    const parsed = parseFloat(row.bps);
    if (Number.isFinite(parsed)) enteredTotalPercent += parsed;
  }
  const totalPercent = error && recipients.length === 0 ? enteredTotalPercent : recipients.reduce((total, recipient) => total + recipient.bps, 0) / 100;
  const totalLabel = Number.isFinite(totalPercent) ? `${totalPercent.toFixed(2).replace(/\.00$/, "")} %` : "—";

  async function payAndSplit(now: number) {
    if (!wallet) {
      toast.error("Connect the payer wallet before continuing.");
      return;
    }
    if (error) {
      toast.error(error);
      return;
    }
    if (recipients.some((recipient) => recipient.wallet === wallet.address)) {
      toast.error("Payer and recipient must be different wallets.", { description: "Connect a different payer wallet before continuing." });
      return;
    }
    try { wallet.assertActive(); } catch (nextError) { toast.error(errorText(nextError)); return; }
    setSettling(true);
    setSettlement(null);
    const notification = toast.loading("Authorizing split payment…");
    try {
      const payload = JSON.stringify({
        merchantWallet: wallet.address,
        title: "Split payment",
        description: `Atomic ${settlementLabel} split payment`,
        asset,
        amount,
        recipients: recipients.map((recipient) => ({ label: recipient.label, wallet: recipient.wallet, bps: recipient.bps })),
        reference: "SPLIT-" + now,
        expiresAt: now + 3_600_000,
        timestamp: now,
        origin: location.origin,
      });
      const signature = await wallet.signMessage(creationMessage(payload, network));
      const payment = await api<PaymentIntent>("/api/payments", { payload, signature });
      toast.loading("Preparing atomic transaction…", { id: notification });
      const prepared = await api<{ transaction: string; attemptId: string; attemptToken: string }>(`/api/payments/${payment.id}/prepare`, { payer: wallet.address });
      toast.loading("Approve one transaction in your wallet…", { id: notification });
      wallet.assertActive();
const walletSignature = wallet.signAndSendTransaction ? await wallet.signAndSendTransaction(prepared.transaction) : undefined;
      const signedTransaction = walletSignature ? undefined : await wallet.signTransaction?.(prepared.transaction);
      if (!signedTransaction && !walletSignature) throw new Error("This wallet cannot sign the prepared transaction.");
      const submitted = await api<{ signature: string; status: string; message?: string }>(`/api/payments/${payment.id}/submissions`, signedTransaction
        ? { attemptId: prepared.attemptId, attemptToken: prepared.attemptToken, transaction: signedTransaction }
        : { attemptId: prepared.attemptId, attemptToken: prepared.attemptToken, signature: walletSignature });
      setSettlement({ paymentId: payment.id, attemptId: prepared.attemptId, attemptToken: prepared.attemptToken, ...submitted, relayMessage: submitted.message });
      if (submitted.message) toast.error("Solana has not accepted the split yet.", { id: notification, description: submitted.message, duration: 6_000 });
      else toast.success("Split transaction submitted. Finalization is now being checked.", { id: notification });
    } catch (nextError) {
      const message = errorText(nextError);
      setSettlement((current) => current ? { ...current, error: message } : current);
      toast.error("Split payment was not submitted.", { id: notification, description: message, duration: 6_000 });
    } finally {
      setSettling(false);
    }
  }

  const verifySplit = useCallback(async (quiet = false) => {
    if (!settlement) return;
    setSettling(true);
    const notification = quiet ? undefined : toast.loading(`Checking ${settlementLabel} finalization…`);
    try {
      const result = await api<PaymentIntent | { status: string; signature?: string }>(`/api/payments/${settlement.paymentId}/verify`, { attemptId: settlement.attemptId, attemptToken: settlement.attemptToken });
      const receipt = result.status === "PAID" && "recipients" in result ? result : undefined;
      const verifiedSignature = "transactionSignature" in result ? result.transactionSignature : result.signature;
      setSettlement((current) => current ? { ...current, status: result.status, signature: verifiedSignature || current.signature, error: undefined, receipt } : current);
      if (receipt && !quiet) toast.success("Split settled. Your verified receipt is ready.", { id: notification });
      else if (!quiet) toast.info("Transaction is still confirming. Check again shortly.", { id: notification });
    } catch (nextError) {
      const message = errorText(nextError);
      setSettlement((current) => current ? { ...current, error: message } : current);
      if (!quiet) toast.error("Split verification failed.", { id: notification, description: message, duration: 6_000 });
    } finally {
      setSettling(false);
    }
  }, [settlement]);

  useEffect(() => {
    if (!settlement || settlement.receipt || settlement.error || settling || !["SUBMITTED", "CONFIRMING"].includes(settlement.status)) return;
    const timer = window.setTimeout(() => void verifySplit(true), 10_000);
    return () => window.clearTimeout(timer);
  }, [settlement, settling, verifySplit]);

  return (
    <AppShell title="One payment. Many destinations." subtitle={`Set exact destinations, review the split, then sign one atomic ${settlementLabel} transaction when settlement is enabled.`}>
      <ol className="split-flow-steps" aria-label="Split payment flow">
        <li className={step === "configure" ? "is-current" : "is-complete"}><span>1</span><div><strong>Configure</strong><small>Amount, asset, wallets, allocation</small></div></li>
        <li className={step === "review" ? "is-current" : ""}><span>2</span><div><strong>Connect & review</strong><small>Confirm every destination</small></div></li>
        <li><span>3</span><div><strong>Pay & Split</strong><small>One signature, atomic settlement</small></div></li>
      </ol>

      {step === "configure" ? (
      <div className="split-workspace">
        <section className="panel split-editor-panel" aria-labelledby="split-editor-title">
          <div className="split-panel-header">
            <div className="split-panel-title">
              <span className="split-panel-icon"><FiGitBranch aria-hidden="true" /></span>
              <div>
                <span className="split-kicker">PAYMENT ROUTING</span>
                <h2 id="split-editor-title">Split payment</h2>
              </div>
            </div>
            <span className="badge split-preview-badge"><FiGitBranch aria-hidden="true" /> {mainnet ? "MAINNET BETA" : "DEVNET"}</span>
          </div>

          <div className="split-form-grid">
            <label className="split-field">
              <span className="split-field-label"><FiDollarSign aria-hidden="true" /> Amount</span>
              <input aria-label="Payment amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </label>
            <label className="split-field">
              <span className="split-field-label"><FiLayers aria-hidden="true" /> Asset</span>
              <select aria-label="Payment asset" value={asset} onChange={(event) => setAsset(event.target.value as Asset)}>
                <option>USDC</option>
                <option>SOL</option>
              </select>
            </label>
          </div>

          <div className="split-recipients-header">
            <span><FiUsers aria-hidden="true" /> Recipients and wallets</span>
            <span><FiPercent aria-hidden="true" /> Allocation</span>
          </div>
          <div className="split-recipient-list">
            {rows.map((row, index) => (
              <div className={`split-recipient-row split-recipient-row-${index}`} key={index}>
                <span className="split-recipient-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <label className="split-row-field">
                  <span className="sr-only">Recipient {index + 1} label</span>
                  <input aria-label={`Recipient ${index + 1} label`} placeholder="e.g. Olivia Bennett" value={row.label} onChange={(event) => setRows(rows.map((current, currentIndex) => currentIndex === index ? { ...current, label: event.target.value } : current))} />
                </label>
                <label className="split-wallet-field">
                  <span className="sr-only">Recipient {index + 1} Solana wallet</span>
                  <input aria-label={`Recipient ${index + 1} Solana wallet`} autoComplete="off" placeholder="Solana wallet address" spellCheck="false" value={row.wallet} onChange={(event) => setRows(rows.map((current, currentIndex) => currentIndex === index ? { ...current, wallet: event.target.value } : current))} />
                </label>
                <label className="split-percent-field">
                  <span className="sr-only">Recipient {index + 1} percentage</span>
                  <input aria-label={`Recipient ${index + 1} percentage`} inputMode="decimal" value={row.bps} onChange={(event) => setRows(rows.map((current, currentIndex) => currentIndex === index ? { ...current, bps: event.target.value } : current))} />
                  <span>%</span>
                </label>
                <button className="split-remove-button" type="button" aria-label={`Remove recipient ${index + 1}`} disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, currentIndex) => currentIndex !== index))}>
                  <FiTrash2 aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>

          <button className="button outline split-add-button" type="button" disabled={rows.length >= 5} onClick={() => setRows([...rows, { label: "", wallet: "", bps: "0" }])}>
            <FiPlus aria-hidden="true" /> Add recipient <span>{rows.length}/5</span>
          </button>
          <div className="split-rules-note">
            <FiInfo aria-hidden="true" />
            <p><strong>Allocation rules</strong>Use 2–5 unique Solana wallets. Allocations must total 100%. Amounts use base units; any remainder is assigned deterministically to the first recipient.</p>
          </div>
        </section>

        <section className="panel split-preview-panel" aria-labelledby="allocation-preview-title">
          <div className="split-panel-header">
            <div className="split-panel-title">
              <span className="split-panel-icon split-panel-icon-preview"><FiBarChart2 aria-hidden="true" /></span>
              <div>
                <span className="split-kicker">LIVE CALCULATION</span>
                <h2 id="allocation-preview-title">Allocation preview</h2>
              </div>
            </div>
            <span className={`split-total-badge ${error ? "is-invalid" : ""}`}><FiCheckCircle aria-hidden="true" /> {totalLabel}</span>
          </div>

          {error ? (
            <div className="split-validation-state" role="status">
              <FiAlertCircle aria-hidden="true" />
              <div><strong>Allocation needs attention</strong><p>{error}</p></div>
            </div>
          ) : (
            <>
              <div className="split-total-summary">
                <div><span>Total payment</span><strong>{amount || "0"} <small>{asset}</small></strong></div>
                <span><FiCheckCircle aria-hidden="true" /> {recipients.length} destinations</span>
              </div>
              <div className="allocation-bar" role="img" aria-label={`Allocation split totaling ${totalLabel}`}>
                {recipients.map((recipient, index) => <span className={`split-segment split-segment-${index}`} key={recipient.wallet} style={{ width: `${recipient.bps / 100}%` }} />)}
              </div>
              <div className="split-allocation-list">
                {recipients.map((recipient, index) => (
                  <div className={`split-allocation-item split-allocation-item-${index}`} key={recipient.wallet}>
                    <span className="split-allocation-label"><i aria-hidden="true" /><span><strong>{recipient.label}</strong><small>{recipient.wallet.slice(0, 4)}…{recipient.wallet.slice(-4)} · {recipient.bps / 100}% allocation</small></span></span>
                    <strong>{displayUnits(values[index], ASSETS[asset].decimals)} {asset}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
          <button className="button wide split-review-button" type="button" disabled={Boolean(error)} onClick={() => setStep("review")}>Continue to wallet & review <FiArrowRight aria-hidden="true" /></button>
        </section>
      </div>
      ) : (
        <section className="panel split-review-panel" aria-labelledby="split-review-title">
          <div className="split-panel-header">
            <div className="split-panel-title">
              <span className="split-panel-icon split-panel-icon-preview"><FiCheckCircle aria-hidden="true" /></span>
              <div><span className="split-kicker">FINAL CHECK</span><h2 id="split-review-title">Review your split</h2></div>
            </div>
            <span className="badge split-preview-badge">{mainnet ? "MAINNET BETA" : "DEVNET"}</span>
          </div>
          <div className="split-review-summary"><span>Total</span><strong>{amount} {asset}</strong><span>{recipients.length} recipients</span></div>
          <div className="split-allocation-list split-review-list">
            {recipients.map((recipient, index) => <div className={`split-allocation-item split-allocation-item-${index}`} key={recipient.wallet}><span className="split-allocation-label"><i aria-hidden="true" /><span><strong>{recipient.label}</strong><small>{recipient.wallet}</small></span></span><strong>{displayUnits(values[index], ASSETS[asset].decimals)} {asset}</strong></div>)}
          </div>
          <div className="split-review-wallet"><div><strong>Connect payer wallet</strong><p>The payer signs once. The signed transaction must include every displayed destination and amount.</p></div><WalletButton session={wallet} onChange={setWallet} /></div>
          <div className="split-planned-note"><FiInfo aria-hidden="true" /><div><strong>Atomic {settlementLabel} settlement</strong><p>Your wallet first authorizes this payment intent, then signs one transaction containing every displayed destination. No funds move until that transaction is signed.</p></div></div>
          {settlement && (
            settlement.receipt ? <SplitReceipt receipt={settlement.receipt} /> : (
              <div className={`notice${settlement.relayMessage || settlement.error ? " error" : ""}`} role="status" aria-live="polite">
                <strong>{settlement.relayMessage || settlement.error ? "Split needs attention" : "Split transaction submitted"}</strong>
                <p className="break"><a className="text-link" href={explorer(settlement.signature, network)} target="_blank" rel="noreferrer">{settlement.signature}</a></p>
                <p>Finalization status: {settlement.status}</p>
                <div className="split-receipt-link">
                  <span>Receipt URL</span>
                  <a className="text-link" href={`/receipt/${settlement.paymentId}`}>{`${window.location.origin}/receipt/${settlement.paymentId}`}</a>
                  <button className="icon-button" type="button" aria-label="Copy receipt URL" onClick={async () => {
                    await navigator.clipboard.writeText(`${window.location.origin}/receipt/${settlement.paymentId}`);
                    toast.success("Receipt URL copied.");
                  }}><FiCopy aria-hidden="true" /></button>
                </div>
                <p>The receipt is public after finalization. AUNO checks it automatically while this page is open.</p>
                {settlement.relayMessage && <p>{settlement.relayMessage}</p>}
                {settlement.error && <p>{settlement.error}</p>}
                <button className="button small" type="button" disabled={settling} onClick={() => verifySplit()}>Check finalization</button>
              </div>
            )
          )}
          <div className="split-review-actions"><button className="button outline" type="button" disabled={settling} onClick={() => setStep("configure")}>Back to edit</button><button className="button" type="button" disabled={settling || Boolean(error) || !wallet} onClick={() => payAndSplit(Date.now())}>{settling ? "Preparing split…" : <>Pay & Split <FiArrowRight aria-hidden="true" /></>}</button></div>
        </section>
      )}
    </AppShell>
  );
}

export function PublicSplitReceipt({ id }: { id: string }) {
  const [receipt, setReceipt] = useState<PaymentIntent | null>(null);
  const [message, setMessage] = useState("Loading finalized receipt…");

  useEffect(() => {
    let active = true;
    async function loadReceipt() {
      try {
        const next = await api<PaymentIntent>(`/api/public/payments/${id}/receipt`);
        if (active) {
          setReceipt(next);
          setMessage("");
        }
      } catch (nextError) {
        if (active) setMessage(errorText(nextError));
      }
    }
    void loadReceipt();
    const timer = window.setInterval(() => void loadReceipt(), 10_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [id]);

  return (
    <AppShell title="Verified split receipt" subtitle={`Public, finalized ${receipt?.network === "mainnet-beta" ? "Mainnet Beta" : "Devnet"} settlement details.`}>
      {receipt ? <SplitReceipt receipt={receipt} /> : (
        <section className="notice" role="status" aria-live="polite">
          <strong>Receipt not available yet</strong>
          <p>{message || "The split transaction is still being finalized. This page refreshes automatically."}</p>
        </section>
      )}
    </AppShell>
  );
}