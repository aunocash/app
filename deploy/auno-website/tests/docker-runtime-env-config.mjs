import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const entrypoint = await readFile(new URL("../docker-entrypoint.sh", import.meta.url), "utf8");
const initialMigration = await readFile(new URL("../drizzle/0000_lush_the_executioner.sql", import.meta.url), "utf8");

assert.match(
  entrypoint,
  /\/app\/dist\/server\/\.dev\.vars/,
  "Wrangler must receive runtime variables next to dist/server/wrangler.json.",
);
assert.match(
  entrypoint,
  /for migration in drizzle\/\*\.sql; do[\s\S]*?exec node \.\/scripts\/coolify-runtime\.mjs/,
  "The container must start the split runtime instead of exposing Wrangler directly.",
);
assert.doesNotMatch(
  initialMigration,
  /\bCREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX)\s+`(?!IF\s+NOT\s+EXISTS)/i,
  "The initial migration must be safe to replay when a persistent D1 volume outlives its marker.",
);
