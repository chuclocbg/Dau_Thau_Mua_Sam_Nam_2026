#!/bin/sh
# ── Deployment Script — Phase X.9.5 ────────────────────────────────────────────
# Orchestrates a deploy: validate environment -> build+start the app container (X.9.4's opt-in
# Compose profile) -> wait for readiness -> run the smoke test suite. Reuses X.9.4's
# validateEnvironment.ts and this milestone's waitForReady.ts/smokeTest.ts -- no duplicated
# health-check, config-loading, or startup logic. Run from the app/ directory.
set -e

APP_PORT="${APP_PORT:-3000}"
APP_URL="${APP_URL:-http://localhost:${APP_PORT}}"

echo "[deploy] validating environment..."
npx tsx scripts/validateEnvironment.ts

echo "[deploy] building and starting the app container (profile: app)..."
docker compose --profile app up -d --build

echo "[deploy] waiting for readiness at ${APP_URL}/ready..."
npx tsx scripts/waitForReady.ts "${APP_URL}/ready"

echo "[deploy] running smoke tests against ${APP_URL}..."
npx tsx scripts/smokeTest.ts "${APP_URL}"

echo "[deploy] deployment complete."
