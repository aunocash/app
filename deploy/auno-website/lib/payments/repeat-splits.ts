import { ASSETS, allocate, toBaseUnits, validateSplitRecipients, type Asset, type NetworkId, type SplitRecipient } from './model';

export type RepeatSplitConfig = { name: string; description: string; asset: Asset; amount: string; recipients: SplitRecipient[]; allocationType: 'percentage' };
export type RepeatSplit = RepeatSplitConfig & { id: string; ownerWallet: string; network: NetworkId; revision: number; createdAt: number; updatedAt: number; lastUsedAt: number | null; executionCount: number };
export function repeatSplitMessage(payload: string, network: NetworkId) { return `AUNO ${network} Repeat Split authorization\n${payload}`; }
export function validateRepeatSplit(value: unknown): RepeatSplitConfig {
  if (!value || typeof value !== 'object') throw new Error('Enter a valid split configuration.');
  const input = value as Record<string, unknown>;
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 120) throw new Error('Enter a split name of up to 120 characters.');
  if (typeof input.description !== 'string' || input.description.length > 1000) throw new Error('Notes must be no longer than 1,000 characters.');
  if (input.asset !== 'SOL' && input.asset !== 'USDC') throw new Error('Choose SOL or USDC.');
  if (input.allocationType !== 'percentage') throw new Error('Use percentage allocation.');
  if (typeof input.amount !== 'string') throw new Error('Enter a payment amount.');
  if (!Array.isArray(input.recipients)) throw new Error('Enter split recipients.');
  const recipients = validateSplitRecipients(input.recipients.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid recipient.');
    const r = item as Record<string, unknown>;
    if (typeof r.label !== 'string' || r.label.length > 120 || typeof r.wallet !== 'string' || !Number.isInteger(r.bps)) throw new Error('Invalid recipient label, wallet or allocation.');
    return { label: r.label, wallet: r.wallet, bps: r.bps as number };
  }));
  allocate(toBaseUnits(input.amount, ASSETS[input.asset].decimals), recipients.map(r => r.bps));
  return { name: input.name.trim(), description: input.description, amount: input.amount, asset: input.asset, allocationType: 'percentage', recipients };
}
