/**
 * Legal v1.6 — Applicability engine
 *
 * Determines which legal documents from legalIndex.json are applicable
 * to a given procurement workflow stage, based on:
 *   - package category (hang-hoa, dich-vu-tu-van, …)
 *   - workflow document type (to-trinh, khlcnt, hsyc, …)
 *   - procurement method (chi-dinh-thau, dau-thau-rong-rai, …)
 *   - source of funds (ngan-sach-nha-nuoc, von-su-nghiep, …)
 *
 * Pure function — no side effects, no agent changes, no UI changes.
 * Deterministic: same input always yields same output.
 */

import { searchLegalIndex } from './searchLegalIndex';
import type { SearchIndexResult } from './searchLegalIndex';

// ─── Input / output types ─────────────────────────────────────────────────────

export type WorkflowDocType =
  | 'to-trinh'             // Tờ trình
  | 'khlcnt'               // Kế hoạch lựa chọn nhà thầu
  | 'hsyc'                 // Hồ sơ yêu cầu / Hồ sơ mời thầu
  | 'hop-dong'             // Hợp đồng
  | 'bien-ban-nghiem-thu'  // Biên bản nghiệm thu
  | 'thanh-ly'             // Thanh lý
  | 'thanh-toan';          // Thanh toán

export type ProcurementMethod =
  | 'chi-dinh-thau'
  | 'chi-dinh-thau-rut-gon'
  | 'chao-hang-canh-tranh'
  | 'dau-thau-rong-rai'
  | 'mua-sam-truc-tiep';

export type FundSource =
  | 'ngan-sach-nha-nuoc'   // Capital budget (vốn đầu tư công / NSNN)
  | 'von-su-nghiep'        // Recurrent / operational budget (chi thường xuyên)
  | 'von-tu-co'            // Own revenue (nguồn thu tự chủ)
  | 'von-vay-oda';         // ODA / foreign concessional loans

export type PackageCategory =
  | 'hang-hoa'
  | 'dich-vu-tu-van'
  | 'dich-vu-phi-tu-van'
  | 'xay-lap';

export interface ApplicabilityInput {
  packageCategory: PackageCategory;
  workflowDocType: WorkflowDocType;
  procurementMethod: ProcurementMethod;
  fundSource: FundSource;
}

export interface ApplicableDocument {
  id: string;
  title: string;
  sourceFile: string;
  effectiveDate: string;
  relevanceTags: string[];
}

