"use client";

import {
  useConnect,
  useConnectedWallet,
  useDisconnect,
  useSignIn,
  useWalletStatus,
  useWallets,
} from "@solana/kit-plugin-wallet/react";
import type { UiWallet } from "@wallet-standard/ui";
import { Check, ChevronDown, Copy, LogOut, Wallet } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, ApiClientError, type Merchant } from "@/lib/client/api";
import { aunoWalletClient } from "./wallet-provider";

function base64(value: ArrayLike<number>): string {
  let output = "";
  for (let index = 0; index < value.length; index += 1) output += String.fromCharCode(value[index] ?? 0);
  return window.btoa(output);
}

function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

type WalletButtonProps = {
  mode: "merchant" | "payer";
  onMerchantAuthenticated?: (merchant: Merchant) => void;
  onPayerConnected?: (walletAddress: string) => void;
};

export function WalletButton({ mode, onMerchantAuthenticated, onPayerConnected }: WalletButtonProps) {
  const wallets = useWallets(aunoWalletClient);
  const walletStatus = useWalletStatus(aunoWalletClient);
  const connected = useConnectedWallet(aunoWalletClient);
  const connect = useConnect(aunoWalletClient);
  const disconnect = useDisconnect(aunoWalletClient);
  const signIn = useSignIn(aunoWalletClient);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function authenticate(wallet: UiWallet, connectedAddress?: string) {
    setError(null);
    try {
      const accounts = connectedAddress && connected ? [connected.account] : await connect.dispatchAsync(wallet);
      const walletAddress = connectedAddress ?? accounts.find((account) => account.chains.includes("solana:devnet"))?.address;
      if (!walletAddress) throw new Error("This wallet has no Solana devnet account available.");
      const challenge = await api.createChallenge(walletAddress);
      const output = await signIn.dispatchAsync(wallet, challenge.input);
      if (output.account.address !== walletAddress) throw new Error("Wallet account changed during sign-in.");
      const session = await api.createSession({
        challengeId: challenge.id,
        accountAddress: output.account.address,
        publicKey: base64(output.account.publicKey),
        signedMessage: base64(output.signedMessage),
        signature: base64(output.signature),
      });
      onMerchantAuthenticated?.(session.merchant);
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "Wallet sign-in was not completed.");
    }
  }

  async function connectPayer(wallet: UiWallet) {
    setError(null);
    try {
      const accounts = await connect.dispatchAsync(wallet);
      const account = accounts.find((item) => item.chains.includes("solana:devnet"));
      if (!account) throw new Error("This wallet has no Solana devnet account available.");
      onPayerConnected?.(account.address);
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Wallet connection was not completed.");
    }
  }

  if (connected) {
    const address = connected.account.address;
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="gap-2 border-[var(--product-line)] bg-white text-[var(--product-ink)]" />}>
          <span className="mini-dot" aria-hidden="true" />
          {shortAddress(address)}
          <ChevronDown size={14} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-64 border-[var(--product-line)] bg-[#fffefa] p-2 text-[var(--product-ink)]">
          <DropdownMenuLabel className="flex items-center justify-between gap-3 px-2 py-1">
            <span className="soft-label">SOLANA DEVNET</span>
            <Badge variant="outline" className="border-[#cfe6d9] bg-[#edf8f1] text-[var(--product-success)]">Connected</Badge>
          </DropdownMenuLabel>
          <div className="px-2 pb-2 text-sm font-semibold">{shortAddress(address)}</div>
          <DropdownMenuSeparator />
          {mode === "merchant" && (
            <DropdownMenuItem disabled={signIn.isRunning} onClick={() => void authenticate(connected.wallet, address)}>
              <Wallet size={15} /> Sign in as {shortAddress(address)}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={async () => { try { await navigator.clipboard.writeText(address); setCopied(true); } catch { setError("Clipboard access was unavailable."); } }}>
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy address"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={async () => { if (mode === "merchant") await api.revokeSession(); await disconnect.dispatchAsync(); setOpen(false); }}>
            <LogOut size={15} /> Disconnect
          </DropdownMenuItem>
          {error && <p className="error-message px-2" role="alert">{error}</p>}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger render={<Button variant="default" size="lg" className="button primary wallet-trigger" disabled={walletStatus === "pending" || connect.isRunning || signIn.isRunning} />}>
        <Wallet size={15} />
        {mode === "merchant" ? "Connect & sign in" : "Connect wallet"}
        <ChevronDown size={14} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-64 border-[var(--product-line)] bg-[#fffefa] p-2 text-[var(--product-ink)]">
        <DropdownMenuLabel className="px-2 py-1"><span className="soft-label">SOLANA DEVNET</span></DropdownMenuLabel>
        <DropdownMenuSeparator />
        {wallets.length ? wallets.map((wallet) => (
          <DropdownMenuItem key={wallet.name} onClick={() => { if (mode === "merchant") void authenticate(wallet); else void connectPayer(wallet); }}>
            <Wallet size={15} /> {wallet.name}
          </DropdownMenuItem>
        )) : <p className="wallet-empty px-2 py-2">No compatible browser wallet was found. Install a Wallet Standard wallet, then refresh this page.</p>}
        {error && <p className="error-message px-2" role="alert">{error}</p>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}