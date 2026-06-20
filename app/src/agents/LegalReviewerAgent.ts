/**
 * P6-03C: LegalReviewerAgent — complete implementation.
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
 *   detectCrossDocumentIssues() — date / value inconsistencies across 28 docs
 *   calculateComplianceScore()  — 0–100 score derived from findings + issues
 *   summarizeFindings()         — actionable recommendations from output
 *   reviewPackage()             — dossier-level orchestrator (wraps P5-03)
 *
 * Agent methods (P6-03C):
 *   emit()               — registry event emitter
 *   transition()         — state machine step + event log
 *   buildErrorResponse() — error AgentMessage, always resets state to idle
 *   buildResponse()      — success AgentMessage with legalBasis
 *   process()            — main entry point, never throws uncaught exceptions
 */

// ─── Type-only imports ────────────────────────────────────────────────────────

import type { AgentId, AgentMessage, IAgent }             from './types';
import type { AgentRegistry }                              from './AgentRegistry';
import type { ProcurementPackage }                         from '../demoData';
import type { Severity, LegalFinding, LegalReviewResult } from '../ai/legalReviewer';

// ─── Runtime imports ──────────────────────────────────────────────────────────

// P5-03 reviewPackage aliased to avoid collision with the dossier-level export below.
import { reviewPackage as p5ReviewPackage } from '../ai/legalReviewer';
import { generateTraceId }                  from './detectPackageSplitting';
import { paraphraseAnswer }                from '../ai/llmBridge';
import type { LLMBridgeConfig }            from '../ai/llmBridge';
import { enrichLegalBasis }               from '../ai/legalSearchAdapter';

// ─── Re-export P5-03 types as unified entry point ────────────────────────────

export type { Severity, LegalFinding, LegalReviewResult };
// Note: P5-03 reviewPackage(pkg) is available internally as p5ReviewPackage.
// This module exports reviewPackage(DossierReviewInput) at the dossier level.

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
  /** Date / value inconsistencies across the 28 documents. */
  crossCheckIssues: CrossCheckIssue[];
  /** 0–100: 100 = perfect compliance, 0 = severe violations. */
  complianceScore:  number;
  auditReadiness:   'ready' | 'conditional' | 'not-ready';
  recommendations:  string[];
  legalBasis:       string[];
  /** LLM-generated prose summary of the compliance review. Undefined when no API key or on any error. */
  llmSummary?:      string;
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
  'Điều 12 Luật Đấu thầu 22/2023/QH15; Thông tư 79/2025/TT-BTC — nghĩa vụ đăng tải thông tin.',
];

// ─── Internal helpers (unexported) ───────────────────────────────────────────

/** Parses a date string (ISO YYYY-MM-DD) to milliseconds. Returns null when empty or invalid. */
function parseDateMs(dateStr: string): number | null {
  if (!dateStr?.trim()) return null;
  const ms = new Date(dateStr).getTime();
  return isNaN(ms) ? null : ms;
}

/**
 * Returns a CrossCheckIssue if dateA is strictly after dateB (i.e. the
 * procurement sequence is inverted).  Returns null when either date is absent
 * or the order is correct.
 */
function checkOrder(
  dateA: string, doc1Id: number, labelA: string,
  dateB: string, doc2Id: number, labelB: string,
  severity: Severity,
): CrossCheckIssue | null {
  const msA = parseDateMs(dateA);
  const msB = parseDateMs(dateB);
  if (msA === null || msB === null) return null;
  if (msA > msB) {
    return {
      severity,
      doc1Id,
      doc2Id,
      field:       `${labelA} → ${labelB}`,
      description: `${labelA} (${dateA}) phải trước ${labelB} (${dateB}). Hiện tại bị đảo ngược — vi phạm trật tự thủ tục.`,
    };
  }
  return null;
}

