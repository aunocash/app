# Mainnet Split Payment Release Plan

## Goal

Enable verified SOL split payments on `https://mainnet.auno.cash` without weakening the existing Mainnet payment controls.

The release must support one payer sending a single signed transaction to 2–5 recipient wallets. The payer must never be one of the recipients.

## Current State

- Mainnet standard SOL payments are enabled behind `AUNO_MAINNET_ENABLED=true`.
- Mainnet USDC payment links are intentionally unavailable.
- Devnet split settlement exists behind `AUNO_DEVNET_SPLITS_ENABLED=true` plus the verifier token.
- The transaction builder and verifier already handle multiple SOL recipients.
- Mainnet creation is explicitly blocked when the request includes `recipients`.
- The Mainnet navigation hides the Split Payment screen.

## Scope for First Mainnet Release

- SOL only.
- 2–5 recipients.
- One transaction containing every expected transfer and the AUNO payment memo.
- Existing payment amount cap of `0.1 SOL` per link remains in place.
- Existing Mainnet merchant allowlist, rate limits, D1 storage, verifier Worker, and settlement kill switch remain in place.
- USDC splits are out of scope for this release.

## Required Implementation

### 1. Add an explicit Mainnet split feature flag

Add `AUNO_MAINNET_SPLITS_ENABLED=false` as a separate flag from `AUNO_MAINNET_ENABLED`.

Rules:

- `AUNO_MAINNET_ENABLED` controls all Mainnet settlement.
- `AUNO_MAINNET_SPLITS_ENABLED` controls only Mainnet payments with 2–5 recipients.
- Both flags must be `true` before Mainnet split creation, preparation, submission, or verification can proceed.
- Keep the default `false` in every example configuration.

### 2. Keep server-side enforcement authoritative

Update `lib/payments/server.ts` so Mainnet split requests are accepted only when the new feature flag is enabled.

Server validation must continue to reject:

- Fewer than 2 or more than 5 recipients.
- Duplicate recipient wallets.
- Percentages that do not total 100%.
- Allocations producing a zero-value transfer.
- A payer address equal to any recipient address.
- Non-allowlisted Mainnet merchant creation requests.
- Amounts above the configured Mainnet cap.

The current `preparePayment()` payer/recipient check is already correct. Retain it and add a focused regression test.

### 3. Enable the Mainnet split UI only when the feature flag is active

Use an API-provided public capability value rather than trusting a browser-only environment check.

- Show Split Payment in Mainnet navigation only when the server reports that Mainnet splits are enabled.
- If disabled, keep the current Mainnet UI limited to standard SOL payment links.
- On checkout, prevent the pay action and show a toast when the connected payer wallet is also a recipient.
- Keep the server rejection even when the UI blocks it.

### 4. Preserve transaction and verifier guarantees

For each Mainnet split:

- Build one transaction with one SOL transfer per recipient and exactly one AUNO memo.
- Bind the prepared message hash and an expiring attempt token to one payer.
- Verify the finalized transaction has exactly the expected payer, recipient wallets, amounts, memo, and permitted program instructions.
- Mark the payment `PAID` only after finalized on-chain verification.
- Keep a verifier cron Worker active at two-minute intervals.
- Return a public receipt with the transaction signature and Explorer link after verification.

### 5. Add observability and abuse controls

Add structured events and alerts for:

- `mainnet_split_created`
- `mainnet_split_prepared`
- `mainnet_split_submitted`
- `mainnet_split_verified`
- `mainnet_split_rejected`
- split validation failures, including self-payment attempts

Review Cloudflare WAF and rate limits for creation, prepare, and submission endpoints before activation.

## Test Plan

### Unit and contract tests

- Mainnet split creation returns `422` when `AUNO_MAINNET_SPLITS_ENABLED=false`.
- Mainnet split creation succeeds with both flags enabled and an allowlisted merchant.
- Mainnet split creation rejects 1, 6, duplicate, and invalid-allocation recipients.
- Prepare rejects a payer matching any split recipient.
- A signed transaction with a missing recipient, wrong amount, altered memo, extra signer, or unexpected instruction is rejected.
- A valid 2-recipient and 5-recipient SOL transaction verifies to `PAID`.

### Integration tests on Devnet

- 2-recipient split: 0.001 SOL total.
- 3-recipient split with a rounding remainder.
- 5-recipient split: maximum supported recipient count.
- Self-payment attempt from a recipient wallet.
- Wallet rejection, expired blockhash, insufficient fee budget, duplicate submission, and verifier retry.

### Mainnet canary tests

Run only after all automated tests pass and security review is complete:

1. Enable the feature for one approved merchant wallet.
2. Create and settle a 2-recipient `0.001 SOL` split.
3. Confirm each recipient balance delta and Explorer instructions.
4. Create and settle a 3-recipient `0.01 SOL` split with non-even percentages.
5. Verify the public receipt, D1 record, and verifier event match the same signature.
6. Keep the feature limited to the canary merchant for at least 24 hours with no unresolved alert.

## Rollout

1. Implement and test behind `AUNO_MAINNET_SPLITS_ENABLED=false`.
2. Deploy the Worker and verifier with the flag still disabled.
3. Confirm health, D1, RPC, verifier cron, alerts, and rollback procedure.
4. Complete an independent security review with no unresolved Critical or High findings.
5. Enable the flag for the approved canary merchant configuration.
6. Complete the Mainnet canary tests.
7. Expand the merchant allowlist gradually.
8. Announce availability only after the monitoring window completes successfully.

## Rollback

- Set `AUNO_MAINNET_SPLITS_ENABLED=false` to immediately stop new Mainnet split attempts.
- Keep `AUNO_MAINNET_ENABLED=true` if standard payment links should remain available.
- Set `AUNO_MAINNET_ENABLED=false` only when all Mainnet settlement must stop.
- Do not delete payment or attempt records during an incident.
- Preserve transaction signatures, verifier logs, and D1 data for investigation.

## Deployment Configuration

Add the new variable to the ignored Mainnet Worker configuration and Cloudflare Worker variables:

```env
AUNO_MAINNET_ENABLED=true
AUNO_MAINNET_SPLITS_ENABLED=false
AUNO_MAX_SOL_LAMPORTS=100000000
```

Do not put RPC URLs, verifier tokens, or private keys in this document or in Git. Store them as Cloudflare Worker secrets.

## Definition of Done

- Mainnet split creation is gated by `AUNO_MAINNET_SPLITS_ENABLED`.
- Server and checkout both block payer-equals-recipient attempts.
- Valid 2–5 recipient SOL splits settle and verify on Mainnet.
- Invalid or altered transactions are rejected before a payment becomes `PAID`.
- Explorer receipts, D1 records, and verifier events agree on the same transaction signature.
- Rollback is tested and documented.
