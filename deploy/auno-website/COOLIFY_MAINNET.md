# Coolify Mainnet Beta production deployment

This is the **production** Mainnet deployment for the primary domain `https://auno.cash` on a Coolify server. Settlement is enabled: real SOL moves, so treat every step as a production release.

Two Coolify Mainnet resources may coexist:

- **Production** (this document) — `compose.mainnet.yaml`, real settlement, domain `auno.cash`.
- **Staging** ([COOLIFY_MAINNET_STAGING.md](./COOLIFY_MAINNET_STAGING.md)) — `compose.mainnet-staging.yaml`, settlement hard-disabled, domain `mainnet.auno.cash`.

Do not share their D1 volume, RPC endpoint, or verifier token.

The existing Devnet Coolify resource ([COOLIFY.md](./COOLIFY.md)) currently binds the same `auno.cash` domain. **Decommission or repoint the Devnet resource before the Mainnet cutover** — the same host cannot serve both.

## Create a new Coolify resource

- Repository: `https://github.com/aunocash/app.git`
- Branch: `main`
- Base Directory: `/deploy/auno-website`
- Docker Compose Location: `/compose.mainnet.yaml`
- Service domain: `https://auno.cash`
- Service: `web`
- Internal port: `3000`
- Path: blank
- Replicas: `1`

Do not expose a host port or attach a domain to the `verifier` service.

## Required secrets

Set these as service secrets in Coolify (never commit):

```env
SOLANA_RPC_URL=https://your-dedicated-authenticated-mainnet-rpc.example
AUNO_VERIFIER_TOKEN=<random value of at least 32 characters>
```

Compose fixes the following and they must not be overridden:

```env
SOLANA_NETWORK=mainnet-beta
AUNO_PUBLIC_ORIGIN=https://auno.cash
AUNO_COOLIFY_MAINNET_PRODUCTION=true
AUNO_MAINNET_ENABLED=true
AUNO_MAX_SOL_LAMPORTS=100000000
```

Optional overrides:

```env
AUNO_MAINNET_SPLITS_ENABLED=true      # default: true
AUNO_VERIFIER_BATCH_SIZE=25           # default: 25
AUNO_VERIFIER_POLL_MS=120000          # verifier interval, min 15000
```

The entrypoint enforces `AUNO_PUBLIC_ORIGIN=https://auno.cash` for production. The staging entrypoint enforces `https://mainnet.auno.cash`. Any other origin exits with code 64.

## Volume and D1 data

- Volume name: `auno-mainnet-production-d1` — separate from staging and devnet.
- Configure Coolify backups on this volume **before** any real payment can be created.
- The entrypoint runs every `drizzle/*.sql` migration once on first boot and marks each applied under `/app/.wrangler/state/`.

## Migrating existing data from the Cloudflare Worker at `mainnet.auno.cash` (optional)

If the previous Cloudflare Worker at `auno-mainnet-beta` had real payment records, export them before flipping DNS:

```bash
# On your workstation, using wrangler already authenticated
npx wrangler d1 export auno-mainnet-beta --remote --output=mainnet-d1-export.sql
```

Then, after the Coolify container is running but before DNS switchover:

```bash
docker cp mainnet-d1-export.sql <coolify_web_container>:/tmp/import.sql
docker exec -it <coolify_web_container> sh -c \
  "node ./node_modules/wrangler/bin/wrangler.js d1 execute DB \
   --local --config dist/server/wrangler.json \
   --persist-to /app/.wrangler/state --file /tmp/import.sql"
```

Do this while the Cloudflare Worker (or its old route) is still serving reads so no new writes happen during export/import.

## DNS switchover to `auno.cash`

`auno.cash` currently points to whichever Devnet Coolify or Worker resource is bound to it. To move it to the new Mainnet Coolify resource:

1. **Decommission Devnet at `auno.cash`.** Either stop the Devnet Coolify resource, or move it to a subdomain (recommended: `devnet.auno.cash`). If you keep Devnet, update its Coolify env `AUNO_PUBLIC_ORIGIN=https://devnet.auno.cash`.
2. **Remove the Cloudflare Worker route** `mainnet.auno.cash/*` (already done in this rollout). Keep the Worker deployed but unrouted — it stays as a rollback path at `https://auno-mainnet-beta.rydhlnst.workers.dev`.
3. **Update DNS**: `auno.cash` `A`/`AAAA` record → Coolify VPS IP. If the record is proxied by Cloudflare, keep the orange cloud on for the TLS termination and DDoS protection.
4. Wait for propagation (usually seconds inside Cloudflare).
5. Verify `https://auno.cash/api/health` responds from Coolify with:
   - `database: "available"`
   - `rpc: "available"`
   - `payments: "mainnet-beta-enabled"`
   - `mainnet: true`
   - `mainnetSplits: "enabled"` (or `"disabled"` if you kept the flag off)

Keep the Cloudflare Worker deployed and unrouted for 24 h — it's your instant rollback.

## Handling the old `mainnet.auno.cash` subdomain

Keep or drop the subdomain:

- **Keep as redirect (recommended)**: at Cloudflare, set up a page rule or worker that 301-redirects `mainnet.auno.cash/*` → `https://auno.cash/$1`. Bookmarks and old payment links keep working.
- **Drop**: delete the `mainnet` DNS record. Old links break with `DNS_PROBE_FINISHED_NXDOMAIN`.

Server code accepts either hostname as Mainnet, so if you keep the subdomain pointed at the same Coolify instance, `mainnet.auno.cash` still works. But `AUNO_PUBLIC_ORIGIN` is fixed at `https://auno.cash`, so payment-link creation always yields `auno.cash` URLs.

## Verifier

Coolify runs the `verifier` container which loops every `AUNO_VERIFIER_POLL_MS` ms (default 120 s) and posts to `http://web:3000/api/internal/verify`. It never exposes its token. Log events are `coolify_mainnet_production_verifier_run` / `coolify_mainnet_production_verifier_failure`.

Watch a live tail during rollout:

```bash
docker logs -f <coolify_verifier_container>
```

## Pre-flight checks

Before flipping DNS:

- `https://auno.cash/api/health` from your workstation must reach Coolify (test with `/etc/hosts` override or Coolify's preview URL).
- Confirm a 2 min log window shows verifier runs with `status: 200`.
- Confirm `/api/capabilities` returns `{"network":"mainnet-beta","mainnetEnabled":true,"mainnetSplitsEnabled":true}`.
- Confirm a Devnet-linked payment link cannot be resolved (`GET /api/payments/<devnet-id>` returns 404).

## Rollback

- **Fastest** (restore Worker in seconds): re-add the Cloudflare Worker route `auno.cash/*` (or `mainnet.auno.cash/*` if reverting to old topology) to the `auno-mainnet-beta` Worker. DNS falls back to the Worker.
- **Split-only issue**: set `AUNO_MAINNET_SPLITS_ENABLED=false` in Coolify env and redeploy the `web` service. Standard payments stay live.
- **Deeper issue with settlement**: production Compose requires `AUNO_MAINNET_ENABLED=true` — you cannot set it to `false` here. Instead, cut back to Cloudflare Worker (fast rollback above) or stop the Coolify `web` service entirely.

## Post-cutover monitoring window

- 24 h of continuous verifier success logs.
- No stuck `SUBMITTED`/`CONFIRMING` attempts older than 15 min in the database.
- No `payment_rejected` events with reason `prepared_message_mismatch` or `outside_payment_window` outside expected wallet-error rates.

When those conditions hold, remove the Cloudflare Worker deployment.
