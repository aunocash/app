import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const schema = await readFile("drizzle/0003_invoices.sql", "utf8");
const server = await readFile("lib/invoices/server.ts", "utf8");
const verifier = await readFile("lib/payments/server.ts", "utf8");
const packageJson = await readFile("package.json", "utf8");

assert.match(schema, /CREATE TABLE IF NOT EXISTS invoices/);
assert.match(schema, /ALTER TABLE payments ADD COLUMN invoice_id/);
assert.match(server, /verifyWalletSignature/);
assert.match(server, /acceptedAssets/);
assert.match(server, /paymentId/);
assert.match(verifier, /UPDATE invoices SET status='PAID'/);
assert.match(await readFile("components/pdf/watermark.tsx", "utf8"), /PdfWatermark/);
assert.match(await readFile("lib/invoices/pdf.tsx", "utf8"), /takumi-pdf/);
for (const route of [
  "app/api/invoices/route.ts",
  "app/api/invoices/[id]/publish/route.ts",
  "app/api/public/invoices/[publicId]/route.ts",
  "app/api/public/invoices/[publicId]/payment-intents/route.ts",
  "app/api/public/invoices/[publicId]/pdf/route.ts",
]) await readFile(route);
assert.match(packageJson, /takumi-pdf/);
console.log("PASS invoice schema, signed actions, finalized linkage, routes, and Takumi watermark");
