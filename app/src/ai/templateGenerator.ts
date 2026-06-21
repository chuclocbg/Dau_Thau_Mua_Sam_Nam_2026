/**
 * Legal v3.4 — Template Generator
 *
 * Generates an ordered 11-stage procurement dossier template list following
 * the standard Vietnamese public procurement lifecycle.
 *
 * Lifecycle (in order):
 *   1. to-trinh              — Tờ trình
 *   2. khlcnt                — Kế hoạch LCNT
 *   3. hsyc                  — Hồ sơ mời thầu / Hồ sơ yêu cầu
 *   4. quyet-dinh-phe-duyet  — Quyết định phê duyệt
 *   5. dang-tai              — Đăng tải (process stage)
 *   6. mo-thau               — Mở thầu (process stage)
 *   7. danh-gia              — Đánh giá (process stage)
 *   8. thuong-thao           — Thương thảo (process stage)
 *   9. hop-dong              — Hợp đồng
 *  10. bien-ban-ban-giao     — Nghiệm thu & bàn giao
 *  11. thanh-ly              — Thanh lý
 *
 * Pure function. Deterministic. No LLM. No browser globals. No hooks.
 * No IndexedDB. No UI. No agent modifications.
 */

import { getDocumentLegalContext } from './documentLegalContext';
import type { DocumentType }        from './documentLegalContext';
import type { ProcurementMethod, FundSource } from './legalApplicabilityEngine';
import type { ContractType }                   from './contractReviewer';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TemplateStatus = 'COMPLETE' | 'MISSING' | 'OPTIONAL';

export type TemplateDocType =
  | 'to-trinh'
  | 'khlcnt'
  | 'hsyc'
  | 'quyet-dinh-phe-duyet'
  | 'dang-tai'
  | 'mo-thau'
  | 'danh-gia'
  | 'thuong-thao'
  | 'hop-dong'
  | 'bien-ban-ban-giao'
  | 'thanh-ly';

export interface TemplateItem {
  docType:     TemplateDocType;
  /** True when mandated by the procurement method. */
  required:    boolean;
  /** True when the docType appears in existingDocuments. */
  present:     boolean;
  /** COMPLETE = required + present; MISSING = required + absent; OPTIONAL = not required. */
  status:      TemplateStatus;
  title:       string;
  description: string;
  legalBasis:  string[];
}

export interface TemplateGeneratorInput {
  procurementMethod: ProcurementMethod;
  fundingSource:     FundSource;
  packageValue:      number;
  existingDocuments: string[];
  contractType:      ContractType;
  durationDays:      number;
}

export interface TemplateGeneratorOutput {
  templates: TemplateItem[];
}

// Re-export so callers have a single import point.
export type { ProcurementMethod, FundSource, ContractType };

// ─── Lifecycle ────────────────────────────────────────────────────────────────

const LIFECYCLE_ORDER: readonly TemplateDocType[] = [
  'to-trinh',
  'khlcnt',
  'hsyc',
  'quyet-dinh-phe-duyet',
  'dang-tai',
  'mo-thau',
  'danh-gia',
  'thuong-thao',
  'hop-dong',
  'bien-ban-ban-giao',
  'thanh-ly',
];

// Stages absent from a method's set are OPTIONAL.
const REQUIRED_STAGES: Record<ProcurementMethod, ReadonlySet<TemplateDocType>> = {
  'dau-thau-rong-rai': new Set([
    'to-trinh', 'khlcnt', 'hsyc', 'quyet-dinh-phe-duyet',
    'dang-tai', 'mo-thau', 'danh-gia', 'thuong-thao',
    'hop-dong', 'bien-ban-ban-giao', 'thanh-ly',
  ]),
  'chao-hang-canh-tranh': new Set([
    'to-trinh', 'khlcnt', 'hsyc', 'quyet-dinh-phe-duyet',
    'dang-tai', 'danh-gia',
    'hop-dong', 'bien-ban-ban-giao', 'thanh-ly',
  ]),
  'mua-sam-truc-tiep': new Set([
    'to-trinh', 'khlcnt', 'hsyc', 'quyet-dinh-phe-duyet',
    'hop-dong', 'bien-ban-ban-giao', 'thanh-ly',
  ]),
  'chi-dinh-thau': new Set([
    'to-trinh', 'quyet-dinh-phe-duyet',
    'hop-dong', 'bien-ban-ban-giao', 'thanh-ly',
  ]),
  'chi-dinh-thau-rut-gon': new Set([
    'to-trinh',
    'hop-dong', 'bien-ban-ban-giao', 'thanh-ly',
  ]),
};

// ─── Display metadata ─────────────────────────────────────────────────────────

const STAGE_TITLE: Record<TemplateDocType, string> = {
  'to-trinh':             'Tờ trình phê duyệt kế hoạch lựa chọn nhà thầu',
  'khlcnt':               'Kế hoạch lựa chọn nhà thầu',
  'hsyc':                 'Hồ sơ mời thầu / Hồ sơ yêu cầu',
  'quyet-dinh-phe-duyet': 'Quyết định phê duyệt kết quả lựa chọn nhà thầu',
  'dang-tai':             'Đăng tải thông báo mời thầu trên hệ thống mạng đấu thầu',
  'mo-thau':              'Biên bản mở thầu',
  'danh-gia':             'Báo cáo đánh giá hồ sơ dự thầu',
  'thuong-thao':          'Biên bản thương thảo và hoàn thiện hợp đồng',
  'hop-dong':             'Hợp đồng mua sắm',
  'bien-ban-ban-giao':    'Biên bản nghiệm thu và bàn giao hàng hóa, dịch vụ',
  'thanh-ly':             'Biên bản thanh lý hợp đồng',
};

