'use client';
import { useState } from 'react';
import { AppShell, WalletButton } from '../../payment-ui';
import { SavedRecipientWorkspace } from '../../saved-recipients-ui';
import { useSiteNetwork } from '../../network-context';
import type { WalletSession } from '@/lib/payments/wallet';

export default function SavedRecipientsPage() {
  const [wallet, setWallet] = useState<WalletSession | null>(null);
  const network = useSiteNetwork();
  return <AppShell title="Saved Recipients" subtitle="Save a name and wallet address to use in future payments."><WalletButton session={wallet} onChange={setWallet} />{wallet ? <SavedRecipientWorkspace key={`${network}:${wallet.address}`} wallet={wallet} network={network} /> : <div className="empty"><h2>Connect your wallet.</h2><p>Authorize with a wallet signature to access your private saved recipients.</p></div>}</AppShell>;
}
