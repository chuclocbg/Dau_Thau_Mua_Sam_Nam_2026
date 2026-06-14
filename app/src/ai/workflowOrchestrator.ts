/**
 * P5-05: One-Click Procurement Workflow Orchestrator
 *
 * From a single natural-language request, chains all 4 AI modules:
 *   P5-01 → P5-02 → P5-03 → P5-04 → document selection
 *
 * Does NOT call external APIs. Does NOT fabricate legal content.
 * All data must be reviewed and confirmed by the user before export.
 */

import type { ProcurementPackage, ProcurementItem } from '../demoData';
import { generatePackageSuggestion } from './packageGenerator';
import { generateItemSpec } from './specGenerator';
import { reviewPackage, LegalReviewResult } from './legalReviewer';
import { searchLegalKB, SearchResult } from './legalKnowledgeBase';

export interface WorkflowStep {
  step: number;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  message?: string;
}

/** Core procurement documents for one-click ZIP export */
export const WORKFLOW_DOCUMENT_IDS = [10, 11, 12, 27, 28, 14, 17, 18, 20, 21] as const;

export const WORKFLOW_DOCUMENT_NAMES: Record<number, string> = {
  10: 'Kế hoạch lựa chọn nhà thầu (KHLCNT)',
  11: 'Quyết định phê duyệt KHLCNT',
  12: 'Hồ sơ yêu cầu (HSYC)',
  14: 'Báo cáo đánh giá hồ sơ dự thầu',
  17: 'Quyết định phê duyệt kết quả lựa chọn nhà thầu',
  18: 'Hợp đồng kinh tế',
  20: 'Biên bản nghiệm thu',
  21: 'Thanh lý hợp đồng',
  27: 'Thông báo mời chào hàng',
  28: 'Biên bản mở thầu (chào hàng cạnh tranh)',
};

export interface WorkflowResult {
  success: boolean;
  pkg: ProcurementPackage;
  legalReview: LegalReviewResult;
  /** Top legal KB results relevant to this package (P5-04) */
  kbResults: SearchResult[];
  /** IDs from documentTemplates selected for ZIP export */
  selectedDocumentIds: number[];
  steps: WorkflowStep[];
  warnings: string[];
  readyForExport: boolean;
}

// Skeleton ProcurementPackage with neutral CLAUDE.md-compliant placeholders
const BASE_PKG_DEFAULTS: Omit<ProcurementPackage, 'id' | 'packageName' | 'packageCode'> = {
  fundingSource: 'autonomy_fund',
  fundingSourceName: 'Quỹ phát triển hoạt động sự nghiệp của nhà trường',
  budgetYear: new Date().getFullYear(),
  rectorName: '[Tên Hiệu trưởng]',
  departmentName: '[Tên đơn vị đề xuất]',
  departmentCode: '[Mã phòng]',
  expertTeamLeader: '[Tổ trưởng tổ chuyên gia]',
  expertTeamMember1: '[Thành viên tổ chuyên gia]',
  expertTeamMember2: '[Thành viên tổ chuyên gia]',
  appraisalLeader: '[Tổ trưởng thẩm định độc lập]',
  appraisalMember: '[Thành viên thẩm định độc lập]',
  supplier1Name: '[Nhà cung cấp số 1]',
  supplier1Address: '[Địa chỉ nhà cung cấp 1]',
  supplier1TaxCode: '[Mã số thuế]',
  supplier1Representative: '[Người đại diện]',
  supplier1Position: '[Chức vụ]',
  supplier2Name: '[Nhà cung cấp số 2]',
  supplier2Address: '[Địa chỉ nhà cung cấp 2]',
  supplier3Name: '[Nhà cung cấp số 3]',
  supplier3Address: '[Địa chỉ nhà cung cấp 3]',

  dateProposal: '',
  dateSurvey: '',
  dateQuotes: '',
  dateCompare: '',
  dateKhlcnt: '',
  dateKhlcntApprove: '',
  dateExpertEstablish: '',
  dateDocIssue: '',
  dateBidClose: '',
  dateEvaluate: '',
  dateAppraise: '',
  dateResultProposal: '',
  dateResultApprove: '',
  dateContractSign: '',
  dateDelivery: '',
  dateAcceptance: '',
  dateLiquidation: '',
  dateAssetIncrease: '',

  contractDurationDays: 30,
  contractType: 'lump_sum',
  warrantyMonths: 12,
  packageType: 'goods_fixed_asset',
  items: [],
};

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Generate a legal-minimum timeline starting from today
function buildTimeline(today: Date, contractDays: number): Partial<ProcurementPackage> {
  return {
    dateProposal: addDays(today, 0),
    dateSurvey: addDays(today, 2),
    dateQuotes: addDays(today, 4),
    dateCompare: addDays(today, 6),
    dateKhlcnt: addDays(today, 8),
    dateKhlcntApprove: addDays(today, 10),
    dateExpertEstablish: addDays(today, 12),
    dateDocIssue: addDays(today, 14),
    dateBidClose: addDays(today, 22),    // 8 calendar days ≥ 5 working days (Điều 81 NĐ 214/2025)
    dateEvaluate: addDays(today, 24),
    dateAppraise: addDays(today, 25),
    dateResultProposal: addDays(today, 27),
    dateResultApprove: addDays(today, 28),
    dateContractSign: addDays(today, 30),
    dateDelivery: addDays(today, 30 + contractDays),
    dateAcceptance: addDays(today, 30 + contractDays + 3),
    dateLiquidation: addDays(today, 30 + contractDays + 7),
    dateAssetIncrease: addDays(today, 30 + contractDays + 10),
  };
}