const STAGE_DESCRIPTION: Record<TemplateDocType, string> = {
  'to-trinh':
    'Văn bản trình cấp có thẩm quyền phê duyệt nội dung, hình thức và kế hoạch lựa chọn nhà thầu.',
  'khlcnt':
    'Tài liệu xác định tên gói thầu, hình thức lựa chọn nhà thầu, nguồn vốn, thời gian thực hiện và giá gói thầu ước tính.',
  'hsyc':
    'Bộ hồ sơ gồm yêu cầu kỹ thuật, điều khoản hợp đồng và tiêu chí đánh giá được sử dụng để lựa chọn nhà thầu.',
  'quyet-dinh-phe-duyet':
    'Quyết định hành chính do cấp có thẩm quyền ban hành, chính thức phê duyệt kết quả lựa chọn nhà thầu.',
  'dang-tai':
    'Thông báo mời thầu hoặc thông báo mời chào hàng được đăng tải trên Hệ thống mạng đấu thầu quốc gia theo quy định.',
  'mo-thau':
    'Biên bản ghi nhận diễn biến mở hồ sơ dự thầu, lập bởi tổ mở thầu có chứng kiến của đại diện nhà thầu.',
  'danh-gia':
    'Báo cáo tổng hợp kết quả đánh giá hồ sơ dự thầu theo tiêu chí quy định trong hồ sơ mời thầu.',
  'thuong-thao':
    'Biên bản ghi nhận nội dung thương thảo, làm rõ hoặc hoàn thiện các điều khoản hợp đồng trước khi ký kết.',
  'hop-dong':
    'Văn bản pháp lý ràng buộc giữa bên mời thầu và nhà thầu trúng thầu về quyền, nghĩa vụ và giá trị hợp đồng.',
  'bien-ban-ban-giao':
    'Biên bản xác nhận kết quả nghiệm thu hàng hóa, dịch vụ và bàn giao tài sản vào sử dụng, quản lý.',
  'thanh-ly':
    'Văn bản xác nhận hai bên đã thực hiện đầy đủ nghĩa vụ hợp đồng và chính thức thanh lý, kết thúc hợp đồng.',
};

// Static citations for process stages and bien-ban-ban-giao (no DocumentType entry).
const STATIC_LEGAL_BASIS: Partial<Record<TemplateDocType, readonly string[]>> = {
  'dang-tai': [
    'Điều 8 Luật Đấu thầu số 22/2023/QH15 — đăng tải thông tin về đấu thầu',
    'Khoản 1 Điều 7 Nghị định 214/2025/NĐ-CP — công khai thông tin đấu thầu',
  ],
  'mo-thau': [
    'Điều 39 Luật Đấu thầu số 22/2023/QH15 — mở thầu',
    'Điều 36 Nghị định 214/2025/NĐ-CP — trình tự mở hồ sơ dự thầu',
  ],
  'danh-gia': [
    'Điều 40 Luật Đấu thầu số 22/2023/QH15 — nguyên tắc đánh giá hồ sơ dự thầu',
    'Thông tư 79/2025/TT-BTC — tiêu chí và phương pháp đánh giá',
  ],
  'thuong-thao': [
    'Điều 19 Luật Đấu thầu số 22/2023/QH15 — thương thảo hợp đồng',
    'Khoản 2 Điều 54 Nghị định 214/2025/NĐ-CP — nội dung thương thảo',
  ],
  'bien-ban-ban-giao': [
    'Luật Quản lý, sử dụng tài sản công số 15/2017/QH14',
    'Điều 26 Nghị định 186/2025/NĐ-CP — nghiệm thu và bàn giao tài sản công',
  ],
};

// Stages that map to a DocumentType in documentLegalContext.
const CONTEXT_MAPPED_TYPES = new Set<TemplateDocType>([
  'to-trinh', 'khlcnt', 'hsyc', 'quyet-dinh-phe-duyet', 'hop-dong', 'thanh-ly',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLegalBasis(
  docType: TemplateDocType,
  method:  ProcurementMethod,
  fund:    FundSource,
): string[] {
  if (CONTEXT_MAPPED_TYPES.has(docType)) {
    const ctx = getDocumentLegalContext({
      documentType:      docType as DocumentType,
      packageCategory:   'hang-hoa',
      procurementMethod: method,
      sourceOfFunds:     fund,
    });
    // Fall back to reasoning excerpt if citations are empty (index may be sparse).
    return ctx.citations.length > 0 ? ctx.citations : [ctx.reasoning];
  }
  return [...(STATIC_LEGAL_BASIS[docType] ?? [])];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function generateTemplates(input: TemplateGeneratorInput): TemplateGeneratorOutput {
  const { procurementMethod, fundingSource, existingDocuments } = input;
  const existingSet = new Set(existingDocuments);
  const required    = REQUIRED_STAGES[procurementMethod];

  const templates: TemplateItem[] = LIFECYCLE_ORDER.map(docType => {
    const isRequired = required.has(docType);
    const isPresent  = existingSet.has(docType);

    let status: TemplateStatus;
    if (!isRequired)   status = 'OPTIONAL';
    else if (isPresent) status = 'COMPLETE';
    else                status = 'MISSING';

    return {
      docType,
      required:    isRequired,
      present:     isPresent,
      status,
      title:       STAGE_TITLE[docType],
      description: STAGE_DESCRIPTION[docType],
      legalBasis:  getLegalBasis(docType, procurementMethod, fundingSource),
    };
  });

  return { templates };
}
