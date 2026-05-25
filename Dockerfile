# ── Stage 1: Build ────────────────────────────────────────────────────────────
# Installs all deps (including dev) and compiles TypeScript + bundles React.
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace manifests first so Docker can cache the install layer.
# Any source change won't bust the cache unless package*.json also changes.
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

RUN npm ci

# Copy all source and run the monorepo build:
#   npm run build  →  server: tsc  →  server/dist/
#                 →  client: tsc + vite build  →  client/dist/
COPY . .
RUN npm run build

# ── Stage 2: Production ───────────────────────────────────────────────────────
# Lean image: only production server deps + compiled artefacts.
FROM node:20-alpine AS production

WORKDIR /app

# npm workspaces needs all workspace manifests present to resolve the graph.
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install only the server's production dependencies.
# client/* deps are NOT installed — the SPA is already compiled to static files.
RUN npm ci --omit=dev --workspace=server

# Pull compiled artefacts from the builder stage.
# server/dist/index.js serves client/dist as static files in production.
# path.resolve(__dirname, '../../client/dist')  →  /app/client/dist  ✓
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "server/dist/index.js"]
