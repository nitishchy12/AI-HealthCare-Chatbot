FROM node:20-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy package files first for Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy project files
COPY . .

# Environment
ENV NODE_ENV=production

# Expose backend port
EXPOSE 5004

# Start backend server
CMD ["npm", "start"]