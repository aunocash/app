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
```

Do not commit the RPC value if it contains credentials. The entrypoint writes these values to an ignored, runtime-only `.dev.vars` file.

## Internal runtime routing

Coolify connects only to port `3000`. The runtime forwards `/api` and `/api/*` to the Wrangler Worker on `127.0.0.1:8787`; all other requests, including pages and static assets, go to Vinext on `127.0.0.1:3001`. Do not create domains or expose ports for either internal service.
## Persistence and limitations

The Compose volume `auno-website-d1` stores Wrangler's local D1 state. Keep one replica and configure volume backups before using the preview with real users. This is a Devnet developer preview, not a production Cloudflare D1 deployment. Mainnet is intentionally rejected by the entrypoint.

After deployment, check `https://auno.cash/api/health`. It should return HTTP 200 only when local D1 and the configured Solana Devnet RPC are available.
