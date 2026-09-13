# AUNO Coolify Docker Compose Deployment Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the archived AUNO developer-preview payment application on Coolify with Docker Compose without changing the existing AUNO project until the runtime decision is validated.

**Architecture:** The archive is a Vinext/Next-compatible React application whose server routes run in the Cloudflare Workers runtime. It uses a Cloudflare D1 binding named `DB`, persisted locally by Wrangler/Miniflare, and a server-only Solana RPC URL. It is not currently a conventional Node/Next standalone app, so the first deployment must either preserve the Cloudflare-compatible runtime in a single persistent container or complete a deliberate D1-to-Postgres/Node port.

**Tech Stack:** Node 22+ (README says Node 24), npm, Vinext, Vite, Wrangler, Cloudflare Workers compatibility, D1/SQLite, Drizzle, Solana devnet, Docker Compose, Coolify.

**Spec:** `AUNO-Website-Source.zip` and its archived `AUNO-Website/README.md`.

## Global Constraints

- Keep `SOLANA_NETWORK=devnet`; mainnet is hard-disabled in this release.
- Keep `SOLANA_RPC_URL` server-only and use a dedicated RPC endpoint; do not expose private RPC credentials through `NEXT_PUBLIC_*` variables.
- Do not request or persist wallet private keys, seed phrases, or recovery material.
- Apply database migrations before serving payment routes; never create schema inside request handlers.
- Treat the application as Developer Preview until real funded-wallet SOL and USDC acceptance tests pass.
- Do not deploy the ZIP itself as the application source; use an extracted, reviewed source directory as the Compose build context.
- Do not include `AUNO-Website-Source/` in a future Docker build context; add it to `.dockerignore` in the selected deployment source.

---

## Archive findings

- Top-level source directory inside the ZIP: `AUNO-Website/`.
- Framework/runtime: Vinext, Vite, Next-compatible routing, Cloudflare Vite plugin, Wrangler.
- API surface: payment create/list/prepare/submit/verify routes plus `/api/health`.
- Persistence: SQLite schema in `db/schema.ts`, Drizzle SQL in `drizzle/`, runtime access through `cloudflare:workers` and `env.DB`.
- Required runtime variables: `SOLANA_NETWORK`, `SOLANA_RPC_URL`.
- Current start command runs `wrangler dev --local --persist-to .wrangler/state` and binds to `127.0.0.1`; that bind address must be changed for a container.
- The archive contains no `Dockerfile` and no `compose.yaml`.
- The existing project root already has a separate Postgres/Next Docker setup and has extensive uncommitted changes. It was not modified.

## Deployment decision

### Recommended production direction

Use the existing project’s Node/Postgres architecture as the production target, after confirming it is the intended successor to this archive. Port the archived payment logic from D1 to Postgres, keep the verifier as a separate worker, and deploy the existing `web`, `worker`, and `database` Compose services with persistent Postgres storage.

### Short-term archived-preview direction

If the exact archive must be deployed first, run its Cloudflare-compatible runtime in one container:

1. Build with `npm ci` and `npm run build`.
2. Run Wrangler locally with `--ip 0.0.0.0`, `--port 3000`, and `--persist-to /app/.wrangler/state`.
3. Mount a named volume at `/app/.wrangler/state`.
4. Apply the bundled Drizzle SQL once before the web process starts. The first migration is not idempotent, so do not execute it on every restart without a migration guard.
5. Run one Coolify replica only. Do not scale this D1/Miniflare deployment horizontally.

This preview route is operationally weaker than external Postgres/D1 because the database is container-local state. Back up the named volume and keep the service devnet-only.

## Implementation tasks

### Task 1: Freeze the deployment source

**Files:**
- Create: `deploy/auno-website/` from the reviewed contents of `AUNO-Website/` in the archive.
- Create: `deploy/auno-website/.dockerignore`.

- [ ] Extract the archive into a new deployment directory; do not overwrite the current project root.
- [ ] Confirm the extracted directory contains `package.json`, `vite.config.ts`, `wrangler.local.json`, `db/`, `drizzle/`, `app/`, and `scripts/`.
- [ ] Add `node_modules`, `.wrangler`, `.sites-runtime`, `dist`, `.next`, `.env*`, and the parent archive folder to `.dockerignore`.
- [ ] Run `npm ci` in the extracted directory.

### Task 2: Make the archived runtime container-compatible

**Files:**
- Modify: `deploy/auno-website/package.json` start script.
- Create: `deploy/auno-website/Dockerfile`.
- Create: `deploy/auno-website/docker-entrypoint.sh`.

