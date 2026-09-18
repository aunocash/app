import assert from "node:assert/strict";
import fs from "node:fs";

const home = fs.readFileSync(new URL("../app/ui.tsx", import.meta.url), "utf8");
const paymentUi = fs.readFileSync(new URL("../app/payment-ui.tsx", import.meta.url), "utf8");
const developers = fs.readFileSync(new URL("../app/content.tsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

assert.match(home, /Public Beta · Solana Devnet/);
assert.match(home, /Test payment flows with SOL and USDC before mainnet release\./);
assert.doesNotMatch(home, /Test tokens only/);
assert.match(home, /Explore Split Payment/);
assert.match(home, /title: "Split Payments", description: "Calculate precise allocations before settlement\.", status: "DEVELOPER PREVIEW", href: "\/split"/);
assert.match(paymentUi, /label: "Split Payment"/);
assert.doesNotMatch(paymentUi, /Split Calculator/);
assert.match(paymentUi, /split-preview-badge[^>]*>.*?DEVNET/s);
assert.doesNotMatch(paymentUi, /split-preview-badge[^>]*>.*?PREVIEW ONLY/s);

for (const label of ["Available", "Preview", "Planned", "Public API & SDK", "Webhooks", "Escrow & Milestones", "Subscriptions"]) {
  assert.match(developers, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

assert.match(developers, /developer-capability-matrix/);
assert.match(styles, /\.brand-logo,\s*\.mini-brand img,\s*\.sf-hub-logo\s*\{\s*filter:/);
assert.match(styles, /\.developer-capability-matrix/);
