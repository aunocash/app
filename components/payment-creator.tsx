"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowUpRight, Check, Copy, Link2 } from "lucide-react";
import {
  type Payment,
  type Asset,
  validatePayment,
  encodePayment,
  saveRecord,
} from "@/lib/payments";
export function PaymentCreator({
  initialSplit = false,
}: {
  initialSplit?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState<Asset>("USDC");
  const [recipient, setRecipient] = useState("");
  const [split, setSplit] = useState(initialSplit);
  const [affiliate, setAffiliate] = useState("");
  const [treasury, setTreasury] = useState("");
  const [percentages, setPercentages] = useState([80, 15, 5]);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const payment: Payment = {
      title: title.trim(),
      amount: amount.trim(),
      asset,
      recipient: recipient.trim(),
      splits: split
        ? [recipient, affiliate, treasury].map((address, i) => ({
            recipient: address.trim(),
            percent: percentages[i],
          }))
        : [],
    };
    const validation = validatePayment(payment);
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    try {
      const id = encodePayment(payment);
      saveRecord({
        ...payment,
        id,
        createdAt: new Date().toISOString(),
        status: "Draft",
      });
      setUrl(`${window.location.origin}/pay/${id}`);
    } catch {
      setError(
        "We couldn’t save this request. Allow browser storage and try again. Existing history has not been replaced.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("Clipboard unavailable. Select the link and copy it manually.");
    }
  }
  if (url)
    return (
      <section className="success-panel">
        <span className="success-icon">
          <Check size={22} />
        </span>
        <h2>Your payment link is ready.</h2>
        <p>
          Share this demo request anywhere. The link contains the payment
          details and can open in another browser.
        </p>
        <div className="copy-box">
          <input
            aria-label="Created payment link"
            value={url}
            readOnly
            onFocus={(e) => e.target.select()}
          />
          <button onClick={copy} aria-label="Copy payment link">
            {copied ? <Check size={17} /> : <Copy size={17} />}
          </button>
        </div>
        <p aria-live="polite">
          {copied
            ? "Link copied to clipboard."
            : "Demo only. The recipient address is included in this public link."}
        </p>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <div className="button-row" style={{ marginTop: 25 }}>
          <Link className="button primary" href={url}>
            Open checkout <ArrowUpRight size={16} />
          </Link>
          <button
            className="button text-button"
            onClick={() => {
              setUrl("");
              setCopied(false);
              setError("");
            }}
          >
            Create another
          </button>
        </div>
      </section>
    );
  return (
    <form className="form-panel" onSubmit={submit}>
      <h2>Create a payment</h2>
      <label className="field">
        <span>Payment title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          placeholder="Website Development"
          required
          autoComplete="off"
        />
      </label>
      <div className="field-grid">
        <label className="field">
          <span>Amount</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="100.00"
            inputMode="decimal"
            required
          />
          <small>
            {asset === "USDC"
              ? "Up to 6 decimal places"
              : "Up to 9 decimal places"}
          </small>
        </label>
        <label className="field">
          <span>Asset</span>
          <select
            value={asset}
            onChange={(e) => setAsset(e.target.value as Asset)}
          >
            <option>USDC</option>
            <option>SOL</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>Recipient wallet</span>
        <input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="Enter a Solana wallet address"
          required
          maxLength={44}
          spellCheck={false}
          autoComplete="off"
        />
        <small>Use a public wallet address. Never enter a private key.</small>
      </label>
      <label className="form-toggle">
        <input
          type="checkbox"
          checked={split}
          onChange={(e) => setSplit(e.target.checked)}
        />
        Split this payment <span className="soft-label">Preview</span>
      </label>
      {split && (
        <div className="split-fields">
          <h3>
            Route your payment · Total {percentages.reduce((a, b) => a + b, 0)}%
          </h3>
          {["Merchant", "Affiliate", "Treasury"].map((name, i) => (
            <div className="field-grid" key={name}>
              <label className="field">
                <span>{name} wallet</span>
                <input
                  aria-label={`${name} wallet`}
                  value={i === 0 ? recipient : i === 1 ? affiliate : treasury}
                  onChange={(e) =>
                    i === 0
                      ? setRecipient(e.target.value)
                      : i === 1
                        ? setAffiliate(e.target.value)
                        : setTreasury(e.target.value)
                  }
                  placeholder="Solana address"
                  maxLength={44}
                  required
                />
              </label>
              <label className="field">
                <span>Share %</span>
                <input
                  aria-label={`${name} percentage`}
                  type="number"
                  value={percentages[i]}
                  onChange={(e) =>
                    setPercentages(
                      percentages.map((p, j) =>
                        j === i ? Number(e.target.value) : p,
                      ),
                    )
                  }
                  min={1}
                  max={100}
                  step={1}
                  required
                />
              </label>
            </div>
          ))}
        </div>
      )}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <button
        className="button primary full-width"
        type="submit"
        disabled={saving}
      >
        <Link2 size={16} />
        {saving ? "Creating…" : "Create Payment Link"}
        <ArrowUpRight size={16} />
      </button>
      <p className="fine-print">
        Saved in this browser. Demo requests do not move funds.
      </p>
    </form>
  );
}
