import { Developers } from '../content';
import { isMainnetRequest } from '../../lib/site-network';

export default async function DevelopersPage() {
  const mainnet = await isMainnetRequest();
  return <Developers network={mainnet ? 'mainnet' : undefined} />;
}
