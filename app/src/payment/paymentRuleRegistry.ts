/**
 * Payment Rule Registry — bootstrap legal rule set.
 *
 * These are the initial rules derived from the five seed legal instruments.
 * They are NOT hardcoded business logic — they are data. Any future law,
 * decree, circular, ministerial decision, provincial regulation, or internal
 * regulation can be registered here without changing any business service.
 *
 * To supersede a rule: set its supersededBy field and add the new rule.
 * To extend: call buildPaymentRuleRegistry([...additionalRules]).
 *
 * Rule values (maxRate, maxDays, etc.) live ONLY in numericParams.
 * Business services never reference these numbers directly.
 */

import { createLegalBasis } from '../shared/financial/financialFactory';
import type { PaymentLegalRule } from './paymentLegalRule';

// ─── Advance rate rules (Tạm ứng) ────────────────────────────────────────────
// Source: TT 79/2025/TT-BTC Điều 15; Luật 22/2023/QH15 Điều 66
// numericParams: maxRate (decimal), minRate, guaranteeRequired (1=yes, 0=no)

export const ADVANCE_RATE_RULES: readonly PaymentLegalRule[] = [
  {
    ruleId: 'PR-PAY-ADV-001',
    ruleName: 'Tạm ứng vốn nhà nước/ODA — tối đa 30%',
    ruleType: 'ADVANCE_RATE',
    legalReferences: [
      createLegalBasis({ document: 'TT 79/2025/TT-BTC', article: 'Điều 15', clause: 'Khoản 1', effectiveDate: '2025-08-01', issuingAuthority: 'Bộ Tài chính', summary: 'Tỷ lệ tạm ứng tối đa đối với vốn nhà nước' }),
      createLegalBasis({ document: '22/2023/QH15', article: 'Điều 66', effectiveDate: '2024-01-01', issuingAuthority: 'Quốc hội', summary: 'Tạm ứng hợp đồng' }),
      createLegalBasis({ document: '214/2025/NĐ-CP', article: 'Điều 73', effectiveDate: '2025-07-01', issuingAuthority: 'Chính phủ', summary: 'Điều kiện tạm ứng' }),
    ],
    effectiveFrom: '2025-08-01',
    effectiveTo: null,
    applicablePackageTypes: [],
    applicableFundingSources: ['STATE', 'ODA'],
    applicableAuthorities: [],
    numericParams: { maxRate: 0.30, minRate: 0.00, guaranteeRequired: 1 },
    conditions: [{ field: 'fundSource', operator: 'IN', value: ['STATE', 'ODA'] }],
    priority: 10,
    description: 'Vốn nhà nước/ODA: tạm ứng ≤ 30%, bắt buộc bảo đảm tạm ứng',
  },
  {
    ruleId: 'PR-PAY-ADV-002',
    ruleName: 'Tạm ứng vốn doanh nghiệp/PPP — tối đa 15%',
    ruleType: 'ADVANCE_RATE',
    legalReferences: [
      createLegalBasis({ document: 'TT 79/2025/TT-BTC', article: 'Điều 15', clause: 'Khoản 2', effectiveDate: '2025-08-01', issuingAuthority: 'Bộ Tài chính', summary: 'Tỷ lệ tạm ứng đối với nguồn vốn khác' }),
    ],
    effectiveFrom: '2025-08-01',
    effectiveTo: null,
    applicablePackageTypes: [],
    applicableFundingSources: ['ENTERPRISE', 'PPP'],
    applicableAuthorities: [],
    numericParams: { maxRate: 0.15, minRate: 0.00, guaranteeRequired: 0 },
    conditions: [{ field: 'fundSource', operator: 'IN', value: ['ENTERPRISE', 'PPP'] }],
    priority: 20,
    description: 'Vốn doanh nghiệp/PPP: tạm ứng ≤ 15%, bảo đảm theo hợp đồng',
  },
];

// ─── Retention rate rules (Khấu trừ bảo hành) ────────────────────────────────
// Source: NĐ 214/2025/NĐ-CP Điều 18
// numericParams: maxRate, defaultRate, maxDurationMonths

