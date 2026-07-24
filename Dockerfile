# ============================
# 1️⃣ Build Stage
# ============================
FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies (only what's necessary)
RUN apk add --no-cache python3 make g++

# Copy only package files first (for better caching)
COPY package*.json ./

RUN npm ci

# Allow passing BUILD_TARGET during build (commented out for unified image)
# ARG BUILD_TARGET=saas

# Copy source code
COPY . .
# RUN if [ "$BUILD_TARGET" = "self-hosted" ]; then rm -rf modules/multi-org; fi

RUN npx tsc --outDir dist && \
    cp -r views dist/ && \
    mkdir -p dist/keys dist/config && \
    (cp -r keys dist/ 2>/dev/null || true) && \
    (cp config/*.p8 dist/config/ 2>/dev/null || true)

# ============================
# 2️⃣ Production Stage
# ============================
FROM node:18-alpine AS production

# Set working directory
WORKDIR /app

# Install dumb-init for signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs

# Copy only production dependencies
COPY package*.json ./
RUN npm ci --no-audit && npm cache clean --force

# Copy built artifacts from builder (everything is in dist now)
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist/

# Create writable dirs with correct ownership
RUN mkdir -p /app/{arbFileUploads,logs} && chown -R nodejs:nodejs /app

# Use non-root user
USER nodejs

# Expose application port
EXPOSE 5000

# Use dumb-init as entrypoint for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Run app
CMD ["npm", "start"]