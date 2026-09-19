# Mainnet Beta Operations

Mainnet Beta provides public standard SOL payment links at `https://mainnet.auno.cash`. USDC is not supported. Split settlement (2–5 SOL recipients per link) is available for any Mainnet merchant when the `AUNO_MAINNET_SPLITS_ENABLED` flag is on. Each payment link is still capped at `0.1 SOL`.

## Separate deployment

1. Create a new managed Cloudflare D1 database named `auno-mainnet-beta`. Do not reuse the Devnet/Coolify local D1 volume.
2. Copy `wrangler.mainnet.example.jsonc` to an ignored `wrangler.mainnet.jsonc` and replace the D1 database ID.
3. Build the application, then deploy it with the Mainnet configuration. Bind `mainnet.auno.cash` only to this Worker.
4. Set `SOLANA_RPC_URL` and `AUNO_VERIFIER_TOKEN` as Worker secrets. Use a dedicated authenticated Mainnet RPC; never commit either value.
5. Deploy `wrangler.mainnet-verifier.example.jsonc` as a second Worker. Give it the same verifier token and keep its two-minute Cron Trigger enabled.

## Required Worker variables

```env
SOLANA_NETWORK=mainnet-beta
AUNO_PUBLIC_ORIGIN=https://mainnet.auno.cash
AUNO_MAINNET_ENABLED=false
AUNO_MAINNET_SPLITS_ENABLED=false
AUNO_MAX_SOL_LAMPORTS=100000000
AUNO_VERIFIER_BATCH_SIZE=25
```

`AUNO_MAINNET_ENABLED` is the master settlement kill switch. When false, creation, preparation, and submission stop for every Mainnet payment; payment and receipt reads continue. Set it to `true` only after the deployment gates below are complete.

`AUNO_MAINNET_SPLITS_ENABLED` gates 2–5 recipient SOL split settlement independently. It only takes effect when `AUNO_MAINNET_ENABLED=true`. Single-recipient payment links are not affected by this flag. Toggle it back to `false` at any time to immediately stop new split creation, preparation, submission, and verification without touching standard payment links.

## Deployment gates

- Confirm `/api/health` returns the Mainnet Beta network and healthy D1/RPC states.
- Configure Cloudflare WAF/rate limiting for `POST /api/payments`, `POST /api/payments/*/prepare`, and `POST /api/payments/*/submissions`.
- Configure alerts for Worker failures, `/api/health` failures, RPC errors, verifier failures, and a growing submitted/confirming attempt count.
- Test D1 backup and restore before enabling settlement.
- Complete an independent security review with no unresolved Critical or High findings.

## Controlled activation

1. Keep `AUNO_MAINNET_ENABLED=false` and `AUNO_MAINNET_SPLITS_ENABLED=false` while validating DNS, health, logs, alerting, D1 recovery, and the verifier Worker.
2. Set `AUNO_MAINNET_ENABLED=true` to allow public signed payment-link creation.
3. Complete and verify `0.001`, `0.01`, and `0.1 SOL` single-recipient transactions with Explorer receipts and recipient balance checks.
4. Set `AUNO_MAINNET_SPLITS_ENABLED=true` to activate 2–5 recipient SOL splits for every Mainnet merchant. Verify `/api/capabilities` reports `mainnetSplitsEnabled: true` and complete a 2-recipient and a 3-recipient split of `0.001 SOL` before announcing availability.
5. Disable the relevant flag immediately for any unexpected RPC, verification, or wallet-signing behavior. Split-only incidents: toggle `AUNO_MAINNET_SPLITS_ENABLED` off. Any deeper incident: toggle `AUNO_MAINNET_ENABLED` off. Do not delete records during incident response.

## Temporary Coolify staging

Before `auno.cash` DNS is moved to Cloudflare, an isolated Coolify staging deployment may be used for DNS, UI, RPC, health-check, backup, and verifier testing only. It cannot accept payments: both the Compose file and container entrypoint enforce the settlement kill switch.

Use [COOLIFY_MAINNET_STAGING.md](./COOLIFY_MAINNET_STAGING.md). It has a separate volume and credentials from Devnet. Migrate to the managed Cloudflare Worker and D1 deployment before enabling Mainnet settlement.
