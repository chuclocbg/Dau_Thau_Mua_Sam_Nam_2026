/**
 * ProcurementEngine — orchestrates all six procurement capabilities.
 *
 * Stateless. All rules injected (defaults to the standard Vietnamese rule set).
 * Produces a full ProcurementDecision from a ProcurementCase.
 *
 * Capabilities:
 *   1. classifyPackage     — Phân loại gói thầu
 *   2. determineThreshold  — Xác định ngưỡng giá trị
 *   3. selectMethod        — Lựa chọn hình thức đấu thầu
 *   4. resolveApproval     — Xác định thẩm quyền phê duyệt
 *   5. resolveLegalDocuments — Xác định văn bản pháp lý áp dụng
 *   6. buildWorkflow       — Xây dựng quy trình thực hiện
 */

import type {
  ProcurementCase,
  ProcurementDecision,
  PackageClassification,
  ThresholdDecision,
  MethodDecision,
  ApprovalDecision,
  RuleEvaluation,
  ProcurementRuleSpec,
  LegalBasis,
} from '../domain/procurementTypes';
import { PROCUREMENT_METHOD_NAMES, APPROVAL_AUTHORITY_NAMES } from '../domain/procurementTypes';
import {
  CLASSIFICATION_RULES,
  THRESHOLD_RULES,
  METHOD_RULES,
  APPROVAL_RULES,
  EXCEPTION_RULES,
  evaluateRuleSpec,
  findMatchingRule,
  findAllMatchingRules,
} from '../rules/procurementRules';

// ─── Workflow step definitions ────────────────────────────────────────────────
// Vietnamese procurement workflow steps by method

const WORKFLOW_STEPS: Readonly<Record<string, readonly string[]>> = {
  DIRECT_PROCUREMENT: [
    '1. Lập và phê duyệt dự toán mua sắm',
    '2. Lựa chọn nhà cung cấp (tối thiểu 3 báo giá)',
    '3. Thẩm định giá',
    '4. Phê duyệt kết quả lựa chọn nhà thầu',
    '5. Ký kết hợp đồng',
    '6. Nghiệm thu và thanh toán',
  ],
  COMPETITIVE_QUOTE: [
    '1. Chuẩn bị hồ sơ yêu cầu báo giá',
    '2. Đăng tải thông báo / gửi yêu cầu báo giá',
    '3. Nhận và mở hồ sơ báo giá',
    '4. Đánh giá hồ sơ báo giá',
    '5. Thẩm định kết quả đánh giá',
    '6. Phê duyệt kết quả lựa chọn nhà thầu',
    '7. Hoàn thiện và ký kết hợp đồng',
    '8. Nghiệm thu và thanh toán',
  ],
  OPEN_TENDER: [
    '1. Lập và phê duyệt kế hoạch lựa chọn nhà thầu (KHLCNT)',
    '2. Chuẩn bị hồ sơ mời thầu (HSMT)',
    '3. Thẩm định và phê duyệt HSMT',
    '4. Đăng tải thông báo mời thầu trên hệ thống mạng đấu thầu quốc gia',
    '5. Phát hành và giải thích HSMT',
    '6. Nhận và mở hồ sơ dự thầu (HSDT)',
    '7. Đánh giá HSDT (năng lực, kỹ thuật, tài chính)',
    '8. Thẩm định kết quả đánh giá',
    '9. Phê duyệt kết quả lựa chọn nhà thầu',
    '10. Thương thảo và hoàn thiện hợp đồng',
    '11. Ký kết hợp đồng',
    '12. Nghiệm thu từng phần và toàn bộ',
    '13. Thanh lý hợp đồng',
  ],
  DIRECT_APPOINTMENT: [
    '1. Xác định nhà thầu được chỉ định',
    '2. Chuẩn bị hồ sơ yêu cầu',
    '3. Gửi hồ sơ yêu cầu cho nhà thầu',
    '4. Nhận và đánh giá hồ sơ đề xuất',
    '5. Thẩm định kết quả chỉ định thầu',
    '6. Phê duyệt kết quả chỉ định thầu',
    '7. Hoàn thiện và ký kết hợp đồng',
    '8. Nghiệm thu và thanh toán',
  ],
  LIMITED_TENDER: [
    '1. Lập danh sách ngắn nhà thầu đủ năng lực',
    '2. Chuẩn bị và gửi HSMT cho danh sách ngắn',
    '3. Nhận và mở HSDT',
    '4. Đánh giá HSDT',
    '5. Thẩm định và phê duyệt kết quả',
    '6. Thương thảo và ký hợp đồng',
  ],
  SELF_EXECUTION: [
    '1. Đánh giá năng lực tự thực hiện',
    '2. Lập và phê duyệt phương án tự thực hiện',
    '3. Ký hợp đồng nội bộ (nếu có)',
    '4. Thực hiện và nghiệm thu',
  ],
  COMMUNITY: [
    '1. Họp cộng đồng, bầu ban giám sát',
    '2. Lập phương án thực hiện cộng đồng',
    '3. Phê duyệt phương án',
    '4. Tổ chức thực hiện với sự tham gia của cộng đồng',
    '5. Nghiệm thu và quyết toán',
  ],
};

