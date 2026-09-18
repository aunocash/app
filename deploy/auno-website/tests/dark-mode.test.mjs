import assert from "node:assert/strict";
import fs from "node:fs";

const styles = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

assert.match(styles, /color-scheme:light dark/);
assert.match(styles, /@media\s*\(prefers-color-scheme:\s*dark\)/);

const darkTheme = styles.slice(styles.lastIndexOf("@media (prefers-color-scheme: dark)"));
for (const token of [
  "--ink: #f5f7fa",
  "--muted: #a4acb8",
  "--line: #252b35",
  "--paper: #090b0f",
  "--orange-soft: #3d2315",
]) {
  assert.match(darkTheme, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

assert.match(styles, /scrollbar-width:\s*thin/);
assert.match(styles, /::-webkit-scrollbar\s*\{[^}]*width:\s*8px/s);
assert.match(styles, /::-webkit-scrollbar-thumb/);
assert.match(darkTheme, /border-inline:\s*0/);
assert.match(darkTheme, /\.doc-section pre\s*\{[^}]*background:\s*#0e1218[^}]*color:\s*#c7d0dc/s);
for (const selector of ["body", ".nav", ".panel", ".app-tabs", ".app-tabs a.active", ".mock-input", ".notice"]) {
  assert.match(darkTheme, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}
