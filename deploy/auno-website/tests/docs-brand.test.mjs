import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const docsPage = readFileSync(new URL("../app/docs/page.tsx", import.meta.url), "utf8");

assert.match(docsPage, /src="\/auno-logo\.png"/);
assert.doesNotMatch(docsPage, /auno-tab-icon\.svg/);

console.log("PASS docs header uses the direct AUNO logo asset");
