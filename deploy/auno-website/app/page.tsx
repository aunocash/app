import { Home } from './ui';
import { isMainnetRequest } from '../lib/site-network';

export default async function HomePage() {
  const mainnet = await isMainnetRequest();
  return <Home network={mainnet ? 'mainnet' : undefined} />;
}
