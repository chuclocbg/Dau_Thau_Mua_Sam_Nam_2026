/**
 * Legal v3.1 — Document Generator
 *
 * Orchestrates the full legal engine pipeline from a simple, caller-friendly
 * input into a complete procurement document analysis.
 *
 * Engine pipeline (execution order):
 *   1. searchLegalIndex          → BM25-lite search for method + fund legal texts
 *   2. legalCitationEngine       → extractCitations + extractDocumentName
 *   3. legalApplicabilityEngine  → determineApplicability (explicit call)
 *   4. documentLegalContext      → getDocumentLegalContext (citation + priority)
 *   5. legalChecklistEngine      → buildChecklist (required / missing / warnings)
 *   6. legalRiskEngine           → evaluateRisk (riskLevel / riskScore / recommendations)
 *
 * Pure function. Deterministic: same input always yields identical output.
 * No LLM. No browser globals. No UI. No IndexedDB.
 * No agent modifications. No ChatAgent changes. No LegalReviewerAgent changes.
 */

import { searchLegalIndex }                       from './searchLegalIndex';
import { extractCitations, extractDocumentName }  from './legalCitationEngine';
import { determineApplicability }                 from './legalApplicabilityEngine';
import { getDocumentLegalContext }                from './documentLegalContext';
import { buildChecklist }                         from './legalChecklistEngine';
import { evaluateRisk }                           from './legalRiskEngine';

import type { ProcurementMethod, FundSource } from './legalApplicabilityEngine';
import type { ChecklistDocType, RequiredDocument } from './legalChecklistEngine';
import type { RiskLevel } from './legalRiskEngine';

// ─── Input / output types ─────────────────────────────────────────────────────

export interface PkgDates {
  /** ISO-8601 date string "YYYY-MM-DD" */
  start: string;
  end:   string;
}

export interface DocumentGeneratorInput {
  /** Procurement method — accepts engine codes or human-readable aliases. */
  methodCode:        string;
  /** Fund source — accepts engine codes or human-readable aliases. */
  fundingSourceName: string;
  /** Package validity period (informational; not consumed by legal engines). */
  pkgDates:          PkgDates;
  /** Doc types already present in the dossier (engine codes or alias strings). */
  existingDocuments: string[];
}

export interface TimelineStage {
  docType:   ChecklistDocType;
  label:     string;
  status:    'present' | 'missing';
  sortOrder: number;
}

export interface DocumentGeneratorOutput {
  requiredDocuments: RequiredDocument[];
  missingDocuments:  RequiredDocument[];
  warnings:          string[];
  recommendations:   string[];
  timeline:          TimelineStage[];
  riskLevel:         RiskLevel;
  riskScore:         number;
  legalBasis:        string[];
}

// ─── Method + fund aliases ────────────────────────────────────────────────────

const METHOD_ALIASES: Record<string, ProcurementMethod> = {
  'open-bidding':                   'dau-thau-rong-rai',
  'dau-thau-rong-rai':              'dau-thau-rong-rai',
  'competitive-quotation':          'chao-hang-canh-tranh',
  'chao-hang-canh-tranh':           'chao-hang-canh-tranh',
  'direct-appointment':             'chi-dinh-thau',
  'chi-dinh-thau':                  'chi-dinh-thau',
  'abbreviated-direct-appointment': 'chi-dinh-thau-rut-gon',
  'chi-dinh-thau-rut-gon':          'chi-dinh-thau-rut-gon',
  'direct-purchase':                'mua-sam-truc-tiep',
  'mua-sam-truc-tiep':              'mua-sam-truc-tiep',
};

const FUND_ALIASES: Record<string, FundSource> = {
  'state-budget':       'ngan-sach-nha-nuoc',
  'ngan-sach-nha-nuoc': 'ngan-sach-nha-nuoc',
  'oda':                'von-vay-oda',
  'von-vay-oda':        'von-vay-oda',
  'enterprise':         'von-tu-co',
  'von-tu-co':          'von-tu-co',
  'recurrent':          'von-su-nghiep',
  'von-su-nghiep':      'von-su-nghiep',
};

// ─── Lifecycle definitions ─────────────────────────────────────────────────────
//
// Conservative (audit-safe) ordered document sequence per procurement method.
// chi-dinh-thau variants have shorter sequences because they bypass the public
// competitive stage (no mandatory KHLCNT publication or formal HSYC).
// PREREQUISITES in legalChecklistEngine remain the single source of truth for
// per-document prerequisites; METHOD_LIFECYCLE is the generator's own view of
// which documents the full dossier must contain.

