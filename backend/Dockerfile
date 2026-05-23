# =============================================================================
# Roomies Backend — Multi-Stage Dockerfile
# =============================================================================
# Stages:
#   1. base        — shared Node.js base with dependencies
#   2. development — hot-reload dev server (tsx watch)
#   3. build       — TypeScript compilation
#   4. production  — minimal runtime image
# =============================================================================

# ---- Stage 1: Base ----
FROM node:22-alpine AS base
WORKDIR /app

# Install OS deps needed by Prisma (OpenSSL)
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm install

COPY prisma ./prisma/
RUN npx prisma generate

# ---- Stage 2: Development (hot-reload) ----
FROM base AS development
WORKDIR /app

COPY . .

# Run migrations then start dev server
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma generate && npm run dev"]

# ---- Stage 3: Build ----
FROM base AS build
WORKDIR /app

COPY . .
RUN npm run build

# ---- Stage 4: Production ----
FROM node:22-alpine AS production
WORKDIR /app

RUN apk add --no-cache openssl

# Copy only production dependencies
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# Copy Prisma schema and generated client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy compiled JS from build stage
COPY --from=build /app/dist ./dist

# Non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup
USER appuser

EXPOSE 3000

# Run migrations then start
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma generate && node dist/app.js"]
