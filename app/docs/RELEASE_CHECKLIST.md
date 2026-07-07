# Release Checklist — Reasoning API Server

A step-by-step checklist for shipping a change to the backend server (`src/server/main.ts` and
everything it composes). Every command below already exists in this repository — this checklist
sequences them, it does not introduce new verification logic.

---

## Pre-Release (before merging / before tagging)

- [ ] `npm test` (full suite) — 0 failures. As of Phase X.9.5's freeze: 515+ files, 14,500+
      tests, 0 failures — confirm the count hasn't regressed.
- [ ] `npx tsc --noEmit -p tsconfig.app.json` — no new type errors introduced by the change
      (this repository has pre-existing, unrelated type errors outside Phase X's scope — confirm
      your change doesn't add to `src/reasoning/`, `src/mcp/`, `src/multiagent/`, `src/server/`,
      or any other Phase X directory's error count, not that the whole repo is error-free).
- [ ] Every architecture-guard test relevant to the touched milestone still passes (each
      `x9*-*-architecture.test.ts` file lists exactly which frozen files it protects).
- [ ] `npx tsx scripts/validateEnvironment.ts` — passes for both an empty environment
      (development profile) and `NODE_ENV=production`.

## Release (building and deploying)

- [ ] Tag the release: `git tag -a vX.Y.Z -m "..."` (or your project's actual tagging
      convention) at the commit being deployed — this is the `<git-ref>`
      `deployment/rollback.sh` would use if this release needs reverting.
- [ ] `deployment/deploy.sh` (or the individual steps it wraps, if deploying to an environment
      without Docker Compose available):
  - [ ] Environment validated (`scripts/validateEnvironment.ts`)
  - [ ] Image built and container started (`docker compose --profile app up -d --build`)
  - [ ] Readiness confirmed (`scripts/waitForReady.ts`)
  - [ ] Smoke tests passed (`scripts/smokeTest.ts`) — exercises `/live`, `/ready`, `/health`,
        `POST /api/v1/reasoning/answer`, `POST /api/v1/reasoning/batch`, and
        `POST /api/v1/reasoning/answer/stream` against the real, running deployment.

## Post-Release (after traffic is live)

- [ ] `npx tsx scripts/smokeTest.ts <production-url>` — re-run against the actual production URL
      (not just the local/staging instance used during Release), since DNS/proxy/TLS
      configuration differences can surface issues a local smoke test wouldn't catch.
- [ ] Watch structured logs for `"level":"error"` for the first few minutes after traffic
      resumes (`docker compose logs -f app | grep '"level":"error"'`).
- [ ] Confirm `GET /health` reports `"status":"ok"` from the production URL itself, not just
      locally.

## If Something Goes Wrong

See `docs/RUNBOOK.md` for incident-specific guidance, and
`deployment/rollback.sh <previous-git-ref>` to revert — the previous release's tag (from the
Release step above) is exactly the ref to pass. See `docs/DISASTER_RECOVERY.md` for total
host-loss scenarios.

---

## What This Checklist Does Not Cover

- Frontend (`App.tsx`, Vite build) releases — a separate, unrelated application; this checklist
  is for the backend Reasoning API server only.
- Database migrations (Phase M1/Prisma) — this server's own reasoning path has no database
  dependency; if a future deployment adds one, that release process needs its own checklist
  entry for `npx prisma migrate deploy`, not fabricated here ahead of that need.
- Automated CI/CD pipeline wiring — no CI configuration exists in this repository yet (confirmed
  during the Production Hardening Audit); this checklist is manually followed until one exists.