/** Derives auditReadiness from findings, cross-check issues, and compliance score. */
function determineAuditReadiness(
  findings:         LegalFinding[],
  crossCheckIssues: CrossCheckIssue[],
  score:            number,
): 'ready' | 'conditional' | 'not-ready' {
  const hasCritical =
    findings.some(f => f.severity === 'CRITICAL') ||
    crossCheckIssues.some(c => c.severity === 'CRITICAL');
  const hasHigh =
    findings.some(f => f.severity === 'HIGH') ||
    crossCheckIssues.some(c => c.severity === 'HIGH');

  if (hasCritical || score < 50) return 'not-ready';
  if (hasHigh     || score < 75) return 'conditional';
  return 'ready';
}

/** Collects unique legal citations from P5-03 findings plus the constant basis. */
function collectDossierLegalBasis(findings: LegalFinding[]): string[] {
  const citations = new Set<string>(REVIEWER_LEGAL_BASIS);
  for (const f of findings) {
    citations.add(f.legalBasis);
  }
  return [...citations];
}

// ─── P6-03B: Pure functions ───────────────────────────────────────────────────

/**
 * Detects date ordering violations across the 28 procurement documents.
 *
 * Document ID → date field mapping (from documentTemplates):
 *   Doc 10 dateKhlcnt        → Doc 11 dateKhlcntApprove
 *   Doc 11 dateKhlcntApprove → Doc 13 dateExpertEstablish
 *   Doc 13 dateExpertEstablish → Doc 12 dateDocIssue
 *   Doc 12 dateDocIssue      → Doc 28 dateBidClose
 *   Doc 28 dateBidClose      → Doc 14 dateEvaluate
 *   Doc 14 dateEvaluate      → Doc 15 dateAppraise
 *   Doc 15 dateAppraise      → Doc 17 dateResultApprove
 *   Doc 17 dateResultApprove → Doc 18 dateContractSign
 *   Doc 18 dateContractSign  → Doc 19 dateDelivery
 *   Doc 19 dateDelivery      → Doc 20 dateAcceptance
 *   Doc 20 dateAcceptance    → Doc 21 dateLiquidation
 */
export function detectCrossDocumentIssues(pkg: ProcurementPackage): CrossCheckIssue[] {
  const issues: CrossCheckIssue[] = [];

  // Procurement planning sequence
  const khlcntApproveOrder = checkOrder(
    pkg.dateKhlcnt,        10, 'Ngày KHLCNT (Doc 10)',
    pkg.dateKhlcntApprove, 11, 'Ngày phê duyệt KHLCNT (Doc 11)',
    'CRITICAL',
  );
  if (khlcntApproveOrder) issues.push(khlcntApproveOrder);

  // Expert team must be established after KHLCNT approval
  const expertAfterApprove = checkOrder(
    pkg.dateKhlcntApprove,    11, 'Ngày phê duyệt KHLCNT (Doc 11)',
    pkg.dateExpertEstablish,  13, 'Ngày thành lập Tổ chuyên gia (Doc 13)',
    'HIGH',
  );
  if (expertAfterApprove) issues.push(expertAfterApprove);

  // Document issuance must be after expert team established
  const docAfterExpert = checkOrder(
    pkg.dateExpertEstablish, 13, 'Ngày thành lập Tổ chuyên gia (Doc 13)',
    pkg.dateDocIssue,        12, 'Ngày phát hành HSMT/HSYC (Doc 12)',
    'CRITICAL',
  );
  if (docAfterExpert) issues.push(docAfterExpert);

  // Bid close must be after document issuance
  const bidCloseAfterDocIssue = checkOrder(
    pkg.dateDocIssue, 12, 'Ngày phát hành HSMT/HSYC (Doc 12)',
    pkg.dateBidClose, 28, 'Ngày đóng thầu (Doc 28)',
    'CRITICAL',
  );
  if (bidCloseAfterDocIssue) issues.push(bidCloseAfterDocIssue);

  // Evaluation must be after bid close
  const evalAfterBidClose = checkOrder(
    pkg.dateBidClose,  28, 'Ngày đóng thầu (Doc 28)',
    pkg.dateEvaluate,  14, 'Ngày báo cáo đánh giá (Doc 14)',
    'CRITICAL',
  );
  if (evalAfterBidClose) issues.push(evalAfterBidClose);

  // Appraisal must be after evaluation
  const appraiseAfterEval = checkOrder(
    pkg.dateEvaluate, 14, 'Ngày báo cáo đánh giá (Doc 14)',
    pkg.dateAppraise, 15, 'Ngày báo cáo thẩm định (Doc 15)',
    'HIGH',
  );
  if (appraiseAfterEval) issues.push(appraiseAfterEval);

  // Result approval must be after appraisal
  const resultAfterAppraise = checkOrder(
    pkg.dateAppraise,      15, 'Ngày báo cáo thẩm định (Doc 15)',
    pkg.dateResultApprove, 17, 'Ngày phê duyệt kết quả (Doc 17)',
    'CRITICAL',
  );
  if (resultAfterAppraise) issues.push(resultAfterAppraise);

  // Contract must be signed after result approval
  const contractAfterResult = checkOrder(
    pkg.dateResultApprove, 17, 'Ngày phê duyệt kết quả (Doc 17)',
    pkg.dateContractSign,  18, 'Ngày ký hợp đồng (Doc 18)',
    'CRITICAL',
  );
  if (contractAfterResult) issues.push(contractAfterResult);

  // Delivery must be after contract signing
  const deliveryAfterContract = checkOrder(
    pkg.dateContractSign, 18, 'Ngày ký hợp đồng (Doc 18)',
    pkg.dateDelivery,     19, 'Ngày bàn giao (Doc 19)',
    'HIGH',
  );
  if (deliveryAfterContract) issues.push(deliveryAfterContract);

  // Acceptance must be after delivery
  const acceptanceAfterDelivery = checkOrder(
    pkg.dateDelivery,    19, 'Ngày bàn giao (Doc 19)',
    pkg.dateAcceptance,  20, 'Ngày nghiệm thu (Doc 20)',
    'CRITICAL',
  );
  if (acceptanceAfterDelivery) issues.push(acceptanceAfterDelivery);

  // Liquidation must be after acceptance
  const liquidationAfterAcceptance = checkOrder(
    pkg.dateAcceptance,  20, 'Ngày nghiệm thu (Doc 20)',
    pkg.dateLiquidation, 21, 'Ngày thanh lý hợp đồng (Doc 21)',
    'HIGH',
  );
  if (liquidationAfterAcceptance) issues.push(liquidationAfterAcceptance);

  return issues;
}

