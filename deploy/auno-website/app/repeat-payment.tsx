"use client";

import { useEffect, useState, type ReactNode } from 'react';
import { repeatDraft, type RepeatDraft } from '@/lib/payments/repeat';
import type { NetworkId, PaymentIntent } from '@/lib/payments/model';

export function RepeatPaymentLoader({ network, split, children }: {
  network: NetworkId; split: boolean; children: (draft?: RepeatDraft) => ReactNode;
}) {
  const [result, setResult] = useState<{ network: NetworkId; draft?: RepeatDraft; error?: string } | null>(null);
  const path = split ? '/split' : '/dashboard/create';
  useEffect(() => {
    const controller = new AbortController();
    const id = new URLSearchParams(window.location.search).get('repeat');
    if (!id) { setResult({ network }); return () => controller.abort(); }
    async function load() {
      try {
        if (!/^[a-zA-Z0-9-]{1,100}$/.test(id!)) throw new Error('Invalid payment reference.');
        const response = await fetch(`/api/payments/${encodeURIComponent(id!)}/repeat`, { signal: controller.signal, cache: 'no-store' });
        let payment: PaymentIntent & { error?: string };
        try { payment = await response.json(); }
        catch { throw new Error('AUNO could not load the payment details. Check your connection and try again.'); }
        if (!response.ok) throw new Error(payment.error || 'The original payment could not be loaded.');
        const draft = repeatDraft(payment, network);
        if ((draft.recipients.length > 1) !== split) throw new Error('Open Repeat Payment from the matching payment in history.');
        if (!controller.signal.aborted) setResult({ network, draft });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ network, error: error instanceof Error ? error.message : 'Payment could not be loaded.' });
      }
    }
    void load();
    return () => controller.abort();
  }, [network, split]);
  if (!result || result.network !== network) return <main className="page-shell"><div className="notice" role="status">Loading payment details…</div></main>;
  if (result.error) return <main className="page-shell"><section className="panel"><h1>Unable to repeat payment.</h1><p role="alert">{result.error}</p><div className="actions"><button className="button" onClick={() => window.location.reload()}>Try again</button><a className="button outline" href="/dashboard/payments">Payment history</a><a className="text-link" href={path}>Start a new payment</a></div></section></main>;
  return children(result.draft);
}

export function RepeatNotice({ draft }: { draft: RepeatDraft }) {
  return <div className="notice repeat-notice" role="status"><strong>Repeat payment</strong><p>Recipients and amounts are copied from a verified payment. Review or edit them below. This creates a new payment and requires fresh wallet approval. Network fees may change.</p><a className="text-link" href={`/pay/${encodeURIComponent(draft.sourceId)}`}>View original payment</a></div>;
}
