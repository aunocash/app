import { networkForOrigin, type NetworkId } from './payments/model';

// The server renders the deployment network. The browser must use the same
// value for labels, signed messages and wallet chains, including local previews.
export function browserNetwork(): NetworkId {
  const configured = typeof document === 'undefined' ? undefined : document.documentElement.dataset.network;
  if (configured === 'mainnet-beta' || configured === 'devnet') return configured;
  return networkForOrigin(typeof window === 'undefined' ? 'https://auno.cash' : window.location.origin);
}
