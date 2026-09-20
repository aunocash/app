"use client";

import { createContext, useContext, type ReactNode } from 'react';
import type { NetworkId } from '@/lib/payments/model';

const NetworkContext = createContext<NetworkId>('mainnet-beta');
export function NetworkProvider({ network, children }: { network: NetworkId; children: ReactNode }) {
  return <NetworkContext.Provider value={network}>{children}</NetworkContext.Provider>;
}
export function useSiteNetwork() { return useContext(NetworkContext); }
