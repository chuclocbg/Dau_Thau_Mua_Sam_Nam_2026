#!/bin/sh
# ── Rollback Script — Phase X.9.5 ──────────────────────────────────────────────
# The reasoning API server is stateless -- src/bootstrap/buildApplication.ts (frozen since
# X.9.1) constructs an in-memory Knowledge Platform on every process start, with no persisted
# application state. Rollback is therefore simply "redeploy a previous, known-good git ref" --
# there is no data migration to reverse for this server. For the Postgres/Redis/MinIO backing
# services' own restore procedure (a separate, Phase M0 concern), see docs/infrastructure.md's
# "Restore Strategy" section -- intentionally not duplicated here.
#
# Run with a clean working tree (this checks out a ref, which fails or gets confusing with
# uncommitted local changes) -- ideally from CI or a dedicated deploy checkout, not a dev machine.
set -e

REF="${1:?Usage: deployment/rollback.sh <git-ref>}"
APP_PORT="${APP_PORT:-3000}"
APP_URL="${APP_URL:-http://localhost:${APP_PORT}}"

echo "[rollback] checking out ${REF}..."
git checkout "${REF}"

echo "[rollback] validating environment (fail fast before rebuilding)..."
npx tsx scripts/validateEnvironment.ts

echo "[rollback] rebuilding and restarting the app container..."
docker compose --profile app up -d --build

echo "[rollback] waiting for readiness at ${APP_URL}/ready..."
npx tsx scripts/waitForReady.ts "${APP_URL}/ready"

echo "[rollback] running smoke tests against ${APP_URL}..."
npx tsx scripts/smokeTest.ts "${APP_URL}"

echo "[rollback] rollback to ${REF} complete."
