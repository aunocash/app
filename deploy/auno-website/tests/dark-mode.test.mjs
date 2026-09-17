import assert from "node:assert/strict";
import fs from "node:fs";

const styles = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

assert.match(styles, /color-scheme:light dark/);
assert.match(styles, /@media\s*\(prefers-color-scheme:\s*dark\)/);

const darkTheme = styles.slice(styles.lastIndexOf("@media (prefers-color-scheme: dark)"));
for (const token of [
  "--ink: #f4f7fb",
  "--muted: #adbacb",
  "--line: #34445c",
  "--paper: #0f1726",
  "--orange-soft: #3a2416",
]) {
  assert.match(darkTheme, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

for (const selector of ["body", ".nav", ".panel", ".app-tabs", ".app-tabs a.active", ".mock-input", ".notice"]) {
  assert.match(darkTheme, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}
