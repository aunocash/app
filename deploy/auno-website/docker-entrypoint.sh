#!/bin/sh
set -eu

cd /app

: "${SOLANA_NETWORK:=devnet}"
: "${AUNO_PUBLIC_ORIGIN:=https://auno.cash}"

case "$SOLANA_NETWORK" in
  devnet)
    : "${SOLANA_RPC_URL:=https://api.devnet.solana.com}"
    ;;
  mainnet-beta)
    if [ "${AUNO_COOLIFY_MAINNET_STAGING:-}" = "true" ] && [ "${AUNO_COOLIFY_MAINNET_PRODUCTION:-}" = "true" ]; then
      echo "Set only one of AUNO_COOLIFY_MAINNET_STAGING or AUNO_COOLIFY_MAINNET_PRODUCTION." >&2
      exit 64
    fi
    if [ "${AUNO_COOLIFY_MAINNET_STAGING:-}" != "true" ] && [ "${AUNO_COOLIFY_MAINNET_PRODUCTION:-}" != "true" ]; then
      echo "Mainnet requires either the Coolify staging or production Compose deployment." >&2
      exit 64
    fi
    if [ "${AUNO_COOLIFY_MAINNET_STAGING:-}" = "true" ] && [ "${AUNO_MAINNET_ENABLED:-false}" != "false" ]; then
      echo "Coolify Mainnet staging cannot enable settlement." >&2
      exit 64
    fi
    if [ "${AUNO_COOLIFY_MAINNET_PRODUCTION:-}" = "true" ] && [ "${AUNO_MAINNET_ENABLED:-false}" != "true" ]; then
      echo "Coolify Mainnet production must set AUNO_MAINNET_ENABLED=true." >&2
      exit 64
    fi
    if [ "${AUNO_COOLIFY_MAINNET_STAGING:-}" = "true" ] && [ "$AUNO_PUBLIC_ORIGIN" != "https://mainnet.auno.cash" ]; then
      echo "Coolify Mainnet staging must use https://mainnet.auno.cash." >&2
      exit 64
    fi
    if [ "${AUNO_COOLIFY_MAINNET_PRODUCTION:-}" = "true" ] && [ "$AUNO_PUBLIC_ORIGIN" != "https://auno.cash" ]; then
      echo "Coolify Mainnet production must use https://auno.cash." >&2
      exit 64
    fi
    : "${SOLANA_RPC_URL:?Set SOLANA_RPC_URL to a dedicated Solana Mainnet RPC endpoint}"
    : "${AUNO_VERIFIER_TOKEN:?Set AUNO_VERIFIER_TOKEN to a random server-only value}"
    if [ "${#AUNO_VERIFIER_TOKEN}" -lt 32 ]; then
      echo "AUNO_VERIFIER_TOKEN must contain at least 32 characters." >&2
      exit 64
    fi
    if [ "${AUNO_MAX_SOL_LAMPORTS:-100000000}" != "100000000" ]; then
      echo "Coolify Mainnet must retain the 0.1 SOL maximum." >&2
      exit 64
    fi
    case "${AUNO_MAINNET_USDC_ENABLED:-true}" in
      true|false) ;;
      *) echo "AUNO_MAINNET_USDC_ENABLED must be true or false." >&2
         exit 64 ;;
    esac
    case "${AUNO_MAX_USDC_BASE_UNITS:-100000000}" in
      ''|*[!0-9]*) echo "AUNO_MAX_USDC_BASE_UNITS must be a positive integer of USDC base units." >&2
         exit 64 ;;
    esac
    if [ "${AUNO_MAX_USDC_BASE_UNITS:-100000000}" -gt 100000000 ]; then
      echo "Coolify Mainnet must retain the 100 USDC maximum." >&2
      exit 64
    fi
    ;;
  *)
    echo "SOLANA_NETWORK must be devnet or mainnet-beta." >&2
    exit 64
    ;;
esac

write_runtime_value() {
  name="$1"
  value="$2"
  normalized=$(printf '%s' "$value" | tr -d '\r\n')
  if [ "$normalized" != "$value" ]; then
    echo "Runtime settings cannot contain line breaks." >&2
    exit 64
  fi
  printf '%s=%s\n' "$name" "$value"
}

umask 077
{
  write_runtime_value SOLANA_NETWORK "$SOLANA_NETWORK"
  write_runtime_value SOLANA_RPC_URL "$SOLANA_RPC_URL"
  write_runtime_value AUNO_PUBLIC_ORIGIN "$AUNO_PUBLIC_ORIGIN"
  if [ "$SOLANA_NETWORK" = "devnet" ]; then
    write_runtime_value AUNO_DEVNET_SPLITS_ENABLED "${AUNO_DEVNET_SPLITS_ENABLED:-false}"
    write_runtime_value AUNO_VERIFIER_BATCH_SIZE "${AUNO_VERIFIER_BATCH_SIZE:-25}"
    write_runtime_value AUNO_VERIFIER_TOKEN "${AUNO_VERIFIER_TOKEN:-}"
  fi
  if [ "$SOLANA_NETWORK" = "mainnet-beta" ]; then
    write_runtime_value AUNO_MAINNET_ENABLED "${AUNO_MAINNET_ENABLED:-false}"
    write_runtime_value AUNO_MAINNET_SPLITS_ENABLED "${AUNO_MAINNET_SPLITS_ENABLED:-false}"
    write_runtime_value AUNO_MAINNET_USDC_ENABLED "${AUNO_MAINNET_USDC_ENABLED:-true}"
    write_runtime_value AUNO_MAX_SOL_LAMPORTS "${AUNO_MAX_SOL_LAMPORTS:-100000000}"
    write_runtime_value AUNO_MAX_USDC_BASE_UNITS "${AUNO_MAX_USDC_BASE_UNITS:-100000000}"
    write_runtime_value AUNO_VERIFIER_BATCH_SIZE "${AUNO_VERIFIER_BATCH_SIZE:-25}"
    write_runtime_value AUNO_VERIFIER_TOKEN "$AUNO_VERIFIER_TOKEN"
  fi
} > /app/dist/server/.dev.vars

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
