#!/bin/sh
# ── Development Startup Script — Phase X.9.4 ───────────────────────────────────
# The app-dev Compose service's command. Source is bind-mounted (docker-compose.yml), so no
# rebuild is needed between edits. Validates the environment (same reused parser, non-fatal here
# — a broken .env shouldn't block iterating on code that doesn't touch config), then runs the
# same src/server/main.ts entrypoint via `tsx watch` for auto-restart on file change — the one
# genuine dev-vs-prod behavioral difference, using tsx's own already-installed watch mode, no new
# dependency.
set -e

NODE_ENV="${NODE_ENV:-development}"
export NODE_ENV

echo "[start-dev] validating environment (profile: ${NODE_ENV})..."
npx tsx scripts/validateEnvironment.ts || echo "[start-dev] environment validation failed — continuing anyway in dev mode"

echo "[start-dev] starting server (watch mode)..."
exec npx tsx watch src/server/main.ts
