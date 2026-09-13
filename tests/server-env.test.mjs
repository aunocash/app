import assert from "node:assert/strict";
import test from "node:test";

import { loadServerEnv } from "../lib/server/env.ts";

const base = {
  NODE_ENV: "test",
  APP_ORIGIN: "http://localhost:3000",
  DATABASE_URL: "postgres://auno:auno@db:5432/auno",
  SOLANA_NETWORK: "devnet",
  SOLANA_RPC_URL: "https://api.devnet.solana.com",
};

test("loads a safe devnet configuration with operational defaults", () => {
  const env = loadServerEnv(base);
  assert.equal(env.SOLANA_NETWORK, "devnet");
  assert.equal(env.USDC_MINT, "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
  assert.equal(env.WORKER_POLL_MS, 2000);
  assert.equal(env.SESSION_TTL_SECONDS, 604800);
});

test("treats an empty optional mint from Compose as unset", () => {
  const env = loadServerEnv({ ...base, USDC_MINT: "" });
  assert.equal(env.USDC_MINT, "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
});

test("blocks mainnet unless it is explicitly enabled with a configured mint", () => {
  assert.throws(() => loadServerEnv({ ...base, SOLANA_NETWORK: "mainnet-beta" }));
  assert.throws(() => loadServerEnv({ ...base, SOLANA_NETWORK: "mainnet-beta", ENABLE_MAINNET: "true" }));
  assert.equal(
    loadServerEnv({
      ...base,
      SOLANA_NETWORK: "mainnet-beta",
      ENABLE_MAINNET: "true",
      USDC_MINT: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    }).SOLANA_NETWORK,
    "mainnet-beta",
  );
});

test("rejects secrets accidentally exposed through NEXT_PUBLIC variables", () => {
  assert.throws(() => loadServerEnv({ ...base, NEXT_PUBLIC_DATABASE_URL: base.DATABASE_URL }));
  assert.throws(() => loadServerEnv({ ...base, NEXT_PUBLIC_SOLANA_RPC_URL: base.SOLANA_RPC_URL }));
});
