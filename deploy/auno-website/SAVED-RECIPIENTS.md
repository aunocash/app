# Saved Recipients

Saved Recipients adds private wallet-owned contacts to the existing AUNO application. It uses the current D1/SQLite backend and wallet message-signature authentication. No new backend, dependency, wallet provider, network configuration or transaction engine is introduced.

## Access and use

- Open **Saved Recipients** in the dashboard (`/dashboard/recipients`). Connect your wallet and choose **Authorize & Load Recipients**.
- Add a name, destination wallet and optional note. Search names without case sensitivity; address matching preserves case. Inspect and copy the full address, edit, or confirm deletion.
- In **Split Payment**, connect the payer wallet and choose **Choose saved recipient** beside any row. The picker supports search and adding a contact in a dialog without leaving the payment draft. Manual entry remains available.
- **Repeat Splits** uses the same editor and picker. Choose **Back to edit** from a repeat's review to select a different destination.
- Payment Link creation and Invoice recipient fields define incoming request/merchant settlement destinations, rather than an outgoing payee selection. They are intentionally not connected to the contact picker. Existing public checkout destinations remain fixed.

The picker copies an address snapshot. It displays the contact name privately in the editor/review, and uses a generic public recipient label. Contact names, notes and IDs are not copied into payment records, public checkout responses, on-chain memos or analytics logs. Public recipient labels that users explicitly type in the existing split editor remain public.

## Address support

Validation uses Solana `PublicKey`, never lowercases addresses, and distinguishes parseable format from payment-engine support. The current engine requires on-curve destination wallets and derives the USDC associated token account itself. A parseable off-curve address receives a specific unsupported-destination message; it is not described as a malformed Solana address. Users must enter a wallet address, not a token account. Parsing is not verification of a recipient's identity or ownership, and contacts receive no verified badge.

Name length is 1–80 after trimming; notes are optional and limited to 200 characters. A database unique index prevents duplicate active addresses for an owner, including racing requests. The same address can be saved independently by a different owner. Up to 500 contacts per wallet are supported.

## Authentication and privacy

`POST /api/saved-recipients` supports signed `list`, `get`, `create`, `update`, and `delete` actions. A connected public key is not accepted as proof of ownership: the server verifies the Ed25519 signature over the action, owner, current network, request origin, timestamp, target and full input. Signatures expire after five minutes; mutations consume unique nonces. SQL scopes every read/write by the verified owner. Revisions reject stale changes, and address changes require explicit confirmation.

Contacts are stored on the backend, not in browser local storage. Wallet-scoped components remount on switch/disconnect and invalidate pending requests on unmount. Wallet Standard account-change events clear the session immediately. `assertActive()` is also checked before/after signing and before accepting responses. Private contact labels disappear when the owner disconnects. Cross-device operation has not been independently tested; no sync claim is made.

## Immutable split snapshots

Repeat Split recipient JSON now optionally includes `contactId` alongside the existing fixed wallet address, public label and basis-point allocation. Contact names and notes are not stored in this JSON. Server-side checks ensure referenced contacts belong to the template owner.

Loading an authenticated split returns private contact-status information. If a contact was edited, the split continues to display and use its saved address. **Review address update** shows old/new addresses and requires **Use new address in draft**, followed by **Save changes** and the normal payment review. **Check saved recipient addresses** refreshes the comparison without changing any destination. Contact edits during an already-open review do not silently refresh or mutate the prepared transaction.

Deleted contacts produce a notice while the saved split remains usable. Previously saved splits without contact IDs have no contact-change detection until an owner explicitly selects a contact and saves the template. Every repeated transaction still needs fresh wallet authorization and normal finalized verification.

## Migration and source

Apply `drizzle/0005_saved_recipients.sql` after migrations 0000–0004 and before starting the updated build. The existing Docker entrypoint applies new SQL files with its migration markers. Preserve the existing database volume. No new environment variables are required.

- `saved_recipients`: owner, name, exact address, note, revision, timestamps and soft-delete timestamp; partial unique index on active owner/address.
- `saved_recipient_authorizations`: expiring one-time mutation nonces.
- Repeat Split references use existing JSON storage; no live contact lookup is used for payment destinations.

New files: `app/dashboard/recipients/page.tsx`, `app/saved-recipients-ui.tsx`, `app/api/saved-recipients/route.ts`, `lib/payments/saved-recipients.ts`, `lib/payments/saved-recipients-client.ts`, `drizzle/0005_saved_recipients.sql`, `tests/saved-recipients.test.mjs`.

Updated: `app/payment-ui.tsx`, `app/globals.css`, `lib/payments/server.ts`, `lib/payments/repeat-splits.ts`, `lib/payments/wallet.ts`, `db/schema.ts`, `drizzle/meta/_journal.json`, `package.json`, and the existing payment/repeat test harnesses.

## Checks and limitations

- Type checking, production build and the complete test suite pass. The payment regression suite now stubs its remaining block-height RPC request so transaction tests run offline with no real funds.
- Focused lint on feature code passes. Full repository lint was run and still reports 11 existing errors in Invoice components and the earlier repeat loader. These unrelated components were not broadly refactored.
- Tests cover persistent database reload, forged/expired/wrong-origin signatures, cross-owner access, duplicate contacts, validation, case-sensitive address matching, stale requests after wallet switch/disconnect, private metadata exclusion, immutable saved split/payment/history snapshots, explicit address updates and deletion preservation.
- Real production preparation logic is exercised with controlled RPC responses. Decoded SOL instructions and USDC ATA owner accounts match the selected address, including after explicit template updates. No Mainnet transaction is broadcast.
- Actual local HTTP checks passed signed CRUD, duplicate prevention, confirmed address changes and owner isolation against the running D1-backed API. Temporary local test contacts were deleted.
- Browser verification covers dashboard access, disconnected-wallet controls, the split picker placement, existing manual entry/review and mobile/desktop layout. Wallet-connected dialog flows and cross-device access have not been exercised with a real browser wallet in this session.

No public deployment, real-funds payment, identity verification, or automatic recurring debit was performed or added.