/**
 * Computes a 0–100 compliance score.
 *
 * Deduction per finding severity:  CRITICAL −25, HIGH −15, MEDIUM −8, LOW −3.
 * Deduction per CrossCheckIssue:   CRITICAL −20, HIGH −10, MEDIUM −5, LOW −2.
 * Floor is 0.
 */
export function calculateComplianceScore(
  findings:         LegalFinding[],
  crossCheckIssues: CrossCheckIssue[],
): number {
  const findingDeductions: Record<Severity, number> = {
    CRITICAL: 25,
    HIGH:     15,
    MEDIUM:   8,
    LOW:      3,
  };
  const crossDeductions: Record<Severity, number> = {
    CRITICAL: 20,
    HIGH:     10,
    MEDIUM:   5,
    LOW:      2,
  };

  let score = 100;
  for (const f of findings)         score -= findingDeductions[f.severity];
  for (const c of crossCheckIssues) score -= crossDeductions[c.severity];
  return Math.max(0, score);
}

/**
 * Builds an actionable recommendations list from a completed DossierReviewOutput.
 *
 * Sources (in order):
 *   1. Deduplicated P5-03 finding.recommendation strings (tagged by severity).
 *   2. Cross-document issue descriptions (tagged by severity).
 *   3. One overall audit readiness summary line.
 */
