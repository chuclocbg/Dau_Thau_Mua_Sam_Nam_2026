# Operational Runbook — Reasoning API Server

Covers the backend server (`src/server/main.ts` — Reasoning/Tool Calling/MCP/Multi-Agent/
Streaming, built X.9.1-X.9.3; hardened with observability X.9.2, Docker/config X.9.4). Does
**not** cover the Vite/React frontend (`App.tsx`) or the Phase M0 backing services
(Postgres/pgAdmin/Redis/MinIO) — see `docs/infrastructure.md` for those.

**Sequencing note:** this runbook was correctly deferred until a real deployment target existed
(Phase X.9.4) — writing "how to restart the process" before there was a process to restart would
have described nothing real. It is written now that `Dockerfile`/`docker-compose.yml`'s `app`
service exist.

---

## Quick Reference

| Action | Command |
|---|---|
| Start (production, containerized) | `deployment/deploy.sh` (or `docker compose --profile app up -d --build`) |
| Start (development, containerized) | `docker compose --profile dev up app-dev` |
| Start (bare host) | `npm run server` |
| Stop | `docker compose stop app` (or `Ctrl+C` / `SIGTERM` on the host process) |
| Restart | `docker compose restart app` |
| View logs (container) | `docker compose logs -f app` |
| View logs (bare host) | stdout, structured JSON lines (one line per event) |
| Check liveness | `curl http://localhost:3000/live` |
| Check readiness | `curl http://localhost:3000/ready` |
| Check aggregated health | `curl http://localhost:3000/health` |
| Run the full smoke test suite | `npx tsx scripts/smokeTest.ts http://localhost:3000` |
| Wait for a fresh deploy to become ready | `npx tsx scripts/waitForReady.ts http://localhost:3000/ready` |
| Validate configuration without starting | `npx tsx scripts/validateEnvironment.ts` |
| Roll back to a previous release | `deployment/rollback.sh <git-ref>` |

The process shuts down gracefully on `SIGTERM`/`SIGINT` (`src/startup/gracefulShutdown.ts`,
frozen since X.9.1): it stops accepting new connections, lets in-flight requests finish (up to
`SHUTDOWN_TIMEOUT_MS`, default 10s), then exits. `docker compose stop`/`restart` send `SIGTERM`
by default — no forced kill needed for a normal restart.

---

## Common Incidents

### Server won't start

1. Run `npx tsx scripts/validateEnvironment.ts` — if it reports `FAILED`, the printed
   `[CODE] message` names exactly which environment variable is invalid (reuses the same
   `loadAppConfigFromEnv()` the server itself uses — if validation passes here, configuration is
   not the cause).
2. Check container logs: `docker compose logs app` (or `app-dev`). A crash before the first
   `"stream started"`/`"request received"` log line usually means a port conflict
   (`Error: listen EADDRINUSE`) or the healthcheck/entrypoint script failing before `exec`.
3. Confirm the image actually built: `docker compose --profile app build app` — a failed `npm ci`
   (network issue, lockfile mismatch) will surface here.

### `GET /ready` returns 503 / `"ready": false`

`src/health/healthCheck.ts` (frozen, X.9.1) reports `false` only when a **configured** MCP
client's `getStatus()` is not `CONNECTED` — the in-memory reasoning path itself has no external
dependency to fail (`checks: [{ name: "reasoning-engine", ok: true, ... }]` is always present and
always `ok`). Look at the `checks` array in the response body:

- `mcp-client` present and `ok: false` → the configured MCP server is unreachable or the
  connection was never established. This is a caller-side deployment decision (`buildApplication`
  only builds an `MCPClient` when one is explicitly supplied — check whatever code path wires
  this deployment's MCP configuration) — not a defect in the frozen health-check logic itself.
- No `mcp-client` entry at all → no MCP client is configured for this deployment; readiness will
  always report `true` for the reasoning-engine check alone. If `/ready` is still 503 in this
  case, something is wrong with the health-check wiring itself — treat as a P1, check
  `docker compose logs app` for a crash loop.

### High latency / slow responses

1. Check `GET /health` for `uptimeSeconds` — a very low uptime right after a deploy means cold
   process start, not a real latency problem; wait a few seconds and recheck.
2. The reasoning path itself is in-memory and deterministic (no network I/O) — genuine latency
   almost always means either (a) a configured, slow/unreachable MCP tool call (bounded by
   `STREAM_TIMEOUT_MS` for the streaming endpoint, and by `MCPClient`'s own internal timeout for
   the non-streaming path), or (b) host-level resource pressure (CPU/memory), not application
   logic.
3. Structured logs (`stream completed`/`request completed`) carry a `durationMs` field on every
   line — grep for outliers: `docker compose logs app | grep '"durationMs":[0-9]\{4,\}'` (four+
   digit millisecond durations).

### Elevated error rate

1. `docker compose logs app | grep '"level":"error"'` — every error-mapped request logs
   `errorCode`/`message` via `src/middleware/requestLifecycleHooks.ts`'s error handler (frozen,
   X.9.2).
2. `INVALID_REQUEST`/`VALIDATION_ERROR` spikes usually mean a client-side integration bug
   (malformed request bodies), not a server problem — check the `message` field for which
   validation failed.
3. `INTERNAL_ERROR` (5xx) spikes are the only category that should page anyone — the message is
   redacted in production (`NODE_ENV=production`), so check `traceId`/`requestId` in the log line
   and correlate with any upstream proxy/load-balancer logs if the real cause isn't obvious from
   context.

### Container `HEALTHCHECK` reports unhealthy

The `Dockerfile`'s `HEALTHCHECK` (X.9.4) curls the container's own `/live` — if that fails
repeatedly, the process inside the container is not responding on its configured port at all.
Treat identically to "Server won't start" above; `docker compose ps` shows the `unhealthy` state
and restart count.

---

## Escalation

This project has no on-call rotation or paging system configured (out of scope for Phase X —
not fabricated here). If an incident requires escalation, follow whatever the organization's
existing on-call process is; this runbook only covers *what to check*, not *who to page*.

---

## Useful Commands Reference

```bash
# Full status of the Compose stack (backing services + app, if running)
docker compose ps

# Tail structured logs, filtering to errors only
docker compose logs -f app | grep '"level":"error"'

# One-off health check without curl (uses Node's own fetch, matches the container's own HEALTHCHECK)
docker compose exec app node -e "fetch('http://127.0.0.1:3000/live').then(r=>r.json()).then(console.log)"

# Full smoke test against a running deployment (local, staging, or production — pass its URL)
npx tsx scripts/smokeTest.ts https://your-deployment-url.example
```
