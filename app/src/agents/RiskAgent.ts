/**
 * P6-04C: RiskAgent — complete implementation.
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
 *   detectSystemicRisks()    — identify recurring violation patterns across packages
 *   calculateAuditExposure() — estimate audit probability and financial impact
 *   buildMitigationPlan()    — ordered remediation steps sorted by riskScore
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

// ─── P6-04B: Helpers (unexported) ────────────────────────────────────────────

const SCORE_BY_SEVERITY: Record<Severity, { likelihood: number; impact: number }> = {
  CRITICAL: { likelihood: 5, impact: 5 },
  HIGH:     { likelihood: 4, impact: 4 },
  MEDIUM:   { likelihood: 3, impact: 3 },
  LOW:      { likelihood: 2, impact: 2 },
};

function mapFindingCategory(category: string): RiskMatrixEntry['category'] {
  switch (category) {
    case 'brand-locking':
    case 'method-mismatch':  return 'legal';
    case 'contract-type':
    case 'missing-clause':
    case 'publication':      return 'procedural';
    case 'date-gap':         return 'timeline';
    case 'missing-data':
    case 'asset-recording':  return 'financial';
    default:                 return 'legal';
  }
}

/** Derives the five-level overall verdict from the scored risk matrix. */
function determineOverallRisk(riskMatrix: RiskMatrixEntry[]): OverallRisk {
  if (riskMatrix.some(e => e.severity === 'CRITICAL')) return 'CRITICAL';
  if (riskMatrix.some(e => e.severity === 'HIGH'))     return 'HIGH';
  if (riskMatrix.some(e => e.severity === 'MEDIUM'))   return 'MEDIUM';
  if (riskMatrix.some(e => e.severity === 'LOW'))      return 'LOW';
  return 'CLEAN';
}

// ─── P6-04B: Pure functions ───────────────────────────────────────────────────

/**
 * Detects systemic violation patterns across a list of packages.
 *
 * Pattern 1 — Synchronized approvals: same packageType + same dateResultApprove
 *   in ≥2 packages (CRITICAL for ≥3, HIGH for 2).  Identical approval dates
 *   across independent packages indicate fabricated dates or coordinated bypass.
 *
 * Pattern 2 — Dominant supplier: same supplier1Name winning ≥3 packages
 *   (MEDIUM).  Signals limited competition per Điều 10 Luật ĐT 22/2023.
 */
export function detectSystemicRisks(packages: ProcurementPackage[]): SystemicRisk[] {
  const risks: SystemicRisk[] = [];
  if (packages.length < 2) return risks;

  // Pattern 1: same packageType + same dateResultApprove
  const approvalGroups = new Map<string, ProcurementPackage[]>();
  for (const pkg of packages) {
    if (!pkg.packageType || !pkg.dateResultApprove) continue;
    const key = `${pkg.packageType}|${pkg.dateResultApprove}`;
    const grp = approvalGroups.get(key) ?? [];
    grp.push(pkg);
    approvalGroups.set(key, grp);
  }
  for (const [key, grp] of approvalGroups) {
    if (grp.length < 2) continue;
    const [, date] = key.split('|');
    risks.push({
      pattern:        `${grp.length} gói thầu cùng loại có ngày phê duyệt kết quả trùng nhau (${date})`,
      severity:       grp.length >= 3 ? 'CRITICAL' : 'HIGH',
      occurrences:    grp.length,
      affectedIds:    grp.map(p => p.packageName),
      recommendation: 'Kiểm tra tính độc lập giữa các quy trình phê duyệt. ' +
        'Ngày phê duyệt trùng nhau giữa nhiều gói thầu cùng loại là dấu hiệu rủi ro ' +
        'kiểm toán cao theo Điều 12 Luật Đấu thầu 22/2023/QH15.',
    });
  }

  // Pattern 2: same supplier winning ≥3 packages (skip placeholder names)
  const supplierGroups = new Map<string, ProcurementPackage[]>();
  for (const pkg of packages) {
    const supplier = pkg.supplier1Name?.trim();
    if (!supplier || supplier.startsWith('[')) continue;
    const grp = supplierGroups.get(supplier) ?? [];
    grp.push(pkg);
    supplierGroups.set(supplier, grp);
  }
  for (const [supplier, grp] of supplierGroups) {
    if (grp.length < 3) continue;
    risks.push({
      pattern:        `Nhà cung cấp "${supplier}" trúng thầu ${grp.length} gói liên tiếp — nguy cơ hạn chế cạnh tranh`,
      severity:       'MEDIUM',
      occurrences:    grp.length,
      affectedIds:    grp.map(p => p.packageName),
      recommendation: 'Rà soát quá trình khảo sát giá và lựa chọn nhà cung cấp. ' +
        'Đảm bảo có ít nhất 3 nhà cung cấp độc lập tham gia báo giá theo ' +
        'Khoản 1 Điều 10 Luật Đấu thầu 22/2023/QH15.',
    });
  }

  return risks;
}

