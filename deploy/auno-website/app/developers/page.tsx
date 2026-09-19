import { Developers } from '../content';
import { MainnetInfoPage } from '../mainnet-site';
import { isMainnetRequest } from '../../lib/site-network';

export default async function DevelopersPage() {
  return await isMainnetRequest() ? <MainnetInfoPage page="developers" /> : <Developers />;
}
