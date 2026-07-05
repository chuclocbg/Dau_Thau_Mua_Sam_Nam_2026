import type {
  KnowledgeItemRef, ResolvedKnowledge, RuleKnowledgeItemRef, ThresholdKnowledgeItemRef,
} from '../domain/reasoningTypes.ts'

// ── Batch A mock knowledge fixtures ─────────────────────────────────────────────
// Stands in for Stage 2 (Knowledge Resolution) in Batch A. In production, X.3's
// knowledgeResolver.ts produces a ResolvedKnowledge shape identical to this one from
// the real, frozen Knowledge Platform — legalReasoningEngine.ts never knows the
// difference. All figures here are hand-built fixture data for pipeline testing,
// not asserted legal fact (per CLAUDE.md: never fabricate legal citations/figures
// as if authoritative — these mirror the documented founding rule set already
// present in app/knowledge/reasoning/rules.md and conflict.md's own worked examples).

export const LAW_BID_SECURITY: KnowledgeItemRef = Object.freeze({
  itemId: 'law-22-2023-dieu-14', domain: 'legal', type: 'LAW', title: 'Luật Đấu thầu 22/2023/QH15 — Điều 14',
  summary: 'Bảo đảm dự thầu bắt buộc đối với gói thầu áp dụng đấu thầu rộng rãi có giá trị trên 500.000.000 đồng.',
  legalBasis: [{ documentSymbol: '22/2023/QH15', article: 'Điều 14' }],
  metadata: {}, confidence: 0.95, layer: 1, effectiveFrom: '2024-01-01',
})

export const LAW_OPEN_TENDER_GOODS: KnowledgeItemRef = Object.freeze({
  itemId: 'law-22-2023-dieu-22', domain: 'legal', type: 'LAW', title: 'Luật Đấu thầu 22/2023/QH15 — Điều 22',
  summary: 'Gói thầu hàng hóa có giá trị trên 2.000.000.000 đồng thuộc nguồn vốn ngân sách nhà nước hoặc ODA phải áp dụng đấu thầu rộng rãi, trừ trường hợp thuộc danh mục chỉ định thầu theo quy định.',
  legalBasis: [{ documentSymbol: '22/2023/QH15', article: 'Điều 22' }],
  metadata: {}, confidence: 0.95, layer: 1, effectiveFrom: '2024-01-01',
})

export const CIRCULAR_ADVANCE_MAX: KnowledgeItemRef = Object.freeze({
  itemId: 'tt-79-2025-dieu-15', domain: 'legal', type: 'CIRCULAR', title: 'Thông tư 79/2025/TT-BTC — Điều 15',
  summary: 'Mức tạm ứng tối đa không vượt quá 30% giá trị hợp đồng đối với hợp đồng sử dụng vốn ngân sách nhà nước.',
  legalBasis: [{ documentSymbol: '79/2025/TT-BTC', article: 'Điều 15', clause: 'khoản 1' }],
  metadata: { conflictDimension: 'ADVANCE_PAYMENT_MAX', conflictValue: '0.30' },
  confidence: 0.9, layer: 1, effectiveFrom: '2025-03-15',
})

export const CIRCULAR_ADVANCE_GUARANTEE: KnowledgeItemRef = Object.freeze({
  itemId: 'tt-79-2025-dieu-18', domain: 'legal', type: 'CIRCULAR', title: 'Thông tư 79/2025/TT-BTC — Điều 18',
  summary: 'Bảo lãnh tạm ứng bắt buộc đối với khoản tạm ứng trên 100.000.000 đồng, trừ trường hợp khẩn cấp theo quyết định của Thủ trưởng đơn vị.',
  legalBasis: [{ documentSymbol: '79/2025/TT-BTC', article: 'Điều 18' }],
  metadata: {}, confidence: 0.9, layer: 1, effectiveFrom: '2025-03-15',
})

export const SCHOOL_POLICY_ADVANCE_MAX: KnowledgeItemRef = Object.freeze({
  itemId: 'qcnb-01-2025', domain: 'school', type: 'INTERNAL_REGULATION', title: 'Quy chế chi tiêu nội bộ — Tạm ứng',
  summary: 'Mức tạm ứng tối đa đối với các hợp đồng mua sắm của đơn vị là 20% giá trị hợp đồng.',
  legalBasis: [{ documentSymbol: 'QCNB-01/2025' }],
  metadata: { conflictDimension: 'ADVANCE_PAYMENT_MAX', conflictValue: '0.20' },
  confidence: 0.85, layer: 3, effectiveFrom: '2025-01-01',
})

