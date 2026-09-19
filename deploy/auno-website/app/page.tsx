import { Home } from './ui';
import { MainnetHome } from './mainnet-site';
import { isMainnetRequest } from '../lib/site-network';

export default async function HomePage() {
  return await isMainnetRequest() ? <MainnetHome /> : <Home />;
}
