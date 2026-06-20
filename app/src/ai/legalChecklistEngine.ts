/**
 * Legal v1.8 — Checklist engine for procurement workflows
 *
 * Determines which prerequisite documents must exist before a target document
 * can be lawfully generated, computes a completion score, and emits warnings.
 *
 * Uses:
 *   documentLegalContext.ts        → citations + priority for the target document
 *   legalApplicabilityEngine.ts    → applicable legal documents for legal basis
 *   legalCitationEngine.ts         → extractDocumentName() to normalise doc titles
 *
 * Adds 'bien-ban-ban-giao' (Biên bản bàn giao) as a 9th workflow document type
 * on top of v1.7's 8 DocumentType values. Existing types are unchanged.
 *
 * Pure function. Deterministic. ChatAgent, LegalReviewerAgent, UI unchanged.
 */

import {
  getDocumentLegalContext,
  type DocumentType,
  type PackageCategory,
  type ProcurementMethod,
  type FundSource,
  type Priority,
} from './documentLegalContext';

import {
  determineApplicability,
  type WorkflowDocType,
} from './legalApplicabilityEngine';

import { extractDocumentName } from './legalCitationEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

// 'bien-ban-ban-giao' is new in v1.8; all other types come from documentLegalContext.
export type ChecklistDocType = DocumentType | 'bien-ban-ban-giao';

// Re-export for callers who want a single import point.
export type { PackageCategory, ProcurementMethod, FundSource, Priority };

export interface ChecklistInput {
  documentType:      ChecklistDocType;
  packageCategory:   PackageCategory;
  procurementMethod: ProcurementMethod;
  sourceOfFunds:     FundSource;
  existingDocuments: ChecklistDocType[];
}

export interface RequiredDocument {
  docType:    ChecklistDocType;
  label:      string;
  mandatory:  boolean;
  legalBasis: string;   // normalised doc name from legalCitationEngine
}

export interface ChecklistResult {
  requiredDocuments: RequiredDocument[];
  presentDocuments:  ChecklistDocType[];
  missingDocuments:  RequiredDocument[];
  warnings:          string[];
  completionScore:   number;   // integer 0–100
}

// ─── Workflow prerequisite map ────────────────────────────────────────────────
//
// For each target document, lists the documents that MUST already exist in the
// dossier before this one can be lawfully prepared.
// Order follows the standard Vietnamese procurement sequence:
//   Tờ trình → KHLCNT → HSYC → Quyết định phê duyệt → Hợp đồng
//           → Nghiệm thu → Bàn giao → Thanh toán → Thanh lý

const PREREQUISITES: Record<ChecklistDocType, ChecklistDocType[]> = {
  'to-trinh':             [],
  'khlcnt':               ['to-trinh'],
  'hsyc':                 ['to-trinh', 'khlcnt'],
  'quyet-dinh-phe-duyet': ['to-trinh', 'khlcnt', 'hsyc'],
  'hop-dong':             ['to-trinh', 'khlcnt', 'hsyc', 'quyet-dinh-phe-duyet'],
  'bien-ban-nghiem-thu':  ['hop-dong'],
  'bien-ban-ban-giao':    ['hop-dong', 'bien-ban-nghiem-thu'],
  'thanh-toan':           ['hop-dong', 'bien-ban-nghiem-thu', 'bien-ban-ban-giao'],
  'thanh-ly':             ['hop-dong', 'bien-ban-nghiem-thu', 'bien-ban-ban-giao', 'thanh-toan'],
};

// ─── Lookup tables ─────────────────────────────────────────────────────────────

const DOC_TYPE_VI: Record<ChecklistDocType, string> = {
  'to-trinh':             'Tờ trình',
  'khlcnt':               'Kế hoạch lựa chọn nhà thầu',
  'hsyc':                 'Hồ sơ yêu cầu',
  'quyet-dinh-phe-duyet': 'Quyết định phê duyệt',
  'hop-dong':             'Hợp đồng',
  'bien-ban-nghiem-thu':  'Biên bản nghiệm thu',
  'bien-ban-ban-giao':    'Biên bản bàn giao',
  'thanh-toan':           'Thanh toán',
  'thanh-ly':             'Thanh lý',
};

// Maps v1.8 ChecklistDocType → v1.6 WorkflowDocType for determineApplicability().
const TO_WORKFLOW: Record<ChecklistDocType, WorkflowDocType> = {
  'to-trinh':             'to-trinh',
  'khlcnt':               'khlcnt',
  'hsyc':                 'hsyc',
  'quyet-dinh-phe-duyet': 'to-trinh',
  'hop-dong':             'hop-dong',
  'bien-ban-nghiem-thu':  'bien-ban-nghiem-thu',
  'bien-ban-ban-giao':    'bien-ban-nghiem-thu',
  'thanh-toan':           'thanh-toan',
  'thanh-ly':             'thanh-ly',
};

// Maps v1.8 ChecklistDocType → v1.7 DocumentType for getDocumentLegalContext().
const TO_DOC_TYPE: Record<ChecklistDocType, DocumentType> = {
  'to-trinh':             'to-trinh',
  'khlcnt':               'khlcnt',
  'hsyc':                 'hsyc',
  'quyet-dinh-phe-duyet': 'quyet-dinh-phe-duyet',
  'hop-dong':             'hop-dong',
  'bien-ban-nghiem-thu':  'bien-ban-nghiem-thu',
  'bien-ban-ban-giao':    'bien-ban-nghiem-thu',
  'thanh-toan':           'thanh-toan',
  'thanh-ly':             'thanh-ly',
};

