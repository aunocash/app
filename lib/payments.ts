export type Asset = "USDC" | "SOL";
export type Split = { recipient: string; percent: number };
export type Payment = {
  title: string;
  amount: string;
  asset: Asset;
  recipient: string;
  splits: Split[];
};
export type PaymentRecord = Payment & {
  id: string;
  createdAt: string;
  status: "Draft" | "Demo completed";
};
export const STORAGE_KEY = "auno.preview.payments.v1";
export const DEMO_PAYMENT: Payment = {
  title: "Website Development",
  amount: "100",
  asset: "USDC",
  recipient: "Demo recipient · 8Ks...91Q",
  splits: [],
};
export function validAddress(value: string): boolean {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return false;
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let number = BigInt(0);
  for (const char of value)
    number = number * BigInt(58) + BigInt(alphabet.indexOf(char));
  let bytes = 0;
  while (number > BigInt(0)) {
    bytes++;
    number >>= BigInt(8);
  }
  return bytes + (value.match(/^1*/)?.[0].length ?? 0) === 32;
}
export function validatePayment(value: unknown): string | null {
  if (!value || typeof value !== "object") return "Invalid payment request.";
  const p = value as Partial<Payment>;
  if (typeof p.title !== "string" || !p.title.trim() || p.title.length > 80)
    return "Enter a title between 1 and 80 characters.";
  if (p.asset !== "SOL" && p.asset !== "USDC") return "Choose SOL or USDC.";
  const decimals = p.asset === "USDC" ? 6 : 9;
  if (
    typeof p.amount !== "string" ||
    !new RegExp(`^\\d{1,9}(\\.\\d{1,${decimals}})?$`).test(p.amount) ||
    Number(p.amount) <= 0
  )
    return `Enter a positive amount with up to ${decimals} decimal places (up to 9 integer digits).`;
  if (typeof p.recipient !== "string" || !validAddress(p.recipient))
    return "Enter a valid 32-byte Solana recipient address.";
  if (
    !Array.isArray(p.splits) ||
    (p.splits.length !== 0 && p.splits.length !== 3)
  )
    return "A split must contain three destinations.";
  if (p.splits.length) {
    if (
      p.splits.some(
        (s) =>
          !s ||
          typeof s.recipient !== "string" ||
          !validAddress(s.recipient) ||
          !Number.isInteger(s.percent) ||
          s.percent <= 0 ||
          s.percent > 100,
      )
    )
      return "Each destination needs a valid address and a whole percentage from 1 to 100.";
    if (p.splits.reduce((sum, s) => sum + s.percent, 0) !== 100)
      return "Split percentages must add up to 100%.";
    if (new Set(p.splits.map((s) => s.recipient)).size !== 3)
      return "Use a different address for each split destination.";
    if (p.splits[0].recipient !== p.recipient)
      return "The merchant destination must match the recipient.";
  }
  return null;
}
export function encodePayment(payment: Payment): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payment));
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
export function decodePayment(id: string): Payment | null {
  if (id.length > 2400 || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
  try {
    const bytes = Uint8Array.from(
      atob(id.replaceAll("-", "+").replaceAll("_", "/")),
      (char) => char.charCodeAt(0),
    );
    const value: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    return validatePayment(value) ? null : (value as Payment);
  } catch {
    return null;
  }
}
export function readRecords(): PaymentRecord[] {
  const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  if (!Array.isArray(raw)) throw new Error("Invalid local payment history.");
  return raw.filter(
    (p): p is PaymentRecord =>
      !!p &&
      typeof p === "object" &&
      !validatePayment(p) &&
      typeof p.id === "string" &&
      typeof p.createdAt === "string" &&
      !Number.isNaN(Date.parse(p.createdAt)) &&
      (p.status === "Draft" || p.status === "Demo completed"),
  );
}
export function saveRecord(record: PaymentRecord) {
  const records = readRecords();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      [record, ...records.filter((p) => p.id !== record.id)].slice(0, 100),
    ),
  );
  window.dispatchEvent(new Event("auno-payments"));
}
