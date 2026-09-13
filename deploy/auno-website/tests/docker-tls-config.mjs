import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dockerfile = await readFile(new URL("../Dockerfile", import.meta.url), "utf8");

assert.match(
  dockerfile,
  /apt-get install -y --no-install-recommends ca-certificates/,
  "The runtime image must install the Debian CA bundle for workerd TLS validation.",
);
assert.match(
  dockerfile,
  /NODE_EXTRA_CA_CERTS=\/etc\/ssl\/certs\/ca-certificates\.crt/,
  "The runtime must explicitly provide the CA bundle to workerd.",
);
