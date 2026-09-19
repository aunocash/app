import { MainnetInfoPage } from "../mainnet-site";
import { SplitCalculator } from "../payment-ui";
import { isMainnetRequest } from "@/lib/site-network";

export default async function SplitPage() {
  return await isMainnetRequest() ? <MainnetInfoPage page="split" /> : <SplitCalculator />;
}