export function summarizeFindings(output: DossierReviewOutput): string[] {
  const recs: string[] = [];
  const seen = new Set<string>();

  for (const finding of output.findings) {
    if (!seen.has(finding.recommendation)) {
      seen.add(finding.recommendation);
      recs.push(`[${finding.severity}] ${finding.recommendation}`);
    }
  }

  for (const issue of output.crossCheckIssues) {
    recs.push(`[${issue.severity}] Sửa trật tự tài liệu: ${issue.description}`);
  }

  if (output.auditReadiness === 'not-ready') {
    recs.push(
      `Điểm tuân thủ: ${output.complianceScore}/100 — ` +
      'Hồ sơ CHƯA SẴN SÀNG kiểm toán. ' +
      'Khắc phục toàn bộ phát hiện [CRITICAL] và [HIGH] trước khi nộp.',
    );
  } else if (output.auditReadiness === 'conditional') {
    recs.push(
      `Điểm tuân thủ: ${output.complianceScore}/100 — ` +
      'Hồ sơ ĐẠT CÓ ĐIỀU KIỆN. ' +
      'Xử lý các phát hiện [HIGH] trước khi trình phê duyệt.',
    );
  } else {
    recs.push(
      `Điểm tuân thủ: ${output.complianceScore}/100 — Hồ sơ sẵn sàng kiểm toán.`,
    );
  }

  return recs;
}

/**
 * Dossier-level legal review.
 *
 * Orchestrates:
 *   1. P5-03 package-level scan (reviewPackage).
 *   2. Cross-document date consistency check (detectCrossDocumentIssues).
 *   3. Compliance scoring (calculateComplianceScore).
 *   4. Audit readiness assessment.
 *   5. Recommendation generation (summarizeFindings).
 *
 * The `documentIds` field in DossierReviewInput is accepted for forward-
 * compatibility (P6-03C will use it for selective review); P6-03B ignores it
 * and always performs a full scan so that tests remain deterministic.
 */
export function reviewPackage(input: DossierReviewInput): DossierReviewOutput {
  const p5Result         = p5ReviewPackage(input.pkg);
  const crossCheckIssues = detectCrossDocumentIssues(input.pkg);
  const complianceScore  = calculateComplianceScore(p5Result.findings, crossCheckIssues);
  const auditReadiness   = determineAuditReadiness(p5Result.findings, crossCheckIssues, complianceScore);
  const legalBasis       = collectDossierLegalBasis(p5Result.findings);

  const output: DossierReviewOutput = {
    findings:         p5Result.findings,
    crossCheckIssues,
    complianceScore,
    auditReadiness,
    recommendations:  [],
    legalBasis,
  };

  output.recommendations = summarizeFindings(output);
  return output;
}

// ─── LegalReviewerAgent ───────────────────────────────────────────────────────

export class LegalReviewerAgent implements IAgent {
  readonly id   = 'legal-reviewer' as const;
  readonly name = 'Legal Reviewer Agent';

  private state:             ReviewerState = 'idle';
  private currentTraceId:    string | null  = null;
  private readonly registry: AgentRegistry;
  private readonly llmConfig?: LLMBridgeConfig;

