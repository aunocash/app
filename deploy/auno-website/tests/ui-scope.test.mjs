import assert from "node:assert/strict";
import fs from "node:fs";

const splitFlow = fs.readFileSync(new URL("../app/split-flow.tsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

assert.doesNotMatch(splitFlow, /useState|useEffect|replay|paused|Play|Replay|Pause|sf-controls/i);
assert.doesNotMatch(styles, /border-(left|right)|border-(inline-start|inline-end)|sf-controls|data-stopped/i);
