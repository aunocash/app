import { MainnetInfoPage } from "../mainnet-site";
import { SplitCalculator } from "../payment-ui";
import { isMainnetRequest } from "@/lib/site-network";
import { mainnetSplitsEnabled } from "@/lib/payments/server";

export default async function SplitPage() {
  if (await isMainnetRequest()) return mainnetSplitsEnabled() ? <SplitCalculator network="mainnet-beta" /> : <MainnetInfoPage page="split" />;
  return <SplitCalculator network="devnet" />;
}
