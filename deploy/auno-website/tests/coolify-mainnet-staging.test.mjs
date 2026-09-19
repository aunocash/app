import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const entrypointUrl = new URL("../docker-entrypoint.sh", import.meta.url);
const verifierEntrypointUrl = new URL("../docker-mainnet-verifier.sh", import.meta.url);
const compose = await readFile(new URL("../compose.mainnet-staging.yaml", import.meta.url), "utf8");
const entrypoint = await readFile(entrypointUrl, "utf8");
const verifierEntrypoint = await readFile(verifierEntrypointUrl, "utf8");
const verifier = await readFile(new URL("../scripts/coolify-mainnet-verifier.mjs", import.meta.url), "utf8");

assert.match(compose, /SOLANA_NETWORK: mainnet-beta/);
assert.match(compose, /AUNO_MAINNET_ENABLED: "false"/);
assert.doesNotMatch(compose, /\\$\\{AUNO_MAINNET_ENABLED/);
assert.ok(compose.includes("auno-mainnet-staging-d1:/app/.wrangler/state"));
assert.ok(compose.includes("- /usr/local/bin/auno-mainnet-verifier"));
assert.match(entrypoint, /Coolify Mainnet staging cannot enable settlement/);
assert.match(entrypoint, /AUNO_COOLIFY_MAINNET_STAGING/);
assert.match(entrypoint, /AUNO_MAX_SOL_LAMPORTS:-100000000/);
assert.match(verifierEntrypoint, /AUNO_MAINNET_ENABLED:-false/);
assert.match(verifierEntrypoint, /exec node \.\/scripts\/coolify-mainnet-verifier\.mjs/);
assert.ok(verifier.includes("/api/internal/verify"));

console.log("PASS isolated Coolify Mainnet staging remains settlement-disabled");
