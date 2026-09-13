"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { LockKeyhole } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client/api";
import { WalletButton } from "./wallet-button";
import { aunoWalletClient } from "./wallet-provider";

export function DashboardAuthGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: ["session"], queryFn: api.session });
  const connected = useConnectedWallet(aunoWalletClient);
  const hadConnectedWallet = useRef(false);
  useEffect(() => {
    const merchant = session.data?.merchant;
    if (!merchant) return;
    if (connected) {
      hadConnectedWallet.current = true;
      if (connected.account.address !== merchant.walletAddress) {
        void api.revokeSession().finally(() => queryClient.invalidateQueries({ queryKey: ["session"] }));
      }
    } else if (hadConnectedWallet.current) {
      void api.revokeSession().finally(() => queryClient.invalidateQueries({ queryKey: ["session"] }));
    }
  }, [connected, queryClient, session.data?.merchant]);

  if (session.isPending) return <Skeleton className="mx-auto my-8 min-h-40 max-w-3xl rounded-2xl" aria-label="Loading your payment workspace" />;

  const merchant = session.data?.merchant;
  const hasMatchingWallet = connected?.account.address === merchant?.walletAddress;
  if (session.isError || !merchant || !hasMatchingWallet) {
    return (
      <Card className="mx-auto my-8 max-w-2xl border-[var(--product-line)] bg-[#fffefa] text-center shadow-[var(--product-shadow)]">
        <CardHeader className="items-center gap-3 p-8 pb-3 sm:p-12 sm:pb-4">
          <span className="auth-gate-icon"><LockKeyhole size={20} /></span>
          <div className="eyebrow">MERCHANT WORKSPACE · DEVNET</div>
          <CardTitle id="workspace-signin-title" className="text-2xl text-[var(--product-ink)]">Sign in with the wallet that owns your payments.</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-8 pb-8 sm:px-12 sm:pb-12">
          <p className="mx-auto max-w-xl text-[var(--product-muted)]">AUNO uses a short-lived, wallet-signed session. No private key is shared or stored.</p>
          <WalletButton mode="merchant" onMerchantAuthenticated={() => queryClient.invalidateQueries({ queryKey: ["session"] })} />
        </CardContent>
      </Card>
    );
  }
  return <>{children}</>;
}