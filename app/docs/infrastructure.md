# Production Infrastructure Foundation (Phase M0 + Phase X.9.4)

Docker Compose stack providing PostgreSQL, pgAdmin, Redis, and MinIO as backing services for
local development and as the reference architecture for VPS/Linux production deployment. This
phase is configuration and documentation only — no Prisma models, no migrations, no application
code changes. Phase M1 (Production Prisma Layer) builds on top of the PostgreSQL container
configured here.

**Phase X.9.4 addition:** the application's backend HTTP server (`src/server/main.ts` — the
Fastify + Reasoning/Tool Calling/MCP/Multi-Agent/Streaming stack from X.9.1-X.9.3) can now
optionally run *inside* this same Compose stack too, via two new, opt-in `profiles` on the
existing `docker-compose.yml` — see "Application Container" below. The Phase M0 backing
services and their default (no-profile) startup behavior are completely unchanged.

**Verification status:** Docker is not installed in the environment this was authored in
(re-confirmed at time of the X.9.4 addition — `docker --version` still reports command not
found), so none of this — Phase M0's original services or the new application container — has
ever been started, run, or tested against a live container; no service has ever been up, no
healthcheck has ever passed, no image has ever actually been built. The only verification
performed for both the original stack and the X.9.4 addition was a YAML *syntax* parse
(`npx js-yaml docker-compose.yml`), confirming the file is well-formed — not that Compose accepts
it (`docker compose config` was not run), that the Dockerfile actually builds
(`docker build` was not run), or that any container starts. Everything below is a design that
must be verified the first time it actually runs — see "First-run checklist," now extended with
X.9.4 items.

---

## Architecture

```
                     ┌─────────────────────────────────────────┐
                     │         dtmsn_internal (bridge)          │
                     │                                           │
   host:5432 ───────►│  postgres   (postgres:17-alpine)         │
                     │      │  postgres_data volume              │
                     │      ▼                                    │
   host:5050 ───────►│  pgadmin    (dpage/pgadmin4:8)            │──► depends_on postgres (healthy)
                     │      pgadmin_data volume                   │
                     │                                           │
   host:6379 ───────►│  redis      (redis:7-alpine)              │
                     │      redis_data volume (AOF persistence)  │
                     │                                           │
   host:9000/9001 ──►│  minio      (minio/minio:latest)          │
                     │      minio_data volume                     │
                     │      │                                    │
                     │      ▼                                    │
                     │  minio-init (minio/mc, one-shot)          │──► depends_on minio (healthy)
                     │      creates attachments/backups buckets   │
                     └─────────────────────────────────────────┘

  By default, the Node app (npm run dev / npm run server) runs on the HOST,
  outside Docker, connecting to each service via its published localhost
  port. Since Phase X.9.4, the backend server can OPTIONALLY also join this
  same network as an `app`/`app-dev` container (opt-in, see "Application
  Container" below) — never on by default.
```

**Why the app stays off the container network *by default*:** Vite's dev server, hot reload, and
the existing `npm run dev` workflow are unaffected; only the database/cache/object-store layer
changes by default. Phase X.9.4 adds the option to also run the *backend* server (not the Vite
frontend — a separate, unrelated app) inside the same network, opt-in via Compose profiles — see
below.

---

## Application Container (Phase X.9.4)

The backend HTTP server (`src/server/main.ts`) can run two ways:

1. **On the host**, exactly as before X.9.4 — `npm run server`, connecting to the backing
   services above via their published `localhost` ports. Unchanged.
2. **Inside the same Compose stack**, via one of two new, opt-in services added to the existing
   `docker-compose.yml` (not a second compose file, not a competing container strategy):

| Service | Profile | Purpose | Image |
|---|---|---|---|
| `app` | `app` | Production-shaped run — built image, no source mount | `Dockerfile`, target `runtime` |
| `app-dev` | `dev` | Development run — dependency layer only, `./src`/`./scripts` bind-mounted for iteration without a rebuild, `tsx watch` for auto-restart | `Dockerfile`, target `deps` |

