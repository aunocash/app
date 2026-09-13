"use client";

import { createClient } from "@solana/kit";
import { walletSigner } from "@solana/kit-plugin-wallet";
import { ClientProvider } from "@solana/react";
import type { ReactNode } from "react";

export const aunoWalletClient = createClient().use(
  walletSigner({ chain: "solana:devnet" }),
);

export function WalletProvider({ children }: { children: ReactNode }) {
  return <ClientProvider client={aunoWalletClient}>{children}</ClientProvider>;
}
