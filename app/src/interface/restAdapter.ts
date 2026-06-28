/**
 * Phase 14 — REST Adapter (Fastify)
 *
 * Fastify application factory that wires Application Services to HTTP routes.
 * Handlers are intentionally thin: validate → build context → call service → map response.
 * Zero business logic lives here.
 *
 * Routes:
 *   POST   /api/v1/procurement              → ProcurementService.startProcurement
 *   PUT    /api/v1/procurement/:instanceId  → ProcurementService.reviewProcurement
 *   GET    /api/v1/procurement/:instanceId  → ProcurementService.getProcurementStatus
 *   GET    /api/v1/legal/applicable         → LegalService.resolveApplicableLaw
 *   GET    /api/v1/legal/search             → LegalService.searchLaw  (?q=keyword)
 *   POST   /api/v1/workflow                 → WorkflowService.startWorkflow
 *   PUT    /api/v1/workflow/:instanceId     → WorkflowService.advanceWorkflow
 *   GET    /api/v1/workflow/:instanceId     → WorkflowService.getWorkflowHistory
 *   POST   /api/v1/audit/compliance         → AuditService.reviewCompliance
 *   GET    /api/v1/audit/rules              → AuditService.getAuditRules
 *   GET    /api/v1/dashboard                → DashboardService.getGovernanceDashboard
 *   GET    /api/v1/configuration            → ConfigurationService.resolveConfiguration (?type=X)
 *   POST   /api/v1/context                  → ConfigurationService.generateGovernanceContext
 *
 * Context is built from every request using contextFromRequest() (requestMapper.ts).
 * Responses are mapped from GovernanceResult via mapResultToResponse() (responseMapper.ts).
 *
 * No React. No UI. No browser globals.
 */

import Fastify from 'fastify';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { ProcurementService }   from '../application/procurementService';
import type { LegalService }         from '../application/legalService';
import type { WorkflowService }      from '../application/workflowService';
import type { AuditService }         from '../application/auditService';
import type { DashboardService }     from '../application/dashboardService';
import type { ConfigurationService } from '../application/configurationService';
import type { ConfigType }           from '../legal/governanceConfig';
import { contextFromRequest }        from './requestMapper';
import { mapResultToResponse }       from './responseMapper';

// ─── Service bundle ───────────────────────────────────────────────────────────

export interface AppServices {
  readonly procurement:   ProcurementService;
  readonly legal:         LegalService;
  readonly workflow:      WorkflowService;
  readonly audit:         AuditService;
  readonly dashboard:     DashboardService;
  readonly configuration: ConfigurationService;
}

// ─── Body type helpers ────────────────────────────────────────────────────────

function asBody(req: FastifyRequest): Record<string, unknown> {
  return (req.body !== null && typeof req.body === 'object')
    ? (req.body as Record<string, unknown>)
    : {};
}

function asQuery(req: FastifyRequest): Record<string, string | string[] | undefined> {
  return (req.query !== null && typeof req.query === 'object')
    ? (req.query as Record<string, string | string[] | undefined>)
    : {};
}

function asParams(req: FastifyRequest): Record<string, string> {
  return (req.params !== null && typeof req.params === 'object')
    ? (req.params as Record<string, string>)
    : {};
}