Neither service starts with a bare `docker compose up -d` — Compose profiles are opt-in by
design, so the Phase M0 default behavior (backing services only) is unchanged for anyone who
doesn't pass `--profile`.

```bash
# Production-shaped run (builds the image, joins the existing dtmsn_internal network):
docker compose --profile app up -d --build

# Development run (bind-mounted source, auto-restart on save):
docker compose --profile dev up app-dev
```

Both services join the **same** `dtmsn_internal` network the backing services already use —
addressable as `postgres`/`redis`/`minio` from inside the app container by service name, exactly
like every other service in this file.

**Dockerfile** (`Dockerfile`, repo root, alongside `docker-compose.yml`): a two-stage build —
`deps` (installs dependencies via `npm ci`) and `runtime` (the deployed image: copies
`node_modules` from `deps`, copies `src`/`scripts`, runs as a non-root user, exposes port 3000,
declares a `HEALTHCHECK` against the real `/live` endpoint). **Honest build-tooling note:** this
repository has no dedicated backend bundler — the container runs the TypeScript source directly
via `tsx` (already an existing devDependency), the same way `npm run server` already does on the
host, rather than introducing a new esbuild/tsc bundling step. `tsx` therefore ships in the final
image; this is a real image-size trade-off, made deliberately and documented in the Dockerfile
itself rather than hidden. A full-project `tsc --noEmit` build-time gate was considered and
deliberately **not** included: this repository has pre-existing type errors in modules unrelated
to Phase X (confirmed during the Production Hardening Audit), which would make the image fail to
build through no fault of the application code being containerized — out of scope to fix here.

**Environment validation / secrets loading / configuration diagnostics** (`src/config/`,
`src/startup/`, Phase X.9.4): `scripts/validateEnvironment.ts` (run via
`npx tsx scripts/validateEnvironment.ts`) loads a local `.env` if present (reusing the existing,
previously-unused `dotenv` dependency), resolves a configuration *profile* (`development`/
`production`/`test`, from `NODE_ENV`) that supplies profile-appropriate defaults (e.g.
`LOG_FORMAT=pretty` in development, `json` in production) for any env var not explicitly set,
then validates the result through the same, unmodified `loadAppConfigFromEnv()` every prior X.9
milestone has used since X.9.1 — never a second config parser. `scripts/start-prod.sh` /
`scripts/start-dev.sh` run this validation before `exec`-ing the real, unmodified
`src/server/main.ts` entrypoint (`start-dev.sh` via `tsx watch` for auto-restart; failures there
are logged but non-fatal, since a broken `.env` shouldn't block iterating on code that doesn't
touch configuration).

---

## Services

| Service | Image | Purpose | Host port(s) |
|---|---|---|---|
| `postgres` | `postgres:17-alpine` | Canonical production database (Phase M1 target) | `POSTGRES_PORT` (default 5432) |
| `pgadmin` | `dpage/pgadmin4:8` | Web GUI for inspecting/administering Postgres | `PGADMIN_PORT` (default 5050) |
| `redis` | `redis:7-alpine` | Cache / session store for future use (AOF persistence enabled) | `REDIS_PORT` (default 6379) |
| `minio` | `minio/minio:latest` | S3-compatible object storage — production target for the Storage module's provider | `MINIO_API_PORT` (9000), `MINIO_CONSOLE_PORT` (9001) |
| `minio-init` | `minio/mc:latest` | One-shot job: creates `attachments` and `backups` buckets, then exits | — |
| `app` *(Phase X.9.4, opt-in, profile `app`)* | built from `Dockerfile` | The backend Reasoning/Tool Calling/MCP/Multi-Agent HTTP + SSE server | `APP_PORT` (default 3000) |
| `app-dev` *(Phase X.9.4, opt-in, profile `dev`)* | built from `Dockerfile`, target `deps` | Same server, source bind-mounted, `tsx watch` | `APP_PORT` (default 3000) |

