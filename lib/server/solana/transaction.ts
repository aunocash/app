import { getTransferSolInstruction } from "@solana-program/system";
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getTransferCheckedInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import {
  AccountRole,
  address,
  appendTransactionMessageInstructions,
  assertIsTransactionWithinSizeLimit,
  blockhash,
  compileTransaction,
  createNoopSigner,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Instruction,
} from "@solana/kit";

import type { Asset } from "../../contracts/payments";

const MAX_INSTRUCTIONS = 12;
const MAX_STATIC_ACCOUNTS = 32;

type RecipientTransfer = { address: string; amountBaseUnits: bigint };

export async function deriveRecipientTokenAccounts(
  recipients: RecipientTransfer[],
  mintAddress: string,
): Promise<string[]> {
  const mint = address(mintAddress);
  return Promise.all(
    recipients.map(async (recipient) => {
      const [tokenAccount] = await findAssociatedTokenPda({
        owner: address(recipient.address),
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
        mint,
      });
      return tokenAccount;
    }),
  );
}

function withReference(instruction: Instruction, referenceAddress: string): Instruction {
  return {
    ...instruction,
    accounts: [
      ...(instruction.accounts ?? []),
      { address: address(referenceAddress), role: AccountRole.READONLY },
    ],
  };
}

export async function buildUnsignedPaymentTransaction(options: {
  asset: Asset;
  payer: string;
  reference: string;
  recipients: RecipientTransfer[];
  lifetime: { blockhash: string; lastValidBlockHeight: bigint };
  usdcMint: string;
  existingTokenAccounts: ReadonlySet<string>;
}) {
  const payer = address(options.payer);
  const payerSigner = createNoopSigner(payer);
  const reference = address(options.reference);
  const instructions: Instruction[] = [];
  const recipientTokenAccounts: string[] = [];

  if (options.asset === "SOL") {
    for (const recipient of options.recipients) {
      instructions.push(
        withReference(
          getTransferSolInstruction({
            source: payerSigner,
            destination: address(recipient.address),
            amount: recipient.amountBaseUnits,
          }),
          reference,
        ),
      );
    }
  } else {
    const mint = address(options.usdcMint);
    const [source] = await findAssociatedTokenPda({
      owner: payer,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      mint,
    });
    for (const recipient of options.recipients) {
      const owner = address(recipient.address);
      const [destination] = await findAssociatedTokenPda({
        owner,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
        mint,
      });
      recipientTokenAccounts.push(destination);
      if (!options.existingTokenAccounts.has(destination)) {
        instructions.push(
          getCreateAssociatedTokenIdempotentInstruction({
            payer: payerSigner,
            ata: destination,
            owner,
            mint,
          }),
        );
      }
      instructions.push(
        withReference(
          getTransferCheckedInstruction({
            source,
            mint,
            destination,
            authority: payerSigner,
            amount: recipient.amountBaseUnits,
            decimals: 6,
          }),
          reference,
        ),
      );
    }
  }

  if (instructions.length > MAX_INSTRUCTIONS) {
    throw new Error("Payment requires too many transaction instructions.");
  }
  const staticAccounts = new Set<string>();
  for (const instruction of instructions) {
    staticAccounts.add(instruction.programAddress);
    for (const account of instruction.accounts ?? []) staticAccounts.add(account.address);
  }
  if (staticAccounts.size > MAX_STATIC_ACCOUNTS) {
    throw new Error("Payment requires too many transaction accounts.");
  }

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (value) => setTransactionMessageFeePayer(payer, value),
    (value) =>
      setTransactionMessageLifetimeUsingBlockhash(
        {
          blockhash: blockhash(options.lifetime.blockhash),
          lastValidBlockHeight: options.lifetime.lastValidBlockHeight,
        },
        value,
      ),
    (value) => appendTransactionMessageInstructions(instructions, value),
  );
  const transaction = compileTransaction(message);
  assertIsTransactionWithinSizeLimit(transaction);

  return {
    serializedTransaction: getBase64EncodedWireTransaction(transaction),
    transaction,
    instructions,
    recipientTokenAccounts,
  };
}
