'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { contactRequest } from '@/lib/payments/saved-recipients-client';
import { ContactRequestScope, matchingContacts, validateContact, type RecipientContact } from '@/lib/payments/saved-recipients';
import type { WalletSession } from '@/lib/payments/wallet';
import type { NetworkId } from '@/lib/payments/model';

function message(error: unknown) { return error instanceof Error ? error.message : 'Please try again.'; }
export function ContactDialog({ title, onClose, children, busy = false }: { title: string; onClose: () => void; children: ReactNode; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null), id = useId();
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => { dialog?.close(); }; }, []);
  return <dialog ref={ref} className="contact-dialog panel" aria-labelledby={id} onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}><div className="contact-dialog-heading"><h2 id={id}>{title}</h2><button type="button" className="button outline small" disabled={busy} onClick={onClose} aria-label="Close dialog">Close</button></div>{children}</dialog>;
}

function ContactEditor({ contact, wallet, network, onSaved, onClose }: { contact?: RecipientContact; wallet: WalletSession; network: NetworkId; onSaved: (contact: RecipientContact) => void; onClose: () => void }) {
  const [name, setName] = useState(contact?.name ?? ''), [address, setAddress] = useState(contact?.address ?? ''), [note, setNote] = useState(contact?.note ?? '');
  const [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false), scope = useRef(new ContactRequestScope());
  useEffect(() => { const current = scope.current; return () => current.invalidate(); }, []);
  const changed = Boolean(contact && address.trim() !== contact.address);
  async function save() {
    if (lock.current) return;
    setError('');
    let config;
    try { config = validateContact({ name, address, note }); if (changed && !confirmed) throw new Error('Confirm the address change below.'); } catch (e) { setError(message(e)); return; }
    lock.current = true; setBusy(true); const token = scope.current.begin();
    try { const saved = await contactRequest<RecipientContact>(wallet, network, contact ? 'update' : 'create', { config, ...(contact ? { id: contact.id, revision: contact.revision, confirmAddressChange: confirmed } : {}) }); if (scope.current.current(token)) onSaved(saved); }
    catch (e) { if (scope.current.current(token)) setError(message(e)); }
    finally { if (scope.current.current(token)) { lock.current = false; setBusy(false); } }
  }
  return <ContactDialog title={contact ? 'Edit recipient' : 'Add recipient'} onClose={onClose} busy={busy}>
    <div className="contact-editor"><label>Name<input autoFocus maxLength={80} value={name} onChange={e => setName(e.target.value)} disabled={busy} /></label>
    <label>Solana wallet address<input spellCheck={false} autoComplete="off" value={address} onChange={e => { setAddress(e.target.value); setConfirmed(false); }} disabled={busy} /></label>
    <p className="detail-note">Use the recipient wallet address, not a USDC token account. Names are your labels, not proof of identity.</p>
    <label>Note (optional)<textarea maxLength={200} value={note} onChange={e => setNote(e.target.value)} disabled={busy} /></label>
    {changed && <section className="notice"><p>Changing this contact will not update existing saved payments or splits.</p><p>Previous address</p><code>{contact?.address}</code><p>New address</p><code>{address}</code><label className="contact-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />I reviewed both addresses.</label></section>}
    {error && <p className="notice error" role="alert">{error}</p>}
    <button type="button" className="button" disabled={busy || (changed && !confirmed)} onClick={save}>{busy ? 'Saving…' : 'Save recipient'}</button></div>
  </ContactDialog>;
}

export function SavedRecipientWorkspace({ wallet, network, onSelect }: { wallet: WalletSession; network: NetworkId; onSelect?: (contact: RecipientContact) => void }) {
  const [items, setItems] = useState<RecipientContact[] | null>(null), [query, setQuery] = useState('');
  const [editor, setEditor] = useState<RecipientContact | 'new' | null>(null), [deleting, setDeleting] = useState<RecipientContact | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const scope = useRef(new ContactRequestScope()), lock = useRef(false);
  useEffect(() => { const current = scope.current; return () => current.invalidate(); }, []);
  async function load() {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setSuccess(''); const token = scope.current.begin();
    try { const data = await contactRequest<{ recipients: RecipientContact[] }>(wallet, network, 'list'); if (scope.current.current(token)) setItems(data.recipients); }
    catch (e) { if (scope.current.current(token)) setError(message(e)); }
    finally { if (scope.current.current(token)) { lock.current = false; setBusy(false); } }
  }
  async function remove() {
    if (!deleting || lock.current) return; lock.current = true; setBusy(true); setError(''); const token = scope.current.begin();
    try { await contactRequest(wallet, network, 'delete', { id: deleting.id, revision: deleting.revision }); if (scope.current.current(token)) { setItems(current => current?.filter(c => c.id !== deleting.id) ?? null); setDeleting(null); setSuccess('Recipient deleted. Existing payments and splits are unchanged.'); } }
    catch (e) { if (scope.current.current(token)) setError(message(e)); }
    finally { if (scope.current.current(token)) { lock.current = false; setBusy(false); } }
  }
  const visible = matchingContacts(items ?? [], query);
  return <section className="saved-recipient-workspace">
    <div className="record-actions"><button type="button" className="button outline" disabled={busy} onClick={load}>{busy ? 'Working…' : 'Authorize & Load Recipients'}</button><button type="button" className="button" disabled={busy} onClick={() => setEditor('new')}>Add recipient</button></div>
    <p className="detail-note">Stored privately for your wallet. A message signature authorizes access; it does not approve spending. Names and notes stay off public payment pages.</p>
    {error && <p role="alert" className="notice error">{error}</p>}{success && <p role="status" className="notice">{success}</p>}
    {items && <label className="contact-search">Search recipients<input type="search" placeholder="Name or wallet address" value={query} onChange={e => setQuery(e.target.value)} /></label>}
    {items?.length === 0 && <div className="empty"><h2>No saved recipients yet.</h2><p>Save a name and wallet address to use in future payments.</p><button type="button" className="button" onClick={() => setEditor('new')}>Add recipient</button></div>}
    {items && items.length > 0 && visible.length === 0 && <p role="status">No matching recipients.</p>}
    <div className="saved-recipient-list">{visible.map(c => <article className="panel saved-recipient-card" key={c.id}><h3>{c.name}</h3><code>{c.address.slice(0, 6)}…{c.address.slice(-6)}</code><details><summary>Full address</summary><code>{c.address}</code></details>{!onSelect && c.note && <p>{c.note}</p>}
      <div className="record-actions">{onSelect && <button type="button" className="button small" disabled={busy} onClick={() => { try { wallet.assertActive(); onSelect(c); } catch (e) { setItems(null); setError(message(e)); } }}>Use recipient</button>}<button type="button" className="button outline small" onClick={async () => { try { await navigator.clipboard.writeText(c.address); setSuccess('Full wallet address copied.'); } catch { setError('Copy failed. Select the full address and copy it manually.'); } }}>Copy address</button><button type="button" className="button outline small" disabled={busy} onClick={() => setEditor(c)}>Edit</button><button type="button" className="button outline small" disabled={busy} onClick={() => setDeleting(c)}>Delete</button></div>
    </article>)}</div>
    {editor && <ContactEditor wallet={wallet} network={network} contact={editor === 'new' ? undefined : editor} onClose={() => setEditor(null)} onSaved={c => { setItems(old => old ? [...old.filter(item => item.id !== c.id), c] : [c]); setEditor(null); setSuccess('Recipient saved.'); }} />}
    {deleting && <ContactDialog title={`Delete “${deleting.name}”?`} busy={busy} onClose={() => setDeleting(null)}><p>This removes the contact only. Existing payments, saved splits and history remain unchanged.</p><code>{deleting.address}</code><div className="record-actions"><button type="button" className="button outline" disabled={busy} onClick={() => setDeleting(null)}>Cancel</button><button type="button" className="button" disabled={busy} onClick={remove}>Delete recipient</button></div>{error && <p role="alert">{error}</p>}</ContactDialog>}
  </section>;
}

function ConnectedPicker({ wallet, network, onSelect, disabled }: { wallet: WalletSession | null; network: NetworkId; onSelect: (contact: RecipientContact) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className="button outline small" disabled={!wallet || disabled} onClick={() => setOpen(true)}>Choose saved recipient</button>{open && wallet && <ContactDialog title="Choose saved recipient" onClose={() => setOpen(false)}><SavedRecipientWorkspace wallet={wallet} network={network} onSelect={contact => { onSelect(contact); setOpen(false); }} /></ContactDialog>}</>;
}
export function SavedRecipientPicker(props: { wallet: WalletSession | null; network: NetworkId; onSelect: (contact: RecipientContact) => void; disabled?: boolean }) {
  return <ConnectedPicker key={`${props.network}:${props.wallet?.address ?? 'disconnected'}`} {...props} />;
}
