import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const docsPage = readFileSync(new URL("../app/docs/page.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

assert.match(docsPage, /<img className="brand-logo docs-portal-logo" src="\/auno-logo\.png"/);
assert.doesNotMatch(docsPage, /next\/image|auno-tab-icon\.svg/);
assert.match(layout, /icon: "\/auno-logo\.png"/);
assert.match(layout, /shortcut: "\/auno-logo\.png"/);
assert.doesNotMatch(layout, /auno-tab-icon\.svg/);
assert.match(styles, /Docs portal responsive shell/);
assert.match(styles, /@media \(max-width: 1280px\)[\s\S]*?\.docs-portal-header\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) minmax\(220px, 360px\)/);
assert.match(styles, /@media \(max-width: 980px\)[\s\S]*?\.docs-portal-sidebar\s*\{[\s\S]*?display: none/);
assert.match(styles, /@media \(max-width: 980px\)[\s\S]*?\.docs-portal\s*\{[\s\S]*?padding: 0 0 76px/);
assert.match(styles, /@media \(max-width: 980px\)[\s\S]*?\.docs-portal-content\s*\{[\s\S]*?padding: 28px 6% 0/);

console.log("PASS docs header and browser tab use the main navbar logo asset");