export const ALL_LEGAL_ITEMS: readonly KnowledgeItemRef[] = Object.freeze([
  LAW_BID_SECURITY, LAW_OPEN_TENDER_GOODS, CIRCULAR_ADVANCE_MAX, CIRCULAR_ADVANCE_GUARANTEE,
])
export const ALL_SCHOOL_POLICY_ITEMS: readonly KnowledgeItemRef[] = Object.freeze([SCHOOL_POLICY_ADVANCE_MAX])

export const THRESHOLD_OPEN_TENDER_GOODS: ThresholdKnowledgeItemRef = Object.freeze({
  itemId: 'thr-open-tender-goods', domain: 'procurement', type: 'THRESHOLD', title: 'Ngưỡng đấu thầu rộng rãi — hàng hóa',
  summary: 'Ngưỡng giá trị bắt buộc áp dụng đấu thầu rộng rãi cho gói hàng hóa.',
  legalBasis: [{ documentSymbol: '22/2023/QH15', article: 'Điều 22' }], metadata: {}, confidence: 0.95, layer: 1,
  effectiveFrom: '2024-01-01',
  threshold: { thresholdCode: 'OPEN_TENDER_GOODS_MIN', thresholdType: 'PROCUREMENT_METHOD_FLOOR', contextField: 'estimatedValue', operator: 'GT', value: '2000000000', unit: 'VND' },
})

export const THRESHOLD_ADVANCE_MAX: ThresholdKnowledgeItemRef = Object.freeze({
  itemId: 'thr-advance-max', domain: 'procurement', type: 'THRESHOLD', title: 'Ngưỡng tạm ứng tối đa',
  summary: 'Tỷ lệ tạm ứng tối đa theo quy định chung.',
  legalBasis: [{ documentSymbol: '79/2025/TT-BTC', article: 'Điều 15', clause: 'khoản 1' }], metadata: {},
  confidence: 0.9, layer: 1, effectiveFrom: '2025-03-15',
  threshold: { thresholdCode: 'ADVANCE_PAYMENT_MAX_STATE', thresholdType: 'ADVANCE_PAYMENT_MAX', contextField: 'advanceRatio', operator: 'LTE', value: '0.30', unit: 'PERCENT' },
})

export const THRESHOLD_BID_SECURITY: ThresholdKnowledgeItemRef = Object.freeze({
  itemId: 'thr-bid-security', domain: 'procurement', type: 'THRESHOLD', title: 'Ngưỡng bảo đảm dự thầu',
  summary: 'Ngưỡng giá trị bắt buộc bảo đảm dự thầu.',
  legalBasis: [{ documentSymbol: '22/2023/QH15', article: 'Điều 14' }], metadata: {}, confidence: 0.95, layer: 1,
  effectiveFrom: '2024-01-01',
  threshold: { thresholdCode: 'BID_SECURITY_FLOOR', thresholdType: 'BID_SECURITY_FLOOR', contextField: 'estimatedValue', operator: 'GT', value: '500000000', unit: 'VND' },
})

export const ALL_THRESHOLD_ITEMS: readonly ThresholdKnowledgeItemRef[] = Object.freeze([
  THRESHOLD_OPEN_TENDER_GOODS, THRESHOLD_ADVANCE_MAX, THRESHOLD_BID_SECURITY,
])

export const RULE_OPEN_TENDER_GOODS: RuleKnowledgeItemRef = Object.freeze({
  itemId: 'rule-m01', domain: 'procurement', type: 'EVALUATION_RULE', title: 'RULE-M01 — Đấu thầu rộng rãi hàng hóa',
  summary: 'Quy tắc lựa chọn phương thức đấu thầu rộng rãi cho gói hàng hóa.',
  legalBasis: [{ documentSymbol: '22/2023/QH15', article: 'Điều 22' }], metadata: {}, confidence: 0.95, layer: 1,
  effectiveFrom: '2024-01-01',
  rule: {
    ruleCode: 'RULE-M01', ruleCategory: 'PROCUREMENT_METHOD',
    conditions: [
      { field: 'fundSource', operator: 'IN', value: 'STATE_BUDGET,ODA' },
      { field: 'packageType', operator: 'EQ', value: 'GOODS' },
      { field: 'estimatedValue', operator: 'GT', value: '2000000000', unit: 'VND' },
    ],
    outcome: { pass: 'Bắt buộc đấu thầu rộng rãi (gói hàng hóa > 2 tỷ VNĐ)', fail: 'Không bắt buộc đấu thầu rộng rãi' },
    isCritical: true,
  },
})

