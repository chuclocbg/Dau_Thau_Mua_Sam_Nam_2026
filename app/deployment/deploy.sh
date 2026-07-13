#!/bin/sh
# ── Deployment Script — Phase X.9.5, extended X.15 ─────────────────────────────
# Orchestrates a deploy: validate environment -> build+start the app container (X.9.4's opt-in
# Compose profile) -> wait for readiness -> scan for interrupted conversation turns from any
# prior deployment -> run the smoke test suite. Reuses X.9.4's validateEnvironment.ts, X.9.5's
# waitForReady.ts/smokeTest.ts, and X.13's scripts/recoveryScan.ts -- no duplicated health-check,
# config-loading, startup, or recovery logic. Run from the app/ directory.
#
# X.15 ADDITION, per ADR_X15_ARCHITECTURE_DECISION.md: runs scripts/recoveryScan.ts (Phase X.13,
# unmodified) once the new deployment is confirmed ready, so any PENDING recovery marker left by
# a crashed prior process gets processed before the deployment is considered complete. Per the
# ADR's explicit scope, this wires the recovery SCAN only -- no HTTP route creates recovery
# markers yet (recovery-producer wiring was deliberately deferred), so in practice this step
# currently finds an empty queue; it is included now so the capability is genuinely exercised
# end-to-end as part of a real deployment, ready for the day a producer is wired.
set -e

APP_PORT="${APP_PORT:-3000}"
APP_URL="${APP_URL:-http://localhost:${APP_PORT}}"

echo "[deploy] validating environment..."
npx tsx scripts/validateEnvironment.ts

echo "[deploy] building and starting the app container (profile: app)..."
docker compose --profile app up -d --build

echo "[deploy] waiting for readiness at ${APP_URL}/ready..."
npx tsx scripts/waitForReady.ts "${APP_URL}/ready"

echo "[deploy] scanning for interrupted conversation turns..."
npx tsx scripts/recoveryScan.ts

echo "[deploy] running smoke tests against ${APP_URL}..."
npx tsx scripts/smokeTest.ts "${APP_URL}"

echo "[deploy] deployment complete."