export const RETENTION_RATE_RULES: readonly PaymentLegalRule[] = [
  {
    ruleId: 'PR-PAY-RET-001',
    ruleName: 'Khấu trừ bảo hành — tối đa 10%',
    ruleType: 'RETENTION_RATE',
    legalReferences: [
      createLegalBasis({ document: '214/2025/NĐ-CP', article: 'Điều 18', effectiveDate: '2025-07-01', issuingAuthority: 'Chính phủ', summary: 'Khấu trừ bảo hành công trình, hàng hóa, thiết bị' }),
      createLegalBasis({ document: '22/2023/QH15', article: 'Điều 67', effectiveDate: '2024-01-01', issuingAuthority: 'Quốc hội', summary: 'Bảo hành công trình, hàng hóa' }),
    ],
    effectiveFrom: '2025-07-01',
    effectiveTo: null,
    applicablePackageTypes: [],
    applicableFundingSources: [],
    applicableAuthorities: [],
    numericParams: { maxRate: 0.10, defaultRate: 0.05, maxDurationMonths: 24 },
    conditions: [],
    priority: 10,
    description: 'Khấu trừ bảo hành ≤ 10%, mặc định 5%, tối đa 24 tháng',
  },
];

// ─── Guarantee requirement rules (Bảo đảm hợp đồng) ─────────────────────────
// Source: NĐ 214/2025/NĐ-CP Điều 56, 57; TT 79/2025/TT-BTC Điều 15
// numericParams: minRate, maxRate, required (1=yes)

export const GUARANTEE_REQUIREMENT_RULES: readonly PaymentLegalRule[] = [
  {
    ruleId: 'PR-PAY-GUAR-001',
    ruleName: 'Bảo đảm thực hiện hợp đồng — 3-10%',
    ruleType: 'GUARANTEE_REQUIREMENT',
    legalReferences: [
      createLegalBasis({ document: '214/2025/NĐ-CP', article: 'Điều 56', effectiveDate: '2025-07-01', issuingAuthority: 'Chính phủ', summary: 'Bảo đảm thực hiện hợp đồng' }),
    ],
    effectiveFrom: '2025-07-01',
    effectiveTo: null,
    applicablePackageTypes: [],
    applicableFundingSources: [],
    applicableAuthorities: [],
    numericParams: { minRate: 0.03, maxRate: 0.10, required: 1 },
    conditions: [],
    priority: 10,
    description: 'Bảo đảm thực hiện hợp đồng: 3–10% giá trị hợp đồng',
  },
  {
    ruleId: 'PR-PAY-GUAR-002',
    ruleName: 'Bảo đảm bảo hành công trình — 2-5%',
    ruleType: 'GUARANTEE_REQUIREMENT',
    legalReferences: [
      createLegalBasis({ document: '214/2025/NĐ-CP', article: 'Điều 57', effectiveDate: '2025-07-01', issuingAuthority: 'Chính phủ', summary: 'Bảo đảm bảo hành công trình xây lắp' }),
    ],
    effectiveFrom: '2025-07-01',
    effectiveTo: null,
    applicablePackageTypes: ['CONSTRUCTION'],
    applicableFundingSources: [],
    applicableAuthorities: [],
    numericParams: { minRate: 0.02, maxRate: 0.05, required: 1 },
    conditions: [{ field: 'packageType', operator: 'EQ', value: 'CONSTRUCTION' }],
    priority: 20,
    description: 'Bảo đảm bảo hành công trình xây lắp: 2–5% giá trị hợp đồng',
  },
  {
    ruleId: 'PR-PAY-GUAR-003',
    ruleName: 'Bảo đảm tạm ứng — bằng giá trị tạm ứng',
    ruleType: 'GUARANTEE_REQUIREMENT',
    legalReferences: [
      createLegalBasis({ document: 'TT 79/2025/TT-BTC', article: 'Điều 15', clause: 'Khoản 3', effectiveDate: '2025-08-01', issuingAuthority: 'Bộ Tài chính', summary: 'Bảo đảm tạm ứng bằng giá trị tạm ứng' }),
    ],
    effectiveFrom: '2025-08-01',
    effectiveTo: null,
    applicablePackageTypes: [],
    applicableFundingSources: ['STATE', 'ODA'],
    applicableAuthorities: [],
    numericParams: { minRate: 1.00, maxRate: 1.00, required: 1 },
    conditions: [{ field: 'fundSource', operator: 'IN', value: ['STATE', 'ODA'] }],
    priority: 30,
    description: 'Bảo đảm tạm ứng phải bằng giá trị tạm ứng (vốn nhà nước)',
  },
];

// ─── Payment deadline rules (Thời hạn thanh toán) ────────────────────────────
// Source: TT 79/2025/TT-BTC Điều 20
// numericParams: maxDaysAfterAcceptance, maxDaysAfterTreasuryApproval

