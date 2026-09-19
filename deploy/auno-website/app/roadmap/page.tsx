import { Roadmap } from '../roadmap-view';
import { MainnetInfoPage } from '../mainnet-site';
import { isMainnetRequest } from '../../lib/site-network';

export default async function RoadmapPage() {
  return await isMainnetRequest() ? <MainnetInfoPage page="roadmap" /> : <Roadmap />;
}
