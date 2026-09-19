import { Whitepaper } from '../content';
import { MainnetInfoPage } from '../mainnet-site';
import { isMainnetRequest } from '../../lib/site-network';

export default async function WhitepaperPage() {
  return await isMainnetRequest() ? <MainnetInfoPage page="whitepaper" /> : <Whitepaper />;
}
