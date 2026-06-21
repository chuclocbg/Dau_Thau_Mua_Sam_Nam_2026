/**
 * Legal v3.2 — Contract Reviewer Engine
 *
 * Reviews a procurement contract against Vietnamese procurement law requirements:
 *   1. Mandatory clause completeness
 *   2. Contract type compatibility with procurement method
 *   3. Procurement method compatibility check
 *   4. Funding-source constraints
 *   5. Duration validation per contract type
 *   6. Severity classification (CRITICAL / HIGH / MEDIUM / LOW)
 *   7. Recommendation generation
 *   8. Legal basis extraction (searchLegalIndex + extractCitations)
 *
 * Pure function. Deterministic: same input always yields identical output.
 * No LLM. No browser globals. No hooks. No IndexedDB. No UI.
 * No agent modifications. No ChatAgent changes. No LegalReviewerAgent changes.
 *
 * Primary legal references (not fabricated — all sourced from CLAUDE.md priority list):
 *   Luật Đấu thầu số 22/2023/QH15
 *   Nghị định 214/2025/NĐ-CP
 */

import { searchLegalIndex }  from './searchLegalIndex';
import { extractCitations }  from './legalCitationEngine';
import type { ProcurementMethod, FundSource } from './legalApplicabilityEngine';

// ─── Public types ──────────────────────────────────────────────────────────────

export type ContractType =
  | 'tron-goi'                 // Hợp đồng trọn gói (lump-sum)
  | 'theo-don-gia-dinh-truoc'  // Theo đơn giá định trước (fixed unit-price)
  | 'theo-don-gia-dieu-chinh'  // Theo đơn giá điều chỉnh (adjustable unit-price)
  | 'theo-thoi-gian'           // Theo thời gian (time-based, consulting)
  | 'ket-hop';                 // Kết hợp (combined)

export type ContractSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ContractFinding {
  code:     string;           // e.g. 'MISSING_CLAUSE', 'TYPE_MISMATCH'
  message:  string;           // Vietnamese explanation
  severity: ContractSeverity;
  legalRef: string;           // primary legal document reference
}

export interface ContractReviewerInput {
  contractType:      ContractType;
  procurementMethod: ProcurementMethod;
  fundingSource:     FundSource;
  durationDays:      number;    // contract duration in calendar days
  clauses:           string[];  // clause IDs present in the contract
  packageValue:      number;    // total package value in VND
}

export interface ContractReviewerOutput {
  findings:        ContractFinding[];
  warnings:        string[];     // '[SEVERITY] text' format — mirrors findings + context
  recommendations: string[];
  legalBasis:      string[];     // deduplicated formal citation strings
  severity:        ContractSeverity;  // maximum severity across all findings
}

// ─── Constants ─────────────────────────────────────────────────────────────────

// Package value above which performance security clause is mandatory.
// Threshold is set conservatively for public-unit procurement (Decree 214/2025/NĐ-CP).
const PERFORMANCE_SECURITY_THRESHOLD = 50_000_000; // 50 million VND

// Package value above which abbreviated direct appointment is auditably risky.
const RUT_GON_VALUE_THRESHOLD = 100_000_000; // 100 million VND

// Maximum contract duration in calendar days per contract type.
// Derived from typical Vietnamese procurement rules for recurrent-budget packages.
const MAX_DURATION_DAYS: Record<ContractType, number> = {
  'tron-goi':                365,   // goods: max 1 year
  'theo-don-gia-dinh-truoc': 730,   // works: max 2 years
  'theo-don-gia-dieu-chinh': 1825,  // long-term works: max 5 years
  'theo-thoi-gian':          365,   // consulting: max 1 year
  'ket-hop':                 1095,  // combined: max 3 years
};

// Contract types compatible with each procurement method.
const METHOD_COMPATIBLE_TYPES: Record<ProcurementMethod, ContractType[]> = {
  'dau-thau-rong-rai':     ['tron-goi', 'theo-don-gia-dinh-truoc', 'theo-don-gia-dieu-chinh', 'theo-thoi-gian', 'ket-hop'],
  'chao-hang-canh-tranh':  ['tron-goi', 'theo-don-gia-dinh-truoc'],
  'mua-sam-truc-tiep':     ['tron-goi', 'theo-don-gia-dinh-truoc'],
  'chi-dinh-thau':         ['tron-goi', 'theo-thoi-gian', 'theo-don-gia-dinh-truoc'],
  'chi-dinh-thau-rut-gon': ['tron-goi'],
};

