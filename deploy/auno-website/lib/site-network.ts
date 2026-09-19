import { headers } from "next/headers";

const MAINNET_HOST = "mainnet.auno.cash";

function normalizeHost(value: string | null) {
  return value?.split(",", 1)[0]?.trim().toLowerCase().replace(/:\d+$/, "") ?? "";
}

export async function isMainnetRequest() {
  const requestHeaders = await headers();
  return [requestHeaders.get("x-forwarded-host"), requestHeaders.get("host")]
    .map(normalizeHost)
    .includes(MAINNET_HOST);
}
