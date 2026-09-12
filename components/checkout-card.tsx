"use client";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Download,
  Info,
  LoaderCircle,
  Wallet,
} from "lucide-react";
import {
  type Payment,
  type Asset,
  readRecords,
  saveRecord,
} from "@/lib/payments";
import { Logo, SolanaMark, UsdcMark } from "./site-shell";
const stages = [
  "Awaiting signature",
  "Submitted",
  "Confirming",
  "Demo payment completed",
];
export function CheckoutCard({
  payment,
  sample = false,
  id,
}: {
  payment: Payment;
  sample?: boolean;
  id: string;
}) {
  const [asset, setAsset] = useState<Asset>(payment.asset);
  const [connected, setConnected] = useState(false);
  const [stage, setStage] = useState(-1);
  const [storageError, setStorageError] = useState("");
  const amount = sample && asset === "SOL" ? "1" : payment.amount;
  useEffect(() => {
    if (stage < 0 || stage > 2) return;
    const timer = window.setTimeout(() => setStage(stage + 1), 1200);
    return () => window.clearTimeout(timer);
  }, [stage]);
  useEffect(() => {
    if (stage !== 3 || sample) return;
    try {
      const record = readRecords().find((p) => p.id === id);
      if (record) saveRecord({ ...record, status: "Demo completed" });
    } catch {
      queueMicrotask(() =>
        setStorageError(
          "The demo finished, but this browser could not update its local history.",
        ),
      );
    }
  }, [stage, id, sample]);
  function downloadReceipt() {
    const receipt = {
      type: "AUNO DEMO RECEIPT — NOT A BLOCKCHAIN RECEIPT",
      title: payment.title,
      amount,
      asset,
      recipient: payment.recipient,
      splits: payment.splits,
      status: "Simulation completed",
      blockchainConfirmed: false,
      fundsMoved: false,
      transactionSignature: null,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(receipt, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "auno-demo-receipt.json";
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="checkout-page">
      <div className="notice">
        <Info size={16} />
        <span>
          Demo checkout. No wallet is connected and no funds are moved. All
          transaction states below are simulated.
        </span>
      </div>
      <section className="checkout-full">
        <Logo />
        <div className="eyebrow">
          AUNO CHECKOUT <span className="soft-label">DEMO</span>
        </div>
        <h1>{payment.title}</h1>
        <div className="payment-amount">
          {amount} <small>{asset}</small>
        </div>
        <div className="checkout-recipient">
          <span>
            {payment.splits.length ? "Merchant recipient" : "Recipient wallet"}
          </span>
          {payment.recipient}
        </div>
        {payment.splits.length > 0 && (
          <div className="receipt">
            <h2>Payment destinations</h2>
            {payment.splits.map((s, i) => (
              <div className="checkout-recipient" key={s.recipient}>
                <span>
                  {["Merchant", "Affiliate", "Treasury"][i]} · {s.percent}%
                </span>
                {s.recipient}
              </div>
            ))}
          </div>
        )}
        {sample && (
          <>
            <div className="asset-tabs" aria-label="Demo asset">
              {(["USDC", "SOL"] as const).map((a) => (
                <button
                  key={a}
                  aria-pressed={asset === a}
                  disabled={stage >= 0}
                  onClick={() => setAsset(a)}
                >
                  {a === "SOL" ? <SolanaMark /> : <UsdcMark />}
                  {a}
                </button>
              ))}
            </div>
            <p
              className="fine-print"
              style={{ marginTop: 0, marginBottom: 20 }}
            >
              Sample requests: 100 USDC or 1 SOL. These are independent demo
              amounts, not an exchange rate.
            </p>
          </>
        )}
        {stage === -1 ? (
          <button
            className="button primary full-width"
            style={{ marginTop: 20 }}
            onClick={() => (connected ? setStage(0) : setConnected(true))}
          >
            <Wallet size={16} />
            {connected
              ? `Simulate payment of ${amount} ${asset}`
              : "Connect demo wallet"}
            <ArrowUpRight size={15} />
          </button>
        ) : (
          <ol
            className="status-list"
            aria-live="polite"
            aria-label="Simulated payment progress"
          >
            {stages.map((label, i) => (
              <li
                key={label}
                className={
                  stage > i || stage === 3
                    ? "done"
                    : stage === i
                      ? "current"
                      : ""
                }
              >
                {stage > i || stage === 3 ? (
                  <CheckCircle2 />
                ) : stage === i ? (
                  <LoaderCircle className="spinner" />
                ) : (
                  <Circle />
                )}
                {label}
                {i < 3 && <span className="soft-label">SIMULATED</span>}
              </li>
            ))}
          </ol>
        )}
        {connected && stage === -1 && (
          <p className="fine-print" role="status">
            Demo wallet ready. No real wallet authorization was requested.
          </p>
        )}
        {stage === 3 && (
          <div className="receipt">
            <h2>Flow complete.</h2>
            <p>
              This was a simulation. There is no transaction signature, on-chain
              confirmation, or transfer of funds.
            </p>
            <button className="button primary" onClick={downloadReceipt}>
              <Download size={15} />
              Download demo receipt
            </button>
            <button
              className="button text-button"
              onClick={() => {
                setStage(-1);
                setConnected(false);
              }}
            >
              Try again
            </button>
          </div>
        )}
        {storageError && (
          <p className="error-message" role="alert">
            {storageError}
          </p>
        )}
        <p className="fine-print">
          Always review the amount, asset, and every recipient. Demo links are
          editable data and are not signed payment instructions.
        </p>
      </section>
    </div>
  );
}