function toHttpReq(req: FastifyRequest) {
  return {
    headers: req.headers as Record<string, string | string[] | undefined>,
    body:    asBody(req),
    params:  asParams(req),
    query:   asQuery(req),
  };
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a configured Fastify instance with all governance routes registered.
 * logger is off by default; pass `{ logger: true }` for production use.
 */
export function buildRestAdapter(
  services: AppServices,
  opts: { logger?: boolean } = {},
): FastifyInstance {
  const app = Fastify({ logger: opts.logger ?? false });

  // ── Procurement ─────────────────────────────────────────────────────────────

  app.post('/api/v1/procurement', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = asBody(req);
    const ctx  = contextFromRequest(toHttpReq(req));
    const result = services.procurement.startProcurement(
      String(body['definitionId'] ?? ''),
      String(body['instanceId']   ?? ''),
      ctx,
    );
    const { httpStatus, body: resBody } = mapResultToResponse(result);
    return reply.status(httpStatus).send(resBody);
  });

  app.put('/api/v1/procurement/:instanceId', async (req: FastifyRequest, reply: FastifyReply) => {
    const body   = asBody(req);
    const params = asParams(req);
    const ctx    = contextFromRequest(toHttpReq(req));
    const result = services.procurement.reviewProcurement(
      params['instanceId'] ?? '',
      String(body['trigger'] ?? ''),
      ctx,
    );
    const { httpStatus, body: resBody } = mapResultToResponse(result);
    return reply.status(httpStatus).send(resBody);
  });

  app.get('/api/v1/procurement/:instanceId', async (req: FastifyRequest, reply: FastifyReply) => {
    const params = asParams(req);
    const ctx    = contextFromRequest(toHttpReq(req));
    const result = services.procurement.getProcurementStatus(params['instanceId'] ?? '', ctx);
    const { httpStatus, body: resBody } = mapResultToResponse(result);
    return reply.status(httpStatus).send(resBody);
  });

  // ── Legal ────────────────────────────────────────────────────────────────────

  app.get('/api/v1/legal/applicable', async (req: FastifyRequest, reply: FastifyReply) => {
    const ctx    = contextFromRequest(toHttpReq(req));
    const result = services.legal.resolveApplicableLaw(ctx);
    const { httpStatus, body: resBody } = mapResultToResponse(result);
    return reply.status(httpStatus).send(resBody);
  });

  app.get('/api/v1/legal/search', async (req: FastifyRequest, reply: FastifyReply) => {
    const q      = String(asQuery(req)['q'] ?? '');
    const ctx    = contextFromRequest(toHttpReq(req));
    const result = services.legal.searchLaw(q, ctx);
    const { httpStatus, body: resBody } = mapResultToResponse(result);
    return reply.status(httpStatus).send(resBody);
  });

  // ── Workflow ─────────────────────────────────────────────────────────────────

  app.post('/api/v1/workflow', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = asBody(req);
    const ctx  = contextFromRequest(toHttpReq(req));
    const result = services.workflow.startWorkflow(
      String(body['definitionId'] ?? ''),
      String(body['instanceId']   ?? ''),
      ctx,
    );
    const { httpStatus, body: resBody } = mapResultToResponse(result);
    return reply.status(httpStatus).send(resBody);
  });

  app.put('/api/v1/workflow/:instanceId', async (req: FastifyRequest, reply: FastifyReply) => {
    const body   = asBody(req);
    const params = asParams(req);
    const ctx    = contextFromRequest(toHttpReq(req));
    const result = services.workflow.advanceWorkflow(
      params['instanceId'] ?? '',
      String(body['trigger'] ?? ''),
      ctx,
    );
    const { httpStatus, body: resBody } = mapResultToResponse(result);
    return reply.status(httpStatus).send(resBody);
  });

  app.get('/api/v1/workflow/:instanceId', async (req: FastifyRequest, reply: FastifyReply) => {
    const params = asParams(req);
    const ctx    = contextFromRequest(toHttpReq(req));
    const result = services.workflow.getWorkflowHistory(params['instanceId'] ?? '', ctx);
    const { httpStatus, body: resBody } = mapResultToResponse(result);
    return reply.status(httpStatus).send(resBody);
  });

  // ── Audit ────────────────────────────────────────────────────────────────────

  app.post('/api/v1/audit/compliance', async (req: FastifyRequest, reply: FastifyReply) => {
    const ctx    = contextFromRequest(toHttpReq(req));
    const result = services.audit.reviewCompliance(ctx);
    const { httpStatus, body: resBody } = mapResultToResponse(result);
    return reply.status(httpStatus).send(resBody);
  });

  app.get('/api/v1/audit/rules', async (req: FastifyRequest, reply: FastifyReply) => {
    const ctx    = contextFromRequest(toHttpReq(req));
    const result = services.audit.getAuditRules(ctx);
    const { httpStatus, body: resBody } = mapResultToResponse(result);
    return reply.status(httpStatus).send(resBody);
  });

  // ── Dashboard ────────────────────────────────────────────────────────────────

  app.get('/api/v1/dashboard', async (req: FastifyRequest, reply: FastifyReply) => {
    const ctx    = contextFromRequest(toHttpReq(req));
    const result = services.dashboard.getGovernanceDashboard(ctx);
    const { httpStatus, body: resBody } = mapResultToResponse(result);
    return reply.status(httpStatus).send(resBody);
  });

  // ── Configuration ────────────────────────────────────────────────────────────

  app.get('/api/v1/configuration', async (req: FastifyRequest, reply: FastifyReply) => {
    const type   = String(asQuery(req)['type'] ?? '') as ConfigType;
    const ctx    = contextFromRequest(toHttpReq(req));
    const result = type
      ? services.configuration.resolveConfiguration(type, ctx)
      : services.configuration.resolveConfiguration('PROCUREMENT_THRESHOLD', ctx);
    const { httpStatus, body: resBody } = mapResultToResponse(result);
    return reply.status(httpStatus).send(resBody);
  });

  app.post('/api/v1/context', async (req: FastifyRequest, reply: FastifyReply) => {
    const ctx    = contextFromRequest(toHttpReq(req));
    const result = { status: 'SUCCESS' as const, data: ctx,
      messages: ['Context generated.'], warnings: [], errors: [],
      confidence: 1.0, auditTrail: [], legalReferences: [],
      generatedArtifacts: [], metadata: {} };
    return reply.status(200).send(result);
  });

  return app;
}
