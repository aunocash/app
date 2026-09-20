import { headers } from "next/headers";
import { readRuntimeEnv } from './runtime-env';

const MAINNET_HOSTS = ["auno.cash", "mainnet.auno.cash"];

function normalizeHost(value: string | null) {
  return value?.split(",", 1)[0]?.trim().toLowerCase().replace(/:\d+$/, "") ?? "";
}

export async function isMainnetRequest() {
  const configured = readRuntimeEnv('SOLANA_NETWORK');
  if (configured === 'mainnet-beta' || configured === 'devnet') return configured === 'mainnet-beta';
  const requestHeaders = await headers();
  return [requestHeaders.get("x-forwarded-host"), requestHeaders.get("host")]
    .map(normalizeHost)
    .some((host) => MAINNET_HOSTS.includes(host));
}
