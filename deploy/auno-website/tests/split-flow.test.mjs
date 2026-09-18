import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import typescript from "typescript";

const require = createRequire(import.meta.url);
const Module = require("module");
const filename = fileURLToPath(new URL("../app/split-flow.tsx", import.meta.url));
const source = readFileSync(filename, "utf8");
const output = typescript.transpileModule(source, {
  compilerOptions: {
    jsx: typescript.JsxEmit.ReactJSX,
    module: typescript.ModuleKind.CommonJS,
    target: typescript.ScriptTarget.ES2022,
  },
}).outputText;
const compiled = new Module(filename);
compiled.filename = filename;
compiled.paths = Module._nodeModulePaths(fileURLToPath(new URL("../", import.meta.url)));
compiled._compile(output, filename);

const markup = renderToStaticMarkup(createElement(compiled.exports.SplitFlow));
const routeColors = Array.from(
  markup.matchAll(/<path d="M300 204[^"]+" fill="none" stroke="(#[a-f0-9]+)"/g),
  (match) => match[1],
);

assert.deepEqual(
  routeColors,
  ["#fd6c03", "#fd6c03", "#fd6c03"],
  "split branches must use the single orange product accent",
);

assert.match(markup, /ANIMATED PREVIEW/);
for (const recipient of [
  ["Olivia Bennett", "80"],
  ["Noah Williams", "15"],
  ["Ava Mitchell", "5"],
]) {
  assert.match(
    markup,
    new RegExp("<article class=\"sf-recipient[^>]*>[\\s\\S]*?" + recipient[0] + "[\\s\\S]*?>" + recipient[1] + "<"),
    "the " + recipient[0] + " destination must be rendered with its allocated amount",
  );
}

assert.equal((markup.match(/sf-outgoing-packet/g) || []).length, 3, "each destination must receive an animated route packet");

console.log("PASS split routing shows connected paths and exact destination cards");
