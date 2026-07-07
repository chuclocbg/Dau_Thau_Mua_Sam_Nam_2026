import Fastify from 'fastify'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { checkLiveness, checkReadiness, checkHealth } from '../health/healthCheck.ts'
import { registerReasoningRoutes } from '../api/reasoningRoutes.ts'
import { registerCoordinatorRoutes } from '../api/coordinatorRoutes.ts'
import type { Application } from '../bootstrap/buildApplication.ts'

// ── HTTP Server — Phase X.9.1 ──────────────────────────────────────────────────
// Mirrors the exact Fastify-factory pattern already established by
// src/interface/restAdapter.ts (Phase 14): a pure builder function returning a configured
// FastifyInstance, with no .listen() call inside it — so it is testable via Fastify's own
// in-process inject() (as restAdapter.ts's own tests already do) without ever opening a real
// socket. The real, network-listening .listen() call lives only in server/main.ts.
//
// /live: liveness probe — always 200 once the process can respond at all (no dependency checks;
// standard k8s liveness semantics: "should this container be restarted?").
// /ready: readiness probe — 200 when checkReadiness() reports ready, 503 otherwise ("should this
// container receive traffic?").
// /health: aggregated view for humans/dashboards, combining liveness + readiness.

export function buildHttpServer(app: Application): FastifyInstance {
  const server = Fastify({ logger: false })

  server.get('/live', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send(checkLiveness(app.startedAt))
  })

  server.get('/ready', async (_req: FastifyRequest, reply: FastifyReply) => {
    const readiness = checkReadiness(app)
    return reply.status(readiness.ready ? 200 : 503).send(readiness)
  })

  server.get('/health', async (_req: FastifyRequest, reply: FastifyReply) => {
    const health = checkHealth(app)
    return reply.status(health.status === 'ok' ? 200 : 503).send(health)
  })

  registerReasoningRoutes(server, app)
  registerCoordinatorRoutes(server, app)

  return server
}