/**
 * Maps LegalFindings, CrossCheckIssues and PlannerOutput split warnings to a
 * scored RiskMatrixEntry[].  CrossCheckIssues are converted to synthetic
 * LegalFindings so the matrix has a uniform entry type.
 * Returned array is sorted by riskScore descending.
 */
export function buildRiskMatrix(
  dossierReview: DossierReviewOutput,
  plannerOutput?: PlannerOutput,
): RiskMatrixEntry[] {
  const entries: RiskMatrixEntry[] = [];

  // P5-03 / P6-03 legal findings
  for (const finding of dossierReview.findings) {
    const { likelihood, impact } = SCORE_BY_SEVERITY[finding.severity];
    entries.push({
      category:  mapFindingCategory(finding.category),
      severity:  finding.severity,
      finding,
      likelihood,
      impact,
      riskScore: likelihood * impact,
    });
  }

  // Cross-document timeline issues — wrapped as synthetic LegalFindings
  for (const issue of dossierReview.crossCheckIssues) {
    const { likelihood, impact } = SCORE_BY_SEVERITY[issue.severity];
    const synthetic: LegalFinding = {
      severity:       issue.severity,
      code:           `CC-${issue.doc1Id}-${issue.doc2Id}`,
      category:       'date-gap',
      field:          issue.field,
      message:        issue.description,
      legalBasis:     'Điều 81 Nghị định 214/2025/NĐ-CP — trật tự thủ tục lựa chọn nhà thầu',
      recommendation: 'Điều chỉnh ngày tháng trên các văn bản để đảm bảo trật tự thủ tục đúng quy định.',
    };
    entries.push({
      category:  'timeline',
      severity:  issue.severity,
      finding:   synthetic,
      likelihood,
      impact,
      riskScore: likelihood * impact,
    });
  }

  // PlannerAgent split warnings (already LegalFinding[])
  for (const finding of plannerOutput?.splitWarnings ?? []) {
    const { likelihood, impact } = SCORE_BY_SEVERITY[finding.severity];
    entries.push({
      category:  'legal',
      severity:  finding.severity,
      finding,
      likelihood,
      impact,
      riskScore: likelihood * impact,
    });
  }

  return entries.sort((a, b) => b.riskScore - a.riskScore);
}

/**
 * Estimates audit probability and financial impact from the risk matrix and
 * the overall risk verdict produced by the agent (P6-04C).
 *
 * probability:
 *   CRITICAL → 'high'  |  HIGH → 'medium'  |  else → 'low'
 * potentialFindings:  CRITICAL + HIGH matrix messages.
 * estimatedImpact:    Vietnamese narrative keyed on overallRisk.
 */