  constructor(registry: AgentRegistry, llmConfig?: LLMBridgeConfig) {
    this.registry  = registry;
    this.llmConfig = llmConfig;
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

  // ── emit + transition ──────────────────────────────────────────────────────

  private emit(partial: Omit<AgentMessage, 'traceId' | 'from' | 'timestamp'>): void {
    const msg: AgentMessage = {
      traceId:   this.currentTraceId!,
      from:      'legal-reviewer',
      timestamp: Date.now(),
      ...partial,
    };
    this.registry.log(msg);
    if (msg.to === 'broadcast') {
      this.registry.notifySubscribers(msg.type, msg);
    }
  }

  private transition(next: ReviewerState, detail?: string): void {
    const event: ReviewerStateEvent = {
      previousState: this.state,
      nextState:     next,
      timestamp:     Date.now(),
      detail,
    };
    this.emit({ to: 'legal-reviewer', type: 'event', payload: event });
    this.state = next;
  }

  // ── buildErrorResponse + buildResponse ─────────────────────────────────────

  private buildErrorResponse(
    code:    string,
    message: string,
    inState: ReviewerState,
    to:      AgentId | 'user' = 'user',
  ): AgentMessage {
    const traceId = this.currentTraceId ?? generateTraceId(); // save BEFORE reset
    this.state          = 'idle';
    this.currentTraceId = null;
    return {
      traceId,
      from:      'legal-reviewer',
      to,
      type:      'error',
      payload:   { code, message, state: inState },
      timestamp: Date.now(),
    };
  }

  private buildResponse(to: AgentId | 'user', output: DossierReviewOutput): AgentMessage {
    return {
      traceId:    this.currentTraceId!,
      from:       'legal-reviewer',
      to,
      type:       'response',
      payload:    output,
      timestamp:  Date.now(),
      legalBasis: output.legalBasis,
    };
  }

  // ── collectLegalBasis ──────────────────────────────────────────────────────

  /**
   * Merges legal citations from three sources (Set dedup):
   *   1. dossierOutput.legalBasis — already merged by reviewPackage() (P6-03B)
   *   2. REVIEWER_LEGAL_BASIS constant — defensive re-inclusion
   *   3. Individual finding.legalBasis strings — P5-03 citations per finding
   */
  private collectLegalBasis(dossierOutput: DossierReviewOutput): string[] {
    const citations = new Set<string>(dossierOutput.legalBasis);
    for (const basis of REVIEWER_LEGAL_BASIS) {
      citations.add(basis);
    }
    for (const finding of dossierOutput.findings) {
      citations.add(finding.legalBasis); // LegalFinding.legalBasis is string (single)
    }
    return [...citations];
  }

  // ── process ────────────────────────────────────────────────────────────────

  async process(msg: AgentMessage): Promise<AgentMessage> {
    const traceId    = msg.traceId;
    const callerFrom = msg.from;
    this.currentTraceId = traceId;
    this.registry.log(msg);

    const input = msg.payload as DossierReviewInput;

    if (!input?.pkg) {
      return this.buildErrorResponse(
        'REVIEWER_EMPTY_INPUT',
        'DossierReviewInput.pkg không được rỗng',
        'idle',
        callerFrom,
      );
    }

    try {
      // ── REVIEWING_PACKAGE — runs P5-03 review + cross-check + score + readiness
      this.transition('reviewing-package', `Kiểm tra gói thầu: ${input.pkg.packageName}`);
      const dossierOutput = reviewPackage(input);

      // ── CROSS_CHECKING — broadcast CRITICAL findings to RiskAgent / SpecificationAgent
      this.transition('cross-checking');
      const hasCritical =
        dossierOutput.findings.some(f => f.severity === 'CRITICAL') ||
        dossierOutput.crossCheckIssues.some(c => c.severity === 'CRITICAL');

      if (hasCritical) {
        this.emit({
          to:      'broadcast',
          type:    'event',
          payload: {
            packageName:      input.pkg.packageName,
            dossierReview:    dossierOutput,
            criticalFindings: dossierOutput.findings.filter(f => f.severity === 'CRITICAL'),
            hasBrandLocking:  dossierOutput.findings.some(f => f.category === 'brand-locking'),
          },
        });
      }

      // ── COMPUTING_SCORE — score already computed in reviewPackage(); transition for trace
      this.transition('computing-score');

      // ── COMPOSING_RESPONSE
      this.transition('composing-response');
      const legalBasis  = this.collectLegalBasis(dossierOutput);
      const baseOutput: DossierReviewOutput = { ...dossierOutput, legalBasis };
      const kbResponse  = this.buildResponse(callerFrom, baseOutput);

      // Enrich AgentMessage.legalBasis with index-based citations (Legal v1.5).
      // Kept separate from payload.legalBasis so existing KB-authoritative invariants hold.
      const enrichedLegalBasis = enrichLegalBasis(input.pkg.packageName, kbResponse.legalBasis ?? []);
      const enrichedResponse: AgentMessage = { ...kbResponse, legalBasis: enrichedLegalBasis };

      this.registry.log(enrichedResponse);
      this.state          = 'idle';
      this.currentTraceId = null;

      // Paraphrase after state reset — safe with concurrent LegalReviewerAgent.process() calls
      const recText = dossierOutput.recommendations.join('\n');
      const bridge  = await paraphraseAnswer(recText, this.llmConfig);
      if (!bridge.usedLLM) return enrichedResponse;
      return { ...enrichedResponse, payload: { ...baseOutput, llmSummary: bridge.answer } };

    } catch (err) {
      return this.buildErrorResponse(
        'REVIEWER_INTERNAL_ERROR',
        String(err),
        this.state,
        callerFrom,
      );
    }
  }
}
