/**
 * Phase 14 — Request Mapper
 *
 * Maps an inbound HttpRequest to a GovernanceContext.
 *
 * Convention — actor identity comes from request HEADERS (set by auth middleware):
 *   X-Actor-Id         → actor.id    (default: 'anonymous')
 *   X-Actor-Role       → actor.role  (default: 'GUEST')
 *   X-Governance-Date  → currentDate (default: today YYYY-MM-DD)
 *   X-Request-Id       → requestId   (default: auto-generated)
 *   X-Organization     → organization (optional)
 *   X-Department       → department  (optional)
 *   X-Trace-Id         → traceId     (optional)
 *   X-Locale           → locale      (optional, default 'vi-VN')
 *
 * Convention — domain parameters come from the request BODY (JSON):
 *   packageValue       → number, maps to RuleContext.amount
 *   fundingSource      → string, maps to RuleContext.fundingCode
 *   effectiveDate      → string (YYYY-MM-DD), overrides currentDate for config resolution
 *   procurementType    → string
 *   assetCategory      → string
 *
 * Pure. No I/O. No side effects. No any. No React. No browser globals.
 */

import type { HttpRequest }    from './ports';
import { generateGovernanceContext } from '../application/governanceContext';
import type { GovernanceContext }    from '../application/governanceContext';

// ─── Internal helpers ──────────────────────────────────────────────────────────

function todayISO(): string {
  // ponytail: non-deterministic — tests pass X-Governance-Date header for determinism
  return new Date().toISOString().slice(0, 10);
}

function newRequestId(): string {
  // ponytail: non-deterministic — tests pass X-Request-Id header for determinism
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function header(req: HttpRequest, name: string): string | undefined {
  const val = req.headers[name];
  return typeof val === 'string' ? val : undefined;
}

function bodyField(req: HttpRequest, key: string): unknown {
  if (req.body === null || typeof req.body !== 'object') return undefined;
  return (req.body as Record<string, unknown>)[key];
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

/**
 * Builds a GovernanceContext from an inbound HTTP request.
 *
 * Identity (actor, date, request tracking) is extracted from headers.
 * Domain parameters (packageValue, fundingSource, etc.) are extracted from body.
 * Unknown or missing fields are silently omitted — no 400 is raised here;
 * downstream service methods validate what they need.
 */
export function contextFromRequest(req: HttpRequest): GovernanceContext {
  const pv = bodyField(req, 'packageValue');
  const fs = bodyField(req, 'fundingSource');
  const ed = bodyField(req, 'effectiveDate');
  const pt = bodyField(req, 'procurementType');
  const ac = bodyField(req, 'assetCategory');

  return generateGovernanceContext({
    currentDate:     header(req, 'x-governance-date') ?? todayISO(),
    actor: {
      id:   header(req, 'x-actor-id')   ?? 'anonymous',
      role: header(req, 'x-actor-role') ?? 'GUEST',
    },
    requestId:       header(req, 'x-request-id') ?? newRequestId(),
    organization:    header(req, 'x-organization'),
    department:      header(req, 'x-department'),
    traceId:         header(req, 'x-trace-id'),
    locale:          header(req, 'x-locale'),
    packageValue:    typeof pv === 'number'  ? pv  : undefined,
    fundingSource:   typeof fs === 'string'  ? fs  : undefined,
    effectiveDate:   typeof ed === 'string'  ? ed  : undefined,
    procurementType: typeof pt === 'string'  ? pt  : undefined,
    assetCategory:   typeof ac === 'string'  ? ac  : undefined,
  });
}