export interface ApplicabilityResult {
  applicableDocuments: ApplicableDocument[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
}

// ─── Lookup tables ─────────────────────────────────────────────────────────────

// Vietnamese procurement terms per workflow stage used to search the index.
// More specific terms rank the most relevant documents to the top.
const WORKFLOW_QUERIES: Record<WorkflowDocType, string> = {
  'to-trinh':            'thẩm quyền phê duyệt lựa chọn nhà thầu đấu thầu',
  'khlcnt':              'kế hoạch lựa chọn nhà thầu đăng tải đấu thầu',
  'hsyc':                'hồ sơ yêu cầu mời thầu đánh giá dự thầu lựa chọn nhà thầu',
  'hop-dong':            'hợp đồng ký kết thanh toán thực hiện gói thầu',
  'bien-ban-nghiem-thu': 'nghiệm thu bàn giao hoàn thành quyết toán vốn đầu tư',
  'thanh-ly':            'thanh lý tài sản công quản lý sử dụng kinh phí',
  'thanh-toan':          'thanh toán quyết toán chi ngân sách thường xuyên vốn đầu tư',
};

// Additional terms per fund source to bias results toward relevant budget rules.
const FUND_QUERIES: Record<FundSource, string> = {
  'ngan-sach-nha-nuoc': 'ngân sách nhà nước vốn đầu tư công quyết toán',
  'von-su-nghiep':      'chi thường xuyên sự nghiệp kinh phí bảo dưỡng tài sản công',
  'von-tu-co':          'nguồn thu tự chủ đơn vị sự nghiệp công lập',
  'von-vay-oda':        'ODA nhà tài trợ nước ngoài vốn vay ưu đãi',
};

// Additional terms per package category.
const CATEGORY_QUERIES: Record<PackageCategory, string> = {
  'hang-hoa':           'mua sắm hàng hóa thiết bị',
  'dich-vu-tu-van':     'dịch vụ tư vấn hồ sơ mời thầu',
  'dich-vu-phi-tu-van': 'dịch vụ phi tư vấn',
  'xay-lap':            'xây lắp xây dựng công trình',
};

// Priority reflects legal/audit complexity of the procurement method.
// dau-thau-rong-rai has the most mandatory publication, approval, and evaluation steps.
const METHOD_PRIORITY: Record<ProcurementMethod, ApplicabilityResult['priority']> = {
  'dau-thau-rong-rai':     'critical',
  'chao-hang-canh-tranh':  'high',
  'mua-sam-truc-tiep':     'high',
  'chi-dinh-thau':         'medium',
  'chi-dinh-thau-rut-gon': 'low',
};

const WORKFLOW_VI: Record<WorkflowDocType, string> = {
  'to-trinh':            'Tờ trình',
  'khlcnt':              'Kế hoạch lựa chọn nhà thầu',
  'hsyc':                'Hồ sơ yêu cầu',
  'hop-dong':            'Hợp đồng',
  'bien-ban-nghiem-thu': 'Biên bản nghiệm thu',
  'thanh-ly':            'Thanh lý',
  'thanh-toan':          'Thanh toán',
};

const METHOD_VI: Record<ProcurementMethod, string> = {
  'dau-thau-rong-rai':     'đấu thầu rộng rãi',
  'chao-hang-canh-tranh':  'chào hàng cạnh tranh',
  'mua-sam-truc-tiep':     'mua sắm trực tiếp',
  'chi-dinh-thau':         'chỉ định thầu',
  'chi-dinh-thau-rut-gon': 'chỉ định thầu rút gọn',
};

const FUND_VI: Record<FundSource, string> = {
  'ngan-sach-nha-nuoc': 'ngân sách nhà nước',
  'von-su-nghiep':      'chi thường xuyên sự nghiệp',
  'von-tu-co':          'nguồn thu tự chủ',
  'von-vay-oda':        'vốn ODA/vay ưu đãi',
};

// ─── Document classifier ──────────────────────────────────────────────────────

// Classify a document by its Vietnamese title into standard legal document types.
// Multiple tags are possible (e.g., a form published via circular gets 'form' only).
function classifyTitle(title: string): string[] {
  const tags: string[] = [];
  if (/[Ll]u[aậ]t/.test(title))                      tags.push('law');
  if (/[Nn]gh[iị]\s*[dđ][iị]nh/.test(title))         tags.push('decree');
  if (/[Tt]h[oô]ng\s*t[uư]/.test(title))             tags.push('circular');
  if (/[Mm][aẫ]u/.test(title))                        tags.push('form');
  return tags.length ? tags : ['document'];
}

// ─── Relevance tag builder ────────────────────────────────────────────────────

function buildRelevanceTags(
  result: SearchIndexResult,
  input: ApplicabilityInput,
): string[] {
  const tags = classifyTitle(result.title);
  const c = result.content.toLowerCase();

  if (input.fundSource === 'ngan-sach-nha-nuoc' &&
      (c.includes('đầu tư công') || c.includes('ngân sách nhà nước'))) {
    tags.push('budget-capital');
  }
  if (input.fundSource === 'von-su-nghiep' &&
      (c.includes('thường xuyên') || c.includes('sự nghiệp'))) {
    tags.push('budget-recurrent');
  }
  if (input.fundSource === 'von-vay-oda' &&
      (c.includes('oda') || c.includes('nhà tài trợ') || c.includes('vay ưu đãi'))) {
    tags.push('oda');
  }
  if (tags.includes('form') && input.packageCategory === 'dich-vu-tu-van') {
    tags.push('consulting');
  }

  return tags;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Determine which legal documents apply to the given procurement workflow context.
 *
 * Strategy:
 *   1. Combine workflow, fund-source, and package-category search terms into one query.
 *   2. Run BM25-lite search over legalIndex.json (reuses searchLegalIndex scoring).
 *   3. Deduplicate by title (each document may appear as both .docx and .md entry).
 *   4. Assign relevanceTags per document by classifying its Vietnamese title.
 *   5. Set priority from the procurement method (open bidding = critical, etc.).
 *   6. Return a human-readable reason in Vietnamese.
 */
export function determineApplicability(input: ApplicabilityInput): ApplicabilityResult {
  const query = [
    WORKFLOW_QUERIES[input.workflowDocType],
    FUND_QUERIES[input.fundSource],
    CATEGORY_QUERIES[input.packageCategory],
  ].join(' ');

  const rawResults = searchLegalIndex(query, { topK: 10, minScore: 1 });

  // Deduplicate: prefer the first (highest-scored) entry per title.
  const seen = new Set<string>();
  const deduped: SearchIndexResult[] = [];
  for (const r of rawResults) {
    if (!seen.has(r.title)) {
      seen.add(r.title);
      deduped.push(r);
    }
  }

  const applicableDocuments: ApplicableDocument[] = deduped.map(r => ({
    id:            r.sourceFile.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-'),
    title:         r.title,
    sourceFile:    r.sourceFile,
    effectiveDate: r.effectiveDate,
    relevanceTags: buildRelevanceTags(r, input),
  }));

  const priority = METHOD_PRIORITY[input.procurementMethod];
  const reason =
    `${WORKFLOW_VI[input.workflowDocType]} theo hình thức ` +
    `${METHOD_VI[input.procurementMethod]}, nguồn vốn: ${FUND_VI[input.fundSource]}`;

  return { applicableDocuments, priority, reason };
}
