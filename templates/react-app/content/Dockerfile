# Build stage
FROM node:${{ values.nodeVersion }}-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
{% if values.packageManager == 'yarn' %}
COPY yarn.lock ./
{% elif values.packageManager == 'pnpm' %}
COPY pnpm-lock.yaml ./
{% endif %}

# Install dependencies
{% if values.packageManager == 'yarn' %}
RUN yarn install --frozen-lockfile
{% elif values.packageManager == 'pnpm' %}
RUN npm install -g pnpm && pnpm install --frozen-lockfile
{% else %}
RUN npm ci
{% endif %}

# Copy source code
COPY . .

# Build the application
{% if values.packageManager == 'yarn' %}
RUN yarn build
{% elif values.packageManager == 'pnpm' %}
RUN pnpm build
{% else %}
RUN npm run build
{% endif %}

# Production stage
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create non-root user
RUN addgroup -g 1001 -S appuser && \
    adduser -S appuser -u 1001 -G appuser && \
    chown -R appuser:appuser /usr/share/nginx/html && \
    chown -R appuser:appuser /var/cache/nginx && \
    chown -R appuser:appuser /var/log/nginx && \
    chown -R appuser:appuser /etc/nginx/conf.d

USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80/health || exit 1

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]