const METHOD_LIFECYCLE: Record<ProcurementMethod, ChecklistDocType[]> = {
  'dau-thau-rong-rai': [
    'to-trinh', 'khlcnt', 'hsyc', 'quyet-dinh-phe-duyet',
    'hop-dong', 'bien-ban-nghiem-thu', 'bien-ban-ban-giao', 'thanh-toan', 'thanh-ly',
  ],
  'chao-hang-canh-tranh': [
    'to-trinh', 'khlcnt', 'hsyc', 'quyet-dinh-phe-duyet',
    'hop-dong', 'bien-ban-nghiem-thu', 'bien-ban-ban-giao', 'thanh-toan', 'thanh-ly',
  ],
  'mua-sam-truc-tiep': [
    'to-trinh', 'khlcnt', 'hsyc', 'quyet-dinh-phe-duyet',
    'hop-dong', 'bien-ban-nghiem-thu', 'bien-ban-ban-giao', 'thanh-toan', 'thanh-ly',
  ],
  'chi-dinh-thau': [
    'to-trinh', 'quyet-dinh-phe-duyet',
    'hop-dong', 'bien-ban-nghiem-thu', 'bien-ban-ban-giao', 'thanh-toan', 'thanh-ly',
  ],
  'chi-dinh-thau-rut-gon': [
    'to-trinh',
    'hop-dong', 'bien-ban-nghiem-thu', 'bien-ban-ban-giao', 'thanh-toan', 'thanh-ly',
  ],
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

const VALID_DOC_TYPES = new Set<string>(Object.keys(DOC_TYPE_VI));

// Search queries for direct searchLegalIndex call (step 3).
const METHOD_SEARCH_QUERY: Record<ProcurementMethod, string> = {
  'dau-thau-rong-rai':     'đấu thầu rộng rãi lựa chọn nhà thầu kế hoạch đăng tải',
  'chao-hang-canh-tranh':  'chào hàng cạnh tranh mua sắm báo giá lựa chọn',
  'mua-sam-truc-tiep':     'mua sắm trực tiếp nhà thầu hợp đồng quy định',
  'chi-dinh-thau':         'chỉ định thầu thẩm quyền phê duyệt hợp đồng điều kiện',
  'chi-dinh-thau-rut-gon': 'chỉ định thầu rút gọn đơn giản hóa quy trình điều kiện',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveMethod(code: string): ProcurementMethod {
  const resolved = METHOD_ALIASES[code.toLowerCase().trim()];
  if (resolved === undefined) {
    throw new Error(`Không nhận diện được hình thức: "${code}"`);
  }
  return resolved;
}

function resolveFund(name: string): FundSource {
  const resolved = FUND_ALIASES[name.toLowerCase().trim()];
  if (resolved === undefined) {
    throw new Error(`Không nhận diện được nguồn vốn: "${name}"`);
  }
  return resolved;
}

function filterValidDocs(docs: string[]): ChecklistDocType[] {
  return docs.filter(d => VALID_DOC_TYPES.has(d)) as ChecklistDocType[];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a complete procurement document analysis.
 *
 * Execution order:
 *  1. Resolve method + fund from human-readable codes.
 *  2. Determine full lifecycle for the method.
 *  3. searchLegalIndex → raw search results for method + fund context.
 *  4. extractCitations (legalCitationEngine) → formal citation strings.
 *  5. determineApplicability (legalApplicabilityEngine) → applicable legal documents.
 *  6. extractDocumentName (legalCitationEngine) → normalise best applicable title.
 *  7. getDocumentLegalContext (documentLegalContext) → citations + legal priority.
 *  8. Build requiredDocuments + missingDocuments from lifecycle.
 *  9. buildChecklist (legalChecklistEngine) → warnings + completionScore.
 * 10. evaluateRisk (legalRiskEngine) → riskLevel, riskScore, recommendations.
 * 11. Build timeline from lifecycle stages.
 */
export function generateDocuments(
  input: DocumentGeneratorInput,
): DocumentGeneratorOutput {

  // ── 1. Resolve ───────────────────────────────────────────────────────────
  const method = resolveMethod(input.methodCode);
  const fund   = resolveFund(input.fundingSourceName);

  // ── 2. Lifecycle ─────────────────────────────────────────────────────────
  const lifecycle   = METHOD_LIFECYCLE[method];
  const existingSet = new Set(input.existingDocuments);

  // ── 3. searchLegalIndex ──────────────────────────────────────────────────
  const searchQuery   = `${METHOD_SEARCH_QUERY[method]} lựa chọn nhà thầu`;
  const searchResults = searchLegalIndex(searchQuery, { topK: 5, minScore: 1 });

  // ── 4. extractCitations ──────────────────────────────────────────────────
  const citationResults     = extractCitations(searchResults);
  const legalBasisFromSearch = citationResults.map(c => c.citation);

  // ── 5. determineApplicability ─────────────────────────────────────────────
  const applicability = determineApplicability({
    packageCategory:   'hang-hoa',
    workflowDocType:   'khlcnt',
    procurementMethod: method,
    fundSource:        fund,
  });

  // ── 6. extractDocumentName — normalise best law/decree title ─────────────
  const bestDoc = applicability.applicableDocuments.find(
    d => d.relevanceTags.includes('law') || d.relevanceTags.includes('decree'),
  );
  const primaryLegalRef = bestDoc ? extractDocumentName(bestDoc.title) : null;

  // ── 7. getDocumentLegalContext ────────────────────────────────────────────
  const ctx = getDocumentLegalContext({
    documentType:      'khlcnt',
    packageCategory:   'hang-hoa',
    procurementMethod: method,
    sourceOfFunds:     fund,
  });

  const legalBasis = [
    ...new Set([
      ...(primaryLegalRef != null ? [primaryLegalRef] : []),
      ...legalBasisFromSearch,
      ...ctx.citations,
    ]),
  ];

  // ── 8. Required / missing from lifecycle ─────────────────────────────────
  const legalBasisRef    = legalBasis[0] ?? '';
  const requiredDocuments: RequiredDocument[] = lifecycle.map(docType => ({
    docType,
    label:      DOC_TYPE_VI[docType],
    mandatory:  true,
    legalBasis: legalBasisRef,
  }));

  const missingDocuments = requiredDocuments.filter(d => !existingSet.has(d.docType));
  const presentCount     = requiredDocuments.length - missingDocuments.length;
  const completionScore  =
    requiredDocuments.length === 0
      ? 100
      : Math.round((presentCount / requiredDocuments.length) * 100);

  // ── 9. buildChecklist (target = thanh-ly) → warnings ─────────────────────
  const validExisting = filterValidDocs(input.existingDocuments);
  const checklist     = buildChecklist({
    documentType:      'thanh-ly',
    packageCategory:   'hang-hoa',
    procurementMethod: method,
    sourceOfFunds:     fund,
    existingDocuments: validExisting,
  });

  // Supplement with lifecycle-gap warnings for docs outside
  // PREREQUISITES['thanh-ly'] that are missing from the method's full lifecycle.
  const checklistWarningLabels = new Set(checklist.missingDocuments.map(m => m.label));
  const lifecycleWarnings      = missingDocuments
    .filter(m => !checklistWarningLabels.has(m.label))
    .map(m => `[HIGH] Thiếu "${m.label}" theo yêu cầu của hình thức ${method}`);

  // pkgDates sanity check — pure string comparison works for ISO-8601 dates.
  const dateWarning =
    input.pkgDates.end < input.pkgDates.start
      ? ['[MEDIUM] Ngày kết thúc gói thầu trước ngày bắt đầu — kiểm tra lại thời gian']
      : [];

  const warnings = [...checklist.warnings, ...lifecycleWarnings, ...dateWarning];

  // ── 10. evaluateRisk ─────────────────────────────────────────────────────
  const risk = evaluateRisk({
    documentType:      'thanh-ly',
    procurementMethod: method,
    sourceOfFunds:     fund,
    missingDocuments,
    warnings,
    completionScore,
  });

  // ── 11. Timeline ─────────────────────────────────────────────────────────
  const timeline: TimelineStage[] = lifecycle.map((docType, i) => ({
    docType,
    label:     DOC_TYPE_VI[docType],
    status:    existingSet.has(docType) ? 'present' as const : 'missing' as const,
    sortOrder: i,
  }));

  return {
    requiredDocuments,
    missingDocuments,
    warnings,
    recommendations: risk.recommendations,
    timeline,
    riskLevel:  risk.riskLevel,
    riskScore:  risk.riskScore,
    legalBasis,
  };
}
