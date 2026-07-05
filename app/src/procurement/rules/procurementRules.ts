/**
 * Procurement Rule Definitions + Evaluator
 *
 * Each rule is traceable to a specific article in Vietnamese law.
 * Rules are evaluated in priority order; the first match wins per category.
 *
 * Legal basis:
 *   Luật 22/2023/QH15  — primary procurement law
 *   NĐ 214/2025/NĐ-CP  — implementing decree (from 2025-07-01)
 *   NĐ 104/2026/NĐ-CP  — updated implementing decree (from 2026-06-01)
 *   TT 79/2025/TT-BTC  — financial guidance (from 2025-08-01)
 *   TT 13/2026/TT-BCT  — commercial guidance (from 2026-05-01)
 */

import type {
  ProcurementRuleSpec,
  RuleCondition,
  ProcurementCase,
  RuleEvaluation,
} from '../domain/procurementTypes';

// ─── Condition evaluator ──────────────────────────────────────────────────────

export function testCondition(cond: RuleCondition, pkg: ProcurementCase): boolean {
  const val = (pkg as unknown as Record<string, unknown>)[cond.field];
  if (val === undefined || val === null) return false;
  switch (cond.operator) {
    case 'LT':     return typeof val === 'number' && val < (cond.value as number);
    case 'LTE':    return typeof val === 'number' && val <= (cond.value as number);
    case 'GT':     return typeof val === 'number' && val > (cond.value as number);
    case 'GTE':    return typeof val === 'number' && val >= (cond.value as number);
    case 'EQ':     return val === cond.value;
    case 'IN':     return (cond.value as readonly string[]).includes(String(val));
    case 'NOT_IN': return !(cond.value as readonly string[]).includes(String(val));
    default:       return false;
  }
}

// ─── Rule spec evaluator ──────────────────────────────────────────────────────

export function evaluateRuleSpec(spec: ProcurementRuleSpec, pkg: ProcurementCase): RuleEvaluation {
  const fail = (reason: string): RuleEvaluation => ({
    ruleId: spec.id, ruleName: spec.name, matched: false, reason, output: {},
  });

  if (spec.applicableTo.length > 0 && !spec.applicableTo.includes(pkg.packageType))
    return fail(`packageType '${pkg.packageType}' not in applicableTo`);

  if (pkg.asOfDate < spec.effectiveFrom)
    return fail(`rule effective from ${spec.effectiveFrom}; case date is ${pkg.asOfDate}`);

  if (spec.effectiveTo !== null && pkg.asOfDate >= spec.effectiveTo)
    return fail(`rule expired on ${spec.effectiveTo}`);

  const failed = spec.conditions.find(c => !testCondition(c, pkg));
  if (failed)
    return fail(`condition failed: ${failed.field} ${failed.operator} ${JSON.stringify(failed.value)}`);

  return { ruleId: spec.id, ruleName: spec.name, matched: true, reason: 'All conditions met', output: spec.output };
}

export function findMatchingRule(pkg: ProcurementCase, rules: readonly ProcurementRuleSpec[]): ProcurementRuleSpec | null {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  return sorted.find(r => evaluateRuleSpec(r, pkg).matched) ?? null;
}

export function findAllMatchingRules(pkg: ProcurementCase, rules: readonly ProcurementRuleSpec[]): ProcurementRuleSpec[] {
  return [...rules].sort((a, b) => a.priority - b.priority).filter(r => evaluateRuleSpec(r, pkg).matched);
}

// ─── 1. Classification rules ──────────────────────────────────────────────────
// Điều 4 khoản 21 Luật 22/2023/QH15

