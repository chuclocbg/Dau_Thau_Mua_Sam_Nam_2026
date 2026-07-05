/**
 * Procurement API adapters — JSON request/response wrappers.
 *
 * Pure functions; no HTTP wiring. Mount to any framework:
 *   Express:   app.post('/evaluate', (req, res) => res.json(handleEvaluate(req.body)))
 *   Fastify:   fastify.post('/evaluate', async (req) => handleEvaluate(req.body))
 *
 * All validation returns a typed error in the response; never throws.
 */

import type {
  ProcurementCase,
  ProcurementDecision,
  PackageClassification,
  MethodDecision,
  ApprovalDecision,
  ProcurementPackageKind,
  FundSource,
} from '../domain/procurementTypes';
import { isPackageType } from '../domain/procurementTypes';
import { ProcurementEngine } from '../application/procurementEngine';

// Singleton engine (all state is in the rule definitions — safe to share)
const engine = new ProcurementEngine();

// ─── Request / response types ────────────────────────────────────────────────

export interface EvaluateRequest {
  readonly id?:              string;
  readonly packageType:      string;
  readonly estimatedValue:   number;
  readonly fundSource?:      string;
  readonly isUrgent?:        boolean;
  readonly isNationalSec?:   boolean;
  readonly isInternational?: boolean;
  readonly singleSource?:    boolean;
  readonly asOfDate?:        string;
}

export interface ApiSuccess<T> {
  readonly ok:   true;
  readonly data: T;
}

export interface ApiError {
  readonly ok:      false;
  readonly error:   string;
  readonly field?:  string;
}

export type ApiResult<T> = ApiSuccess<T> | ApiError;

// ─── Input validation ─────────────────────────────────────────────────────────

function buildCase(req: EvaluateRequest): ProcurementCase | ApiError {
  if (!isPackageType(req.packageType))
    return { ok: false, error: `packageType '${req.packageType}' is not valid`, field: 'packageType' };
  if (typeof req.estimatedValue !== 'number' || req.estimatedValue < 0)
    return { ok: false, error: 'estimatedValue must be a non-negative number', field: 'estimatedValue' };

  const today = new Date().toISOString().slice(0, 10);
  return {
    id:              req.id             ?? crypto.randomUUID(),
    packageType:     req.packageType    as ProcurementPackageKind,
    estimatedValue:  req.estimatedValue,
    fundSource:      (req.fundSource ?? 'STATE') as FundSource,
    isUrgent:        req.isUrgent       ?? false,
    isNationalSec:   req.isNationalSec  ?? false,
    isInternational: req.isInternational ?? false,
    singleSource:    req.singleSource   ?? false,
    asOfDate:        req.asOfDate       ?? today,
  };
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export function handleEvaluate(req: EvaluateRequest): ApiResult<ProcurementDecision> {
  const pkg = buildCase(req);
  if ('error' in pkg) return pkg as ApiError;
  return { ok: true, data: engine.evaluate(pkg) };
}

export function handleClassify(req: EvaluateRequest): ApiResult<PackageClassification> {
  const pkg = buildCase(req);
  if ('error' in pkg) return pkg as ApiError;
  return { ok: true, data: engine.classifyPackage(pkg) };
}

export function handleMethod(req: EvaluateRequest): ApiResult<MethodDecision> {
  const pkg = buildCase(req);
  if ('error' in pkg) return pkg as ApiError;
  return { ok: true, data: engine.selectMethod(pkg) };
}

export function handleApproval(req: EvaluateRequest): ApiResult<ApprovalDecision> {
  const pkg = buildCase(req);
  if ('error' in pkg) return pkg as ApiError;
  return { ok: true, data: engine.resolveApproval(pkg) };
}

// ─── Example requests ─────────────────────────────────────────────────────────

export const EXAMPLE_REQUESTS: readonly { label: string; request: EvaluateRequest }[] = [
  {
    label: 'Mua máy tính 45 triệu đồng (mua sắm trực tiếp)',
    request: {
      packageType: 'GOODS', estimatedValue: 45_000_000,
      fundSource: 'STATE', isUrgent: false, isNationalSec: false,
      isInternational: false, asOfDate: '2026-07-01',
    },
  },
  {
    label: 'Tư vấn giám sát 800 triệu đồng (đấu thầu rộng rãi)',
    request: {
      packageType: 'CONSULTING', estimatedValue: 800_000_000,
      fundSource: 'STATE', isUrgent: false, isNationalSec: false,
      isInternational: false, asOfDate: '2026-07-01',
    },
  },
  {
    label: 'Sửa chữa khẩn cấp đê điều (chỉ định thầu)',
    request: {
      packageType: 'CONSTRUCTION', estimatedValue: 2_000_000_000,
      fundSource: 'STATE', isUrgent: true, isNationalSec: false,
      isInternational: false, asOfDate: '2026-07-01',
    },
  },
];