**Image pinning note:** `minio/minio:latest` and `minio/mc:latest` are unpinned in this draft
because no internet-verified tag was available while authoring it. Before production use, pin
both to a specific dated release tag (`docker pull minio/minio:latest` then read the resolved
digest, or check hub.docker.com for the current release tag) and record the tag in this file.

---

## Persistent Volumes

Four named Docker volumes, one per stateful service — nothing is stored in bind-mounted host
directories, so `docker compose down` (without `-v`) never touches data:

| Volume | Mounted at | Contents |
|---|---|---|
| `postgres_data` | `/var/lib/postgresql/data` | All database files |
| `pgadmin_data` | `/var/lib/pgadmin` | pgAdmin's own config/session store |
| `redis_data` | `/data` | Redis AOF (append-only file) persistence |
| `minio_data` | `/data` | Object storage buckets and objects |

`docker compose down -v` deletes all four — never run that against a populated environment
without a fresh backup first (see Backup Strategy).

---

## Network Isolation

All five services share one user-defined bridge network, `dtmsn_internal`, created solely for
this stack. Containers address each other by service name (`postgres`, `redis`, `minio`) — never
by `localhost`, which inside a container refers to that container itself. Only the ports declared
under each service's `ports:` block are published to the host; nothing else on the network is
reachable from outside the Docker host.

---

## Health Checks & Startup Order

| Service | Health check | Interval | Effect |
|---|---|---|---|
| `postgres` | `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` | 5s | `pgadmin` waits for `service_healthy` |
| `pgadmin` | `wget` against pgAdmin's `/misc/ping` endpoint | 10s | — |
| `redis` | `redis-cli -a $REDIS_PASSWORD ping` expects `PONG` | 5s | — |
| `minio` | `mc ready local` | 5s | `minio-init` waits for `service_healthy` |
| `minio-init` | (one-shot, no health check) | — | exits after creating buckets; safe to re-run |

Startup order is enforced only where there's a real dependency: `pgadmin` will not start until
Postgres reports healthy, and `minio-init` will not run until MinIO reports healthy. `redis` has
no dependents in this phase and starts independently. There is intentionally no dependency from
Postgres/Redis/MinIO onto anything else — they are the leaves of this graph.

---

## Backup Strategy

**PostgreSQL** — logical backup via `pg_dump`, run from the host against the published port:

```bash
docker exec dtmsn_postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -F c -f /tmp/backup.dump
docker cp dtmsn_postgres:/tmp/backup.dump ./backups/postgres/$(date +%Y%m%d-%H%M%S).dump
```

For a full physical backup instead, stop the stack and archive the `postgres_data` volume
directly (`docker run --rm -v dtmsn_postgres_data:/data -v "$PWD/backups":/backup alpine tar czf /backup/postgres_data_$(date +%Y%m%d).tgz -C /data .`).

**MinIO** — mirror buckets to the local `backups/` bucket (or an external MinIO/S3 target) using
`mc mirror`:

```bash
docker run --rm --network dtmsn_internal minio/mc \
  mc mirror local/attachments local/backups/attachments-$(date +%Y%m%d)
```

**Redis** — the `redis_data` volume already contains an AOF file; snapshot it the same way as the
Postgres physical backup above, or trigger `BGSAVE` and copy the resulting RDB file.

**Schedule:** not automated in Phase M0 — this documents the commands; wiring them into a cron
job / scheduled task is a deployment-time decision, tracked as a follow-up.

---

## Restore Strategy

**PostgreSQL** (logical):

```bash
docker cp ./backups/postgres/<file>.dump dtmsn_postgres:/tmp/restore.dump
docker exec dtmsn_postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists /tmp/restore.dump
```

