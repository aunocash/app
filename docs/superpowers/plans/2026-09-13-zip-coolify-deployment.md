# AUNO ZIP Coolify Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy the provided `AUNO-Website-Source.zip` application as an isolated Coolify Compose resource without changing the existing root application deployment.

**Architecture:** The ZIP application remains under `deploy/auno-website`. A Docker image builds its Vinext/Cloudflare Worker bundle and runs Wrangler in local D1 mode on port 3000. A named volume persists Wrangler's local D1 state; the startup script applies the packaged migration once before serving traffic.

**Tech Stack:** Node.js 24, npm, Vinext, Wrangler 4, Cloudflare D1 local runtime, Docker Compose, Coolify.

**Spec:** `AUNO-Website-Source/COOLIFY-DEPLOYMENT-PLAN.md` and `deploy/auno-website/README.md`.

## Global Constraints

- Keep the existing root `compose.yaml` deployment unchanged.
- Keep the ZIP source and its application behavior unchanged.
- Run only Solana Devnet; never enable mainnet.
- Do not bake secrets or RPC credentials into the image.
- Do not publish a host port from Compose; Coolify routes to the service's internal port.
- Use one replica while local D1 is the persistence layer.

### Task 1: Isolate the ZIP source

**Files:**
- Create: `deploy/auno-website/` from `AUNO-Website-Source/AUNO-Website-Source.zip`

- [ ] Extract the ZIP's `AUNO-Website/` contents into `deploy/auno-website/`.
- [ ] Confirm the extracted app contains `package.json`, `wrangler.local.json`, `drizzle/`, and `app/api/health/route.ts`.

### Task 2: Add the Coolify container runtime

**Files:**
- Create: `deploy/auno-website/Dockerfile`
- Create: `deploy/auno-website/docker-entrypoint.sh`
- Create: `deploy/auno-website/compose.yaml`
- Create: `deploy/auno-website/.dockerignore`

- [ ] Build with Node 24 and the ZIP's lockfile using `npm run install:ci` and `npm run build`.
- [ ] Generate runtime `.dev.vars` from container environment variables at startup.
- [ ] Apply `drizzle/0000_lush_the_executioner.sql` once to local D1 persisted at `/app/.wrangler/state`.
- [ ] Start Wrangler with `--ip 0.0.0.0 --port 3000`.
- [ ] Define an application healthcheck against `/api/health` and expose only port 3000 internally.

### Task 3: Document Coolify configuration

**Files:**
- Create: `deploy/auno-website/COOLIFY.md`

- [ ] Document repository, branch, Base Directory, Compose Location, domain service, internal port, required environment variables, volume, and one-replica limitation.
- [ ] Document that this deployment is a Devnet developer preview and local D1 is not a multi-replica production database.

### Task 4: Verify the deployment definition

- [ ] Run `docker compose -f deploy/auno-website/compose.yaml config`.
- [ ] Run `git diff --check`.
- [ ] Confirm the root `compose.yaml` is unchanged by this task.
