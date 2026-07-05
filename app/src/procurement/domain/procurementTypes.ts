/**
 * Procurement Rule Engine — domain types.
 *
 * Covers all six capabilities:
 *   1. Package classification    (ProcurementPackageKind, PackageClassification)
 *   2. Threshold determination   (ThresholdDecision)
 *   3. Method selection          (ProcurementMethodCode, MethodDecision)
 *   4. Approval authority        (ApprovalAuthorityLevel, ApprovalDecision)
 *   5. Applicable legal docs     (LegalBasis, legalDocuments)
 *   6. Procurement workflow      (workflow steps)
 *
 * NOTE: ProcurementPackageKind, ProcurementMethodCode, ApprovalAuthorityLevel are
 * string-union domain types. masterdataTypes.ts defines PackageType, ProcurementMethod,
 * ApprovalAuthority as database entity interfaces — deliberately different names.
 *
 * Legal basis: Luật 22/2023/QH15, NĐ 214/2025/NĐ-CP, NĐ 104/2026/NĐ-CP,
 *              TT 79/2025/TT-BTC, TT 13/2026/TT-BCT
 */

// ─── Package kinds ────────────────────────────────────────────────────────────
// Điều 4 khoản 21 Luật 22/2023/QH15

export const PACKAGE_TYPES = [
  'GOODS',        // Hàng hóa
  'SERVICE',      // Dịch vụ phi tư vấn
  'CONSULTING',   // Dịch vụ tư vấn
  'CONSTRUCTION', // Xây lắp
  'MIXED',        // Hỗn hợp
] as const;
export type ProcurementPackageKind = typeof PACKAGE_TYPES[number];

// ─── Procurement method codes ─────────────────────────────────────────────────
// Điều 21 Luật 22/2023/QH15

export const PROCUREMENT_METHODS = [
  'OPEN_TENDER',        // Đấu thầu rộng rãi       — Điều 22
  'LIMITED_TENDER',     // Đấu thầu hạn chế          — Điều 24
  'DIRECT_APPOINTMENT', // Chỉ định thầu              — Điều 23
  'COMPETITIVE_QUOTE',  // Chào hàng cạnh tranh       — Điều 25
  'DIRECT_PROCUREMENT', // Mua sắm trực tiếp          — Điều 26
  'SELF_EXECUTION',     // Tự thực hiện               — Điều 27
  'COMMUNITY',          // Cộng đồng tham gia         — Điều 28
] as const;
export type ProcurementMethodCode = typeof PROCUREMENT_METHODS[number];

export const PROCUREMENT_METHOD_NAMES: Readonly<Record<ProcurementMethodCode, string>> = {
  OPEN_TENDER:        'Đấu thầu rộng rãi',
  LIMITED_TENDER:     'Đấu thầu hạn chế',
  DIRECT_APPOINTMENT: 'Chỉ định thầu',
  COMPETITIVE_QUOTE:  'Chào hàng cạnh tranh',
  DIRECT_PROCUREMENT: 'Mua sắm trực tiếp',
  SELF_EXECUTION:     'Tự thực hiện',
  COMMUNITY:          'Cộng đồng tham gia thực hiện',
};

// ─── Approval authority levels ────────────────────────────────────────────────
// NĐ 214/2025/NĐ-CP Chương VIII

export const APPROVAL_AUTHORITIES = [
  'UNIT_HEAD',           // Trưởng đơn vị / Giám đốc Ban QLDA
  'DEPARTMENT_DIRECTOR', // Giám đốc Sở / Cục trưởng
  'MINISTER',            // Bộ trưởng / Chủ tịch UBND tỉnh
  'PRIME_MINISTER',      // Thủ tướng Chính phủ
] as const;
export type ApprovalAuthorityLevel = typeof APPROVAL_AUTHORITIES[number];

export const APPROVAL_AUTHORITY_NAMES: Readonly<Record<ApprovalAuthorityLevel, string>> = {
  UNIT_HEAD:           'Người đứng đầu đơn vị / Giám đốc Ban QLDA',
  DEPARTMENT_DIRECTOR: 'Giám đốc Sở / Cục trưởng',
  MINISTER:            'Bộ trưởng / Chủ tịch UBND cấp tỉnh',
  PRIME_MINISTER:      'Thủ tướng Chính phủ',
};

// ─── Fund sources ─────────────────────────────────────────────────────────────

export const FUND_SOURCES = ['STATE', 'ODA', 'PPP', 'ENTERPRISE'] as const;
export type FundSource = typeof FUND_SOURCES[number];

// ─── Rule condition operators ─────────────────────────────────────────────────