export const CLASSIFICATION_RULES: readonly ProcurementRuleSpec[] = [
  {
    id: 'PR-CLASS-001', category: 'CLASSIFICATION', priority: 10,
    name: 'Gói thầu mua sắm hàng hóa',
    description: 'Gói thầu cung cấp hàng hóa, máy móc, thiết bị, nguyên vật liệu',
    legalBasis: [{ document: '22/2023/QH15', article: 'Điều 4', clause: 'khoản 21 điểm a' }],
    effectiveFrom: '2024-01-01', effectiveTo: null,
    applicableTo: ['GOODS'],
    conditions: [{ field: 'packageType', operator: 'EQ', value: 'GOODS' }],
    exceptions: [],
    output: { category: 'Hàng hóa', description: 'Mua sắm hàng hóa, máy móc, thiết bị, nguyên vật liệu, vật tư' },
    examples: ['Mua máy tính, văn phòng phẩm, thiết bị y tế'],
  },
  {
    id: 'PR-CLASS-002', category: 'CLASSIFICATION', priority: 10,
    name: 'Gói thầu dịch vụ phi tư vấn',
    description: 'Gói thầu cung cấp dịch vụ không phải tư vấn',
    legalBasis: [{ document: '22/2023/QH15', article: 'Điều 4', clause: 'khoản 21 điểm b' }],
    effectiveFrom: '2024-01-01', effectiveTo: null,
    applicableTo: ['SERVICE'],
    conditions: [{ field: 'packageType', operator: 'EQ', value: 'SERVICE' }],
    exceptions: [],
    output: { category: 'Dịch vụ phi tư vấn', description: 'Vệ sinh, bảo vệ, vận chuyển, bảo trì, sửa chữa' },
    examples: ['Dịch vụ vệ sinh công nghiệp, bảo vệ, vận chuyển tài liệu'],
  },
  {
    id: 'PR-CLASS-003', category: 'CLASSIFICATION', priority: 10,
    name: 'Gói thầu dịch vụ tư vấn',
    description: 'Gói thầu cung cấp dịch vụ tư vấn kỹ thuật, tài chính, pháp lý',
    legalBasis: [{ document: '22/2023/QH15', article: 'Điều 4', clause: 'khoản 21 điểm c' }],
    effectiveFrom: '2024-01-01', effectiveTo: null,
    applicableTo: ['CONSULTING'],
    conditions: [{ field: 'packageType', operator: 'EQ', value: 'CONSULTING' }],
    exceptions: [],
    output: { category: 'Tư vấn', description: 'Khảo sát, lập dự án, giám sát, kiểm tra, đánh giá' },
    examples: ['Tư vấn lập HSMT, giám sát thi công, kiểm toán'],
  },
  {
    id: 'PR-CLASS-004', category: 'CLASSIFICATION', priority: 10,
    name: 'Gói thầu xây lắp',
    description: 'Gói thầu xây dựng, lắp đặt công trình',
    legalBasis: [{ document: '22/2023/QH15', article: 'Điều 4', clause: 'khoản 21 điểm d' }],
    effectiveFrom: '2024-01-01', effectiveTo: null,
    applicableTo: ['CONSTRUCTION'],
    conditions: [{ field: 'packageType', operator: 'EQ', value: 'CONSTRUCTION' }],
    exceptions: [],
    output: { category: 'Xây lắp', description: 'Xây dựng, cải tạo, nâng cấp, sửa chữa công trình' },
    examples: ['Xây dựng trụ sở, sửa chữa đường nội bộ, lắp đặt hệ thống điện'],
  },
  {
    id: 'PR-CLASS-005', category: 'CLASSIFICATION', priority: 10,
    name: 'Gói thầu hỗn hợp',
    description: 'Gói thầu bao gồm nhiều loại công việc khác nhau',
    legalBasis: [{ document: '22/2023/QH15', article: 'Điều 4', clause: 'khoản 21 điểm đ' }],
    effectiveFrom: '2024-01-01', effectiveTo: null,
    applicableTo: ['MIXED'],
    conditions: [{ field: 'packageType', operator: 'EQ', value: 'MIXED' }],
    exceptions: [],
    output: { category: 'Hỗn hợp', description: 'Gói thầu bao gồm thiết kế - cung cấp thiết bị - thi công (EPC)' },
    examples: ['Gói thầu EPC nhà máy điện, khu công nghiệp'],
  },
];

// ─── 2. Threshold rules ───────────────────────────────────────────────────────
// NĐ 214/2025/NĐ-CP Điều 56–58; Luật 22/2023/QH15 Điều 22–26