export const PAYMENT_DEADLINE_RULES: readonly PaymentLegalRule[] = [
  {
    ruleId: 'PR-PAY-DL-001',
    ruleName: 'Thời hạn thanh toán vốn nhà nước/ODA — 30 ngày',
    ruleType: 'PAYMENT_DEADLINE',
    legalReferences: [
      createLegalBasis({ document: 'TT 79/2025/TT-BTC', article: 'Điều 20', clause: 'Khoản 1', effectiveDate: '2025-08-01', issuingAuthority: 'Bộ Tài chính', summary: 'Thời hạn thanh toán hợp đồng vốn nhà nước' }),
    ],
    effectiveFrom: '2025-08-01',
    effectiveTo: null,
    applicablePackageTypes: [],
    applicableFundingSources: ['STATE', 'ODA'],
    applicableAuthorities: [],
    numericParams: { maxDaysAfterAcceptance: 30, maxDaysAfterTreasuryApproval: 5 },
    conditions: [{ field: 'fundSource', operator: 'IN', value: ['STATE', 'ODA'] }],
    priority: 10,
    description: '≤ 30 ngày sau nghiệm thu; ≤ 5 ngày sau KBNN duyệt',
  },
  {
    ruleId: 'PR-PAY-DL-002',
    ruleName: 'Thời hạn thanh toán vốn doanh nghiệp/PPP — 45 ngày',
    ruleType: 'PAYMENT_DEADLINE',
    legalReferences: [
      createLegalBasis({ document: 'TT 79/2025/TT-BTC', article: 'Điều 20', clause: 'Khoản 2', effectiveDate: '2025-08-01', issuingAuthority: 'Bộ Tài chính', summary: 'Thời hạn thanh toán hợp đồng vốn khác' }),
    ],
    effectiveFrom: '2025-08-01',
    effectiveTo: null,
    applicablePackageTypes: [],
    applicableFundingSources: ['ENTERPRISE', 'PPP'],
    applicableAuthorities: [],
    numericParams: { maxDaysAfterAcceptance: 45, maxDaysAfterTreasuryApproval: 0 },
    conditions: [{ field: 'fundSource', operator: 'IN', value: ['ENTERPRISE', 'PPP'] }],
    priority: 20,
    description: '≤ 45 ngày sau nghiệm thu (vốn doanh nghiệp/PPP, không qua KBNN)',
  },
];

// ─── Treasury threshold rules (Kiểm soát chi KBNN) ───────────────────────────
// Source: TT 79/2025/TT-BTC Điều 8–10
// numericParams: thresholdAmount (0 = all amounts), required (1=yes)

export const TREASURY_THRESHOLD_RULES: readonly PaymentLegalRule[] = [
  {
    ruleId: 'PR-PAY-TREAS-001',
    ruleName: 'Kiểm soát chi KBNN — tất cả vốn nhà nước',
    ruleType: 'TREASURY_THRESHOLD',
    legalReferences: [
      createLegalBasis({ document: 'TT 79/2025/TT-BTC', article: 'Điều 8', effectiveDate: '2025-08-01', issuingAuthority: 'Bộ Tài chính', summary: 'Kiểm soát chi qua Kho bạc Nhà nước' }),
      createLegalBasis({ document: 'TT 79/2025/TT-BTC', article: 'Điều 9', effectiveDate: '2025-08-01', issuingAuthority: 'Bộ Tài chính', summary: 'Hồ sơ kiểm soát chi' }),
    ],
    effectiveFrom: '2025-08-01',
    effectiveTo: null,
    applicablePackageTypes: [],
    applicableFundingSources: ['STATE', 'ODA'],
    applicableAuthorities: [],
    numericParams: { thresholdAmount: 0, required: 1 },
    conditions: [{ field: 'fundSource', operator: 'IN', value: ['STATE', 'ODA'] }],
    priority: 10,
    description: 'Mọi thanh toán từ vốn nhà nước/ODA phải kiểm soát chi qua KBNN',
  },
];

// ─── Full registry ────────────────────────────────────────────────────────────

export const PAYMENT_LEGAL_RULES: readonly PaymentLegalRule[] = [
  ...ADVANCE_RATE_RULES,
  ...RETENTION_RATE_RULES,
  ...GUARANTEE_REQUIREMENT_RULES,
  ...PAYMENT_DEADLINE_RULES,
  ...TREASURY_THRESHOLD_RULES,
];

/**
 * Extension point: build a merged registry with additional rules.
 * New laws, provincial regulations, or internal policy rules can be added here
 * without modifying any business service.
 */
export function buildPaymentRuleRegistry(
  additional: readonly PaymentLegalRule[] = [],
): readonly PaymentLegalRule[] {
  return [...PAYMENT_LEGAL_RULES, ...additional];
}
