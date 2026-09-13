import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const entrypoint = await readFile(new URL("../docker-entrypoint.sh", import.meta.url), "utf8");

assert.match(
  entrypoint,
  /\/app\/dist\/server\/\.dev\.vars/,
  "Wrangler must receive runtime variables next to dist/server/wrangler.json.",
);
