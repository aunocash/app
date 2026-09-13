import {
  identifySystemInstruction,
  parseTransferSolInstruction,
  SYSTEM_PROGRAM_ADDRESS,
  SystemInstruction,
} from "@solana-program/system";
import {
  findAssociatedTokenPda,
  identifyTokenInstruction,
  parseTransferCheckedInstruction,
  TOKEN_PROGRAM_ADDRESS,
  TokenInstruction,
} from "@solana-program/token";
import { AccountRole, address, type AccountMeta, type Instruction } from "@solana/kit";
import bs58 from "bs58";

export type ExpectedTransfer = { recipient: string; amountBaseUnits: string };

type RawInstruction = { accounts: readonly number[]; data: string; programIdIndex: number };
export type FinalizedTransactionObservation = {
  slot: bigint;
  meta: { err: unknown | null } | null;
  transaction: {
    signatures: readonly string[];
    message: {
      accountKeys: readonly string[];
      header: { numRequiredSignatures: number };
      recentBlockhash: string;
      instructions: readonly RawInstruction[];
    };
  };
};

type DecodedInstruction = Instruction & {
  accounts: readonly AccountMeta[];
  data: Uint8Array;
};

function toInstruction(raw: RawInstruction, accountKeys: readonly string[]): DecodedInstruction {
  const programAddress = accountKeys[raw.programIdIndex];
  if (!programAddress) throw new Error("Instruction program account is missing.");
  return {
    programAddress: address(programAddress),
    accounts: raw.accounts.map((index) => {
      const accountAddress = accountKeys[index];
      if (!accountAddress) throw new Error("Instruction account is missing.");
      return { address: address(accountAddress), role: AccountRole.READONLY };
    }),
    data: bs58.decode(raw.data),
  };
}

function multiset(values: Array<{ recipient: string; amountBaseUnits: string }>): string[] {
  return values
    .map((value) => `${value.recipient}:${value.amountBaseUnits}`)
    .sort((left, right) => left.localeCompare(right));
}

export type VerificationOptions = {
  observation: FinalizedTransactionObservation;
  signature: string;
  payer: string;
  asset: "SOL" | "USDC";
  reference: string;
  recentBlockhash: string;
  expectedTransfers: ExpectedTransfer[];
  usdcMint: string;
};

async function verifyFinalizedTransactionUnsafe(
  options: VerificationOptions,
): Promise<{ ok: true; slot: bigint } | { ok: false; code: string }> {
  const { observation } = options;
  if (!observation.meta || observation.meta.err !== null) return { ok: false, code: "CHAIN_EXECUTION_FAILED" };
  const message = observation.transaction.message;
  if (observation.transaction.signatures[0] !== options.signature) return { ok: false, code: "SIGNATURE_MISMATCH" };
  if (message.accountKeys[0] !== options.payer || message.header.numRequiredSignatures !== 1) {
    return { ok: false, code: "PAYER_MISMATCH" };
  }
  if (message.recentBlockhash !== options.recentBlockhash) return { ok: false, code: "BLOCKHASH_MISMATCH" };

  const actual: Array<{ recipient: string; amountBaseUnits: string }> = [];
  const payer = address(options.payer);
  const mint = address(options.usdcMint);
  const [expectedSourceAta] = await findAssociatedTokenPda({
    owner: payer,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    mint,
  });

  for (const raw of message.instructions) {
    const instruction = toInstruction(raw, message.accountKeys);
    if (options.asset === "SOL" && instruction.programAddress === SYSTEM_PROGRAM_ADDRESS) {
      if (identifySystemInstruction(instruction) !== SystemInstruction.TransferSol) {
        return { ok: false, code: "UNEXPECTED_SYSTEM_INSTRUCTION" };
      }
      const parsed = parseTransferSolInstruction(instruction);
      if (parsed.accounts.source.address !== payer) return { ok: false, code: "PAYER_MISMATCH" };
      if (instruction.accounts.at(-1)?.address !== options.reference) {
        return { ok: false, code: "REFERENCE_MISMATCH" };
      }
      actual.push({
        recipient: parsed.accounts.destination.address,
        amountBaseUnits: parsed.data.amount.toString(),
      });
    }
    if (options.asset === "USDC" && instruction.programAddress === TOKEN_PROGRAM_ADDRESS) {
      if (identifyTokenInstruction(instruction) !== TokenInstruction.TransferChecked) {
        return { ok: false, code: "UNEXPECTED_TOKEN_INSTRUCTION" };
      }
      const parsed = parseTransferCheckedInstruction(instruction);
      if (
        parsed.accounts.authority.address !== payer ||
        parsed.accounts.source.address !== expectedSourceAta
      ) {
        return { ok: false, code: "PAYER_MISMATCH" };
      }
      if (parsed.accounts.mint.address !== mint || parsed.data.decimals !== 6) {
        return { ok: false, code: "MINT_MISMATCH" };
      }
      if (instruction.accounts.at(-1)?.address !== options.reference) {
        return { ok: false, code: "REFERENCE_MISMATCH" };
      }
      const matchingRecipient = await Promise.all(
        options.expectedTransfers.map(async (expected) => {
          const [ata] = await findAssociatedTokenPda({
            owner: address(expected.recipient),
            tokenProgram: TOKEN_PROGRAM_ADDRESS,
            mint,
          });
          return ata === parsed.accounts.destination.address ? expected.recipient : null;
        }),
      );
      const recipient = matchingRecipient.find((value) => value !== null);
      if (!recipient) return { ok: false, code: "RECIPIENT_MISMATCH" };
      actual.push({ recipient, amountBaseUnits: parsed.data.amount.toString() });
    }
  }

  if (JSON.stringify(multiset(actual)) !== JSON.stringify(multiset(options.expectedTransfers))) {
    return { ok: false, code: "TRANSFER_MISMATCH" };
  }
  return { ok: true, slot: observation.slot };
}

export async function verifyFinalizedTransaction(
  options: VerificationOptions,
): Promise<{ ok: true; slot: bigint } | { ok: false; code: string }> {
  try {
    return await verifyFinalizedTransactionUnsafe(options);
  } catch {
    return { ok: false, code: "MALFORMED_TRANSACTION" };
  }
}
