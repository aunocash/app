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

for migration in drizzle/*.sql; do
  marker="/app/.wrangler/state/.auno-migration-$(basename "$migration" .sql)-applied"
  if [ ! -f "$marker" ]; then
    node ./node_modules/wrangler/bin/wrangler.js d1 execute DB \
      --local \
      --config dist/server/wrangler.json \
      --persist-to /app/.wrangler/state \
      --file "$migration"
    touch "$marker"
  fi
done

exec node ./scripts/coolify-runtime.mjs
