const POSTGRES_INT8_MAX = 9_223_372_036_854_775_807n;
const BASIS_POINTS_TOTAL = 10_000n;

export function parseDisplayAmount(value: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error("Unsupported asset precision.");
  }

  const match = new RegExp(`^(0|[1-9]\\d*)(?:\\.(\\d{1,${decimals}}))?$`).exec(value);
  if (!match) throw new Error("Invalid display amount.");

  const fraction = (match[2] ?? "").padEnd(decimals, "0");
  const baseUnits = BigInt(match[1]) * 10n ** BigInt(decimals) + BigInt(fraction || "0");

  if (baseUnits <= 0n) throw new Error("Amount must be positive.");
  if (baseUnits > POSTGRES_INT8_MAX) throw new Error("Amount exceeds storage limits.");
  return baseUnits;
}

export function allocateByBasisPoints(total: bigint, allocations: number[]): bigint[] {
  if (total <= 0n) throw new Error("Amount must be positive.");
  if (allocations.length !== 1 && (allocations.length < 2 || allocations.length > 5)) {
    throw new Error("Payments require one to five recipients.");
  }
  if (allocations.some((value) => !Number.isInteger(value) || value <= 0)) {
    throw new Error("Allocations must be positive integers.");
  }
  if (allocations.reduce((sum, value) => sum + value, 0) !== Number(BASIS_POINTS_TOTAL)) {
    throw new Error("Allocations must total 10,000 BPS.");
  }

  const shares = allocations.map((allocation, index) => {
    const numerator = total * BigInt(allocation);
    return {
      index,
      amount: numerator / BASIS_POINTS_TOTAL,
      remainder: numerator % BASIS_POINTS_TOTAL,
    };
  });

  let remaining = total - shares.reduce((sum, share) => sum + share.amount, 0n);
  const byRemainder = [...shares].sort(
    (left, right) =>
      Number(right.remainder - left.remainder) || left.index - right.index,
  );
  for (const share of byRemainder) {
    if (remaining === 0n) break;
    shares[share.index].amount += 1n;
    remaining -= 1n;
  }

  return shares.map((share) => share.amount);
}