export function calculateAuditExposure(
  riskMatrix:  RiskMatrixEntry[],
  overallRisk: OverallRisk,
): RiskOutput['auditExposure'] {
  const probability: 'high' | 'medium' | 'low' =
    overallRisk === 'CRITICAL' ? 'high' :
    overallRisk === 'HIGH'     ? 'medium' : 'low';

  const potentialFindings = riskMatrix
    .filter(e => e.severity === 'CRITICAL' || e.severity === 'HIGH')
    .map(e => `[${e.finding.code}] ${e.finding.message}`);

  let estimatedImpact: string;
  switch (overallRisk) {
    case 'CRITICAL':
      estimatedImpact =
        'Nguy cơ thu hồi kinh phí, xử lý kỷ luật và đề nghị khởi tố theo quy định. ' +
        'Ảnh hưởng nghiêm trọng đến uy tín đơn vị và kết quả kiểm toán năm.';
      break;
    case 'HIGH':
      estimatedImpact =
        'Yêu cầu bổ sung hồ sơ, tạm dừng thanh toán, kiến nghị chấn chỉnh. ' +
        'Ảnh hưởng đến tiến độ giải ngân và đánh giá năng lực đơn vị.';
      break;
    case 'MEDIUM':
      estimatedImpact =
        'Kiến nghị khắc phục trong kỳ kiểm toán tiếp theo. ' +
        'Không ảnh hưởng đến hiệu lực hợp đồng đã ký.';
      break;
    case 'LOW':
      estimatedImpact = 'Lưu ý trong báo cáo kiểm toán. Không có hậu quả pháp lý trực tiếp.';
      break;
    default:
      estimatedImpact = 'Không có rủi ro kiểm toán đáng kể. Hồ sơ đạt chuẩn.';
  }

  return { probability, potentialFindings, estimatedImpact };
}

/**
 * Produces an ordered list of remediation steps from the risk matrix and any
 * systemic risks.  Steps are de-duplicated by recommendation text; finding
 * codes for duplicate actions are merged into the first occurrence.
 * Responsible party always uses a neutral placeholder per CLAUDE.md.
 */