export const THRESHOLD_RULES: readonly ProcurementRuleSpec[] = [
  // Goods / Services
  {
    id: 'PR-THRESH-001', category: 'THRESHOLD', priority: 10,
    name: 'Ngưỡng mua sắm trực tiếp — hàng hóa/dịch vụ',
    description: 'Gói thầu hàng hóa, dịch vụ phi tư vấn không quá 50 triệu đồng',
    legalBasis: [
      { document: '22/2023/QH15', article: 'Điều 26', clause: 'khoản 1' },
      { document: '214/2025/NĐ-CP', article: 'Điều 56', clause: 'khoản 1 điểm a' },
    ],
    effectiveFrom: '2025-07-01', effectiveTo: null,
    applicableTo: ['GOODS', 'SERVICE'],
    conditions: [
      { field: 'packageType', operator: 'IN', value: ['GOODS', 'SERVICE'] },
      { field: 'estimatedValue', operator: 'LTE', value: 50_000_000 },
    ],
    exceptions: [],
    output: { band: 'DIRECT', bandName: 'Mua sắm trực tiếp', methodHint: 'DIRECT_PROCUREMENT' },
    examples: ['Mua 10 bộ máy tính trị giá 45 triệu đồng'],
  },
  {
    id: 'PR-THRESH-002', category: 'THRESHOLD', priority: 20,
    name: 'Ngưỡng chào hàng cạnh tranh — hàng hóa/dịch vụ',
    description: 'Gói thầu hàng hóa, dịch vụ phi tư vấn từ 50 triệu đến dưới 200 triệu đồng',
    legalBasis: [
      { document: '22/2023/QH15', article: 'Điều 25', clause: 'khoản 1' },
      { document: '214/2025/NĐ-CP', article: 'Điều 57', clause: 'khoản 1 điểm a' },
    ],
    effectiveFrom: '2025-07-01', effectiveTo: null,
    applicableTo: ['GOODS', 'SERVICE'],
    conditions: [
      { field: 'packageType', operator: 'IN', value: ['GOODS', 'SERVICE'] },
      { field: 'estimatedValue', operator: 'GT',  value: 50_000_000 },
      { field: 'estimatedValue', operator: 'LT',  value: 200_000_000 },
    ],
    exceptions: [],
    output: { band: 'COMPETITIVE_QUOTE', bandName: 'Chào hàng cạnh tranh', methodHint: 'COMPETITIVE_QUOTE' },
    examples: ['Mua vật tư văn phòng 120 triệu đồng'],
  },
  {
    id: 'PR-THRESH-003', category: 'THRESHOLD', priority: 30,
    name: 'Ngưỡng đấu thầu rộng rãi — hàng hóa/dịch vụ',
    description: 'Gói thầu hàng hóa, dịch vụ phi tư vấn từ 200 triệu đồng trở lên',
    legalBasis: [{ document: '22/2023/QH15', article: 'Điều 22', clause: 'khoản 1' }],
    effectiveFrom: '2024-01-01', effectiveTo: null,
    applicableTo: ['GOODS', 'SERVICE'],
    conditions: [
      { field: 'packageType', operator: 'IN', value: ['GOODS', 'SERVICE'] },
      { field: 'estimatedValue', operator: 'GTE', value: 200_000_000 },
    ],
    exceptions: [],
    output: { band: 'OPEN_TENDER', bandName: 'Đấu thầu rộng rãi', methodHint: 'OPEN_TENDER' },
    examples: ['Mua thiết bị y tế 500 triệu đồng'],
  },
  // Construction
  {
    id: 'PR-THRESH-004', category: 'THRESHOLD', priority: 10,
    name: 'Ngưỡng mua sắm trực tiếp — xây lắp',
    description: 'Gói thầu xây lắp không quá 100 triệu đồng',
    legalBasis: [
      { document: '22/2023/QH15', article: 'Điều 26', clause: 'khoản 1' },
      { document: '214/2025/NĐ-CP', article: 'Điều 56', clause: 'khoản 1 điểm b' },
    ],
    effectiveFrom: '2025-07-01', effectiveTo: null,
    applicableTo: ['CONSTRUCTION'],
    conditions: [
      { field: 'packageType', operator: 'EQ',  value: 'CONSTRUCTION' },
      { field: 'estimatedValue', operator: 'LTE', value: 100_000_000 },
    ],
    exceptions: [],
    output: { band: 'DIRECT', bandName: 'Mua sắm trực tiếp (xây lắp)', methodHint: 'DIRECT_PROCUREMENT' },
    examples: ['Sửa chữa nhỏ tường rào 80 triệu đồng'],
  },
  {
    id: 'PR-THRESH-005', category: 'THRESHOLD', priority: 20,
    name: 'Ngưỡng chào hàng cạnh tranh — xây lắp',
    description: 'Gói thầu xây lắp từ 100 triệu đến dưới 500 triệu đồng',
    legalBasis: [
      { document: '22/2023/QH15', article: 'Điều 25', clause: 'khoản 1' },
      { document: '214/2025/NĐ-CP', article: 'Điều 57', clause: 'khoản 1 điểm b' },
    ],
    effectiveFrom: '2025-07-01', effectiveTo: null,
    applicableTo: ['CONSTRUCTION'],
    conditions: [
      { field: 'packageType', operator: 'EQ',  value: 'CONSTRUCTION' },
      { field: 'estimatedValue', operator: 'GT',  value: 100_000_000 },
      { field: 'estimatedValue', operator: 'LT',  value: 500_000_000 },
    ],
    exceptions: [],
    output: { band: 'COMPETITIVE_QUOTE', bandName: 'Chào hàng cạnh tranh (xây lắp)', methodHint: 'COMPETITIVE_QUOTE' },
    examples: ['Sơn lại mặt tiền tòa nhà 300 triệu đồng'],
  },
  {
    id: 'PR-THRESH-006', category: 'THRESHOLD', priority: 30,
    name: 'Ngưỡng đấu thầu rộng rãi — xây lắp',
    description: 'Gói thầu xây lắp từ 500 triệu đồng trở lên',
    legalBasis: [{ document: '22/2023/QH15', article: 'Điều 22', clause: 'khoản 1' }],
    effectiveFrom: '2024-01-01', effectiveTo: null,
    applicableTo: ['CONSTRUCTION'],
    conditions: [
      { field: 'packageType', operator: 'EQ',  value: 'CONSTRUCTION' },
      { field: 'estimatedValue', operator: 'GTE', value: 500_000_000 },
    ],
    exceptions: [],
    output: { band: 'OPEN_TENDER', bandName: 'Đấu thầu rộng rãi (xây lắp)', methodHint: 'OPEN_TENDER' },
    examples: ['Xây dựng nhà kho 2 tỷ đồng'],
  },
  // Consulting
  {
    id: 'PR-THRESH-007', category: 'THRESHOLD', priority: 10,
    name: 'Ngưỡng chỉ định thầu tư vấn — nhỏ',
    description: 'Gói tư vấn không quá 50 triệu đồng được chỉ định thầu',
    legalBasis: [{ document: '22/2023/QH15', article: 'Điều 23', clause: 'khoản 1 điểm b' }],
    effectiveFrom: '2024-01-01', effectiveTo: null,
    applicableTo: ['CONSULTING'],
    conditions: [
      { field: 'packageType', operator: 'EQ',  value: 'CONSULTING' },
      { field: 'estimatedValue', operator: 'LTE', value: 50_000_000 },
    ],
    exceptions: [],
    output: { band: 'DIRECT_APPOINTMENT', bandName: 'Chỉ định thầu (tư vấn nhỏ)', methodHint: 'DIRECT_APPOINTMENT' },
    examples: ['Thuê tư vấn phiên dịch 30 triệu đồng'],
  },
  {
    id: 'PR-THRESH-008', category: 'THRESHOLD', priority: 20,
    name: 'Ngưỡng đấu thầu tư vấn — lớn',
    description: 'Gói tư vấn trên 50 triệu đồng áp dụng đấu thầu rộng rãi hoặc cạnh tranh',
    legalBasis: [{ document: '22/2023/QH15', article: 'Điều 22', clause: 'khoản 1' }],
    effectiveFrom: '2024-01-01', effectiveTo: null,
    applicableTo: ['CONSULTING'],
    conditions: [
      { field: 'packageType', operator: 'EQ',  value: 'CONSULTING' },
      { field: 'estimatedValue', operator: 'GT', value: 50_000_000 },
    ],
    exceptions: [],
    output: { band: 'OPEN_TENDER', bandName: 'Tuyển chọn tư vấn cạnh tranh', methodHint: 'OPEN_TENDER' },
    examples: ['Thuê tư vấn giám sát 500 triệu đồng'],
  },
];