// Documents applicable by case date (cumulative — each decree supersedes for its provisions)
const DOCUMENT_APPLICABILITY: Array<{ from: string; to: string | null; symbol: string; note: string }> = [
  { from: '2024-01-01', to: null,       symbol: '22/2023/QH15',   note: 'Luật Đấu thầu — luôn áp dụng' },
  { from: '2025-07-01', to: '2026-06-01', symbol: '214/2025/NĐ-CP', note: 'Nghị định hướng dẫn (giai đoạn đầu)' },
  { from: '2026-06-01', to: null,       symbol: '104/2026/NĐ-CP',  note: 'Nghị định hướng dẫn (cập nhật)' },
  { from: '2025-08-01', to: null,       symbol: '79/2025/TT-BTC',  note: 'Thông tư tài chính — áp dụng cho nguồn vốn nhà nước' },
  { from: '2026-05-01', to: null,       symbol: '13/2026/TT-BCT',  note: 'Thông tư thương mại — áp dụng cho hàng hóa' },
];

// ─── ProcurementEngine ────────────────────────────────────────────────────────

export class ProcurementEngine {
  private readonly classificationRules: readonly ProcurementRuleSpec[];
  private readonly thresholdRules:     readonly ProcurementRuleSpec[];
  private readonly methodRules:        readonly ProcurementRuleSpec[];
  private readonly approvalRules:      readonly ProcurementRuleSpec[];
  private readonly exceptionRules:     readonly ProcurementRuleSpec[];

  constructor(overrides?: {
    classificationRules?: readonly ProcurementRuleSpec[];
    thresholdRules?:      readonly ProcurementRuleSpec[];
    methodRules?:         readonly ProcurementRuleSpec[];
    approvalRules?:       readonly ProcurementRuleSpec[];
    exceptionRules?:      readonly ProcurementRuleSpec[];
  }) {
    this.classificationRules = overrides?.classificationRules ?? CLASSIFICATION_RULES;
    this.thresholdRules      = overrides?.thresholdRules      ?? THRESHOLD_RULES;
    this.methodRules         = overrides?.methodRules         ?? METHOD_RULES;
    this.approvalRules       = overrides?.approvalRules       ?? APPROVAL_RULES;
    this.exceptionRules      = overrides?.exceptionRules      ?? EXCEPTION_RULES;
  }

  // ── 1. Package classification ───────────────────────────────────────────────

  classifyPackage(pkg: ProcurementCase): PackageClassification {
    const rule = findMatchingRule(pkg, this.classificationRules);
    const legalBasis: LegalBasis = rule?.legalBasis[0] ?? { document: '22/2023/QH15', article: 'Điều 4' };
    return {
      packageType:  pkg.packageType,
      category:     String(rule?.output.category     ?? pkg.packageType),
      description:  String(rule?.output.description  ?? 'Gói thầu chưa phân loại'),
      legalBasis,
    };
  }

  // ── 2. Threshold determination ─────────────────────────────────────────────

