"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/client/api";
import { PaymentCreateForm } from "./payment-create-form";
import { Skeleton } from "./ui/skeleton";

export function PaymentCreateScreen({ initialSplit = false }: { initialSplit?: boolean }) {
  const session = useQuery({ queryKey: ["session"], queryFn: api.session });
  if (session.isPending) return <Skeleton className="detail-skeleton" aria-label="Loading merchant wallet" />;
  if (!session.data?.merchant) return null;
  return <PaymentCreateForm merchantWallet={session.data.merchant.walletAddress} initialSplit={initialSplit} />;
}
