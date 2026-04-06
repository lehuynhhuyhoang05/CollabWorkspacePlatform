# ──── Stage 1: Build ────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first (cache layer)
COPY package*.json ./
RUN npm ci --omit=dev && cp -R node_modules /tmp/prod_modules
RUN npm ci

# Copy source and build
COPY . .
RUN NODE_OPTIONS=--max-old-space-size=1024 npm run build

# ──── Stage 2: Production ────
FROM node:20-alpine AS production

WORKDIR /app

# Security — don't run as root
RUN addgroup -g 1001 -S nestjs && \
    adduser -S nestjs -u 1001

# Copy production deps + built output
COPY --from=builder /tmp/prod_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Set env
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Switch to non-root user
USER nestjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:3000/health || exit 1

# Start
CMD ["node", "dist/main"]
