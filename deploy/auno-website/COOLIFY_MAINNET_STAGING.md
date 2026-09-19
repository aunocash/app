# Temporary Coolify Mainnet Beta staging

This is a temporary, isolated deployment for `https://mainnet.auno.cash` while `auno.cash` remains outside Cloudflare. It is not approved for real Mainnet settlement: the Compose file and entrypoint both enforce `AUNO_MAINNET_ENABLED=false`.

## Create a separate Coolify resource

- Repository: `https://github.com/aunocash/app.git`
- Branch: `main`
- Base Directory: `/deploy/auno-website`
- Docker Compose Location: `/compose.mainnet-staging.yaml`
- Service domain: `https://mainnet.auno.cash`
- Service: `web`
- Internal port: `3000`
- Path: blank
- Replicas: `1`

Do not reuse the Devnet resource, its `auno-website-d1` volume, or its RPC credentials. Do not expose a host port or attach a domain to the `verifier` service.

## Coolify environment variables

Set these as service secrets/environment values:

``TICK@@env
SOLANA_RPC_URL=https://your-dedicated-authenticated-mainnet-rpc.example
AUNO_ALLOWED_MERCHANTS=<comma-separated approved merchant wallets>
AUNO_VERIFIER_TOKEN=<random value of at least 32 characters>
``TICK@@

The Compose deployment fixes these values and refuses overrides:

``TICK@@env
SOLANA_NETWORK=mainnet-beta
AUNO_PUBLIC_ORIGIN=https://mainnet.auno.cash
AUNO_MAINNET_ENABLED=false
AUNO_MAX_SOL_LAMPORTS=100000000
AUNO_VERIFIER_BATCH_SIZE=25
``TICK@@

## DNS

At the current DNS provider, add a record for `mainnet.auno.cash` that targets the Coolify server. Leave the existing `auno.cash` record unchanged.

## Before deployment

1. Configure backups for the separate `auno-mainnet-staging-d1` volume.
2. Deploy, then check `https://mainnet.auno.cash/api/health`.
3. Confirm the response reports `mainnet-beta`.
4. Confirm any attempt to create, prepare, or submit a payment returns the settlement-disabled response.
5. Do not change the container, Compose file, or environment to enable settlement. Migrate to the managed Cloudflare Worker and D1 deployment before accepting real Mainnet payments.
