/**
 * Legal v1.7 — Document-aware legal context
 *
 * Composition layer over the full legal pipeline:
 *   searchLegalIndex  → fetch relevant index chunks
 *   legalCitationEngine → extract formal Vietnamese citations
 *   legalApplicabilityEngine → determine applicable documents + base priority
 *
 * Adds:
 *   - "Quyết định phê duyệt" as an 8th document type (v1.6 had 7)
 *   - Per-document-type priority floor (e.g., approval decisions are always ≥ high)
 *   - A combined "reasoning" field suitable for document generation
 *
 * Pure function. No side effects. ChatAgent, LegalReviewerAgent, and UI unchanged.
 */

import { searchLegalIndex } from './searchLegalIndex';
import { extractCitations } from './legalCitationEngine';
import {
  determineApplicability,
  type PackageCategory,
  type ProcurementMethod,
  type FundSource,
  type WorkflowDocType,
  type ApplicableDocument,
} from './legalApplicabilityEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DocumentType =
  | 'to-trinh'              // Tờ trình
  | 'khlcnt'                // Kế hoạch lựa chọn nhà thầu
  | 'hsyc'                  // Hồ sơ yêu cầu / Hồ sơ mời thầu
  | 'quyet-dinh-phe-duyet'  // Quyết định phê duyệt
  | 'hop-dong'              // Hợp đồng
  | 'bien-ban-nghiem-thu'   // Biên bản nghiệm thu
  | 'thanh-ly'              // Thanh lý
  | 'thanh-toan';           // Thanh toán

// Re-export upstream types so callers have a single import point.
export type { PackageCategory, ProcurementMethod, FundSource };

export interface DocumentLegalContextInput {
  documentType:      DocumentType;
  packageCategory:   PackageCategory;
  procurementMethod: ProcurementMethod;
  sourceOfFunds:     FundSource;
}

// ApplicableDocument from v1.6 is used directly as RelevantDocument.
export type RelevantDocument = ApplicableDocument;

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export interface DocumentLegalContext {
  relevantDocuments: RelevantDocument[];
  citations:         string[];   // deduplicated formal citation strings
  priority:          Priority;
  reasoning:         string;     // Vietnamese explanation for document generation
}

// ─── Lookup tables ─────────────────────────────────────────────────────────────

// Map v1.7 DocumentType → v1.6 WorkflowDocType for the applicability call.
// quyet-dinh-phe-duyet follows the same authority chain as to-trinh.
const DOC_TYPE_TO_WORKFLOW: Record<DocumentType, WorkflowDocType> = {
  'to-trinh':             'to-trinh',
  'khlcnt':               'khlcnt',
  'hsyc':                 'hsyc',
  'quyet-dinh-phe-duyet': 'to-trinh',
  'hop-dong':             'hop-dong',
  'bien-ban-nghiem-thu':  'bien-ban-nghiem-thu',
  'thanh-ly':             'thanh-ly',
  'thanh-toan':           'thanh-toan',
};

// Search queries used specifically for citation extraction (may differ from applicability queries).
const DOC_TYPE_QUERIES: Record<DocumentType, string> = {
  'to-trinh':             'thẩm quyền phê duyệt lựa chọn nhà thầu đấu thầu mua sắm',
  'khlcnt':               'kế hoạch lựa chọn nhà thầu đăng tải đấu thầu',
  'hsyc':                 'hồ sơ yêu cầu mời thầu đánh giá dự thầu lựa chọn nhà thầu',
  'quyet-dinh-phe-duyet': 'phê duyệt quyết định kết quả lựa chọn nhà thầu thẩm quyền',
  'hop-dong':             'hợp đồng ký kết thanh toán thực hiện gói thầu',
  'bien-ban-nghiem-thu':  'nghiệm thu bàn giao hoàn thành quyết toán vốn đầu tư',
  'thanh-ly':             'thanh lý tài sản công quản lý sử dụng kinh phí',
  'thanh-toan':           'thanh toán quyết toán chi ngân sách vốn đầu tư thường xuyên',
};

