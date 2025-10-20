# Multi-stage build for React + Node.js application
FROM node:18-alpine AS base
WORKDIR /app

# Install system Chromium + deps for Puppeteer on Alpine
RUN apk add --no-cache \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  tzdata \
  udev \
  ttf-freefont \
  curl

# Use system Chromium and skip bundled download
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_NO_SANDBOX=true

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY src/client/package*.json ./src/client/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Install client dependencies
WORKDIR /app/src/client
RUN npm ci --only=production && npm cache clean --force

# Build stage
FROM base AS builder
WORKDIR /app

# Copy package files and install all dependencies (including dev)
COPY package*.json ./
COPY src/client/package*.json ./src/client/
RUN npm ci

# Install client dependencies
WORKDIR /app/src/client
RUN npm ci

# Copy source code
WORKDIR /app
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Create data directory for SQLite database
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/status || exit 1

# Start the application
CMD ["npm", "start"]