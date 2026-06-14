/**
 * P6-04A: RiskAgent — schema and file skeleton.
 *
 * State machine:
 *   idle → assessing-risk → detecting-systemic → computing-matrix
 *        → composing-response → idle
 *
 * Aggregates audit risk from all upstream agents:
 *   - LegalFindings + CrossCheckIssues from P6-03 DossierReviewOutput
 *   - Package split warnings from P6-01 PlannerOutput
 *   - Systemic patterns across historicalPackages[]
 *
 * Produces a structured audit risk report ready for State Audit Office review.
 *
 * Pure functions (P6-04B):
 *   buildRiskMatrix()        — score each finding by likelihood × impact (1–5 × 1–5)
 *   detectSystemicRisk()     — identify recurring violation patterns across packages
 *   computeAuditExposure()   — estimate audit probability and financial impact
 *   buildMitigationPlan()    — ordered remediation steps sorted by riskScore
 *   determineOverallRisk()   — 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN'
 *   assessRisk()             — master orchestrator producing full RiskOutput
 *
 * Agent methods (P6-04C):
 *   emit()               — registry event emitter
 *   transition()         — state machine step + event log
 *   buildErrorResponse() — error AgentMessage, always resets state to idle
 *   buildResponse()      — success AgentMessage with legalBasis
 *   process()            — main entry point, never throws uncaught exceptions
 */

// ─── Type-only imports ────────────────────────────────────────────────────────

import type { AgentId, AgentMessage, IAgent }   from './types';
import type { AgentRegistry }                    from './AgentRegistry';
import type { ProcurementPackage }               from '../demoData';
import type { Severity, LegalFinding }           from '../ai/legalReviewer';
import type { DossierReviewOutput }              from './LegalReviewerAgent';
import type { PlannerOutput }                    from './PlannerAgent';

// ─── Runtime imports ──────────────────────────────────────────────────────────

import { generateTraceId } from './detectPackageSplitting';

// ─── RiskInput ────────────────────────────────────────────────────────────────

export interface RiskInput {
  pkg:                  ProcurementPackage;
  /** Full dossier review output from LegalReviewerAgent (P6-03). */
  dossierReview:        DossierReviewOutput;
  /** Annual plan output from PlannerAgent (P6-01) — used to detect split warnings. */
  plannerOutput?:       PlannerOutput;
  /** Prior-year or same-year packages for systemic risk pattern detection. */
  historicalPackages?:  ProcurementPackage[];
}

// ─── OverallRisk ─────────────────────────────────────────────────────────────

/** Five-level audit risk verdict, ordered from most to least severe. */
export type OverallRisk = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN';

// ─── RiskMatrixEntry ──────────────────────────────────────────────────────────

/**
 * One scored entry in the risk matrix.
 * riskScore = likelihood (1–5) × impact (1–5) → max 25.
 */
export interface RiskMatrixEntry {
  category:   'legal' | 'procedural' | 'financial' | 'technical' | 'timeline';
  severity:   Severity;
  finding:    LegalFinding;
  likelihood: number;   // 1–5: 1 = very unlikely, 5 = almost certain
  impact:     number;   // 1–5: 1 = negligible, 5 = catastrophic
  riskScore:  number;   // likelihood × impact
}

// ─── SystemicRisk ─────────────────────────────────────────────────────────────

/**
 * A recurring violation pattern detected across multiple packages or periods.
 * Examples: repeated package splitting, consistent wrong procurement method.
 */
export interface SystemicRisk {
  /** Human-readable description of the detected pattern. */
  pattern:         string;
  severity:        Severity;
  /** Number of packages that exhibit this pattern. */
  occurrences:     number;
  /** Package IDs or codes where the pattern was observed. */
  affectedIds:     string[];
  recommendation:  string;
}

// ─── MitigationStep ───────────────────────────────────────────────────────────

/** One ordered remediation action from the mitigation plan. */
export interface MitigationStep {
  /** Execution order: 1 = highest priority. */
  priority:      number;
  /** Action description in Vietnamese. */
  action:        string;
  /** Responsible party — must use neutral placeholder per CLAUDE.md. */
  responsible:   string;
  /** ISO date deadline, if applicable. */
  deadline?:     string;
  /** Finding codes or risk codes this step addresses. */
  riskCodes:     string[];
}

