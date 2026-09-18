import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const layout = source("../app/layout.tsx");
const home = source("../app/ui.tsx");
const docs = source("../app/docs/page.tsx");
const styles = source("../app/globals.css");

assert.doesNotMatch(home, /ThemeToggle/);
assert.doesNotMatch(docs, /ThemeToggle/);
assert.doesNotMatch(layout, /localStorage|prefers-color-scheme/);
assert.match(layout, /className="dark" data-theme="dark"/);
assert.equal(existsSync(new URL("../app/theme-toggle.tsx", import.meta.url)), false);
assert.equal(existsSync(new URL("../app/theme.ts", import.meta.url)), false);
assert.doesNotMatch(styles, /AUNO themes: orange is the only accent/);
assert.doesNotMatch(styles, /prefers-color-scheme: dark/);
assert.match(styles, /@media all/);
assert.match(styles, /Graphite dashboard surfaces/);
assert.match(styles, /\.page-shell \.app-tabs\s*\{[^}]*background: #0f1114/);
assert.match(styles, /\.page-shell \.panel,[\s\S]*?background: #121417/);
assert.match(styles, /Charcoal palette normalization: orange is the only active product accent/);
assert.match(styles, /\.roadmap-status-developer-preview,[\s\S]*?background: #21170f/);

console.log("PASS strict dark theme has no visible toggle or system preference listener");
