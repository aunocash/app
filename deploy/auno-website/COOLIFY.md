# Coolify deployment for the ZIP source

This directory is an isolated deployment of `AUNO-Website-Source.zip`. It does not use the root application's Postgres Compose file.

## Resource settings

- Repository: `https://github.com/aunocash/app.git`
- Branch: `main`
- Base Directory: `/deploy/auno-website`
- Docker Compose Location: `/compose.yaml`
- Service domain: `https://auno.cash`
- Service: `web`
- Internal port: `3000`
- Path: blank
- Replicas: `1`

Do not add a host port mapping. Coolify routes the domain to the service's internal port.

## Environment variables

Set these in the `web` service environment section:

```env
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://your-dedicated-devnet-rpc.example
AUNO_PUBLIC_ORIGIN=https://auno.cash
# Keep false until the complete SOL and USDC Devnet acceptance matrix passes.
AUNO_DEVNET_SPLITS_ENABLED=false
AUNO_VERIFIER_TOKEN=<at-least-32-random-server-only-characters>
AUNO_VERIFIER_BATCH_SIZE=25
AUNO_VERIFIER_POLL_MS=30000
```

Do not commit the RPC value if it contains credentials. The entrypoint writes these values to an ignored, runtime-only `.dev.vars` file.

## Internal runtime routing

Coolify connects only to port `3000`. The runtime forwards `/api` and `/api/*` to the Wrangler Worker on `127.0.0.1:8787`; all other requests, including pages and static assets, go to Vinext on `127.0.0.1:3001`. Do not create domains or expose ports for either internal service.
## Persistence and limitations

The Compose volume `auno-website-d1` stores Wrangler's local D1 state. Keep one replica and configure volume backups before using the preview with real users. This is a Devnet developer preview, not a production Cloudflare D1 deployment.

After deployment, check `https://auno.cash/api/health`. It should return HTTP 200 only when local D1 and the configured Solana Devnet RPC are available.

For the separately isolated, settlement-disabled Mainnet Beta staging resource, follow [COOLIFY_MAINNET_STAGING.md](./COOLIFY_MAINNET_STAGING.md). Do not change this Devnet Compose file to Mainnet.

## Public Devnet split release

`compose.yaml` now runs a separate `verifier` service. It calls the internal verifier every 30 seconds and never exposes its token to the browser.

To enable public split settlement only after the acceptance matrix passes:

1. Set `AUNO_VERIFIER_TOKEN` to a random value of at least 32 characters.
2. Deploy once with `AUNO_DEVNET_SPLITS_ENABLED=false` and confirm the `verifier` log reports successful internal runs after the web health check succeeds.
3. Run real Devnet SOL and USDC payments for 2 and 5 recipients, including a recipient without a USDC associated token account. Confirm each `/receipt/<paymentId>` page and Devnet Explorer result.
4. Set `AUNO_DEVNET_SPLITS_ENABLED=true` and redeploy. This gate affects split creation, preparation, and submission only; normal Devnet payment links remain available.

Keep Mainnet in the separate `compose.mainnet-staging.yaml` deployment with settlement disabled.