export const RULE_OPERATORS = ['LT', 'LTE', 'GT', 'GTE', 'EQ', 'IN', 'NOT_IN'] as const;
export type RuleOperator = typeof RULE_OPERATORS[number];

// ─── Legal basis reference ────────────────────────────────────────────────────

export interface LegalBasis {
  readonly document: string;   // e.g. '22/2023/QH15'
  readonly article:  string;   // e.g. 'Điều 22'
  readonly clause?:  string;   // e.g. 'khoản 1'
  readonly point?:   string;   // e.g. 'điểm a'
}

// ─── Rule condition ───────────────────────────────────────────────────────────

export interface RuleCondition {
  readonly field:    string;       // field name on ProcurementCase
  readonly operator: RuleOperator;
  readonly value:    number | string | boolean | readonly string[];
}

// ─── Rule spec ────────────────────────────────────────────────────────────────

export type RuleCategory =
  | 'CLASSIFICATION'
  | 'THRESHOLD'
  | 'METHOD'
  | 'APPROVAL'
  | 'WORKFLOW'
  | 'EXCEPTION';

export interface ProcurementRuleSpec {
  readonly id:           string;   // e.g. 'PR-THRESH-001'
  readonly category:     RuleCategory;
  readonly name:         string;
  readonly description:  string;
  readonly legalBasis:   readonly LegalBasis[];
  readonly effectiveFrom: string;  // YYYY-MM-DD
  readonly effectiveTo:   string | null;
  readonly priority:     number;   // lower number = evaluated first
  readonly applicableTo: readonly ProcurementPackageKind[];  // empty = all types
  readonly conditions:   readonly RuleCondition[];
  readonly exceptions:   readonly string[];       // exception rule IDs that can override
  readonly output:       Readonly<Record<string, string | number | boolean>>;
  readonly examples:     readonly string[];
}

// ─── Input: procurement case ──────────────────────────────────────────────────

export interface ProcurementCase {
  readonly id:              string;
  readonly packageType:     ProcurementPackageKind;
  readonly estimatedValue:  number;    // VND (whole number)
  readonly fundSource:      FundSource;
  readonly isUrgent:        boolean;   // trường hợp khẩn cấp
  readonly isNationalSec:   boolean;   // an ninh quốc phòng
  readonly isInternational: boolean;   // đấu thầu quốc tế
  readonly singleSource?:   boolean;   // chỉ có một nhà thầu
  readonly asOfDate:        string;    // YYYY-MM-DD for rule effective date matching
}

// ─── Output: rule evaluation trace ───────────────────────────────────────────

export interface RuleEvaluation {
  readonly ruleId:   string;
  readonly ruleName: string;
  readonly matched:  boolean;
  readonly reason:   string;
  readonly output:   Readonly<Record<string, string | number | boolean>>;
}

// ─── Output: capability decisions ────────────────────────────────────────────

export interface PackageClassification {
  readonly packageType:  ProcurementPackageKind;
  readonly category:     string;
  readonly description:  string;
  readonly legalBasis:   LegalBasis;
}

export interface ThresholdDecision {
  readonly value:      number;
  readonly band:       string;    // 'DIRECT' | 'COMPETITIVE_QUOTE' | 'OPEN_TENDER'
  readonly bandName:   string;
  readonly currency:   'VND';
  readonly legalBasis: LegalBasis;
}

export interface MethodDecision {
  readonly method:      ProcurementMethodCode;
  readonly methodName:  string;
  readonly legalBasis:  LegalBasis;
  readonly exceptions:  readonly string[];   // descriptions of active exceptions
}

export interface ApprovalDecision {
  readonly authority:      ApprovalAuthorityLevel;
  readonly authorityName:  string;
  readonly legalBasis:     LegalBasis;
}

// ─── Full procurement decision ────────────────────────────────────────────────

export interface ProcurementDecision {
  readonly caseId:                string;
  readonly packageClassification: PackageClassification;
  readonly threshold:             ThresholdDecision;
  readonly method:                MethodDecision;
  readonly approval:              ApprovalDecision;
  readonly legalDocuments:        readonly string[];
  readonly workflow:              readonly string[];
  readonly evaluations:           readonly RuleEvaluation[];
  readonly asOfDate:              string;
}

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isPackageType(v: unknown): v is ProcurementPackageKind {
  return typeof v === 'string' && (PACKAGE_TYPES as readonly string[]).includes(v);
}

export function isProcurementMethod(v: unknown): v is ProcurementMethodCode {
  return typeof v === 'string' && (PROCUREMENT_METHODS as readonly string[]).includes(v);
}

export function isApprovalAuthority(v: unknown): v is ApprovalAuthorityLevel {
  return typeof v === 'string' && (APPROVAL_AUTHORITIES as readonly string[]).includes(v);
}
