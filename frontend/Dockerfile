# ============================================================
# Build Stage
# ============================================================
FROM node:20-alpine AS build

WORKDIR /app

# Copy dependency files first for caching
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy application source
COPY . .

# Build production frontend
RUN npm run build


# ============================================================
# Production Stage
# ============================================================
FROM nginx:1.27-alpine

# Copy built frontend files
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose nginx port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]