export function buildMitigationPlan(
  riskMatrix:    RiskMatrixEntry[],
  systemicRisks: SystemicRisk[],
): MitigationStep[] {
  // riskMatrix is already sorted by riskScore desc → first occurrence wins priority
  const actionIndex = new Map<string, { entry: RiskMatrixEntry; codes: string[] }>();
  for (const entry of riskMatrix) {
    const action = entry.finding.recommendation;
    const existing = actionIndex.get(action);
    if (existing) {
      existing.codes.push(entry.finding.code);
    } else {
      actionIndex.set(action, { entry, codes: [entry.finding.code] });
    }
  }

  const steps: MitigationStep[] = [];
  let priority = 1;

  for (const [action, { entry, codes }] of actionIndex) {
    const responsible =
      entry.severity === 'CRITICAL' || entry.severity === 'HIGH'
        ? '[Tổ trưởng tổ chuyên gia]'
        : '[Thành viên tổ chuyên gia]';
    steps.push({
      priority:   priority++,
      action,
      responsible,
      riskCodes:  [...new Set(codes)],
    });
  }

  // Systemic risks not already covered by a riskMatrix recommendation
  for (const risk of systemicRisks) {
    if (!actionIndex.has(risk.recommendation)) {
      const responsible =
        risk.severity === 'CRITICAL' || risk.severity === 'HIGH'
          ? '[Tổ trưởng thẩm định độc lập]'
          : '[Thành viên tổ chuyên gia]';
      steps.push({
        priority:   priority++,
        action:     risk.recommendation,
        responsible,
        riskCodes:  [`SYSTEMIC-${risk.severity}`],
      });
    }
  }

  return steps;
}

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

  // ── emit + transition ──────────────────────────────────────────────────────

  private emit(partial: Omit<AgentMessage, 'traceId' | 'from' | 'timestamp'>): void {
    const msg: AgentMessage = {
      traceId:   this.currentTraceId!,
      from:      'risk',
      timestamp: Date.now(),
      ...partial,
    };
    this.registry.log(msg);
    if (msg.to === 'broadcast') {
      this.registry.notifySubscribers(msg.type, msg);
    }
  }

  private transition(next: RiskState, detail?: string): void {
    const event: RiskStateEvent = {
      previousState: this.state,
      nextState:     next,
      timestamp:     Date.now(),
      detail,
    };
    this.emit({ to: 'risk', type: 'event', payload: event });
    this.state = next;
  }

  // ── buildErrorResponse + buildResponse ─────────────────────────────────────

  private buildErrorResponse(
    code:    string,
    message: string,
    inState: RiskState,
    to:      AgentId | 'user' = 'user',
  ): AgentMessage {
    const traceId = this.currentTraceId ?? generateTraceId(); // save BEFORE reset
    this.state          = 'idle';
    this.currentTraceId = null;
    return {
      traceId,
      from:      'risk',
      to,
      type:      'error',
      payload:   { code, message, state: inState },
      timestamp: Date.now(),
    };
  }

  private buildResponse(to: AgentId | 'user', output: RiskOutput): AgentMessage {
    return {
      traceId:    this.currentTraceId!,
      from:       'risk',
      to,
      type:       'response',
      payload:    output,
      timestamp:  Date.now(),
      legalBasis: output.legalBasis,
    };
  }

  // ── collectLegalBasis ──────────────────────────────────────────────────────

  /**
   * Merges legal citations from four sources (Set dedup):
   *   1. RISK_LEGAL_BASIS constant
   *   2. dossierReview.legalBasis — P6-03 citations
   *   3. plannerOutput.legalBasis — P6-01 citations
   *   4. Individual finding.legalBasis from riskMatrix entries
   */
  private collectLegalBasis(
    riskMatrix:    RiskMatrixEntry[],
    dossierReview: DossierReviewOutput,
    plannerOutput?: PlannerOutput,
  ): string[] {
    const citations = new Set<string>(RISK_LEGAL_BASIS);
    for (const basis of dossierReview.legalBasis) {
      citations.add(basis);
    }
    for (const basis of plannerOutput?.legalBasis ?? []) {
      citations.add(basis);
    }
    for (const entry of riskMatrix) {
      citations.add(entry.finding.legalBasis);
    }
    return [...citations];
  }

  // ── process ────────────────────────────────────────────────────────────────

  async process(msg: AgentMessage): Promise<AgentMessage> {
    const traceId    = msg.traceId;
    const callerFrom = msg.from;
    this.currentTraceId = traceId;
    this.registry.log(msg);

    const input = msg.payload as RiskInput;

    if (!input?.pkg || !input?.dossierReview) {
      return this.buildErrorResponse(
        'RISK_EMPTY_INPUT',
        'RiskInput.pkg và RiskInput.dossierReview không được rỗng',
        'idle',
        callerFrom,
      );
    }

    try {
      // ── ASSESSING_RISK — build risk matrix from findings + cross-checks + split warnings
      this.transition('assessing-risk', `Đánh giá rủi ro gói thầu: ${input.pkg.packageName}`);
      const riskMatrix = buildRiskMatrix(input.dossierReview, input.plannerOutput);

      // ── DETECTING_SYSTEMIC — scan current + historical packages for patterns
      this.transition('detecting-systemic');
      const allPackages   = [input.pkg, ...(input.historicalPackages ?? [])];
      const systemicRisks = detectSystemicRisks(allPackages);

      const criticalSystemic = systemicRisks.filter(r => r.severity === 'CRITICAL');
      if (criticalSystemic.length > 0) {
        this.emit({
          to:      'broadcast',
          type:    'event',
          payload: {
            packageName:   input.pkg.packageName,
            systemicRisks: criticalSystemic,
          },
        });
      }

      // ── COMPUTING_MATRIX — determine overall risk, exposure, and mitigation plan
      this.transition('computing-matrix');
      const overallRisk    = determineOverallRisk(riskMatrix);
      const auditExposure  = calculateAuditExposure(riskMatrix, overallRisk);
      const mitigationPlan = buildMitigationPlan(riskMatrix, systemicRisks);

      // ── COMPOSING_RESPONSE
      this.transition('composing-response');
      const legalBasis = this.collectLegalBasis(riskMatrix, input.dossierReview, input.plannerOutput);

      const output: RiskOutput = {
        overallRisk,
        riskMatrix,
        systemicRisks,
        auditExposure,
        mitigationPlan,
        legalBasis,
      };

      const response = this.buildResponse(callerFrom, output);
      this.registry.log(response);
      this.state          = 'idle';
      this.currentTraceId = null;
      return response;

    } catch (err) {
      return this.buildErrorResponse(
        'RISK_INTERNAL_ERROR',
        String(err),
        this.state,
        callerFrom,
      );
    }
  }
}
