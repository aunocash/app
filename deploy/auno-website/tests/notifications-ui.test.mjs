import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(file, import.meta.url), "utf8");
const packageJson = JSON.parse(read("../package.json"));
const layout = read("../app/layout.tsx");
const paymentUi = read("../app/payment-ui.tsx");
const productUi = read("../app/ui.tsx");
const content = read("../app/content.tsx");
const styles = read("../app/globals.css");
const routeError = read("../app/error.tsx");
const globalError = read("../app/global-error.tsx");

assert.ok(packageJson.dependencies["@web3icons/react"]);
assert.ok(packageJson.dependencies["react-icons"]);
assert.match(layout, /<Toaster\b/);
assert.match(paymentUi, /WalletIcon/);
assert.match(paymentUi, /variant="branded"/);
assert.match(paymentUi, /fallback=\{/);
assert.match(paymentUi, /className="wallet-option"/);
assert.match(styles, /\.wallet-options/);
assert.match(styles, /padding:12px 16px/);
assert.doesNotMatch(paymentUi, /role="alert"/);

for (const message of [
  "No compatible wallet detected",
  "connected.",
  "Wallet disconnected.",
  "Connect your merchant wallet first.",
  "Payment link created.",
  "Payment link copied.",
  "Preparing your Devnet transaction",
  "Payment submitted.",
  "Payment verified.",
  "Authorizing payment history",
  "loaded.",
]) {
  assert.match(paymentUi, new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

assert.match(paymentUi, /toast\.error\(error/);
assert.match(routeError, /toast\.error/);
assert.match(globalError, /toast\.error/);
assert.doesNotMatch(routeError, /error\.message/);
assert.doesNotMatch(globalError, /error\.message/);

for (const source of [productUi, paymentUi, content]) {
  assert.match(source, /react-icons\/(fi|si)/);
  assert.doesNotMatch(source, /[↗→↓≋◇⌘⌄▣⑂☷↻↳×]/);
}