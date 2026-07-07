# ── Phase X.9.4 — Application Container ────────────────────────────────────────
# Multi-stage build for the backend HTTP server (src/server/main.ts — the Fastify + Reasoning/
# Tool Calling/MCP/Multi-Agent/Streaming stack built across X.9.1-X.9.3). Does NOT build or serve
# the separate Vite/React frontend (App.tsx) — that is a different, unrelated application; this
# image is the reasoning API server only.
#
# HONEST BUILD-TOOLING NOTE: this repository has no dedicated backend bundler — the server runs
# its TypeScript source directly via `tsx` (already an existing devDependency), the same way
# `npm run server` already does on the host. Reproducing that exact, already-proven run path in
# the container (rather than inventing a new esbuild/tsc bundling step) is a deliberate,
# minimal-footprint choice, not an oversight: this milestone's scope is "additive infrastructure
# around the existing runtime," not a new build system. tsx therefore ships in the final image;
# this is a real image-size trade-off, documented rather than hidden.
#
# A full-project `tsc --noEmit` gate was considered for a build-time stage but deliberately NOT
# included: this repository has pre-existing type errors in modules unrelated to Phase X
# (confirmed during the X.9 Production Hardening Audit — storage/, workspace/, financial/, and
# several *.test.tsx files), which would make the image fail to build through no fault of this
# milestone's own code. Fixing those is out of this milestone's scope.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── runtime ─────────────────────────────────────────────────────────────────────
# The image actually deployed to production (docker-compose.yml's `app` service, profile "app").
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S dtmsn && adduser -S dtmsn -G dtmsn

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY tsconfig.json tsconfig.app.json ./
COPY src ./src
COPY scripts ./scripts

RUN chown -R dtmsn:dtmsn /app
USER dtmsn

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "scripts/start-prod.sh"]