// Clause IDs mandatory in ALL contracts.
const UNIVERSAL_MANDATORY_CLAUSES: readonly string[] = [
  'doi-tuong',      // Đối tượng hợp đồng
  'gia-tri',        // Giá trị hợp đồng
  'thoi-han',       // Thời hạn hợp đồng
  'thanh-toan',     // Điều khoản thanh toán
  'nghiem-thu',     // Điều kiện nghiệm thu
  'phat-vi-pham',   // Phạt vi phạm hợp đồng
  'bat-kha-khang',  // Bất khả kháng
  'tranh-chap',     // Giải quyết tranh chấp
] as const;

// Additional clause IDs mandatory per contract type.
const TYPE_MANDATORY_CLAUSES: Record<ContractType, string[]> = {
  'tron-goi':                ['bao-hanh'],
  'theo-don-gia-dinh-truoc': ['bao-hanh', 'bao-dam-thuc-hien'],
  'theo-don-gia-dieu-chinh': ['bao-hanh', 'bao-dam-thuc-hien', 'dieu-chinh-gia'],
  'theo-thoi-gian':          [],
  'ket-hop':                 ['bao-hanh'],
};

// Additional clause IDs mandatory per fund source.
const FUND_MANDATORY_CLAUSES: Record<FundSource, string[]> = {
  'ngan-sach-nha-nuoc': ['bao-dam-thuc-hien'],
  'von-su-nghiep':      [],
  'von-tu-co':          [],
  'von-vay-oda':        ['tuan-thu-nha-tai-tro'],
};

// Vietnamese labels for all known clause IDs.
const CLAUSE_LABELS: Record<string, string> = {
  'doi-tuong':              'Đối tượng hợp đồng',
  'gia-tri':                'Giá trị hợp đồng',
  'thoi-han':               'Thời hạn hợp đồng',
  'thanh-toan':             'Điều khoản thanh toán',
  'nghiem-thu':             'Điều kiện nghiệm thu',
  'phat-vi-pham':           'Phạt vi phạm hợp đồng',
  'bat-kha-khang':          'Bất khả kháng',
  'tranh-chap':             'Giải quyết tranh chấp',
  'bao-hanh':               'Bảo hành',
  'bao-dam-thuc-hien':      'Bảo đảm thực hiện hợp đồng',
  'dieu-chinh-gia':         'Điều chỉnh giá hợp đồng',
  'tuan-thu-nha-tai-tro':   'Tuân thủ hướng dẫn nhà tài trợ',
};

// Legal document references per finding type.
// References use real documents from the CLAUDE.md legal priority list.
const FINDING_LEGAL_REF: Record<string, string> = {
  'MISSING_CLAUSE':    'Nghị định 214/2025/NĐ-CP',
  'FUND_CLAUSE':       'Nghị định 214/2025/NĐ-CP',
  'PERF_SECURITY':     'Luật Đấu thầu số 22/2023/QH15',
  'TYPE_MISMATCH':     'Luật Đấu thầu số 22/2023/QH15',
  'DURATION_EXCEEDED': 'Nghị định 214/2025/NĐ-CP',
  'DURATION_INVALID':  'Nghị định 214/2025/NĐ-CP',
  'VALUE_WARNING':     'Nghị định 214/2025/NĐ-CP',
};

// Vietnamese labels for contract types.
const CONTRACT_TYPE_VI: Record<ContractType, string> = {
  'tron-goi':                'Trọn gói',
  'theo-don-gia-dinh-truoc': 'Theo đơn giá định trước',
  'theo-don-gia-dieu-chinh': 'Theo đơn giá điều chỉnh',
  'theo-thoi-gian':          'Theo thời gian',
  'ket-hop':                 'Kết hợp',
};

const METHOD_VI: Record<ProcurementMethod, string> = {
  'dau-thau-rong-rai':     'đấu thầu rộng rãi',
  'chao-hang-canh-tranh':  'chào hàng cạnh tranh',
  'mua-sam-truc-tiep':     'mua sắm trực tiếp',
  'chi-dinh-thau':         'chỉ định thầu',
  'chi-dinh-thau-rut-gon': 'chỉ định thầu rút gọn',
};

const SEVERITY_RANK: Record<ContractSeverity, number> = {
  CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0,
};

