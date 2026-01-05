# ============================
# 1️⃣ Build Stage
# ============================
FROM node:24-alpine AS builder

WORKDIR /app

# Copy only package files first (for better caching)
COPY package*.json ./

# Install dependencies using ci for reproducible builds
RUN npm ci --no-audit && npm cache clean --force

# Copy source code and build
COPY . .

# Normalize view filenames (remove .html if present)
RUN find views -name "*.handlebars.html" -type f | while read f; do \
      mv "$f" "${f%.html}"; \
    done || true

RUN npm run build


# ============================
# 2️⃣ Production Stage
# ============================
FROM node:24-alpine AS production

# Set working directory
WORKDIR /app

# Install dumb-init for signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs

# Copy only production dependencies
COPY package*.json ./
RUN npm ci --only=production --no-audit && npm cache clean --force

# Copy built artifacts from builder (includes dist/views from npm run build)
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy views from builder to overwrite any .html extensions from build script
COPY --from=builder --chown=nodejs:nodejs /app/views ./dist/views

# Create writable logs directory with correct ownership
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app

# Use non-root user
USER nodejs

# Expose application port
EXPOSE 5050

# Use dumb-init as entrypoint for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Run app
CMD ["node", "dist/index.js"]