// ─── 3. Method rules ──────────────────────────────────────────────────────────

export const METHOD_RULES: readonly ProcurementRuleSpec[] = [
  {
    id: 'PR-METHOD-001', category: 'METHOD', priority: 10,
    name: 'Mua sắm trực tiếp — hàng hóa/dịch vụ nhỏ',
    description: 'Áp dụng mua sắm trực tiếp cho hàng hóa/dịch vụ không quá 50 triệu đồng',
    legalBasis: [{ document: '22/2023/QH15', article: 'Điều 26' }],
    effectiveFrom: '2024-01-01', effectiveTo: null,
    applicableTo: ['GOODS', 'SERVICE'],
    conditions: [{ field: 'estimatedValue', operator: 'LTE', value: 50_000_000 }],
    exceptions: ['PR-EXC-001'],
    output: { method: 'DIRECT_PROCUREMENT', methodName: 'Mua sắm trực tiếp' },
    examples: ['Mua mực in 10 triệu đồng'],
  },
  {
    id: 'PR-METHOD-002', category: 'METHOD', priority: 10,
    name: 'Mua sắm trực tiếp — xây lắp nhỏ',
    description: 'Áp dụng mua sắm trực tiếp cho xây lắp không quá 100 triệu đồng',
    legalBasis: [{ document: '22/2023/QH15', article: 'Điều 26' }],
    effectiveFrom: '2024-01-01', effectiveTo: null,
    applicableTo: ['CONSTRUCTION'],
    conditions: [{ field: 'estimatedValue', operator: 'LTE', value: 100_000_000 }],
    exceptions: ['PR-EXC-001'],
    output: { method: 'DIRECT_PROCUREMENT', methodName: 'Mua sắm trực tiếp (xây lắp)' },
    examples: ['Sửa chữa nhỏ 50 triệu đồng'],
  },
  {
    id: 'PR-METHOD-003', category: 'METHOD', priority: 10,
    name: 'Chỉ định thầu — tư vấn nhỏ',
    description: 'Áp dụng chỉ định thầu cho gói tư vấn không quá 50 triệu đồng',
    legalBasis: [{ document: '22/2023/QH15', article: 'Điều 23', clause: 'khoản 1 điểm b' }],
    effectiveFrom: '2024-01-01', effectiveTo: null,
    applicableTo: ['CONSULTING'],
    conditions: [{ field: 'estimatedValue', operator: 'LTE', value: 50_000_000 }],
    exceptions: [],
    output: { method: 'DIRECT_APPOINTMENT', methodName: 'Chỉ định thầu (tư vấn nhỏ)' },
    examples: ['Thuê tư vấn phiên dịch 20 triệu đồng'],
  },
  {
    id: 'PR-METHOD-004', category: 'METHOD', priority: 20,
    name: 'Chào hàng cạnh tranh — hàng hóa/dịch vụ',
    description: 'Chào hàng cạnh tranh cho hàng hóa/dịch vụ từ 50–200 triệu đồng',
    legalBasis: [{ document: '22/2023/QH15', article: 'Điều 25' }],
    effectiveFrom: '2024-01-01', effectiveTo: null,
    applicableTo: ['GOODS', 'SERVICE'],
    conditions: [
      { field: 'estimatedValue', operator: 'GT',  value: 50_000_000 },
      { field: 'estimatedValue', operator: 'LT',  value: 200_000_000 },
    ],
    exceptions: ['PR-EXC-001'],
    output: { method: 'COMPETITIVE_QUOTE', methodName: 'Chào hàng cạnh tranh' },
    examples: ['Mua thiết bị văn phòng 120 triệu đồng'],
  },
  {
    id: 'PR-METHOD-005', category: 'METHOD', priority: 20,
    name: 'Chào hàng cạnh tranh — xây lắp',
    description: 'Chào hàng cạnh tranh cho xây lắp từ 100–500 triệu đồng',
    legalBasis: [{ document: '22/2023/QH15', article: 'Điều 25' }],
    effectiveFrom: '2024-01-01', effectiveTo: null,
    applicableTo: ['CONSTRUCTION'],
    conditions: [
      { field: 'estimatedValue', operator: 'GT',  value: 100_000_000 },
      { field: 'estimatedValue', operator: 'LT',  value: 500_000_000 },
    ],
    exceptions: ['PR-EXC-001'],
    output: { method: 'COMPETITIVE_QUOTE', methodName: 'Chào hàng cạnh tranh (xây lắp)' },
    examples: ['Sơn tòa nhà 300 triệu đồng'],
  },
  {
    id: 'PR-METHOD-006', category: 'METHOD', priority: 100,
    name: 'Đấu thầu rộng rãi — mặc định',
    description: 'Áp dụng đấu thầu rộng rãi cho tất cả gói thầu vượt ngưỡng chào hàng cạnh tranh',
    legalBasis: [{ document: '22/2023/QH15', article: 'Điều 22' }],
    effectiveFrom: '2024-01-01', effectiveTo: null,
    applicableTo: [],   // all types
    conditions: [],     // fallback — always matches if no higher-priority rule matched
    exceptions: ['PR-EXC-001'],
    output: { method: 'OPEN_TENDER', methodName: 'Đấu thầu rộng rãi' },
    examples: ['Bất kỳ gói thầu nào vượt ngưỡng chào hàng cạnh tranh'],
  },
];