// Documents with inherently high legal stakes regardless of procurement method.
// A formal approval decision or contract is always at least "high" priority.
const DOC_TYPE_PRIORITY_FLOOR: Partial<Record<DocumentType, Priority>> = {
  'quyet-dinh-phe-duyet': 'high',
  'hop-dong':             'high',
};

const PRIORITY_RANK: Record<Priority, number> = {
  critical: 3,
  high:     2,
  medium:   1,
  low:      0,
};

const PRIORITY_VI: Record<Priority, string> = {
  critical: 'Rất cao — bắt buộc kiểm tra toàn diện',
  high:     'Cao — yêu cầu rà soát kỹ pháp lý',
  medium:   'Trung bình — kiểm tra các điểm quan trọng',
  low:      'Thấp — thủ tục rút gọn',
};

const DOC_TYPE_VI: Record<DocumentType, string> = {
  'to-trinh':             'Tờ trình',
  'khlcnt':               'Kế hoạch lựa chọn nhà thầu',
  'hsyc':                 'Hồ sơ yêu cầu',
  'quyet-dinh-phe-duyet': 'Quyết định phê duyệt',
  'hop-dong':             'Hợp đồng',
  'bien-ban-nghiem-thu':  'Biên bản nghiệm thu',
  'thanh-ly':             'Thanh lý',
  'thanh-toan':           'Thanh toán',
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Elevate method-derived priority if the document type has a higher floor.
function elevatedPriority(base: Priority, docType: DocumentType): Priority {
  const floor = DOC_TYPE_PRIORITY_FLOOR[docType];
  if (!floor) return base;
  return PRIORITY_RANK[base] >= PRIORITY_RANK[floor] ? base : floor;
}

function buildReasoning(
  input: DocumentLegalContextInput,
  priority: Priority,
  citations: string[],
): string {
  const docLabel    = DOC_TYPE_VI[input.documentType];
  const methodLabel = METHOD_VI[input.procurementMethod];
  const fundLabel   = FUND_VI[input.sourceOfFunds];
  const priLabel    = PRIORITY_VI[priority];
  const citSample   = citations.slice(0, 3).join('; ');

  return (
    `${docLabel} áp dụng hình thức ${methodLabel}, nguồn vốn: ${fundLabel}. ` +
    `Mức độ pháp lý: ${priLabel}.` +
    (citSample ? ` Văn bản áp dụng: ${citSample}.` : '')
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a complete legal context for the given procurement document.
 *
 * Pipeline:
 *   1. determineApplicability()  → relevantDocuments + base priority + reason
 *   2. searchLegalIndex()        → content chunks for the specific document type
 *   3. extractCitations()        → formal citation strings (Điều/Khoản/Điểm + doc name)
 *   4. elevatedPriority()        → apply document-type floor to the method-derived priority
 *   5. buildReasoning()          → Vietnamese explanation for document generation
 */
export function getDocumentLegalContext(
  input: DocumentLegalContextInput,
): DocumentLegalContext {
  // Step 1 — applicable documents and base priority from v1.6 engine
  const applicability = determineApplicability({
    packageCategory:   input.packageCategory,
    workflowDocType:   DOC_TYPE_TO_WORKFLOW[input.documentType],
    procurementMethod: input.procurementMethod,
    fundSource:        input.sourceOfFunds,
  });

  // Step 2 — search with document-type-specific query for citation extraction
  const searchResults = searchLegalIndex(
    DOC_TYPE_QUERIES[input.documentType],
    { topK: 5, minScore: 1 },
  );

  // Step 3 — extract and deduplicate formal citation strings
  const rawCitations = extractCitations(searchResults);
  const citations    = [...new Set(rawCitations.map(c => c.citation))];

  // Step 4 — elevate priority if the document type has a legal-stakes floor
  const priority = elevatedPriority(
    applicability.priority as Priority,
    input.documentType,
  );

  // Step 5 — reasoning combines all inputs into a Vietnamese explanation
  const reasoning = buildReasoning(input, priority, citations);

  return {
    relevantDocuments: applicability.applicableDocuments,
    citations,
    priority,
    reasoning,
  };
}
