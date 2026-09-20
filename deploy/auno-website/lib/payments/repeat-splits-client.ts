import { repeatSplitMessage } from './repeat-splits';
import type { WalletSession } from './wallet';
import type { NetworkId } from './model';

export async function repeatSplitRequest<T>(wallet: WalletSession, network: NetworkId, action: string, data: Record<string, unknown> = {}): Promise<T> {
  wallet.assertActive();
  const payload = JSON.stringify({ ...data, action, wallet: wallet.address, origin: location.origin, timestamp: Date.now(), nonce: crypto.randomUUID() });
  const signature = await wallet.signMessage(repeatSplitMessage(payload, network));
  wallet.assertActive();
  const response = await fetch('/api/repeat-splits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload, signature }), cache: 'no-store' });
  let result: T & { error?: string };
  try { result = await response.json() as T & { error?: string }; } catch { throw new Error('AUNO could not load the response. Please retry.'); }
  if (!response.ok) throw new Error(result.error || 'Repeat Split could not be saved. Please retry.');
  wallet.assertActive();
  return result as T;
}
