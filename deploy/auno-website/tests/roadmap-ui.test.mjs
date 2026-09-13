import assert from "node:assert/strict";
import fs from "node:fs";

const roadmap = fs.readFileSync(new URL("../app/roadmap-view.tsx", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/roadmap/page.tsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

assert.match(page, /roadmap-view/);
for (const title of [
  "Core Payments",
  "Split Payments",
  "Escrow & Milestones",
  "Payment Streaming",
  "Conditional Payments",
  "Subscriptions",
  "AUNO Invoice",
  "Programmable Revenue Split",
  "Developer Infrastructure",
  "Payment Automation Engine",
]) assert.match(roadmap, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

for (const status of ["Developer Preview", "In Development", "Planned", "Future", "Long-Term Direction"]) {
  assert.match(roadmap, new RegExp(status.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

assert.match(roadmap, /No promised launch dates/);
assert.match(roadmap, /function StatusBadge/);
assert.match(roadmap, /roadmap-rail/);
assert.match(styles, /roadmap-node-body/);
assert.match(styles, /prefers-reduced-motion/);
assert.doesNotMatch(roadmap, /Q[1-4]\s+20\d\d|Launching next month|Available 20\d\d/);