const METHOD_VI: Record<ProcurementMethod, string> = {
  'dau-thau-rong-rai':     'đấu thầu rộng rãi',
  'chao-hang-canh-tranh':  'chào hàng cạnh tranh',
  'mua-sam-truc-tiep':     'mua sắm trực tiếp',
  'chi-dinh-thau':         'chỉ định thầu',
  'chi-dinh-thau-rut-gon': 'chỉ định thầu rút gọn',
};

// ─── Warning generator ─────────────────────────────────────────────────────────

function generateWarnings(
  input:          ChecklistInput,
  missing:        RequiredDocument[],
  completionScore: number,
  totalRequired:  number,
): string[] {
  const warnings: string[] = [];
  const targetLabel  = DOC_TYPE_VI[input.documentType];
  const presentCount = totalRequired - missing.length;

  // Missing mandatory documents — highest priority
  for (const m of missing) {
    warnings.push(
      `[CRITICAL] Thiếu "${m.label}" — bắt buộc trước khi lập "${targetLabel}"`,
    );
  }

  // Method-specific: open bidding requires national portal publication
  if (input.procurementMethod === 'dau-thau-rong-rai') {
    warnings.push(
      `[HIGH] Hình thức ${METHOD_VI['dau-thau-rong-rai']} yêu cầu đăng tải KHLCNT và kết quả lựa chọn nhà thầu trên Hệ thống mạng đấu thầu quốc gia`,
    );
  }

  // Fund source: state budget requires approved appropriation
  if (input.sourceOfFunds === 'ngan-sach-nha-nuoc') {
    warnings.push(
      `[MEDIUM] Nguồn ngân sách nhà nước yêu cầu dự toán được cấp có thẩm quyền phê duyệt`,
    );
  }

  // Fund source: ODA requires compliance with donor agreements
  if (input.sourceOfFunds === 'von-vay-oda') {
    warnings.push(
      `[HIGH] Nguồn vốn ODA/vay ưu đãi yêu cầu tuân thủ điều ước quốc tế và hướng dẫn nhà tài trợ`,
    );
  }

  // Low completion: dossier far from complete
  if (completionScore < 50 && missing.length > 0) {
    warnings.push(
      `[HIGH] Hồ sơ chưa đầy đủ — đã có ${presentCount}/${totalRequired} tài liệu yêu cầu (${completionScore}%)`,
    );
  }

  return warnings;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a legal checklist for a procurement document.
 *
 * Strategy:
 *  1. getDocumentLegalContext()   → citations[] and priority for the target doc
 *  2. determineApplicability()    → applicable legal document titles for legalBasis
 *  3. extractDocumentName()       → normalise the best applicable title to short form
 *  4. PREREQUISITES map           → compute requiredDocuments for this workflow stage
 *  5. Set intersection            → presentDocuments and missingDocuments
 *  6. completionScore             → present / required × 100, rounded
 *  7. generateWarnings()          → [CRITICAL]/[HIGH]/[MEDIUM] per issue found
 */
export function buildChecklist(input: ChecklistInput): ChecklistResult {
  // Step 1 — legal context: citations + priority (uses documentLegalContext.ts)
  const ctx = getDocumentLegalContext({
    documentType:      TO_DOC_TYPE[input.documentType],
    packageCategory:   input.packageCategory,
    procurementMethod: input.procurementMethod,
    sourceOfFunds:     input.sourceOfFunds,
  });

  // Step 2 — applicable documents for legalBasis (uses legalApplicabilityEngine.ts)
  const applicability = determineApplicability({
    packageCategory:   input.packageCategory,
    workflowDocType:   TO_WORKFLOW[input.documentType],
    procurementMethod: input.procurementMethod,
    fundSource:        input.sourceOfFunds,
  });

  // Step 3 — normalise best applicable law/decree title (uses legalCitationEngine.ts)
  const bestDoc = applicability.applicableDocuments.find(
    d => d.relevanceTags.includes('law') || d.relevanceTags.includes('decree'),
  );
  const legalBasis = bestDoc
    ? extractDocumentName(bestDoc.title)
    : (ctx.citations[0] ?? '');

  // Step 4 — build required documents from prerequisite map
  const requiredDocuments: RequiredDocument[] = PREREQUISITES[input.documentType].map(
    prereq => ({
      docType:    prereq,
      label:      DOC_TYPE_VI[prereq],
      mandatory:  true,
      legalBasis,
    }),
  );

  // Step 5 — compute present / missing
  const existingSet      = new Set(input.existingDocuments);
  const presentDocuments = requiredDocuments
    .filter(r => existingSet.has(r.docType))
    .map(r => r.docType);
  const missingDocuments = requiredDocuments.filter(r => !existingSet.has(r.docType));

  // Step 6 — completion score
  const completionScore =
    requiredDocuments.length === 0
      ? 100
      : Math.round((presentDocuments.length / requiredDocuments.length) * 100);

  // Step 7 — warnings
  const warnings = generateWarnings(
    input,
    missingDocuments,
    completionScore,
    requiredDocuments.length,
  );

  return { requiredDocuments, presentDocuments, missingDocuments, warnings, completionScore };
}
