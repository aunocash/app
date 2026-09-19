#!/bin/sh
set -eu

cd /app

if [ "${SOLANA_NETWORK:-devnet}" != "devnet" ]; then
  echo "The Devnet verifier is restricted to SOLANA_NETWORK=devnet." >&2
  exit 64
fi

: "${AUNO_APP_ORIGIN:=http://web:3000}"

if [ -z "${AUNO_VERIFIER_TOKEN:-}" ] || [ "${#AUNO_VERIFIER_TOKEN}" -lt 32 ]; then
  echo '{"event":"devnet_verifier_disabled","reason":"missing_or_short_verifier_token"}' >&2
  exec tail -f /dev/null
fi

exec node ./scripts/coolify-devnet-verifier.mjs