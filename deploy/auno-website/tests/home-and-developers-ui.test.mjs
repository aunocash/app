import assert from "node:assert/strict";
import fs from "node:fs";

const home = fs.readFileSync(new URL("../app/ui.tsx", import.meta.url), "utf8");
const paymentUi = fs.readFileSync(new URL("../app/payment-ui.tsx", import.meta.url), "utf8");
const developers = fs.readFileSync(new URL("../app/content.tsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const mainnetSite = fs.readFileSync(new URL("../app/mainnet-site.tsx", import.meta.url), "utf8");
const siteNetwork = fs.readFileSync(new URL("../lib/site-network.ts", import.meta.url), "utf8");
const homePage = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const splitPage = fs.readFileSync(new URL("../app/split/page.tsx", import.meta.url), "utf8");

assert.match(home, /Public Beta · Solana Devnet/);
assert.match(home, /Test payment flows with SOL and USDC before mainnet release\./);
assert.doesNotMatch(home, /Test tokens only/);
assert.match(home, /Explore Split Payment/);
assert.match(home, /52YLW3zzqzViDnZ421Vu17YyTv8TyMfxjUqZ8AYqpump/);
assert.match(home, /Contract address copied/);
assert.match(home, /Copy AUNO contract address/);
assert.match(home, /className="nav-inner"/);
assert.match(home, /title: "Split Payments", description: "Calculate precise allocations before settlement\.", status: "DEVELOPER PREVIEW", href: "\/split"/);
assert.match(paymentUi, /label: "Split Payment"/);
assert.doesNotMatch(paymentUi, /Split Calculator/);
assert.match(paymentUi, /split-preview-badge[^>]*>.*?DEVNET/s);
assert.doesNotMatch(paymentUi, /split-preview-badge[^>]*>.*?PREVIEW ONLY/s);
assert.match(paymentUi, /assertPreparedTransaction/);
assert.match(paymentUi, /wallet: ""/);
assert.match(paymentUi, /View verified transaction/);

for (const label of ["Available", "Preview", "Planned", "Public API & SDK", "Webhooks", "Escrow & Milestones", "Subscriptions"]) {
  assert.match(developers, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

assert.match(developers, /developer-capability-matrix/);
assert.match(styles, /\.brand-logo,\s*\.mini-brand img,\s*\.sf-hub-logo\s*\{\s*filter:/);
assert.match(styles, /\.developer-capability-matrix/);
assert.match(styles, /Checkout uses a quiet internal rhythm, without full-width section rails/);
assert.match(styles, /\.checkout-band\s*\{\s*border-block: 0/);
assert.match(styles, /\.contract-address\s*\{/);
assert.match(styles, /Full-width navigation shell with a centered content rail/);
assert.match(styles, /\.nav-inner\s*\{[\s\S]*?max-width: 1440px/);
assert.match(mainnetSite, /Mainnet Beta staging/);
assert.match(mainnetSite, /USDC and split payments are unavailable in this beta/);
assert.doesNotMatch(mainnetSite, /Try on Devnet|Solana Devnet/);
assert.match(siteNetwork, /mainnet\.auno\.cash/);
assert.match(homePage, /isMainnetRequest\(\).*?<MainnetHome/s);
assert.match(paymentUi, /AUNO Mainnet Payment/);
assert.match(paymentUi, /Mainnet Beta payment link/);
assert.match(paymentUi, /DevnetOnlyRibbon features="USDC and split payments"/);
assert.match(mainnetSite, /DevnetOnlyRibbon features="USDC and split payments"/);
assert.match(splitPage, /isMainnetRequest\(\).*?<MainnetInfoPage page="split"/s);
