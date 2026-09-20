# Record & Repeat Payment

This update belongs to `auno/deploy/auno-website`, the mainnet-capable deployment inside the supplied archive. The outer `auno/app` is a different application and was not changed.

## Behavior

- Payment History includes requests created by the authorized wallet plus its finalized outgoing AUNO payments, on the current deployment network. It uses existing persistent payment records; nothing is inferred from browser storage.
- Users authorize history with the existing wallet-signed message. They can search title, token, recipient or payment ID, filter status, and choose Sent by me / Created by me.
- Recipient details show labels, full addresses, percentages and exact amounts. Verified records link to the transaction in Solana Explorer.
- Repeat Payment is available in history and confirmed checkout/receipt views. Standard payments open `/dashboard/create?repeat=ID`; splits open `/split?repeat=ID`.
- The read-only `GET /api/payments/:id/repeat` accepts only finalized payments on this deployment's network and respects settlement feature switches. It exposes no additional private data beyond the existing public checkout.
- The form copies only title, description, asset, amount and recipients. Old signatures, attempt secrets, payment status, payer, expiration and invoice reference are not reused. The user can edit terms and must authorize a new intent and transaction through the existing wallet flow.
- Split submission is disabled once a settlement result exists. Use the explicit Repeat action after finalization to start a fresh payment.

## Deployment

Apply the updated source in `deploy/auno-website` to the existing deployment and rebuild using its normal Coolify/Docker flow. Keep the existing database, volumes, RPC, origin and feature-switch settings. No new database migration or dependency is required by this feature. The existing verification worker must remain active so submitted payments become finalized records.

This package is source code, not a deployment confirmation. The supplied Sites project ID could not be accessed from this session; the live `auno.cash` deployment has not been modified.

History is limited to the latest 200 matching records, consistent with the existing history limit. It is AUNO payment history, not the wallet's entire blockchain transaction history. Incoming transfers to a recipient are not added unless that wallet also created the request or paid it. Existing finalized AUNO payments are included automatically when their stored payer matches the connected wallet.

## Validation

Network labels and wallet signing now share the server-configured `SOLANA_NETWORK` through the root layout and client context. Mainnet deployments should set `SOLANA_NETWORK=mainnet-beta`; localhost previews can use the same setting. The network-context test covers configuration overrides and both AUNO Mainnet hostnames. Browser checks found no Devnet text on the Mainnet home, documentation, developers, roadmap, whitepaper, history, invoices, create-payment and split pages. Local production preview logs include a Vinext RSC prefetch error; checked pages and repeat-form loading still rendered successfully.

- `npm test` includes the new `tests/repeat-payment.test.mjs` suite and all existing suites.
- `npm run typecheck` checks the complete deployment source.
- `npm run build` creates the production output.
- New tests use isolated in-memory SQLite and generated test keys. They cover SOL/USDC, standard/split allocations, fresh payment IDs and status, immutable originals, signed history access, network isolation, disabled settlement and exclusion of unresolved outgoing payments. These are controlled fixtures, not real transfers.
- Browser checks use explicitly labeled LOCAL TEST records in a disposable local database. No funds are transferred and no production database is touched.

Before public release, run a small wallet acceptance test on the existing staging deployment: settle a payment, authorize history with its payer wallet, open Repeat, edit the amount, approve the new transaction and confirm that both records have different IDs/signatures. Repeat with split recipients and USDC, then check wallet rejection and insufficient funds. Live wallet settlement of this update has not been tested here.
