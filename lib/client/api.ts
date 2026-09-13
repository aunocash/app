import type { Asset, CreatePaymentInput, PaymentStatus } from "@/lib/contracts/payments";
import type { PaymentSummary, PublicPaymentView } from "@/lib/contracts/payment-views";
import { parseApiEnvelope, type ApiFailure, type ApiSuccess } from "./api-response";
export { ApiClientError } from "./api-response";

export type Merchant = { id: string; walletAddress: string };

export type MerchantPaymentView = PublicPaymentView & {
  merchantWallet: string;
  reference: string | null;
  cancelledAt: string | null;
};

export type PaymentList = { items: MerchantPaymentView[]; nextCursor: string | null };
export type PreparedTransaction = {
  transactionId: string;
  abandonToken: string;
  serializedTransaction: string;
  reference: string;
  network: "devnet";
  recentBlockhash: string;
  lastValidBlockHeight: string;
};

export type Receipt = {
  id: string;
  paymentId: string;
  transactionId: string;
  signature: string;
  payerWallet: string;
  network: string;
  slot: string;
  finalizedAt: string;
  explorerUrl: string;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const body = (await response.json()) as ApiSuccess<T> | ApiFailure;
  return parseApiEnvelope(response.status, body, response.headers.get("x-request-id"));
}
export const api = {
  session: () => request<{ merchant: Merchant | null }>("/api/v1/auth/session"),
  revokeSession: () => request<{ revoked: true }>("/api/v1/auth/session", { method: "DELETE" }),
  createChallenge: (walletAddress: string) =>
    request<{ id: string; input: Record<string, string>; message: string; expiresAt: string }>(
      "/api/v1/auth/challenges",
      { method: "POST", body: JSON.stringify({ walletAddress }) },
    ),
  createSession: (input: {
    challengeId: string;
    accountAddress: string;
    publicKey: string;
    signedMessage: string;
    signature: string;
  }) => request<{ merchant: Merchant; expiresAt: string }>("/api/v1/auth/sessions", { method: "POST", body: JSON.stringify(input) }),
  createPayment: (input: CreatePaymentInput, idempotencyKey: string) =>
    request<MerchantPaymentView>("/api/v1/payments", {
      method: "POST",
      headers: { "idempotency-key": idempotencyKey },
      body: JSON.stringify(input),
    }),
  payments: (filters: { cursor?: string; status?: PaymentStatus; asset?: Asset; search?: string; limit?: number } = {}) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) search.set(key, String(value));
    return request<PaymentList>(`/api/v1/payments${search.size ? `?${search}` : ""}`);
  },
  payment: (id: string) => request<MerchantPaymentView>(`/api/v1/payments/${id}`),
  summary: () => request<PaymentSummary>("/api/v1/payments/summary"),
  cancelPayment: (id: string) => request<MerchantPaymentView>(`/api/v1/payments/${id}/cancel`, { method: "POST" }),
  publicPayment: (id: string) => request<PublicPaymentView>(`/api/v1/public/payments/${id}`),
  createDemoPayment: () => request<PublicPaymentView>("/api/v1/public/demo-payments", { method: "POST" }),
  prepareTransaction: (id: string, payerWallet: string, idempotencyKey: string) =>
    request<PreparedTransaction>(`/api/v1/payments/${id}/transactions`, {
      method: "POST",
      headers: { "idempotency-key": idempotencyKey },
      body: JSON.stringify({ payerWallet }),
    }),
  submitTransaction: (id: string, transactionId: string, signature: string) =>
    request<{ transactionId: string; signature: string; status: "SUBMITTED" }>(
      `/api/v1/payments/${id}/submissions`,
      { method: "POST", body: JSON.stringify({ transactionId, signature }) },
    ),
  abandonTransaction: (id: string, transactionId: string, abandonToken: string) =>
    request<{ transactionId: string; status: "FAILED" }>(
      `/api/v1/payments/${id}/transactions/${transactionId}`,
      { method: "DELETE", body: JSON.stringify({ abandonToken }) },
    ),
  receipt: (id: string) => request<Receipt>(`/api/v1/payments/${id}/receipt`),
};
