# =============================================================================
# Roomies Frontend — Multi-Stage Dockerfile
# =============================================================================
# Stages:
#   1. base        — shared Node.js base with dependencies
#   2. development — hot-reload dev server (next dev)
#   3. build       — Next.js production build (standalone)
#   4. production  — minimal runtime image
# =============================================================================

# ---- Stage 1: Base ----
FROM node:22-alpine AS base
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ---- Stage 2: Development (hot-reload) ----
FROM base AS development
WORKDIR /app

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

# ---- Stage 3: Build ----
FROM base AS build
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:3005

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1

COPY . .
RUN mkdir -p public
RUN npm run build

# ---- Stage 4: Production ----
FROM node:22-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Copy standalone output
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

# Copy public dir if it exists
RUN mkdir -p ./public
COPY --from=build /app/public/ ./public/

USER appuser

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
