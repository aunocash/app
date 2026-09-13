import type { Asset } from "@/lib/contracts/payments";
import { formatBaseUnits } from "./payment-ui.ts";

const DECIMALS: Record<Asset, number> = { SOL: 9, USDC: 6 };

function parseDisplayAmount(value: string, decimals: number): bigint {
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error("Amount is invalid.");
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals) throw new Error("Amount has too many decimal places.");
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0"));
}

export function previewRecipientAllocations(
  amount: string,
  asset: Asset,
  allocations: number[],
): string[] {
  if (!allocations.length || allocations.reduce((total, value) => total + value, 0) !== 10_000) {
    throw new Error("Recipient allocations must total 10,000 BPS.");
  }
  const amountBaseUnits = parseDisplayAmount(amount, DECIMALS[asset]);
  const preliminary = allocations.map((allocation, index) => {
    const numerator = amountBaseUnits * BigInt(allocation);
    return { index, amount: numerator / 10_000n, remainder: numerator % 10_000n };
  });
  let remaining = amountBaseUnits - preliminary.reduce((total, value) => total + value.amount, 0n);
  preliminary.sort((left, right) => {
    if (left.remainder === right.remainder) return left.index - right.index;
    return left.remainder > right.remainder ? -1 : 1;
  });
  for (const item of preliminary) {
    if (!remaining) break;
    item.amount += 1n;
    remaining -= 1n;
  }
  return preliminary
    .sort((left, right) => left.index - right.index)
    .map((item) => formatBaseUnits(item.amount.toString(), asset));
}
