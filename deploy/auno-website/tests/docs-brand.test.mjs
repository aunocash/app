import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const docsPage = readFileSync(new URL("../app/docs/page.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

assert.match(docsPage, /<img className="brand-logo docs-portal-logo" src="\/auno-logo\.png"/);
assert.doesNotMatch(docsPage, /next\/image|auno-tab-icon\.svg/);
assert.match(layout, /icon: "\/auno-logo\.png"/);
assert.match(layout, /shortcut: "\/auno-logo\.png"/);
assert.doesNotMatch(layout, /auno-tab-icon\.svg/);

console.log("PASS docs header and browser tab use the main navbar logo asset");
