import { PublicKey } from '@solana/web3.js';
import type { NetworkId } from './model';

export type RecipientContactInput = { name: string; address: string; note: string };
export type RecipientContact = RecipientContactInput & { id: string; ownerWallet: string; revision: number; createdAt: number; updatedAt: number };
export type ContactStatus = { contactId: string; name: string; snapshotAddress: string; currentAddress: string | null; deleted: boolean };
export function recipientMessage(payload: string, network: NetworkId) { return `AUNO ${network} Saved Recipients authorization\n${payload}`; }
export function validateContact(value: unknown): RecipientContactInput {
  if (!value || typeof value !== 'object') throw new Error('Enter a recipient name and wallet address.');
  const c = value as Record<string, unknown>;
  if (typeof c.name !== 'string' || !c.name.trim() || c.name.trim().length > 80) throw new Error('Name must contain 1–80 characters.');
  const note = c.note === undefined ? '' : c.note;
  if (typeof note !== 'string' || note.length > 200) throw new Error('Note must be no longer than 200 characters.');
  let key: PublicKey;
  try { if (typeof c.address !== 'string') throw new Error(); key = new PublicKey(c.address.trim()); } catch { throw new Error('Enter a valid Solana wallet address.'); }
  // A parseable address is not proof of ownership. The current payment engine
  // requires on-curve destination wallets (including USDC ATA derivation).
  if (!PublicKey.isOnCurve(key.toBytes())) throw new Error('This Solana address is valid, but AUNO currently supports only on-curve recipient wallets.');
  return { name: c.name.trim(), address: key.toBase58(), note: note.trim() };
}
export function matchingContacts(items: RecipientContact[], query: string) {
  const q = query.trim();
  return items.filter(c => c.name.toLocaleLowerCase().includes(q.toLocaleLowerCase()) || c.address.includes(q));
}
// Independent from React so delayed wallet responses can be tested explicitly.
export class ContactRequestScope {
  private generation = 0;
  begin() { return ++this.generation; }
  invalidate() { this.generation++; }
  current(token: number) { return token === this.generation; }
}
