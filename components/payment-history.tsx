"use client";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { ArrowUpRight, Inbox } from "lucide-react";
import {
  STORAGE_KEY,
  type PaymentRecord,
  validatePayment,
} from "@/lib/payments";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("auno-payments", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("auno-payments", callback);
  };
}
function snapshot() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "storage-unavailable";
  }
}
function serverSnapshot() {
  return "loading";
}
export function PaymentHistory({ overview = false }: { overview?: boolean }) {
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [query, setQuery] = useState("");
  const { records, error } = useMemo(() => {
    if (raw === "loading")
      return { records: [] as PaymentRecord[], error: false };
    try {
      const value: unknown = JSON.parse(raw);
      if (!Array.isArray(value)) throw Error();
      return {
        records: value.filter(
          (p): p is PaymentRecord =>
            !!p &&
            typeof p === "object" &&
            !validatePayment(p) &&
            typeof p.id === "string" &&
            typeof p.createdAt === "string" &&
            !Number.isNaN(Date.parse(p.createdAt)) &&
            (p.status === "Draft" || p.status === "Demo completed"),
        ),
        error: false,
      };
    } catch {
      return { records: [] as PaymentRecord[], error: true };
    }
  }, [raw]);
  const filtered = records.filter((p) =>
    `${p.title} ${p.asset} ${p.status}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  if (raw === "loading")
    return <p role="status">Loading your local payment requests…</p>;
  if (error)
    return (
      <p role="alert" className="error-message">
        Payment history could not be read. Enable browser storage or restore
        valid local data. No stored records were changed.
      </p>
    );
  return (
    <>
      {overview && (
        <div className="stat-grid">
          <div className="stat">
            <span>Payment requests</span>
            <strong>{records.length}</strong>
          </div>
          <div className="stat">
            <span>Demo completed</span>
            <strong>
              {records.filter((p) => p.status === "Demo completed").length}
            </strong>
          </div>
          <div className="stat">
            <span>Live transactions</span>
            <strong>0</strong>
          </div>
        </div>
      )}
      <div className="table-toolbar">
        <h2>{overview ? "Your latest requests" : "Payment history"}</h2>
        <input
          className="search-input"
          aria-label="Search payments"
          placeholder="Search title, asset, or status…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {filtered.length ? (
        <div className="payment-table-wrap">
          <table className="payment-table">
            <thead>
              <tr>
                <th>Payment</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Checkout</th>
              </tr>
            </thead>
            <tbody>
              {(overview ? filtered.slice(0, 5) : filtered).map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.title}
                    <small>
                      {new Date(p.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {p.splits.length > 0 ? " · Split payment" : ""}
                    </small>
                  </td>
                  <td>
                    {p.amount} {p.asset}
                  </td>
                  <td>
                    <span className="soft-label">{p.status}</span>
                  </td>
                  <td>
                    <Link
                      className="inline-link"
                      href={`/pay/${p.id}`}
                      aria-label={`Open ${p.title} checkout`}
                    >
                      Open <ArrowUpRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <Inbox size={30} />
          <h3>
            {query
              ? "No matching payments."
              : "Your first payment starts here."}
          </h3>
          <p>
            {query
              ? "Try a different title, asset, or status."
              : "Create a request and explore the payment flow. Your history stays in this browser."}
          </p>
          {!query && (
            <Link className="button primary" href="/dashboard/create">
              Create a Payment <ArrowUpRight size={15} />
            </Link>
          )}
        </div>
      )}
      <p className="fine-print">
        Local demo history · Up to 100 requests · No blockchain transactions or
        verified receipts.
      </p>
    </>
  );
}
