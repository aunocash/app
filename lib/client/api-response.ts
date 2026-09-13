export type ApiFailure = { error: { code: string; message: string; fields?: Record<string, string[]> }; requestId: string };
export type ApiSuccess<T> = { data: T; requestId: string };

const SAFE_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "Sign in with your merchant wallet to continue.",
  PAYMENT_NOT_FOUND: "This payment is unavailable.",
  PAYMENT_EXPIRED: "This payment has expired.",
  PAYMENT_STATE_CONFLICT: "This payment is no longer available for that action.",
  TRANSACTION_STATE_CONFLICT: "This transaction attempt can no longer be changed.",
  SIGNATURE_ALREADY_USED: "This transaction signature has already been submitted.",
  RATE_LIMITED: "Too many requests. Please try again shortly.",
  DEMO_UNAVAILABLE: "The live devnet sample is temporarily unavailable.",
};

export class ApiClientError extends Error {
  readonly code: string;
  readonly requestId: string;
  readonly fields?: Record<string, string[]>;

  constructor(code: string, requestId: string, message: string, fields?: Record<string, string[]>) {
    super(message);
    this.code = code;
    this.requestId = requestId;
    this.fields = fields;
  }
}

export function parseApiEnvelope<T>(
  status: number,
  body: ApiSuccess<T> | ApiFailure,
  headerRequestId: string | null,
): T {
  if (status >= 200 && status < 300 && "data" in body) return body.data;
  const failure = "error" in body ? body.error : { code: "REQUEST_FAILED", message: "Request failed." };
  const requestId = "requestId" in body ? body.requestId : headerRequestId ?? "unknown";
  throw new ApiClientError(failure.code, requestId, SAFE_MESSAGES[failure.code] ?? "Request failed. Include the request ID when contacting support.", failure.fields);
}