// Build a starter ProcurementItem; uses P5-02 for spec generation
function buildStarterItem(
  description: string,
  qty: number,
  estimatedTotal: number,
  budgetYear: number,
): ProcurementItem {
  const unitPrice = qty > 0 ? Math.round(estimatedTotal / qty) : estimatedTotal;
  const specResult = generateItemSpec(description);

  return {
    id: `ai-item-${budgetYear}-001`,
    name: description,
    unit: 'Bộ',
    quantity: qty,
    unitPrice,
    specs: specResult.specs,
    supplier1Price: Math.round(unitPrice * 0.97),
    supplier2Price: unitPrice,
    supplier3Price: Math.round(unitPrice * 1.02),
  };
}

// Extract first integer from request string
function extractQtyFromRequest(text: string): number {
  const m = text.match(/\b(\d+)\b/);
  return m ? parseInt(m[1], 10) : 1;
}

// Build a KB search query from package details
function buildKBQuery(category: string, methodHint: string, packageName: string): string {
  const parts: string[] = [];
  if (category && category !== 'Không rõ') parts.push(category);
  if (methodHint) parts.push(methodHint);
  if (packageName) parts.push(packageName.substring(0, 40));
  return parts.join(' ');
}

/**
 * Run the one-click procurement workflow.
 *
 * @param naturalLanguageRequest  e.g. "20 máy tính để bàn phục vụ thực hành"
 * @param budgetYear  fiscal year (default: current year)
 * @param today  date override for deterministic tests
 */
export function runWorkflow(
  naturalLanguageRequest: string,
  budgetYear = new Date().getFullYear(),
  today = new Date(),
): WorkflowResult {
  const steps: WorkflowStep[] = [
    { step: 1, label: 'Phân tích yêu cầu (P5-01)', status: 'pending' },
    { step: 2, label: 'Sinh yêu cầu kỹ thuật (P5-02)', status: 'pending' },
    { step: 3, label: 'Rà soát pháp lý (P5-03)', status: 'pending' },
    { step: 4, label: 'Tra cứu căn cứ pháp lý (P5-04)', status: 'pending' },
    { step: 5, label: 'Chọn hồ sơ cần xuất', status: 'pending' },
  ];
  const warnings: string[] = [];

  // ── Step 1: AI Package Generator (P5-01) ──────────────────────────────────
  steps[0].status = 'running';
  const suggestion = generatePackageSuggestion(naturalLanguageRequest, budgetYear);
  steps[0].status = 'done';
  steps[0].message = `Nhận dạng: ${suggestion.detectedCategory || 'Không rõ'} (độ tin cậy: ${suggestion.confidence})`;

  if (suggestion.confidence === 'low') {
    warnings.push(
      'Không nhận dạng được loại hàng hóa/dịch vụ. Các trường được điền với giá trị mặc định — vui lòng kiểm tra và chỉnh sửa thủ công.'
    );
  }
  suggestion.notes.forEach(n => warnings.push(n));

  // ── Step 2: AI Spec Generator (P5-02) ─────────────────────────────────────
  steps[1].status = 'running';
  const qty = extractQtyFromRequest(naturalLanguageRequest);
  const item = buildStarterItem(
    suggestion.packageName || naturalLanguageRequest,
    qty,
    suggestion.estimatedTotal || 0,
    budgetYear,
  );
  steps[1].status = 'done';
  steps[1].message = `Đã sinh yêu cầu kỹ thuật cho "${item.name}"`;

  // ── Step 3: Legal Review (P5-03) ───────────────────────────────────────────
  steps[2].status = 'running';
  const timeline = buildTimeline(today, suggestion.contractDurationDays);

  const pkg: ProcurementPackage = {
    ...BASE_PKG_DEFAULTS,
    id: `ai-generated-${Date.now()}`,
    packageName: suggestion.packageName || `Mua sắm ${naturalLanguageRequest}`,
    packageCode: suggestion.packageCode || `MS-${budgetYear}-AI01`,
    fundingSource: suggestion.fundingSource,
    fundingSourceName: suggestion.fundingSourceName,
    budgetYear,
    packageType: suggestion.packageType,
    contractType: suggestion.contractType,
    contractDurationDays: suggestion.contractDurationDays,
    warrantyMonths: suggestion.packageType === 'goods_fixed_asset' ? 12 : 0,
    items: [item],
    ...timeline,
  };

  const legalReview = reviewPackage(pkg);
  steps[2].status = 'done';
  steps[2].message = legalReview.summary;

  legalReview.findings
    .filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH')
    .forEach(f => warnings.push(`[${f.severity}] ${f.message}`));

  // ── Step 4: Legal Knowledge Base Query (P5-04) ────────────────────────────
  steps[3].status = 'running';
  const kbQuery = buildKBQuery(
    suggestion.detectedCategory,
    suggestion.procurementMethodHint,
    pkg.packageName,
  );
  const kbResults = kbQuery.trim().length > 0 ? searchLegalKB(kbQuery, 3) : [];
  steps[3].status = 'done';
  steps[3].message = kbResults.length > 0
    ? `Tìm thấy ${kbResults.length} căn cứ pháp lý liên quan`
    : 'Không tìm thấy căn cứ pháp lý cụ thể — kiểm tra thủ công';

  // ── Step 5: Document Selection ────────────────────────────────────────────
  steps[4].status = 'running';
  const selectedDocumentIds = [...WORKFLOW_DOCUMENT_IDS];
  steps[4].status = 'done';
  steps[4].message = `${selectedDocumentIds.length} hồ sơ sẵn sàng để xuất ZIP`;

  const readyForExport = !legalReview.hasCritical;

  return {
    success: true,
    pkg,
    legalReview,
    kbResults,
    selectedDocumentIds,
    steps,
    warnings,
    readyForExport,
  };
}
