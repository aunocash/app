# AUNO

English website and interactive product preview for programmable payments on Solana.

## Run

npm install
npm run dev

## Verify

npm test
npm run lint
npm run build

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

This is a clearly labeled demo, not a live payment processor. Wallet connection, transaction signing, Solana RPC submission, and on-chain verification are not implemented. Payment status transitions and downloaded receipts explicitly identify themselves as simulations.

Payment requests are encoded in public, unsigned URLs. Up to 100 requests are stored locally in the browser. The dashboard has no authentication, backend database, or cross-device synchronization. The API/SDK code shown on the site is a proposed interface, not an available package.

Real settlement requires a wallet integration, trusted server-side verification of amount/asset/recipient/reference, persistence, replay protection, network configuration, and integration testing before accepting funds. No credentials are needed for this preview.
