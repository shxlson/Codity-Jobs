FROM node:20-alpine AS builder
WORKDIR /app

# ── Dependencies ──────────────────────────────────────────────────────────────
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/dashboard/package.json ./packages/dashboard/
RUN npm ci --workspace=packages/shared --workspace=packages/dashboard

# ── Build ─────────────────────────────────────────────────────────────────────
COPY packages/shared/ ./packages/shared/
COPY packages/dashboard/ ./packages/dashboard/
COPY tsconfig.base.json ./
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/dashboard

# ── Production Image (Nginx) ──────────────────────────────────────────────────
FROM nginx:alpine AS runner
COPY --from=builder /app/packages/dashboard/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
