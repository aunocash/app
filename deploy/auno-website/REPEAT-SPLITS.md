# Repeat Split implementation

Status: implemented in source with database persistence and the existing transaction pipeline. Live wallet acceptance on Solana is still pending; this is not a claim that the full real-money acceptance flow has passed.

## User flow

1. Configure a normal Split Payment and continue to wallet and review.
2. Connect the wallet, enter a split name and optional note, then choose **Save as Repeat Split**. Saving requires a wallet message signature but transfers no funds. It is also available after successful settlement.
3. Open **Repeat Splits** and choose **Authorize & Load Repeat Splits**. The server returns only this wallet's templates on the configured network.
4. **Pay Again** opens the existing split review with the stored recipients, percentages, asset and default amount. **Back to edit** allows a different payment amount. Changed recipients or asset must be saved before payment.
5. **Pay & Split** authorizes a new payment intent and requests a new transaction signature through the existing wallet provider. Finalized verification creates the existing PAID history record and atomically updates usage statistics.
6. **Edit** opens the same split editor; continue to review and use **Save changes**. **Delete** requires an explicit confirmation and wallet authorization. Historical transactions are retained.

There are no schedules, automatic signatures, background withdrawals or custodial keys. Percentage allocation is supported, matching the existing split editor; fixed-amount allocation has not been added. The existing Mainnet limits and feature flags still apply.

## Database and deployment

Apply `drizzle/0004_repeat_splits.sql` to the same D1/SQLite database before using the new application build. The existing Docker entrypoint already applies new SQL migration files using persistent markers. Keep the database volume and existing environment configuration. Do not recreate the database.

- `repeat_splits`: owner and network, name, note, asset, default amount, allocation type, recipient JSON, revision, timestamps, finalized execution count and soft-deletion timestamp.
- `repeat_split_authorizations`: one-time mutation nonces and expiration times. No wallet secrets or signed transactions are stored here.
- `payments.repeat_split_id` and `payments.repeat_split_name`: immutable source metadata for the existing history.
- `repeat_split_finalized` trigger: updates last-used time and count in the same database operation that first marks a matching owner's payment PAID. Pending, failed and repeated verification updates do not increment it. Last-used time uses the latest finalized block timestamp, even if confirmations arrive out of order.

Template deletion hides the configuration; it does not cancel already-created payment intents or erase history. Usage updates do not change the configuration revision. A second tab editing a stale revision receives a conflict and must reload.

## Routes and components

- `/dashboard/repeat-splits`: `RepeatSplitsDashboard` displays signed wallet-scoped data, recipient details, Pay Again, Edit and confirmed Delete.
- `POST /api/repeat-splits`: signed `list`, `get`, `create`, `update`, and `delete` actions. The signature binds action, owner, origin, timestamp, nonce, target revision and full configuration.
- Existing `/api/payments` accepts signed template metadata after checking owner, network, current revision and recipient/asset consistency.
- `SplitPaymentForm` is reused for editing, saving, review and payment. No second transaction engine was introduced.
- Existing prepare, submissions, verify, scheduled verifier, explorer links, status/error handling and Payment History remain in use.

## Source files

New: `lib/payments/repeat-splits.ts`, `lib/payments/repeat-splits-client.ts`, `app/api/repeat-splits/route.ts`, `app/dashboard/repeat-splits/page.tsx`, `app/dashboard/repeat-splits/repeat-splits-dashboard.tsx`, `drizzle/0004_repeat_splits.sql`, `tests/repeat-splits.test.mjs`.

Updated: `lib/payments/server.ts`, `lib/payments/model.ts`, `db/schema.ts`, `drizzle/meta/_journal.json`, `app/payment-ui.tsx`, `app/globals.css`, `tests/payment.test.mjs`, `tests/repeat-payment.test.mjs`, `package.json`.

## Security and validation

Every request uses the existing same-origin protection and Ed25519 wallet signature validation. Read signatures expire after five minutes; mutations additionally consume a unique nonce to prevent replay. Queries enforce wallet ownership and network on the server. Stale edits/deletes are rejected using revision checks. Payment preparation restricts a template-linked intent to its owner wallet; transaction signature and instruction verification remain mandatory.

Recipient validation uses the existing on-curve address, unique recipient, 2–5 recipients, exact 10,000 basis points and integer base-unit allocation rules. Payment limits, insufficient funds, wallet rejection, RPC failures and transaction expiry continue through the current payment pipeline. Database failure never produces a saved-success or payment-success response. Private keys and seed phrases are never requested or stored.

## Validation and remaining acceptance

- Type checking and the production build pass.
- The full existing test suite plus the new Repeat Split suite pass.
- Focused lint on changed feature code passes without errors. Full repository lint was run and reports 11 existing errors in Invoice components and the earlier `RepeatPaymentLoader`, plus existing warnings. These unrelated pages were not redesigned or broadly refactored.
- New integration tests reopen an on-disk SQLite database to check persistence; verify signed CRUD, nonce replay, wrong origin, expired/forged authorization, other-wallet and other-network access, invalid configurations, stale revisions, immutable prior history and deletion.
- Tests run real production prepare, signed submission and verification functions with generated test keys and isolated RPC fixtures. They check pending/failed transactions, finalized SOL executions, repeated verification, edited configurations, usage statistics and USDC intent allocation. These are tests, not real Solana transfers.
- Browser checks cover the disconnected Repeat Splits page, the existing split review and save UI, and responsive layout. They cannot establish real wallet settlement.
- Actual local HTTP testing also passed signed create/read/list/update/delete against the running D1-backed API and verified that a different wallet's list was empty. The temporary LOCAL TEST template was deleted after the check; no transaction was created or sent. Browser checks at 390px, 768px and desktop size found no horizontal page overflow, blocked saving/payment without a wallet, and blocked review when percentages did not total 100%.

Remaining release gate: on an appropriately configured deployment, connect a real wallet, save and reload a split, pay it with SOL and USDC, approve each transaction, and check finalized Explorer evidence, separate history entries, last-used time and counts. Also reject a wallet prompt and exercise insufficient balances. The local preview has no dedicated Mainnet RPC configured. No public deployment or real-funds transaction was performed in this task.
