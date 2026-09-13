"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { api, ApiClientError } from "@/lib/client/api";

export function LiveDemoButton({ className, children, ariaLabel }: { className?: string; children: ReactNode; ariaLabel?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  return <span className="live-demo-button-wrap"><button className={className} type="button" aria-label={ariaLabel} disabled={loading} onClick={async () => { setLoading(true); setError(null); try { const payment = await api.createDemoPayment(); router.push(`/pay/${payment.id}`); } catch (caught) { setError(caught instanceof ApiClientError ? caught.message : "The live devnet sample is unavailable."); setLoading(false); } }}>{loading ? "Creating devnet payment…" : children}</button>{error && <span className="error-message" role="alert">{error}</span>}</span>;
}
