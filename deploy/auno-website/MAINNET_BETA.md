# Mainnet Beta Operations

Mainnet Beta is restricted to standard SOL payment links at `https://mainnet.auno.cash`. It is not public, does not support USDC or split settlement, and has a hard maximum of `0.1 SOL` per payment.

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
AUNO_ALLOWED_MERCHANTS=<comma-separated approved merchant wallets>
AUNO_MAX_SOL_LAMPORTS=100000000
AUNO_VERIFIER_BATCH_SIZE=25
```

`AUNO_MAINNET_ENABLED` is the settlement kill switch. When false, creation, preparation, and submission stop; payment and receipt reads continue. Set it to `true` only after the gates below are complete.

## Deployment gates

- Confirm `/api/health` returns the Mainnet Beta network and healthy D1/RPC states.
- Configure Cloudflare WAF/rate limiting for `POST /api/payments`, `POST /api/payments/*/prepare`, and `POST /api/payments/*/submissions`.
- Configure alerts for Worker failures, `/api/health` failures, RPC errors, verifier failures, and a growing submitted/confirming attempt count.
- Test D1 backup and restore before enabling settlement.
- Complete an independent security review with no unresolved Critical or High findings.

## Controlled activation

1. Keep `AUNO_MAINNET_ENABLED=false` while validating DNS, health, logs, alerting, D1 recovery, and the verifier Worker.
2. Add one approved merchant wallet and enable settlement.
3. Complete and verify `0.001`, `0.01`, and `0.1 SOL` transactions with Explorer receipts and recipient balance checks.
4. Disable the kill switch immediately for any unexpected RPC, verification, or wallet-signing behavior. Do not delete records during incident response.

## Temporary Coolify staging

Before `auno.cash` DNS is moved to Cloudflare, an isolated Coolify staging deployment may be used for DNS, UI, RPC, health-check, backup, and verifier testing only. It cannot accept payments: both the Compose file and container entrypoint enforce the settlement kill switch.

Use [COOLIFY_MAINNET_STAGING.md](./COOLIFY_MAINNET_STAGING.md). It has a separate volume and credentials from Devnet. Migrate to the managed Cloudflare Worker and D1 deployment before enabling Mainnet settlement.
