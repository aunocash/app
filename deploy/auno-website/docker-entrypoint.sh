#!/bin/sh
set -eu

cd /app

: "${SOLANA_NETWORK:=devnet}"
: "${SOLANA_RPC_URL:=https://api.devnet.solana.com}"

if [ "$SOLANA_NETWORK" != "devnet" ]; then
  echo "SOLANA_NETWORK must be devnet for this ZIP deployment" >&2
  exit 64
fi

umask 077
printf 'SOLANA_NETWORK=%s\nSOLANA_RPC_URL=%s\n' "$SOLANA_NETWORK" "$SOLANA_RPC_URL" > /app/dist/server/.dev.vars

mkdir -p /app/.wrangler/state

if [ ! -f /app/.wrangler/state/.auno-migration-0000-applied ]; then
  node ./node_modules/wrangler/bin/wrangler.js d1 execute DB \
    --local \
    --config dist/server/wrangler.json \
    --persist-to /app/.wrangler/state \
    --file drizzle/0000_lush_the_executioner.sql
  touch /app/.wrangler/state/.auno-migration-0000-applied
fi

exec node --import ./scripts/sites-env.mjs \
  ./node_modules/wrangler/bin/wrangler.js dev \
  --config dist/server/wrangler.json \
  --local \
  --persist-to /app/.wrangler/state \
  --ip 0.0.0.0 \
  --port "${PORT:-3000}" \
  --inspector-port 0