// Search queries for legal basis per contract type.
const CONTRACT_SEARCH_QUERY: Record<ContractType, string> = {
  'tron-goi':                'hợp đồng trọn gói mua sắm điều khoản ký kết lựa chọn nhà thầu',
  'theo-don-gia-dinh-truoc': 'hợp đồng đơn giá định trước xây lắp điều khoản bắt buộc',
  'theo-don-gia-dieu-chinh': 'hợp đồng đơn giá điều chỉnh dài hạn điều khoản',
  'theo-thoi-gian':          'hợp đồng tư vấn thời gian chi phí điều khoản dịch vụ',
  'ket-hop':                 'hợp đồng kết hợp gói thầu phức tạp điều khoản',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maxSeverity(a: ContractSeverity, b: ContractSeverity): ContractSeverity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

/** Format a VND value using Vietnamese decimal separators (no browser locale needed). */
function formatVnd(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Build a deduplicated map of (clauseId → requiredSeverity).
 * Universal clauses are CRITICAL; others are HIGH.
 * If a clause appears in multiple categories, the highest severity wins.
 */
function computeRequiredClauses(input: ContractReviewerInput): Map<string, ContractSeverity> {
  const req = new Map<string, ContractSeverity>();

  // Universal — always CRITICAL
  for (const c of UNIVERSAL_MANDATORY_CLAUSES) {
    req.set(c, 'CRITICAL');
  }

  // Type-specific — HIGH (only if not already mapped at CRITICAL)
  for (const c of TYPE_MANDATORY_CLAUSES[input.contractType]) {
    if (!req.has(c)) req.set(c, 'HIGH');
  }

  // Fund-specific — HIGH
  for (const c of FUND_MANDATORY_CLAUSES[input.fundingSource]) {
    if (!req.has(c)) req.set(c, 'HIGH');
  }

  // Value-based performance security — HIGH
  if (input.packageValue > PERFORMANCE_SECURITY_THRESHOLD) {
    if (!req.has('bao-dam-thuc-hien')) req.set('bao-dam-thuc-hien', 'HIGH');
  }

  return req;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Review a procurement contract for legal compliance.
 *
 * Check order:
 *  1. Mandatory clause completeness (universal + type + fund + value-based).
 *  2. Contract type compatibility with the procurement method.
 *  3. Contract duration validation.
 *  4. Package value / performance security check.
 *  5. Legal basis extraction via searchLegalIndex + extractCitations.
 *  6. Overall severity = max of all finding severities.
 *  7. Contextual warnings (portal, ODA, value ceiling).
 *  8. Recommendations from findings.
 */
export function reviewContract(input: ContractReviewerInput): ContractReviewerOutput {
  const findings: ContractFinding[] = [];
  const clauseSet = new Set(input.clauses);

  // ── 1. Mandatory clause check ─────────────────────────────────────────────
  const required = computeRequiredClauses(input);
  for (const [clause, severity] of required) {
    if (!clauseSet.has(clause)) {
      const label = CLAUSE_LABELS[clause] ?? clause;
      const isFundSpecific = FUND_MANDATORY_CLAUSES[input.fundingSource].includes(clause);
      findings.push({
        code:     isFundSpecific ? 'FUND_CLAUSE' : 'MISSING_CLAUSE',
        message:  `Thiếu điều khoản bắt buộc: "${label}"`,
        severity,
        legalRef: isFundSpecific
          ? FINDING_LEGAL_REF['FUND_CLAUSE']
          : FINDING_LEGAL_REF['MISSING_CLAUSE'],
      });
    }
  }

  // ── 2. Contract type compatibility ───────────────────────────────────────
  const compatibleTypes = METHOD_COMPATIBLE_TYPES[input.procurementMethod];
  if (!compatibleTypes.includes(input.contractType)) {
    const suggestion = CONTRACT_TYPE_VI[compatibleTypes[0]] ?? 'Trọn gói';
    findings.push({
      code:     'TYPE_MISMATCH',
      message:  `Loại hợp đồng "${CONTRACT_TYPE_VI[input.contractType]}" không phù hợp với hình thức ${METHOD_VI[input.procurementMethod]} — đề xuất: "${suggestion}"`,
      severity: 'HIGH',
      legalRef: FINDING_LEGAL_REF['TYPE_MISMATCH'],
    });
  }

  // ── 3. Duration validation ───────────────────────────────────────────────
  if (input.durationDays <= 0) {
    findings.push({
      code:     'DURATION_INVALID',
      message:  `Thời hạn hợp đồng không hợp lệ: ${input.durationDays} ngày`,
      severity: 'CRITICAL',
      legalRef: FINDING_LEGAL_REF['DURATION_INVALID'],
    });
  } else {
    const maxDays = MAX_DURATION_DAYS[input.contractType];
    if (input.durationDays > maxDays) {
      const excess  = input.durationDays - maxDays;
      const pct     = Math.round((excess / maxDays) * 100);
      const sev: ContractSeverity = pct > 50 ? 'HIGH' : 'MEDIUM';
      findings.push({
        code:     'DURATION_EXCEEDED',
        message:  `Thời hạn hợp đồng ${input.durationDays} ngày vượt quá giới hạn tối đa ${maxDays} ngày (${pct}% vượt mức)`,
        severity: sev,
        legalRef: FINDING_LEGAL_REF['DURATION_EXCEEDED'],
      });
    }
  }

  // ── 4. Legal basis (searchLegalIndex + extractCitations) ─────────────────
  const query   = CONTRACT_SEARCH_QUERY[input.contractType];
  const results = searchLegalIndex(query, { topK: 5, minScore: 1 });
  const legalBasis = [...new Set(extractCitations(results).map(c => c.citation))];

  // ── 5. Overall severity ──────────────────────────────────────────────────
  let severity: ContractSeverity = 'LOW';
  for (const f of findings) {
    severity = maxSeverity(severity, f.severity);
  }

  // ── 6. Warnings ──────────────────────────────────────────────────────────
  // Mirror each finding as a [SEVERITY] warning string.
  const warnings: string[] = findings.map(f => `[${f.severity}] ${f.message}`);

  // Contextual warnings beyond findings.
  if (input.procurementMethod === 'dau-thau-rong-rai') {
    warnings.push('[MEDIUM] Hợp đồng đấu thầu rộng rãi: đảm bảo đã đăng tải kết quả lựa chọn nhà thầu trên Hệ thống mạng đấu thầu quốc gia');
  }
  if (input.fundingSource === 'von-vay-oda') {
    warnings.push('[HIGH] Hợp đồng vốn ODA: kiểm tra tuân thủ điều ước quốc tế và hướng dẫn nhà tài trợ trước khi ký kết');
  }
  if (input.procurementMethod === 'chi-dinh-thau-rut-gon' && input.packageValue > RUT_GON_VALUE_THRESHOLD) {
    warnings.push(`[HIGH] Giá trị gói thầu ${formatVnd(input.packageValue)} VND có thể vượt ngưỡng áp dụng chỉ định thầu rút gọn — kiểm tra điều kiện áp dụng`);
  }

  // ── 7. Recommendations ───────────────────────────────────────────────────
  const recommendations: string[] = [];

  // Missing clauses → add them.
  const missingClauses = [...required.keys()].filter(c => !clauseSet.has(c));
  for (const clause of missingClauses) {
    const label = CLAUSE_LABELS[clause] ?? clause;
    recommendations.push(`Bổ sung điều khoản "${label}" vào hợp đồng`);
  }

  // Type mismatch → suggest a compatible type.
  if (findings.some(f => f.code === 'TYPE_MISMATCH')) {
    const suggestion = CONTRACT_TYPE_VI[compatibleTypes[0]] ?? 'Trọn gói';
    recommendations.push(`Chuyển sang loại hợp đồng "${suggestion}" để phù hợp với hình thức ${METHOD_VI[input.procurementMethod]}`);
  }

  // Duration exceeded → reduce or split.
  if (findings.some(f => f.code === 'DURATION_EXCEEDED')) {
    recommendations.push(`Rút ngắn thời hạn hợp đồng hoặc chia nhỏ gói thầu theo từng năm ngân sách`);
  }

  // Invalid duration → fix value.
  if (findings.some(f => f.code === 'DURATION_INVALID')) {
    recommendations.push(`Khai báo lại thời hạn hợp đồng với giá trị hợp lệ (dương và > 0)`);
  }

  // ODA compliance.
  if (input.fundingSource === 'von-vay-oda') {
    recommendations.push(`Đối chiếu toàn bộ điều khoản hợp đồng với hướng dẫn nhà tài trợ trước khi ký kết`);
  }

  // Legal basis reference.
  if (legalBasis.length > 0) {
    recommendations.push(`Căn cứ pháp lý chính: ${legalBasis[0]}`);
  }

  return { findings, warnings, recommendations, legalBasis, severity };
}
