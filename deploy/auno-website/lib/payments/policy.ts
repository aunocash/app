type RuntimePolicySource = Record<string, unknown>;

type Limits = {
  maxBodyBytes: number;
  maxTitleLength: number;
  maxDescriptionLength: number;
  maxReferenceLength: number;
  minExpiryMs: number;
  maxExpiryMs: number;
  creationPerHour: number;
  attemptsPerPaymentWindow: number;
  attemptsPerPayerWindow: number;
  attemptsPerSourceWindow: number;
  attemptWindowMs: number;
};

const defaults: Limits = {
  maxBodyBytes: 20_000,
  maxTitleLength: 120,
  maxDescriptionLength: 1_000,
  maxReferenceLength: 120,
  minExpiryMs: 60_000,
  maxExpiryMs: 30 * 24 * 60 * 60 * 1_000,
  creationPerHour: 50,
  attemptsPerPaymentWindow: 20,
  attemptsPerPayerWindow: 30,
  attemptsPerSourceWindow: 60,
  attemptWindowMs: 60 * 60 * 1_000,
};

function positiveInteger(value: unknown, fallback: number, name: string) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`Invalid ${name} deployment setting.`);
  return parsed;
}

export function paymentPolicy(source: RuntimePolicySource): Limits {
  const policy = {
    maxBodyBytes: positiveInteger(source.AUNO_MAX_BODY_BYTES, defaults.maxBodyBytes, "AUNO_MAX_BODY_BYTES"),
    maxTitleLength: positiveInteger(source.AUNO_MAX_TITLE_LENGTH, defaults.maxTitleLength, "AUNO_MAX_TITLE_LENGTH"),
    maxDescriptionLength: positiveInteger(source.AUNO_MAX_DESCRIPTION_LENGTH, defaults.maxDescriptionLength, "AUNO_MAX_DESCRIPTION_LENGTH"),
    maxReferenceLength: positiveInteger(source.AUNO_MAX_REFERENCE_LENGTH, defaults.maxReferenceLength, "AUNO_MAX_REFERENCE_LENGTH"),
    minExpiryMs: positiveInteger(source.AUNO_MIN_EXPIRY_MS, defaults.minExpiryMs, "AUNO_MIN_EXPIRY_MS"),
    maxExpiryMs: positiveInteger(source.AUNO_MAX_EXPIRY_MS, defaults.maxExpiryMs, "AUNO_MAX_EXPIRY_MS"),
    creationPerHour: positiveInteger(source.AUNO_CREATION_LIMIT_PER_HOUR, defaults.creationPerHour, "AUNO_CREATION_LIMIT_PER_HOUR"),
    attemptsPerPaymentWindow: positiveInteger(source.AUNO_ATTEMPT_LIMIT_PER_PAYMENT, defaults.attemptsPerPaymentWindow, "AUNO_ATTEMPT_LIMIT_PER_PAYMENT"),
    attemptsPerPayerWindow: positiveInteger(source.AUNO_ATTEMPT_LIMIT_PER_PAYER, defaults.attemptsPerPayerWindow, "AUNO_ATTEMPT_LIMIT_PER_PAYER"),
    attemptsPerSourceWindow: positiveInteger(source.AUNO_ATTEMPT_LIMIT_PER_SOURCE, defaults.attemptsPerSourceWindow, "AUNO_ATTEMPT_LIMIT_PER_SOURCE"),
    attemptWindowMs: positiveInteger(source.AUNO_ATTEMPT_WINDOW_MS, defaults.attemptWindowMs, "AUNO_ATTEMPT_WINDOW_MS"),
  };
  if (policy.minExpiryMs > policy.maxExpiryMs) throw new Error("Payment expiry deployment settings are inconsistent.");
  return policy;
}