- [ ] Change the start command to bind `0.0.0.0` and use the Coolify-provided `PORT`, defaulting to `3000`.
- [ ] Use a multi-stage Node 24 image: dependency stage, build stage, and a small runtime stage containing the build output, `drizzle/`, `scripts/`, and Wrangler runtime dependencies.
- [ ] Make the entrypoint create `/app/.wrangler/state`, apply migrations through a guarded one-time initialization, then `exec` the web process so signals and shutdowns are handled correctly.
- [ ] Do not put `SOLANA_RPC_URL` or other secrets in the image or Dockerfile.
- [ ] Run locally with `docker compose build` and verify the container listens on `0.0.0.0:3000`.

### Task 3: Add the Compose definition

**Files:**
- Create: `deploy/auno-website/compose.yaml`.

- [ ] Define one `web` service built from the extracted source.
- [ ] Pass `SOLANA_NETWORK=${SOLANA_NETWORK:?}` and `SOLANA_RPC_URL=${SOLANA_RPC_URL:?}` as required runtime variables.
- [ ] Set `NODE_ENV=production`, `PORT=3000`, and `HOST=0.0.0.0`.
- [ ] Mount a named volume, for example `auno-d1-state:/app/.wrangler/state`.
- [ ] Define a Compose health check against `http://127.0.0.1:3000/api/health`; treat HTTP 503 as unhealthy because the endpoint reports database and RPC availability.
- [ ] Expose only the web service’s internal port 3000 to Coolify’s proxy; do not publish a host database port.
- [ ] Keep one replica until the persistence model is migrated to external Postgres or managed Cloudflare D1.

Coolify treats Compose-defined storage and health checks as the source of truth. Use the official [Coolify Docker Compose documentation](https://coolify.io/docs/services/configuration/docker-compose) and [Compose health-check guidance](https://coolify.io/docs/applications/builds/docker-compose) when creating the resource.

### Task 4: Configure the Coolify resource

- [ ] Create a Git-based Docker Compose resource pointing at the selected deployment directory and Compose file.
- [ ] Add `SOLANA_NETWORK=devnet` as a fixed environment value.
- [ ] Add `SOLANA_RPC_URL` as a protected runtime secret containing a dedicated devnet RPC URL.
- [ ] Configure the public domain to route to internal port `3000`.
- [ ] Keep the deployment single-replica and enable automatic restart only after the persistent volume is confirmed.
- [ ] Review Coolify’s parsed Deployable Compose output, environment variables, volume, port, and health check before the first deploy.
- [ ] Do not place private RPC credentials in the repository or in a client-exposed variable. Coolify’s [Compose environment-variable behavior](https://coolify.io/docs/applications/configuration/environment-variables) supports required references such as `${SOLANA_RPC_URL:?}`.

### Task 5: Validate database and RPC readiness

- [ ] Deploy with the named volume empty and confirm the guarded migration creates `payments`, `attempts`, and all indexes.
- [ ] Confirm `/api/health` returns HTTP 200 with `network=devnet`, `database=available`, and `rpc=available`.
- [ ] Restart the service and confirm the migration is not rerun destructively and the same data remains available.
- [ ] Temporarily use an invalid RPC URL and confirm health becomes HTTP 503 without marking payments as paid.
- [ ] Back up and restore the named D1 state volume before accepting any real test payment.

### Task 6: Run application acceptance tests

- [ ] Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` in the extracted source directory.
- [ ] Use two funded devnet wallets to create, submit, and verify a small SOL payment.
- [ ] Repeat with canonical devnet USDC, including a recipient without an associated token account.
- [ ] Test wallet rejection, insufficient funds, invalid recipient, expiry, stale blockhash, uncertain submission, refresh, and repeated verification.
- [ ] Confirm the Explorer receipt and recipient balance before calling the deployment functional.
- [ ] Keep the service labeled Developer Preview until all required manual acceptance cases pass.

### Task 7: Production hardening gate

- [ ] Decide whether to keep the archived D1/Miniflare preview or port to external Postgres/managed D1.
- [ ] For production, add database backup/recovery, rate limiting, abuse protection, structured monitoring, authenticated developer tooling, cancellation/reconciliation policies, and an external security review.
- [ ] Do not enable mainnet, split settlement, webhooks, QR checkout, escrow, subscriptions, payouts, or token launch until their implementation and acceptance criteria are complete.

## Definition of done

- The ZIP remains intact at `AUNO-Website-Source/AUNO-Website-Source.zip`.
- The deployment source is isolated from the existing dirty project tree.
- Coolify’s Compose preview shows the expected service, internal port, volume, required environment variables, and health check.
- A fresh deployment migrates once, survives restart, and reports both D1 and RPC readiness.
- Devnet SOL and USDC end-to-end tests pass with two funded wallets.
- No mainnet or secret material is enabled.

