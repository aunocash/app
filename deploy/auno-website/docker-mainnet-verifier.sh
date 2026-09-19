#!/bin/sh
set -eu

cd /app

if [ "${SOLANA_NETWORK:-}" != "mainnet-beta" ] || [ "${AUNO_COOLIFY_MAINNET_STAGING:-}" != "true" ]; then
  echo "The verifier is restricted to isolated Coolify Mainnet staging." >&2
  exit 64
fi

if [ "${AUNO_MAINNET_ENABLED:-false}" != "false" ]; then
  echo "Coolify Mainnet staging cannot enable settlement." >&2
  exit 64
fi

: "${AUNO_APP_ORIGIN:=http://web:3000}"
: "${AUNO_VERIFIER_TOKEN:?Set AUNO_VERIFIER_TOKEN to a random server-only value}"

if [ "${#AUNO_VERIFIER_TOKEN}" -lt 32 ]; then
  echo "AUNO_VERIFIER_TOKEN must contain at least 32 characters." >&2
  exit 64
fi

exec node ./scripts/coolify-mainnet-verifier.mjs