**PostgreSQL** (physical volume restore): stop the stack, `docker volume rm dtmsn_postgres_data`,
recreate it, extract the archived tarball into it, then `docker compose up -d postgres`.

**MinIO**: `mc mirror` in reverse (`mc mirror local/backups/attachments-<date> local/attachments`).

**Redis**: stop the container, replace the AOF/RDB file inside the `redis_data` volume, restart.

Always restore into a scratch environment and verify before pointing production traffic at
restored data — not automated or tested in this phase.

---

## Migration Workflow (Phase M1 handoff)

This phase does not create any Prisma models or migrations. Once Phase M1 begins:

1. `docker compose up -d postgres` (this stack must already be running).
2. `npx prisma migrate dev --name <description>` reads `DATABASE_URL` from `.env` and applies
   migrations directly against the containerized Postgres via its published `localhost` port.
3. Migration history lives in Postgres's `_prisma_migrations` table (inside the `postgres_data`
   volume) plus the checked-in `prisma/migrations/` SQL files — both must be kept in sync.
4. Production deployment applies the same migration files with `npx prisma migrate deploy`
   (never `migrate dev`, which can prompt for destructive resets).

---

## Development Workflow

```bash
cp .env.example .env        # fill in real values, this file is git-ignored
docker compose up -d        # starts postgres, pgadmin, redis, minio, then minio-init runs once
docker compose ps           # confirm all four long-running services show "healthy"
npm run dev                 # the app itself runs on the host, unchanged
```

To stop without losing data: `docker compose down` (volumes persist). To tear down completely
(deletes all data): `docker compose down -v`.

---

## Production Workflow

For a Linux/VPS target, the same `docker-compose.yml` is the reference — it is deliberately
platform-agnostic (no Windows-specific paths, no bind mounts). Differences from local dev:

- Use `.env.template` (not `.env.example`) if the app is deployed separately from this stack.
- Set `PGADMIN_CONFIG_SERVER_MODE` back to a properly configured multi-user mode (or omit
  `pgadmin` entirely) rather than the single-user desktop mode used for local dev.
- Do not publish `PGADMIN_PORT` / `MINIO_CONSOLE_PORT` to a public interface — front them with a
  reverse proxy and authentication, or bind them to `127.0.0.1` only.
- Automate the backup commands above via cron/systemd timers.
- Pin every image to an exact digest (see the image-pinning note above) before first production
  deploy.

---

## First-Run Checklist

Not yet executed — run this the first time Docker is available, and update this section with the
actual result (do not mark items done without having run them):

- [ ] `docker compose config` — validates the compose file parses and `.env` substitution resolves
- [ ] `docker compose up -d` — all containers start
- [ ] `docker compose ps` — postgres, pgadmin, redis, minio all reach `healthy`; minio-init exits 0
- [ ] `psql` (or pgAdmin) connects to Postgres using the `.env` credentials
- [ ] `redis-cli -a $REDIS_PASSWORD ping` returns `PONG`
- [ ] MinIO console reachable at `http://localhost:9001`; `attachments` and `backups` buckets exist
- [ ] `docker compose down` / `docker compose up -d` again — data survives (volumes persisted)

**Phase X.9.4 additions (also not yet executed):**

- [ ] `docker build -t dtmsn-app --target runtime .` — the production image builds successfully
- [ ] `docker compose --profile app up -d --build` — the `app` service starts and reaches `healthy`
- [ ] `curl http://localhost:3000/live` — returns `{"status":"ok",...}` from the containerized server
- [ ] `curl http://localhost:3000/health` — reports `ok` (readiness has no external dependency to
      probe for the in-memory reasoning path, per `src/health/healthCheck.ts`)
- [ ] `docker compose --profile dev up app-dev` — starts, source edits under `./src` trigger a
      `tsx watch` restart without rebuilding the image
- [ ] `npx tsx scripts/validateEnvironment.ts` — prints a valid configuration report for both an
      empty environment (development profile defaults) and `NODE_ENV=production`
