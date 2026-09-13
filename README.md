# AUNO

English website and interactive product preview for programmable payments on Solana.

## Frontend demo

npm install
npm run dev

The existing dashboard and checkout still use browser-local demo data. Backend integration is intentionally deferred.

## Backend stack

Copy `.env.example` to `.env`, then start PostgreSQL, migrations, the API, and verification worker:

```sh
docker compose up --build
```

The API uses PostgreSQL, Drizzle migrations, SIWS sessions, devnet SOL/USDC transactions, and finalized on-chain verification. Mainnet startup is blocked unless explicitly enabled and configured.

## Verify

npm test
npm run test:integration
npm run typecheck
npm run lint
npm run build

Database integration tests are gated. Run them against the Compose database with `RUN_DB_INTEGRATION=true` and `TEST_DATABASE_URL` set.

Real devnet E2E is also gated and reads the keypair only from the provided local path:

```sh
AUNO_E2E=1 AUNO_E2E_KEYPAIR=/path/to/id.json npm run e2e:devnet
```

The keypair must have devnet SOL and Circle devnet USDC. The command executes standard and split SOL/USDC payments, checks balance deltas and finalized receipts, and tests invalid, expired, duplicate, omitted-signature, and mismatched flows.

## API

- `POST /api/v1/auth/challenges`
- `POST /api/v1/auth/sessions`
- `GET|DELETE /api/v1/auth/session`
- `POST|GET /api/v1/payments`
- `GET /api/v1/payments/[id]`
- `POST /api/v1/payments/[id]/cancel`
- `POST /api/v1/payments/[id]/transactions`
- `POST /api/v1/payments/[id]/submissions`
- `GET /api/v1/payments/[id]/receipt`
- `GET /api/health/live`
- `GET /api/health/ready`

## Routes

- / — marketing website with responsive animated payment flow
- /dashboard — local request overview
- /dashboard/create — validated request and split creation
- /dashboard/payments — searchable local request history
- /pay/demo — sample checkout
- /pay/[id] — self-contained request checkout
- /developers — proposed developer interface
- /docs — preview documentation
- /roadmap — current and planned scope
- /whitepaper — preliminary product overview

## Product boundary

The frontend is still a clearly labeled demo and is not connected to the backend. Its payment status transitions and downloaded receipts remain simulations.

Payment requests are encoded in public, unsigned URLs. Up to 100 requests are stored locally in the browser. The dashboard has no authentication, backend database, or cross-device synchronization. The API/SDK code shown on the site is a proposed interface, not an available package.

The backend now provides server-built unsigned devnet transactions and trusted finalized verification, but SOL, USDC, and split settlement must not be labeled production-ready until the gated real-devnet E2E command has passed with funded test assets.