// ─── 4. Approval authority rules ─────────────────────────────────────────────
// NĐ 214/2025/NĐ-CP Chương VIII; NĐ 104/2026/NĐ-CP

export const APPROVAL_RULES: readonly ProcurementRuleSpec[] = [
  {
    id: 'PR-APPR-001', category: 'APPROVAL', priority: 10,
    name: 'Người đứng đầu đơn vị — gói thầu nhỏ',
    description: 'Gói thầu dưới 5 tỷ đồng do người đứng đầu đơn vị phê duyệt',
    legalBasis: [
      { document: '214/2025/NĐ-CP', article: 'Điều 76', clause: 'khoản 1' },
      { document: '104/2026/NĐ-CP', article: 'Điều 45', clause: 'khoản 1' },
    ],
    effectiveFrom: '2025-07-01', effectiveTo: null,
    applicableTo: [],
    conditions: [{ field: 'estimatedValue', operator: 'LT', value: 5_000_000_000 }],
    exceptions: [],
    output: { authority: 'UNIT_HEAD', authorityName: 'Người đứng đầu đơn vị / Giám đốc Ban QLDA' },
    examples: ['Gói thầu thiết bị 2 tỷ đồng'],
  },
  {
    id: 'PR-APPR-002', category: 'APPROVAL', priority: 20,
    name: 'Bộ trưởng / Chủ tịch UBND tỉnh — gói thầu vừa',
    description: 'Gói thầu từ 5 tỷ đến dưới 50 tỷ đồng do Bộ trưởng hoặc Chủ tịch UBND tỉnh phê duyệt',
    legalBasis: [
      { document: '214/2025/NĐ-CP', article: 'Điều 77', clause: 'khoản 1' },
      { document: '104/2026/NĐ-CP', article: 'Điều 46', clause: 'khoản 1' },
    ],
    effectiveFrom: '2025-07-01', effectiveTo: null,
    applicableTo: [],
    conditions: [
      { field: 'estimatedValue', operator: 'GTE', value: 5_000_000_000 },
      { field: 'estimatedValue', operator: 'LT',  value: 50_000_000_000 },
    ],
    exceptions: [],
    output: { authority: 'MINISTER', authorityName: 'Bộ trưởng / Chủ tịch UBND cấp tỉnh' },
    examples: ['Gói thầu xây dựng 20 tỷ đồng'],
  },
  {
    id: 'PR-APPR-003', category: 'APPROVAL', priority: 30,
    name: 'Thủ tướng Chính phủ — gói thầu lớn',
    description: 'Gói thầu từ 50 tỷ đồng trở lên do Thủ tướng phê duyệt',
    legalBasis: [
      { document: '214/2025/NĐ-CP', article: 'Điều 78', clause: 'khoản 1' },
      { document: '104/2026/NĐ-CP', article: 'Điều 47', clause: 'khoản 1' },
    ],
    effectiveFrom: '2025-07-01', effectiveTo: null,
    applicableTo: [],
    conditions: [{ field: 'estimatedValue', operator: 'GTE', value: 50_000_000_000 }],
    exceptions: [],
    output: { authority: 'PRIME_MINISTER', authorityName: 'Thủ tướng Chính phủ' },
    examples: ['Gói thầu xây dựng cầu 200 tỷ đồng'],
  },
];

