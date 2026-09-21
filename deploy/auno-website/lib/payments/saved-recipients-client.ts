import { recipientMessage } from './saved-recipients';
import type { WalletSession } from './wallet';
import type { NetworkId } from './model';

export async function contactRequest<T>(wallet: WalletSession, network: NetworkId, action: string, data: Record<string, unknown> = {}): Promise<T> {
  wallet.assertActive();
  const payload = JSON.stringify({ ...data, action, wallet: wallet.address, origin: location.origin, timestamp: Date.now(), nonce: crypto.randomUUID() });
  const signature = await wallet.signMessage(recipientMessage(payload, network));
  wallet.assertActive();
  const response = await fetch('/api/saved-recipients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload, signature }), cache: 'no-store' });
  let result: T & { error?: string };
  try { result = await response.json() as T & { error?: string }; } catch { throw new Error('Could not read the saved recipients response. Please retry.'); }
  if (!response.ok) throw new Error(result.error || 'Saved recipients are unavailable. Please retry.');
  wallet.assertActive();
  return result;
}