// ─── RiskOutput ───────────────────────────────────────────────────────────────

export interface RiskOutput {
  overallRisk:   OverallRisk;
  /** Risk matrix sorted by riskScore descending (highest first). */
  riskMatrix:    RiskMatrixEntry[];
  systemicRisks: SystemicRisk[];
  auditExposure: {
    probability:        'high' | 'medium' | 'low';
    potentialFindings:  string[];
    estimatedImpact:    string;
  };
  mitigationPlan: MitigationStep[];
  legalBasis:     string[];
  /**
   * Deferred DOCX export hook.  Returns unknown until a DOCX library is wired
   * in (P6-06+).  Not implemented in P6-04B/C; reserved for forward-compat.
   */
  auditReportDocx?: () => unknown;
}

// ─── RiskState ────────────────────────────────────────────────────────────────

export type RiskState =
  | 'idle'
  | 'assessing-risk'
  | 'detecting-systemic'
  | 'computing-matrix'
  | 'composing-response';

// ─── RiskStateEvent ───────────────────────────────────────────────────────────

/** Emitted to the registry trace on every state transition. */
export interface RiskStateEvent {
  previousState: RiskState;
  nextState:     RiskState;
  timestamp:     number;
  detail?:       string;
}

// ─── Legal basis constants ────────────────────────────────────────────────────

export const RISK_LEGAL_BASIS: readonly string[] = [
  'Điều 44 khoản 6 Luật Đấu thầu 22/2023/QH15 — cấm chia nhỏ gói thầu vi phạm ngưỡng',
  'Điều 44 khoản 7 Luật Đấu thầu 22/2023/QH15 — không khóa thương hiệu, không hạn chế xuất xứ',
  'Điều 12 Luật Đấu thầu 22/2023/QH15 — nghĩa vụ công khai thông tin trong đấu thầu',
  'Nghị định 214/2025/NĐ-CP — ngưỡng và phương thức lựa chọn nhà thầu',
  'Khoản 1 Điều 10 Luật Đấu thầu 22/2023/QH15 — nguyên tắc cạnh tranh, công bằng, minh bạch',
];

// ─── P6-04B: Pure functions (added in P6-04B) ────────────────────────────────

// buildRiskMatrix()        — map findings + crossCheckIssues → RiskMatrixEntry[]
// detectSystemicRisk()     — scan historicalPackages for recurring patterns
// computeAuditExposure()   — derive probability + potentialFindings + estimatedImpact
// buildMitigationPlan()    — produce MitigationStep[] sorted by priority
// determineOverallRisk()   — 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN'
// assessRisk()             — RiskInput → RiskOutput master orchestrator

// ─── RiskAgent ───────────────────────────────────────────────────────────────

export class RiskAgent implements IAgent {
  readonly id   = 'risk' as const;
  readonly name = 'Risk Agent';

  private state:           RiskState   = 'idle';
  private currentTraceId:  string | null = null;
  private readonly registry: AgentRegistry;

  constructor(registry: AgentRegistry) {
    this.registry = registry;
  }

  getCapabilities(): string[] {
    return [
      'risk-assessment',
      'systemic-risk-detection',
      'risk-matrix-scoring',
      'audit-exposure-estimation',
      'mitigation-planning',
    ];
  }

  // ── P6-04C: emit(), transition(), buildErrorResponse(), buildResponse(),
  //            process() — added in P6-04C.

  async process(_msg: AgentMessage): Promise<AgentMessage> {
    const traceId = _msg.traceId || generateTraceId();
    this.state          = 'idle';
    this.currentTraceId = null;
    return {
      traceId,
      from:      'risk',
      to:        _msg.from as AgentId | 'user',
      type:      'error',
      payload:   {
        code:    'NOT_IMPLEMENTED',
        message: 'P6-04C: process() not yet implemented',
        state:   'idle' satisfies RiskState,
      },
      timestamp: Date.now(),
    };
  }
}
