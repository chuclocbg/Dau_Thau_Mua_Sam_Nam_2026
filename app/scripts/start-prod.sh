#!/bin/sh
# ── Production Startup Script — Phase X.9.4 ────────────────────────────────────
# The Dockerfile's CMD. Runs inside the "runtime" image stage (Alpine /bin/sh). Validates the
# environment first (reusing the existing config parser via validateEnvironment.ts — never a
# second parser), then execs the exact same, unmodified server entrypoint `npm run server`
# already uses on the host (src/server/main.ts via tsx) — no separate production code path.
set -e

NODE_ENV="${NODE_ENV:-production}"
export NODE_ENV

echo "[start-prod] validating environment (profile: ${NODE_ENV})..."
npx tsx scripts/validateEnvironment.ts

echo "[start-prod] starting server..."
exec npx tsx src/server/main.ts
