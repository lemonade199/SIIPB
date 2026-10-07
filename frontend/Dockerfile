# ========================================================
# SIIPB Frontend — Next.js (standalone) di Node 22
# Variabel NEXT_PUBLIC_* dibaca saat build -> diteruskan sebagai build args.
# ========================================================
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_DATA_SOURCE=api
ARG NEXT_PUBLIC_API_BASE_URL=/api/v1
ARG NEXT_PUBLIC_INSTITUTION=""
ARG NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=false
ENV NEXT_PUBLIC_DATA_SOURCE=$NEXT_PUBLIC_DATA_SOURCE \
    NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_INSTITUTION=$NEXT_PUBLIC_INSTITUTION \
    NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=$NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S siipb && adduser -S siipb -G siipb
COPY --from=build --chown=siipb:siipb /app/.next/standalone ./
COPY --from=build --chown=siipb:siipb /app/.next/static ./.next/static
COPY --from=build --chown=siipb:siipb /app/public ./public
USER siipb
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/login >/dev/null || exit 1
CMD ["node", "server.js"]
