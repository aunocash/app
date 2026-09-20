'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { AppShell, SplitPaymentForm, WalletButton } from '../../payment-ui';
import { useSiteNetwork } from '../../network-context';
import type { WalletSession } from '@/lib/payments/wallet';
import type { RepeatSplit } from '@/lib/payments/repeat-splits';
import { repeatSplitRequest } from '@/lib/payments/repeat-splits-client';

export function RepeatSplitsDashboard() {
  const network = useSiteNetwork();
  const [wallet, setWallet] = useState<WalletSession | null>(null);
  const [items, setItems] = useState<RepeatSplit[] | null>(null);
  const [selected, setSelected] = useState<{ split: RepeatSplit; review: boolean } | null>(null);
  const [deleting, setDeleting] = useState<RepeatSplit | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  function changeWallet(next: WalletSession | null) { generation.current++; setWallet(next); setItems(null); setSelected(null); setDeleting(null); setError(''); setBusy(false); }
  async function load() {
    if (!wallet) return;
    const current = ++generation.current;
    setBusy(true); setError('');
    try { const result = await repeatSplitRequest<{ splits: RepeatSplit[] }>(wallet, network, 'list'); if (current === generation.current) setItems(result.splits); }
    catch (e) { if (current === generation.current) setError(e instanceof Error ? e.message : 'Unable to load Repeat Splits.'); }
    finally { if (current === generation.current) setBusy(false); }
  }
  async function remove() {
    if (!wallet || !deleting) return;
    const current = generation.current, target = deleting;
    setBusy(true); setError('');
    try { await repeatSplitRequest(wallet, network, 'delete', { id: target.id, revision: target.revision }); if (current === generation.current) { setItems(items => items?.filter(item => item.id !== target.id) ?? null); setDeleting(null); toast.success('Repeat Split deleted. Payment history is unchanged.'); } }
    catch (e) { if (current === generation.current) setError(e instanceof Error ? e.message : 'Unable to delete Repeat Split.'); }
    finally { if (current === generation.current) setBusy(false); }
  }
  if (selected && wallet) return <SplitPaymentForm key={selected.split.id} network={network} template={selected.split} initialWallet={wallet} initialReview={selected.review} />;
  return <AppShell title="Repeat Splits" subtitle="Save a split once and reuse it whenever you need to pay the same recipients again.">
    <div className="record-actions"><WalletButton session={wallet} onChange={changeWallet} /><button className="button outline" disabled={!wallet || busy} onClick={load}>{busy ? 'Working…' : 'Authorize & Load Repeat Splits'}</button><a className="button outline" href="/split">Create Split Payment</a></div>
    <p className="detail-note">Wallet authorization only reads or updates your saved configurations. Every payment requires a new transaction signature. Up to 200 saved splits are shown.</p>
    {error && <div className="notice error" role="alert">{error}</div>}
    {!wallet ? <div className="empty"><h2>Connect your wallet.</h2><p>Only the owner wallet can access its Repeat Splits.</p></div> : items?.length === 0 ? <div className="empty"><h2>No Repeat Splits yet.</h2><p>Save a Split Payment to quickly reuse the same recipients and allocation later.</p></div> : null}
    <div className="repeat-splits-grid">{items?.map(item => <section className="panel repeat-split-card" key={item.id}>
      <h2>{item.name}</h2><p>{item.recipients.length} recipients · {item.asset} · {item.amount} default amount</p>
      <p>Last paid: {item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleDateString('en-US') : 'Not yet'} · Used {item.executionCount} {item.executionCount === 1 ? 'time' : 'times'}</p>
      <details><summary>View recipients</summary><ul className="record-recipients">{item.recipients.map(r => <li key={r.wallet}><strong>{r.label} · {r.bps / 100}%</strong><code>{r.wallet}</code></li>)}</ul></details>
      <div className="record-actions"><button className="button" disabled={busy} onClick={() => setSelected({ split: item, review: true })}>Pay Again</button><button className="button outline" disabled={busy} onClick={() => setSelected({ split: item, review: false })}>Edit</button><button className="button outline" disabled={busy} onClick={() => setDeleting(item)}>Delete</button></div>
    </section>)}</div>
    {deleting && <section className="notice" role="alertdialog" aria-modal="false" aria-labelledby="repeat-delete-title"><h2 id="repeat-delete-title">Delete “{deleting.name}”?</h2><p>This removes the saved template only. Historical transactions remain unchanged.</p><div className="record-actions"><button className="button outline" disabled={busy} onClick={() => setDeleting(null)}>Cancel</button><button className="button" disabled={busy} onClick={remove}>Confirm deletion</button></div></section>}
  </AppShell>;
}
