FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/worker/package.json ./packages/worker/
RUN npm ci --workspace=packages/shared --workspace=packages/worker

FROM deps AS builder
COPY packages/shared/ ./packages/shared/
COPY packages/worker/ ./packages/worker/
COPY tsconfig.base.json ./
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/worker

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/worker/dist ./packages/worker/dist
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/worker/node_modules ./packages/worker/node_modules

CMD ["node", "packages/worker/dist/worker.js"]
