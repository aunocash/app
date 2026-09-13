import { address } from "@solana/kit";
import { z } from "zod";

import { ASSETS, type Asset, type CreatePaymentInput } from "../../contracts/payments.ts";
import { allocateByBasisPoints, parseDisplayAmount } from "./domain.ts";

const recipientSchema = z.object({
  address: z.string().min(32).max(44),
  allocationBps: z.number().int().min(1).max(10_000),
}).strict();

export const createPaymentSchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(500).optional(),
  asset: z.enum(ASSETS),
  amount: z.string().min(1).max(40),
  recipients: z.array(recipientSchema).min(1).max(5),
  expiresAt: z.iso.datetime({ offset: true }).optional(),
  reference: z.string().trim().min(1).max(120).optional(),
}).strict();

export type NormalizedPaymentRecipient = {
  address: string;
  allocationBps: number;
  amountBaseUnits: bigint;
};

export type NormalizedCreatePayment = {
  title: string;
  description: string | null;
  asset: Asset;
  amount: string;
  amountBaseUnits: bigint;
  recipients: NormalizedPaymentRecipient[];
  expiresAt: Date | null;
  reference: string | null;
};

const ASSET_DECIMALS: Record<Asset, number> = { SOL: 9, USDC: 6 };

export function normalizeCreatePayment(input: CreatePaymentInput, now = new Date()): NormalizedCreatePayment {
  const parsed = createPaymentSchema.parse(input);
  const addresses = parsed.recipients.map((recipient) => {
    try {
      return address(recipient.address);
    } catch {
      throw new Error("Invalid Solana recipient address.");
    }
  });

  if (new Set(addresses).size !== addresses.length) {
    throw new Error("Recipient addresses must be unique.");
  }

  const amountBaseUnits = parseDisplayAmount(parsed.amount, ASSET_DECIMALS[parsed.asset]);
  const amounts = allocateByBasisPoints(
    amountBaseUnits,
    parsed.recipients.map((recipient) => recipient.allocationBps),
  );
  if (amounts.some((amount) => amount === 0n)) {
    throw new Error("Every recipient must receive at least one base unit.");
  }

  const expiresAt = parsed.expiresAt ? new Date(parsed.expiresAt) : null;
  if (expiresAt && expiresAt <= now) throw new Error("Expiration must be in the future.");

  return {
    title: parsed.title,
    description: parsed.description ?? null,
    asset: parsed.asset,
    amount: parsed.amount,
    amountBaseUnits,
    recipients: parsed.recipients.map((recipient, index) => ({
      address: addresses[index],
      allocationBps: recipient.allocationBps,
      amountBaseUnits: amounts[index],
    })),
    expiresAt,
    reference: parsed.reference ?? null,
  };
}
