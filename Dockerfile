FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder
ENV NEXT_TELEMETRY_DISABLED=1
ENV APP_ORIGIN=http://localhost:3000
ENV DATABASE_URL=postgres://build:build@localhost:5432/build
ENV SOLANA_NETWORK=devnet
ENV SOLANA_RPC_URL=https://api.devnet.solana.com
COPY . .
RUN npm run build

FROM node:22-alpine AS web
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

FROM dependencies AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY lib ./lib
COPY worker ./worker
COPY drizzle ./drizzle
COPY drizzle.config.ts tsconfig.json ./
CMD ["npm", "run", "worker"]