export const RULE_ADVANCE_MAX: RuleKnowledgeItemRef = Object.freeze({
  itemId: 'rule-a01', domain: 'procurement', type: 'EVALUATION_RULE', title: 'RULE-A01 — Mức tạm ứng tối đa',
  summary: 'Quy tắc mức tạm ứng tối đa theo nguồn vốn ngân sách nhà nước.',
  legalBasis: [{ documentSymbol: '79/2025/TT-BTC', article: 'Điều 15', clause: 'khoản 1' }], metadata: {},
  confidence: 0.9, layer: 1, effectiveFrom: '2025-03-15',
  rule: {
    ruleCode: 'RULE-A01', ruleCategory: 'ADVANCE_PAYMENT',
    conditions: [
      { field: 'fundSource', operator: 'EQ', value: 'STATE_BUDGET' },
      { field: 'advanceRatio', operator: 'LTE', value: '0.30', unit: 'PERCENT' },
    ],
    outcome: {
      pass: 'Tạm ứng không vượt quá 30% giá trị hợp đồng theo quy định chung (lưu ý: quy chế nội bộ có thể giới hạn chặt hơn)',
      fail: 'Tạm ứng vượt 30% giá trị hợp đồng — không phù hợp quy định',
    },
    isCritical: false,
  },
})

export const RULE_ADVANCE_GUARANTEE: RuleKnowledgeItemRef = Object.freeze({
  itemId: 'rule-a02', domain: 'procurement', type: 'EVALUATION_RULE', title: 'RULE-A02 — Bảo lãnh tạm ứng bắt buộc',
  summary: 'Quy tắc bảo lãnh tạm ứng bắt buộc khi khoản tạm ứng vượt ngưỡng.',
  legalBasis: [{ documentSymbol: '79/2025/TT-BTC', article: 'Điều 18' }], metadata: {}, confidence: 0.9, layer: 1,
  effectiveFrom: '2025-03-15',
  rule: {
    ruleCode: 'RULE-A02', ruleCategory: 'GUARANTEE',
    conditions: [
      { field: 'fundSource', operator: 'EQ', value: 'STATE_BUDGET' },
      { field: 'advanceAmount', operator: 'GT', value: '100000000', unit: 'VND' },
    ],
    outcome: {
      pass: 'Bảo lãnh tạm ứng bắt buộc', fail: 'Không đủ điều kiện yêu cầu bảo lãnh tạm ứng',
      exception: 'Không bắt buộc bảo lãnh tạm ứng do áp dụng trường hợp khẩn cấp',
    },
    isCritical: false, exceptionCodes: ['EMERGENCY_PROCUREMENT'],
  },
})

export const RULE_BID_SECURITY: RuleKnowledgeItemRef = Object.freeze({
  itemId: 'rule-g01', domain: 'procurement', type: 'EVALUATION_RULE', title: 'RULE-G01 — Bảo đảm dự thầu bắt buộc',
  summary: 'Quy tắc bảo đảm dự thầu bắt buộc cho đấu thầu rộng rãi trên ngưỡng.',
  legalBasis: [{ documentSymbol: '22/2023/QH15', article: 'Điều 14' }], metadata: {}, confidence: 0.95, layer: 1,
  effectiveFrom: '2024-01-01',
  rule: {
    ruleCode: 'RULE-G01', ruleCategory: 'GUARANTEE',
    conditions: [
      { field: 'procurementMethod', operator: 'EQ', value: 'OPEN_TENDER' },
      { field: 'estimatedValue', operator: 'GT', value: '500000000', unit: 'VND' },
    ],
    outcome: { pass: 'Bảo đảm dự thầu bắt buộc', fail: 'Không bắt buộc bảo đảm dự thầu' },
    isCritical: false,
  },
})

export const ALL_RULE_ITEMS: readonly RuleKnowledgeItemRef[] = Object.freeze([
  RULE_OPEN_TENDER_GOODS, RULE_ADVANCE_MAX, RULE_ADVANCE_GUARANTEE, RULE_BID_SECURITY,
])

export function buildResolvedKnowledge(
  asOfDate: string, overrides: Partial<ResolvedKnowledge> = {},
): ResolvedKnowledge {
  return {
    legalItems: ALL_LEGAL_ITEMS, procurementItems: [], thresholdItems: ALL_THRESHOLD_ITEMS,
    ruleItems: ALL_RULE_ITEMS, schoolPolicyItems: ALL_SCHOOL_POLICY_ITEMS, asOfDate,
    resolvedAt: `${asOfDate}T00:00:00.000Z`, platformCallCount: 0, warnings: [],
    ...overrides,
  }
}
