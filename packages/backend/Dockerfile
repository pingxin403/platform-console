# Multi-stage Dockerfile for Backstage Internal Developer Platform
# Follows security best practices with minimal hardened base images
# 
# Build with: docker build -t backstage:latest .
# Run with: docker run -p 7007:7007 backstage:latest

# Stage 1: Build stage with full development environment
FROM node:22-bookworm-slim AS build

# Set Python interpreter for node-gyp
ENV PYTHON=/usr/bin/python3

# Install build dependencies
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        g++ \
        build-essential \
        libsqlite3-dev \
        git \
        ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Create app directory and set ownership
WORKDIR /app
RUN chown node:node /app
USER node

# Copy package files for dependency installation
COPY --chown=node:node package.json yarn.lock .yarnrc.yml ./
COPY --chown=node:node .yarn ./.yarn
COPY --chown=node:node backstage.json ./

# Copy workspace package.json files
COPY --chown=node:node packages/app/package.json ./packages/app/
COPY --chown=node:node packages/backend/package.json ./packages/backend/

# Install dependencies with cache mount
RUN --mount=type=cache,target=/home/node/.cache/yarn,sharing=locked,uid=1000,gid=1000 \
    yarn install --immutable

# Copy source code
COPY --chown=node:node . .

# Build the application
RUN yarn tsc && yarn build:backend --config ../../app-config.yaml

# Stage 2: Production runtime with minimal hardened image
FROM cgr.dev/chainguard/wolfi-base:latest AS runtime

# Install runtime dependencies
RUN apk add --no-cache \
    nodejs-22 \
    npm \
    sqlite \
    postgresql-client

# Create non-root user for security
RUN addgroup -g 1001 -S backstage && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G backstage -g backstage backstage

# Set working directory
WORKDIR /app

# Copy built application from build stage
COPY --from=build --chown=backstage:backstage /app/packages/backend/dist/bundle.tar.gz ./
COPY --from=build --chown=backstage:backstage /app/yarn.lock /app/package.json ./
COPY --from=build --chown=backstage:backstage /app/.yarn ./.yarn
COPY --from=build --chown=backstage:backstage /app/.yarnrc.yml ./
COPY --from=build --chown=backstage:backstage /app/backstage.json ./

# Extract bundle and install production dependencies
RUN tar xzf bundle.tar.gz && rm bundle.tar.gz

# Copy configuration files
COPY --chown=backstage:backstage app-config*.yaml ./
COPY --chown=backstage:backstage examples ./examples

# Install production dependencies only
USER backstage
RUN --mount=type=cache,target=/home/backstage/.cache/yarn,sharing=locked,uid=1001,gid=1001 \
    yarn workspaces focus --all --production && \
    yarn cache clean

# Security hardening
ENV NODE_ENV=production
ENV NODE_OPTIONS="--no-node-snapshot --max-old-space-size=1024"

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:7007/api/catalog/health || exit 1

# Expose port
EXPOSE 7007

# Use non-root user
USER backstage

# Start the application
CMD ["node", "packages/backend", "--config", "app-config.yaml", "--config", "app-config.production.yaml"]
