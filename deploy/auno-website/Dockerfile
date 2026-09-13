FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY scripts ./scripts

ENV NODE_ENV=production \
    npm_config_audit=false \
    npm_config_fund=false \
    npm_config_update_notifier=false

RUN npm run install:ci

COPY . .

RUN npm run build

FROM node:24-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    WRANGLER_SEND_METRICS=false \
    WRANGLER_WRITE_LOGS=false \
    SITES_RUNTIME_ROOT=/app/.sites-runtime

COPY --from=build /app /app
COPY docker-entrypoint.sh /usr/local/bin/auno-entrypoint

RUN chmod +x /usr/local/bin/auno-entrypoint \
    && mkdir -p /app/.wrangler/state /app/.sites-runtime

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/auno-entrypoint"]
