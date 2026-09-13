# AUNO devnet developer preview

English product website and payment application built from AUNO Full Product Master Prompt v1.

## Architecture

React and TypeScript on Vinext (Next-compatible routing), Cloudflare Workers request handlers, D1 persistence, Wallet Standard message/transaction signing, @solana/web3.js and SPL Token transfers. Mainnet is hard-disabled. No recovery material is requested or persisted.

## Development

Use Node 24 and npm. Run `npm ci`, `npm run db:generate` only for a schema change, and `npm run dev`. The default dev URL is http://localhost:5173. Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` before publishing. Production output is dist/server/index.js and dist/client.

Copy .env.example into a local ignored environment file supported by your Worker runtime; configure SOLANA_NETWORK=devnet and a dedicated SOLANA_RPC_URL on the server. Never prefix private RPC credentials with NEXT_PUBLIC. The public Solana endpoint was reachable from Node but rejected the local Worker provider with HTTP 403. A working server RPC is required for payment preparation and verification. `/api/health` separates database and RPC availability.

## Database

`.openai/hosting.json` declares logical D1 binding DB. Schema lives in db/schema.ts; generated SQL and migration journal are in drizzle/. Apply migrations before serving payments. The Sites publishing flow applies packaged migrations. For local Wrangler, use a local config declaring DB with the same database ID as vite.config.ts and run `wrangler d1 execute DB --local --file drizzle/0000_lush_the_executioner.sql`. Do not run schema creation in request handlers. Keep applied migrations immutable; append migrations for changes.

payments stores immutable title, description, merchant wallet, asset, decimal display amount, integer amount, recipient allocation JSON, reference, expiration, status, signature, payer, timestamps, creation signature, and the active attempt lease. attempts stores the prepared message, unsigned serialized transaction, payer, block-height expiry, signature and status. Unique creation-key and transaction-signature indexes provide idempotency.

## Payment protocol

1. Merchant signs an origin-bound creation payload with a five-minute timestamp window. The server validates amounts, addresses, asset, expiry, and signature, then persists the intent.
2. Checkout loads only stored data and displays complete payment destinations.
3. The server locks one active attempt, gets a devnet blockhash, constructs native SOL or checked USDC transfer instructions, and adds memo `auno:<intent UUID>:<attempt UUID>`.
4. A Wallet Standard wallet signs the exact transaction. The server checks the complete message and signatures, persists the signature before RPC submission, and sends it without bypassing preflight.
5. Verification retrieves finalized transaction data. It checks successful execution, payer signature, time window, memo, exact prepared message, asset, amount, and destination. USDC also checks the Circle devnet mint, six decimals, associated token destination, and recorded token-account owner. Only then can PAID and a receipt be written.

For USDC, the payer must hold canonical devnet USDC in its ATA and enough SOL for fees and possible destination ATA rent. Asset reference: https://developers.circle.com/stablecoins/quickstart-transfer-10-usdc-on-solana . Devnet mint: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU.

## Verification evidence and limitations

Automated tests use an isolated in-memory SQLite database and controlled RPC fixtures. Their signatures are not real devnet evidence. Local HTTP tests exercise real local D1 creation, retrieval, idempotency, and invalid-signature rejection. Devnet faucet funding was attempted but returned an internal error; no real payment signature is available. No funded browser wallet was connected. SOL and USDC therefore remain Developer Preview, not WORKING. Split arithmetic is implemented; split transfers remain planned until standard-payment acceptance passes.

The separate original AUNO Whitepaper v1.0 was not provided. /whitepaper is an implementation-aligned draft derived from the master brief.

## Required manual acceptance

Use two test wallets. Create a small SOL request; open the stored link in a wallet-capable browser; sign and submit; verify finalized settlement; compare recipient balance; open the real Explorer receipt; repeat verification. Test wallet rejection, insufficient funds, bad recipient, expiry, stale blockhash, uncertain submission and refresh. Repeat with Circle devnet USDC, including a recipient without an ATA. Do not mark USDC working until this succeeds. Split settlement needs atomic multi-recipient construction and verification before activation.

## Production work

Dedicated RPC, successful wallet acceptance tests, external security review, database backup/recovery procedures, stronger public abuse protection, operational monitoring, authenticated developer tooling, cancellation/reconciliation policies, expiry/block-time edge cases, and mainnet activation review remain outstanding. Public SDK, webhooks, QR checkout, escrow, milestones, subscriptions, payouts and token launch are not implemented. Owner-private Site access restricts payment links to the owner until access is explicitly changed.