  determineThreshold(pkg: ProcurementCase): ThresholdDecision {
    const rule = findMatchingRule(pkg, this.thresholdRules);
    const legalBasis: LegalBasis = rule?.legalBasis[0] ?? { document: '22/2023/QH15', article: 'Điều 22' };
    return {
      value:     pkg.estimatedValue,
      band:      String(rule?.output.band     ?? 'OPEN_TENDER'),
      bandName:  String(rule?.output.bandName ?? 'Đấu thầu rộng rãi'),
      currency:  'VND',
      legalBasis,
    };
  }

  // ── 3. Method selection ────────────────────────────────────────────────────

  selectMethod(pkg: ProcurementCase): MethodDecision {
    const activeExceptions = findAllMatchingRules(pkg, this.exceptionRules)
      .filter(r => r.output.overrideMethod === true);

    if (activeExceptions.length > 0) {
      const exc = activeExceptions[0]!;
      return {
        method:      'DIRECT_APPOINTMENT',
        methodName:  String(exc.output.methodName),
        legalBasis:  exc.legalBasis[0] ?? { document: '22/2023/QH15', article: 'Điều 23' },
        exceptions:  activeExceptions.map(r => String(r.output.methodName)),
      };
    }

    const rule = findMatchingRule(pkg, this.methodRules);
    const method = (rule?.output.method ?? 'OPEN_TENDER') as string;
    const legalBasis: LegalBasis = rule?.legalBasis[0] ?? { document: '22/2023/QH15', article: 'Điều 22' };
    return {
      method:      method as ReturnType<ProcurementEngine['selectMethod']>['method'],
      methodName:  String(rule?.output.methodName ?? PROCUREMENT_METHOD_NAMES['OPEN_TENDER']),
      legalBasis,
      exceptions:  [],
    };
  }

  // ── 4. Approval authority ─────────────────────────────────────────────────

  resolveApproval(pkg: ProcurementCase): ApprovalDecision {
    const rule = findMatchingRule(pkg, this.approvalRules);
    const authority = (rule?.output.authority ?? 'UNIT_HEAD') as ReturnType<ProcurementEngine['resolveApproval']>['authority'];
    const legalBasis: LegalBasis = rule?.legalBasis[0] ?? { document: '214/2025/NĐ-CP', article: 'Điều 76' };
    return {
      authority,
      authorityName: String(rule?.output.authorityName ?? APPROVAL_AUTHORITY_NAMES[authority]),
      legalBasis,
    };
  }

  // ── 5. Applicable legal documents ─────────────────────────────────────────

  resolveLegalDocuments(pkg: ProcurementCase): readonly string[] {
    return DOCUMENT_APPLICABILITY
      .filter(d => pkg.asOfDate >= d.from && (d.to === null || pkg.asOfDate < d.to))
      .filter(d => {
        // TT-BCT only for GOODS procurement
        if (d.symbol === '13/2026/TT-BCT' && pkg.packageType !== 'GOODS') return false;
        // TT-BTC only for STATE/ODA fund sources
        if (d.symbol === '79/2025/TT-BTC' && pkg.fundSource === 'ENTERPRISE') return false;
        return true;
      })
      .map(d => d.symbol);
  }

  // ── 6. Required procurement workflow ──────────────────────────────────────

  buildWorkflow(pkg: ProcurementCase): readonly string[] {
    const { method } = this.selectMethod(pkg);
    return WORKFLOW_STEPS[method] ?? WORKFLOW_STEPS['OPEN_TENDER']!;
  }

  // ── Full decision ─────────────────────────────────────────────────────────

  evaluate(pkg: ProcurementCase): ProcurementDecision {
    const allRules = [
      ...this.classificationRules,
      ...this.thresholdRules,
      ...this.methodRules,
      ...this.approvalRules,
      ...this.exceptionRules,
    ];

    const evaluations: RuleEvaluation[] = allRules.map(r => evaluateRuleSpec(r, pkg));

    return {
      caseId:                pkg.id,
      packageClassification: this.classifyPackage(pkg),
      threshold:             this.determineThreshold(pkg),
      method:                this.selectMethod(pkg),
      approval:              this.resolveApproval(pkg),
      legalDocuments:        this.resolveLegalDocuments(pkg),
      workflow:              this.buildWorkflow(pkg),
      evaluations,
      asOfDate:              pkg.asOfDate,
    };
  }
}