// ─── 5. Exception rules ───────────────────────────────────────────────────────
// Điều 23 khoản 1 Luật 22/2023/QH15 — trường hợp chỉ định thầu

export const EXCEPTION_RULES: readonly ProcurementRuleSpec[] = [
  {
    id: 'PR-EXC-001', category: 'EXCEPTION', priority: 1,
    name: 'Chỉ định thầu — trường hợp khẩn cấp',
    description: 'Khi xảy ra sự cố bất khả kháng hoặc cần xử lý khẩn cấp để không ảnh hưởng đến an toàn công cộng',
    legalBasis: [{ document: '22/2023/QH15', article: 'Điều 23', clause: 'khoản 1 điểm a' }],
    effectiveFrom: '2024-01-01', effectiveTo: null,
    applicableTo: [],
    conditions: [{ field: 'isUrgent', operator: 'EQ', value: true }],
    exceptions: [],
    output: { method: 'DIRECT_APPOINTMENT', methodName: 'Chỉ định thầu (khẩn cấp)', overrideMethod: true },
    examples: ['Khắc phục sự cố vỡ đê, cháy nổ, thiên tai'],
  },
  {
    id: 'PR-EXC-002', category: 'EXCEPTION', priority: 1,
    name: 'Chỉ định thầu — nguồn cung duy nhất',
    description: 'Trường hợp chỉ có một nhà thầu có thể cung cấp hàng hóa/dịch vụ theo yêu cầu',
    legalBasis: [{ document: '22/2023/QH15', article: 'Điều 23', clause: 'khoản 1 điểm c' }],
    effectiveFrom: '2024-01-01', effectiveTo: null,
    applicableTo: [],
    conditions: [{ field: 'singleSource', operator: 'EQ', value: true }],
    exceptions: [],
    output: { method: 'DIRECT_APPOINTMENT', methodName: 'Chỉ định thầu (nguồn cung duy nhất)', overrideMethod: true },
    examples: ['Mua phụ tùng thiết bị đặc chủng của nhà sản xuất độc quyền'],
  },
  {
    id: 'PR-EXC-003', category: 'EXCEPTION', priority: 1,
    name: 'Chỉ định thầu — an ninh quốc phòng',
    description: 'Gói thầu liên quan đến bí mật nhà nước, an ninh quốc gia',
    legalBasis: [{ document: '22/2023/QH15', article: 'Điều 23', clause: 'khoản 1 điểm d' }],
    effectiveFrom: '2024-01-01', effectiveTo: null,
    applicableTo: [],
    conditions: [{ field: 'isNationalSec', operator: 'EQ', value: true }],
    exceptions: [],
    output: { method: 'DIRECT_APPOINTMENT', methodName: 'Chỉ định thầu (an ninh quốc phòng)', overrideMethod: true },
    examples: ['Mua thiết bị mật cho lực lượng vũ trang'],
  },
];

// ─── All rules (for engine consumption) ──────────────────────────────────────

export const ALL_RULES: readonly ProcurementRuleSpec[] = [
  ...CLASSIFICATION_RULES,
  ...THRESHOLD_RULES,
  ...METHOD_RULES,
  ...APPROVAL_RULES,
  ...EXCEPTION_RULES,
];
