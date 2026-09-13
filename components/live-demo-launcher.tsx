"use client";

import { useMutation } from "@tanstack/react-query";
import { CircleAlert, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, ApiClientError } from "@/lib/client/api";

export function LiveDemoLauncher() {
  const router = useRouter();
  const demo = useMutation({ mutationFn: api.createDemoPayment, onSuccess: (payment) => router.replace(`/pay/${payment.id}`) });
  const error = demo.error instanceof ApiClientError ? `${demo.error.message} (Request ${demo.error.requestId})` : demo.error ? "The live devnet sample is temporarily unavailable." : null;
  return (
    <Card className="auth-gate demo-launcher mx-auto max-w-2xl border-[var(--product-line)] bg-[#fffefa] text-center shadow-[var(--product-shadow)]">
      <CardHeader className="items-center gap-3 p-8 sm:p-12"><span className="auth-gate-icon"><Sparkles size={20} /></span><div className="eyebrow">LIVE DEVNET SAMPLE</div><CardTitle className="text-2xl text-[var(--product-ink)]">Start a fresh 0.001 SOL checkout.</CardTitle></CardHeader>
      <CardContent className="space-y-4 px-8 pb-8 sm:px-12 sm:pb-12"><p>This creates a new public request with a 30-minute expiry. AUNO never supplies or receives a private key.</p><Button className="button primary" type="button" disabled={demo.isPending} onClick={() => demo.mutate()}>{demo.isPending ? "Creating live sample…" : "Create live sample"}</Button>{error && <p className="error-message flex items-center justify-center gap-2" role="alert"><CircleAlert size={15} /> {error}</p>}</CardContent>
    </Card>
  );
}