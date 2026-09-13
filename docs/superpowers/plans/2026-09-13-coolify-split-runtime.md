# Coolify Split Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the ZIP website through a Coolify-compatible HTTP path while preserving its Cloudflare Worker/D1 payment APIs.

**Architecture:** A Node HTTP proxy listens on port 3000. It forwards page and asset requests to Vinext's production server on `127.0.0.1:3001`, and `/api` requests to Wrangler's local Worker runtime on `127.0.0.1:8787`. Only port 3000 remains exposed to Coolify.

**Tech Stack:** Node.js 24, Node `http`, Vinext, Wrangler, Cloudflare D1 local runtime, Docker Compose, Coolify.

**Spec:** `deploy/auno-website/COOLIFY.md` and the live regression: `auno.cash` returned HTTP 200 with an empty streamed page body through Wrangler, while `vinext start` returned HTML locally.

## Global Constraints

- Keep the ZIP source application behavior unchanged.
- Keep all Worker/D1 traffic internal to the container.
- Keep Coolify's external service port at `3000`.
- Route every `/api` and `/api/*` request to the Worker runtime.
- Route all other requests, including assets and client navigation requests, to Vinext.
- Keep `SOLANA_NETWORK=devnet`; never disable TLS validation.

---

### Task 1: Add a tested internal proxy

**Files:**
- Create: `deploy/auno-website/tests/coolify-runtime.test.mjs`
- Create: `deploy/auno-website/scripts/coolify-runtime.mjs`

**Interfaces:**
- Produces: `targetForPath(pathname): "api" | "web"`.
- Produces: `createProxyServer({ apiOrigin, webOrigin }): http.Server`.
- Consumes: Worker at `http://127.0.0.1:8787`; Vinext at `http://127.0.0.1:3001`.

- [ ] **Step 1: Write the failing proxy test**

```js
assert.equal(targetForPath("/api/health"), "api");
assert.equal(targetForPath("/docs"), "web");
```

- [ ] **Step 2: Run the test and verify it fails because the runtime module is missing**

Run: `node tests/coolify-runtime.test.mjs`

- [ ] **Step 3: Implement the proxy and child-process lifecycle**

```js
const target = targetForPath(request.url) === "api" ? apiOrigin : webOrigin;
requestToUpstream(target, request, response);
```

- [ ] **Step 4: Run the test and verify API and page requests reach separate local upstreams**

Run: `node tests/coolify-runtime.test.mjs`

### Task 2: Launch the split runtime from the container

**Files:**
- Modify: `deploy/auno-website/docker-entrypoint.sh`
- Test: `deploy/auno-website/tests/docker-runtime-env-config.mjs`

**Interfaces:**
- Consumes: `/app/dist/server/.dev.vars` created before runtime startup.
- Produces: proxy process on `PORT` (default `3000`), worker on `8787`, Vinext on `3001`.

- [ ] **Step 1: Write a failing entrypoint assertion for `coolify-runtime.mjs`**
- [ ] **Step 2: Run the assertion and verify it fails**

Run: `node tests/docker-runtime-env-config.mjs`

- [ ] **Step 3: Replace the direct Wrangler process with the split runtime process**

```sh
exec node ./scripts/coolify-runtime.mjs
```

- [ ] **Step 4: Run the assertion and verify it passes**

Run: `node tests/docker-runtime-env-config.mjs`

### Task 3: Verify and document the runtime

**Files:**
- Modify: `deploy/auno-website/COOLIFY.md`

- [ ] **Step 1: Document internal ports and routing behavior**
- [ ] **Step 2: Run `docker compose -f deploy/auno-website/compose.yaml config`**
- [ ] **Step 3: Run all runtime tests and `npm run build`**
- [ ] **Step 4: Commit and push the verified change**
