# Disaster Recovery Guide — Reasoning API Server

**Scope:** the backend server (`src/server/main.ts`) built across X.9.1-X.9.5. For the Phase M0
backing services (Postgres/pgAdmin/Redis/MinIO) — which this server's own reasoning path does
**not** use — see `docs/infrastructure.md`'s existing "Backup Strategy"/"Restore Strategy"
sections; not duplicated here.

---

## The application server is stateless — this changes what "disaster recovery" means

`src/bootstrap/buildApplication.ts` (frozen since X.9.1) constructs a fresh, **in-memory**
Knowledge Platform on every process start — confirmed by direct inspection, not assumed. There is
no database, no file, no volume the reasoning server itself writes to or reads persisted state
from. Concretely, this means:

- **RPO (Recovery Point Objective) for the application server itself: not applicable.** There is
  no data to lose, because there is no data to begin with. Every restart starts from the same,
  known, empty-but-correct state.
- **RTO (Recovery Time Objective) for the application server itself: the time to redeploy.** Since
  there's no data to restore, "recovery" is simply starting a new, healthy process from a known
  good image/git ref — see `deployment/deploy.sh`/`deployment/rollback.sh`.
- **This is an honest, existing limitation, not a disaster-recovery feature.** The in-memory
  Knowledge Platform (`buildMemoryKnowledgeRepositories()`) is the only `IKnowledgePlatform`
  implementation this repository has ever exercised end-to-end — a Prisma-backed persistence
  layer exists in this codebase but has never been verified against a live database
  (`.memory/repository-health.md`). Swapping it in is a separate, future, explicitly-authorized
  migration; this guide does not assume it has happened.

**What this means in practice:** if the container/process/host running this server is lost
entirely, disaster recovery is: redeploy. There is no backup to restore for the application
layer.

---

## Recovery Procedures

### The process crashed / the container is unhealthy

Not a disaster — this is the "Server won't start" / "Container HEALTHCHECK reports unhealthy"
section of `docs/RUNBOOK.md`. Docker Compose's `restart: unless-stopped` policy (already set on
the `app` service, X.9.4) restarts it automatically in most cases.

### The deploy target (host/VM/container platform) is lost entirely

1. Provision a new host per `docs/infrastructure.md`'s Production Workflow (Docker + Compose).
2. Clone the repository at the last known-good git ref/tag.
3. Copy `.env` (from your secrets manager / secure backup — **never** from git, it is
   git-ignored) onto the new host.
4. Run `deployment/deploy.sh` — this validates the environment, builds the image, starts the
   container, waits for readiness, and runs the smoke test suite, exactly as a normal deploy
   would. There is no separate "disaster" deploy path, because there is no state to restore
   first — the same script that deploys a routine release also recovers from total host loss.
5. Point traffic (DNS/load balancer) at the new host once smoke tests pass.

**RTO for this scenario:** dominated by host provisioning time, not by this application — the
deploy itself (steps 2-4) takes as long as a normal deployment.

### A bad release needs to be reverted

`deployment/rollback.sh <git-ref>` — checks out a previous ref, rebuilds, restarts, waits for
readiness, and smoke-tests. See `docs/RUNBOOK.md` for the full command reference and
`docs/RELEASE_CHECKLIST.md` for how releases should be tagged so a "previous good ref" is always
identifiable.

### The `.env` file / secrets are lost

Secrets for this server (`PORT`/`HOST`/`NODE_ENV`/`LOG_LEVEL`/etc. — see `src/config/appConfig.ts`)
are not actually secret-shaped today — the server itself requires no API keys or credentials (its
reasoning path is LLM-free by design). If an MCP server endpoint or credential is configured for
a specific deployment, that value's recovery is whatever secrets-management process that
deployment's operator uses (a password manager, a cloud secrets store, etc.) — out of this
repository's scope to prescribe, since none is configured by default.

---

## What Is Explicitly Out of Scope Here

- **Backing services (Postgres/Redis/MinIO) backup/restore** — genuinely stateful, already
  documented in `docs/infrastructure.md`; this server doesn't use them, so duplicating that
  content here would drift out of sync. Cross-referenced, not copied.
- **Multi-region / multi-host failover** — no such topology exists in this project yet; would be
  a separate, explicitly-authorized infrastructure milestone.
- **Automated backup scheduling** — `docs/infrastructure.md` already states Phase M0's backup
  commands are "not automated... tracked as a follow-up"; unchanged by this milestone, not
  fabricated as solved here.
