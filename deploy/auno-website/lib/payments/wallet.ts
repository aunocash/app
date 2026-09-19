"use client";

import { getWallets } from "@wallet-standard/app";
import bs58 from "bs58";

export type SolanaChain = "solana:devnet" | "solana:mainnet";

type WalletAccount = {
  address: string;
  chains: readonly string[];
  features: readonly string[];
};

type StandardWallet = {
  name: string;
  chains: readonly string[];
  accounts: readonly WalletAccount[];
  features: Record<string, unknown>;
};

type ConnectFeature = {
  connect: () => Promise<{ accounts: readonly WalletAccount[] }>;
};

const requiredFeatures = ["solana:signMessage"];
const transactionSigningFeatures = ["solana:signAndSendTransaction", "solana:signTransaction"];

export type WalletSession = {
  address: string;
  name: string;
  chain: SolanaChain;
  assertActive: () => void;
  signMessage: (text: string) => Promise<string>;
  signAndSendTransaction?: (base64: string) => Promise<string>;
  signTransaction?: (base64: string) => Promise<string>;
  disconnect: () => Promise<void>;
};

export type SavedWalletSession = {
  name: string;
  address: string;
  chain: SolanaChain;
};

const walletSessionKey = "auno:wallet-session:v1";

export function readWalletSession(): SavedWalletSession | null {
  if (typeof window === "undefined") return null;
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(walletSessionKey) || "null");
    if (!value || typeof value !== "object") return null;
    const record = value as { name?: unknown; address?: unknown; chain?: unknown };
    if (typeof record.name !== "string" || typeof record.address !== "string") return null;
    if (record.chain !== "solana:devnet" && record.chain !== "solana:mainnet") return null;
    return { name: record.name, address: record.address, chain: record.chain };
  } catch {
    return null;
  }
}

export function saveWalletSession(wallet: WalletSession) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(walletSessionKey, JSON.stringify({ name: wallet.name, address: wallet.address, chain: wallet.chain }));
  } catch {
    // Private browsing must not interrupt checkout.
  }
}

export function clearWalletSession() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(walletSessionKey);
  } catch {
    // Ignore unavailable session storage.
  }
}

function supportsAccount(account: WalletAccount, chain: SolanaChain) {
  return account.chains.includes(chain)
    && requiredFeatures.every((feature) => account.features.includes(feature))
    && transactionSigningFeatures.some((feature) => account.features.includes(feature));
}

function supportsWallet(wallet: StandardWallet, chain: SolanaChain) {
  return wallet.chains.includes(chain)
    && requiredFeatures.every((feature) => Boolean(wallet.features[feature]))
    && transactionSigningFeatures.some((feature) => Boolean(wallet.features[feature]));
}

function walletsFor(chain: SolanaChain) {
  return (getWallets().get() as readonly StandardWallet[]).filter((wallet) => supportsWallet(wallet, chain));
}

function walletFor(name: string, chain: SolanaChain) {
  return walletsFor(chain).find((wallet) => wallet.name === name);
}

function createSession(wallet: StandardWallet, account: WalletAccount, chain: SolanaChain): WalletSession {
  function activeContext() {
    const currentWallet = walletFor(wallet.name, chain);
    const currentAccount = currentWallet?.accounts.find((candidate) => candidate.address === account.address && supportsAccount(candidate, chain));
    if (!currentWallet || !currentAccount) throw new Error("Wallet connection changed. Reconnect the same account before starting a new payment attempt.");
    return { wallet: currentWallet, account: currentAccount };
  }

  return {
    address: account.address,
    name: wallet.name,
    chain,
    assertActive: () => { activeContext(); },
    signMessage: async (text) => {
      const { wallet: currentWallet, account: currentAccount } = activeContext();
      const feature = currentWallet.features["solana:signMessage"] as { signMessage: (input: unknown) => Promise<{ signature: Uint8Array }[]> };
      const [output] = await feature.signMessage({ account: currentAccount, message: new TextEncoder().encode(text) });
      return bs58.encode(output.signature);
    },
    signAndSendTransaction: wallet.features["solana:signAndSendTransaction"] ? async (base64) => {
      const { wallet: currentWallet, account: currentAccount } = activeContext();
      const feature = currentWallet.features["solana:signAndSendTransaction"] as { signAndSendTransaction: (input: unknown) => Promise<{ signature: Uint8Array }[]> };
      const [output] = await feature.signAndSendTransaction({ account: currentAccount, chain, transaction: Uint8Array.from(atob(base64), (character) => character.charCodeAt(0)) });
      if (!output?.signature) throw new Error("Wallet did not return a transaction signature.");
      return bs58.encode(output.signature);
    } : undefined,
    signTransaction: wallet.features["solana:signTransaction"] ? async (base64) => {
      const { wallet: currentWallet, account: currentAccount } = activeContext();
      const feature = currentWallet.features["solana:signTransaction"] as { signTransaction: (input: unknown) => Promise<{ signedTransaction: Uint8Array }[]> };
      const [output] = await feature.signTransaction({ account: currentAccount, chain, transaction: Uint8Array.from(atob(base64), (character) => character.charCodeAt(0)) });
      return btoa(String.fromCharCode(...output.signedTransaction));
    } : undefined,
    disconnect: async () => {
      const currentWallet = walletFor(wallet.name, chain);
      const feature = currentWallet?.features["standard:disconnect"] as { disconnect: () => Promise<void> } | undefined;
      await feature?.disconnect();
    },
  };
}

export function availableWallets(chain: SolanaChain = "solana:devnet") {
  return walletsFor(chain).filter((wallet) => Boolean(wallet.features["standard:connect"]));
}

export async function connectWallet(name: string, chain: SolanaChain = "solana:devnet"): Promise<WalletSession> {
  const wallet = availableWallets(chain).find((candidate) => candidate.name === name);
  if (!wallet) throw new Error("Install a Wallet Standard compatible Solana wallet, then reload.");
  const result = await (wallet.features["standard:connect"] as ConnectFeature).connect();
  const account = result.accounts.find((candidate) => supportsAccount(candidate, chain));
  if (!account) throw new Error(`This wallet account does not support ${chain} message signing and transaction approval.`);
  return createSession(wallet, account, chain);
}

export function restoreWallet(name: string, address: string, chain: SolanaChain): WalletSession | null {
  const wallet = walletFor(name, chain);
  if (!wallet) return null;
  const account = wallet.accounts.find((candidate) => candidate.address === address && supportsAccount(candidate, chain));
  return account ? createSession(wallet, account, chain) : null;
}
