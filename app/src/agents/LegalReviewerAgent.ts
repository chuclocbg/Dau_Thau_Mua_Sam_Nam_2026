/**
 * P6-03A: LegalReviewerAgent — schema and file skeleton.
 *
 * State machine:
 *   idle → reviewing-package → cross-checking → computing-score
 *        → composing-response → idle
 *
 * Builds on P5-03 (legalReviewer.ts): elevates from package-level to
 * dossier-level review. Adds cross-document date consistency checking,
 * compliance scoring (0–100), and audit readiness assessment.
 *
 * Pure functions (P6-03B):
 *   reviewDossier()           — full dossier scan (wraps P5-03 reviewPackage)
 *   crossCheck()              — detect date / value inconsistencies across docs
 *   explainFinding()          — natural language explanation with full citations
 *   suggestFix()              — concrete remediation steps per finding
 *   computeComplianceScore()  — 0–100 score derived from findings
 *   determineAuditReadiness() — 'ready' | 'conditional' | 'not-ready'
 *
 * Agent methods (P6-03C):
 *   emit()               — registry event emitter
 *   transition()         — state machine step + event log
 *   buildErrorResponse() — error AgentMessage, always resets state to idle
 *   buildResponse()      — success AgentMessage with legalBasis
 *   process()            — main entry point, never throws uncaught exceptions
 */

// ─── Type-only imports ────────────────────────────────────────────────────────

import type { AgentId, AgentMessage, IAgent }              from './types';
import type { AgentRegistry }                               from './AgentRegistry';
import type { ProcurementPackage }                          from '../demoData';
import type { Severity, LegalFinding, LegalReviewResult }  from '../ai/legalReviewer';

// ─── Runtime imports ──────────────────────────────────────────────────────────

import { reviewPackage }   from '../ai/legalReviewer';
import { generateTraceId } from './detectPackageSplitting';

// ─── Re-export P5-03 public API as unified entry point ───────────────────────

export type { Severity, LegalFinding, LegalReviewResult };
export { reviewPackage };

// ─── CrossCheckIssue ─────────────────────────────────────────────────────────

/**
 * A date or value inconsistency detected between two documents in the dossier.
 * doc1Id and doc2Id reference document IDs 1–28 from documentTemplates.
 */
export interface CrossCheckIssue {
  severity:    Severity;
  doc1Id:      number;
  doc2Id:      number;
  field:       string;
  description: string;
}

// ─── DossierReviewInput ───────────────────────────────────────────────────────

export interface DossierReviewInput {
  pkg:         ProcurementPackage;
  /** Subset of document IDs 1–28 to include in the cross-check.
   *  Pass all 28 for a full audit; pass a subset for incremental checks. */
  documentIds: number[];
  /** Procurement method code resolved by PlannerAgent or caller.
   *  Examples: 'DIRECT_50', 'DIRECT_SELECTION_SIMPLIFIED',
   *            'COMPETITIVE_SHOPPING', 'OPEN_BIDDING'. */
  methodCode:  string;
}

// ─── DossierReviewOutput ─────────────────────────────────────────────────────

export interface DossierReviewOutput {
  /** LegalFindings from P5-03 reviewPackage, sorted CRITICAL → HIGH → MEDIUM → LOW. */
  findings:         LegalFinding[];
  /** Date / value inconsistencies across the 28 documents, detected by crossCheck(). */
  crossCheckIssues: CrossCheckIssue[];
  /** 0–100: 100 = perfect compliance, 0 = severe violations. */
  complianceScore:  number;
  auditReadiness:   'ready' | 'conditional' | 'not-ready';
  recommendations:  string[];
  legalBasis:       string[];
}

// ─── ReviewerState ────────────────────────────────────────────────────────────

export type ReviewerState =
  | 'idle'
  | 'reviewing-package'
  | 'cross-checking'
  | 'computing-score'
  | 'composing-response';

// ─── ReviewerStateEvent ───────────────────────────────────────────────────────

/** Emitted to the registry trace on every state transition. */
export interface ReviewerStateEvent {
  previousState: ReviewerState;
  nextState:     ReviewerState;
  timestamp:     number;
  detail?:       string;
}

// ─── Legal basis constants ────────────────────────────────────────────────────

export const REVIEWER_LEGAL_BASIS: readonly string[] = [
  'Điều 38-41 Luật Đấu thầu 22/2023/QH15 — lập và phê duyệt kế hoạch lựa chọn nhà thầu',
  'Điều 44 khoản 7 Luật Đấu thầu 22/2023/QH15 — không khóa thương hiệu, không hạn chế xuất xứ',
  'Điều 62 Luật Đấu thầu 22/2023/QH15 — loại hợp đồng và điều khoản bảo hành',
  'Điều 81 Nghị định 214/2025/NĐ-CP — khoảng cách thời gian tối thiểu giữa các bước LCNT',
  'Khoản 1 Điều 10 Luật Đấu thầu 22/2023/QH15 — nguyên tắc cạnh tranh, công bằng, minh bạch',
];

// ─── P6-03B: Pure functions (added in P6-03B) ────────────────────────────────

// reviewDossier()           — dossier-level scan wrapping reviewPackage + crossCheck
// crossCheck()              — detect date/value inconsistencies across 28 documents
// explainFinding()          — natural language explanation per LegalFinding
// suggestFix()              — concrete remediation steps per LegalFinding
// computeComplianceScore()  — 0–100 compliance score from findings + crossCheckIssues
// determineAuditReadiness() — 'ready' | 'conditional' | 'not-ready'

// ─── LegalReviewerAgent ───────────────────────────────────────────────────────

export class LegalReviewerAgent implements IAgent {
  readonly id   = 'legal-reviewer' as const;
  readonly name = 'Legal Reviewer Agent';

  private state:           ReviewerState = 'idle';
  private currentTraceId:  string | null  = null;
  private readonly registry: AgentRegistry;

  constructor(registry: AgentRegistry) {
    this.registry = registry;
  }

  getCapabilities(): string[] {
    return [
      'package-legal-review',
      'dossier-legal-review',
      'date-cross-check',
      'compliance-scoring',
      'audit-readiness-assessment',
    ];
  }

  // ── P6-03C: emit(), transition(), buildErrorResponse(), buildResponse(),
  //            process() — added in P6-03C.

  async process(_msg: AgentMessage): Promise<AgentMessage> {
    const traceId = _msg.traceId || generateTraceId();
    this.state          = 'idle';
    this.currentTraceId = null;
    return {
      traceId,
      from:      'legal-reviewer',
      to:        _msg.from as AgentId | 'user',
      type:      'error',
      payload:   {
        code:    'NOT_IMPLEMENTED',
        message: 'P6-03C: process() not yet implemented',
        state:   'idle' satisfies ReviewerState,
      },
      timestamp: Date.now(),
    };
  }
}
