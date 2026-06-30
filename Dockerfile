FROM node:20-bookworm-slim AS base
WORKDIR /app

FROM base AS build
# 1. Install build tools needed to compile native modules (like sqlite3) from source
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
# 2. Install all dependencies (including devDependencies)
RUN npm ci
COPY . .
RUN npm run build
# 3. Prune devDependencies so only production dependencies (properly compiled for GLIBC 2.36) remain
RUN npm prune --production

FROM base AS runtime
ENV NODE_ENV=production
# 4. Copy the compiled, production-only node_modules directly from the build stage
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./
EXPOSE 8080
CMD ["node", "dist/server.cjs"]
