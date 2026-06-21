/**
 * Legal v3.5 — Decision Assistant
 *
 * Aggregates procurementCopilot + templateGenerator outputs into a single
 * actionable procurement decision: PROCEED | PROCEED_WITH_WARNINGS | STOP.
 *
 * Decision pipeline:
 *   1. runCopilot()        — risk, contract findings, completionScore, missing docs
 *   2. generateTemplates() — per-stage status (COMPLETE / MISSING / OPTIONAL)
 *   3. Apply 7 escalation rules to derive final severity
 *   4. Map severity → decision (CRITICAL→STOP, LOW→PROCEED, else PROCEED_WITH_WARNINGS)
 *   5. Aggregate reasons, recommendations, legalBasis (all deduplicated)
 *
 * Escalation rules (severity can only increase, never decrease):
 *   A. durationDays ≤ 0                                          → CRITICAL
 *   B. missingDocuments.length > 0                               → ≥ MEDIUM
 *   C. contractFindings with HIGH or CRITICAL severity            → ≥ HIGH
 *   D. completionScore < 50                                       → ≥ HIGH
 *   E. dau-thau-rong-rai + dang-tai MISSING                       → CRITICAL
 *   F. von-vay-oda + missing 'tuan-thu-nha-tai-tro' clause        → ≥ HIGH
 *   G. ngan-sach-nha-nuoc + khlcnt template MISSING              → ≥ HIGH
 *
 * Pure function. Deterministic. No LLM. No browser globals. No hooks.
 * No IndexedDB. No UI. No agent modifications.
 */

import { runCopilot }       from './procurementCopilot';
import { generateTemplates } from './templateGenerator';
import type { ProcurementMethod, FundSource, ContractType, RiskLevel } from './procurementCopilot';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Decision = 'PROCEED' | 'PROCEED_WITH_WARNINGS' | 'STOP';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface DecisionAssistantInput {
  procurementMethod: ProcurementMethod;
  fundingSource:     FundSource;
  packageValue:      number;
  durationDays:      number;
  contractType:      ContractType;
  existingDocuments: string[];
  clauses:           string[];
}

export interface DecisionAssistantOutput {
  decision:        Decision;
  severity:        Severity;
  /** Ordered list: rule-triggered reasons first, then engine warnings. */
  reasons:         string[];
  recommendations: string[];
  legalBasis:      string[];
}

// Re-export for single-import convenience.
export type { ProcurementMethod, FundSource, ContractType };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<string, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };

function maxSeverity(a: Severity, b: Severity): Severity {
  return (SEVERITY_RANK[a] ?? 0) >= (SEVERITY_RANK[b] ?? 0) ? a : b;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function assessDecision(input: DecisionAssistantInput): DecisionAssistantOutput {

  // ── 1. Procurement copilot ─────────────────────────────────────────────────
  const copilot = runCopilot(input);

  // ── 2. Template generator ──────────────────────────────────────────────────
  const { templates } = generateTemplates(input);

  // ── 3. Escalation rules ────────────────────────────────────────────────────
  // Base severity comes from the copilot's aggregate riskLevel.
  // Each rule can only raise severity, never lower it.
  let severity: Severity = copilot.riskLevel as RiskLevel as Severity;
  const ruleReasons: string[] = [];

  // Rule A: Duration invalid → CRITICAL (contract cannot legally exist)
  if (input.durationDays <= 0) {
    severity = 'CRITICAL';
    ruleReasons.push('[CRITICAL] Thời gian thực hiện hợp đồng không hợp lệ — durationDays phải lớn hơn 0');
  }

  // Rule B: Missing mandatory lifecycle documents → at least MEDIUM
  if (copilot.missingDocuments.length > 0) {
    severity = maxSeverity(severity, 'MEDIUM');
    ruleReasons.push(
      `[MEDIUM] Thiếu ${copilot.missingDocuments.length} tài liệu bắt buộc trong hồ sơ`,
    );
  }

  // Rule C: Contract findings with HIGH or CRITICAL severity → at least HIGH
  const hasHighContractFinding = copilot.contractFindings.some(
    f => f.severity === 'HIGH' || f.severity === 'CRITICAL',
  );
  if (hasHighContractFinding) {
    severity = maxSeverity(severity, 'HIGH');
    ruleReasons.push('[HIGH] Phát hiện vi phạm hợp đồng — kiểm tra lại loại hợp đồng và điều khoản');
  }

  // Rule D: Completion score below 50% → at least HIGH
  if (copilot.completionScore < 50) {
    severity = maxSeverity(severity, 'HIGH');
    ruleReasons.push(
      `[HIGH] Tỷ lệ hoàn thiện hồ sơ ${copilot.completionScore}% dưới ngưỡng tối thiểu 50%`,
    );
  }

  // Rule E: Open bidding without publication notice → CRITICAL
  // dang-tai is a mandatory stage for dau-thau-rong-rai; its absence violates
  // the statutory public disclosure requirement (Điều 8 Luật Đấu thầu 22/2023).
  if (input.procurementMethod === 'dau-thau-rong-rai') {
    const dangTai = templates.find(t => t.docType === 'dang-tai');
    if (dangTai?.status === 'MISSING') {
      severity = 'CRITICAL';
      ruleReasons.push(
        '[CRITICAL] Đấu thầu rộng rãi chưa có thông báo đăng tải mời thầu — vi phạm điều kiện công khai bắt buộc',
      );
    }
  }

  // Rule F: ODA package missing donor compliance clause → at least HIGH
  if (input.fundingSource === 'von-vay-oda' && !input.clauses.includes('tuan-thu-nha-tai-tro')) {
    severity = maxSeverity(severity, 'HIGH');
    ruleReasons.push(
      '[HIGH] Hợp đồng ODA/vay ưu đãi thiếu điều khoản tuân thủ nhà tài trợ (tuan-thu-nha-tai-tro)',
    );
  }

  // Rule G: State-budget package missing KHLCNT → at least HIGH
  if (input.fundingSource === 'ngan-sach-nha-nuoc') {
    const khlcnt = templates.find(t => t.docType === 'khlcnt');
    if (khlcnt?.status === 'MISSING') {
      severity = maxSeverity(severity, 'HIGH');
      ruleReasons.push(
        '[HIGH] Gói ngân sách nhà nước thiếu Kế hoạch lựa chọn nhà thầu (KHLCNT) — bắt buộc theo Luật Đấu thầu',
      );
    }
  }

  // ── 4. Decision from final severity ───────────────────────────────────────
  const decision: Decision =
    severity === 'CRITICAL' ? 'STOP'
    : severity === 'LOW'    ? 'PROCEED'
    :                         'PROCEED_WITH_WARNINGS';

  // ── 5. Aggregate ───────────────────────────────────────────────────────────
  // reasons: rule-triggered reasons first, then copilot engine warnings.
  const reasons = [...new Set([...ruleReasons, ...copilot.warnings])];
  if (reasons.length === 0) {
    reasons.push('Hồ sơ đầy đủ và tuân thủ quy định — có thể triển khai');
  }

  const recommendations = [...new Set(copilot.recommendations)];

  // legalBasis: copilot aggregate + first citation from each required but missing stage.
  const legalBasis = [
    ...new Set([
      ...copilot.legalBasis,
      ...templates
        .filter(t => t.required && t.status === 'MISSING')
        .map(t => t.legalBasis[0])
        .filter((s): s is string => !!s),
    ]),
  ];

  return { decision, severity, reasons, recommendations, legalBasis };
}
