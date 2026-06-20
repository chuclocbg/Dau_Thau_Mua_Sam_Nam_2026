/**
 * Legal v1.9 — Risk engine for procurement dossiers
 *
 * Evaluates the legal and audit risk of a procurement dossier based on:
 *   - which prerequisite documents are missing (from legalChecklistEngine)
 *   - contextual warnings already emitted (method/fund warnings, not "Thiếu" entries)
 *   - how far the dossier is from completion (completionScore)
 *   - the inherent complexity of the procurement method and fund source
 *   - the legal priority of the target document (from documentLegalContext)
 *
 * Uses:
 *   legalChecklistEngine     → RequiredDocument / ChecklistDocType types
 *   legalApplicabilityEngine → determineApplicability() for legal-doc recommendations
 *   documentLegalContext     → getDocumentLegalContext() for document priority modifier
 *
 * Pure function. Deterministic. No LLM. ChatAgent and LegalReviewerAgent unchanged.
 */

import {
  type RequiredDocument,
  type ChecklistDocType,
  type ProcurementMethod,
  type FundSource,
} from './legalChecklistEngine';

import {
  determineApplicability,
  type ApplicableDocument,
  type WorkflowDocType,
} from './legalApplicabilityEngine';

import {
  getDocumentLegalContext,
  type DocumentType,
  type Priority,
} from './documentLegalContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type { ChecklistDocType, ProcurementMethod, FundSource, RequiredDocument };

export interface RiskInput {
  documentType:      ChecklistDocType;
  procurementMethod: ProcurementMethod;
  sourceOfFunds:     FundSource;
  missingDocuments:  RequiredDocument[];
  warnings:          string[];
  completionScore:   number;   // 0–100 integer from legalChecklistEngine
}

export interface RiskResult {
  riskLevel:        RiskLevel;
  riskScore:        number;
  reasons:          string[];
  recommendations:  string[];
}

// ─── Scoring tables ───────────────────────────────────────────────────────────

// Risk weight contributed by each missing document type.
// Higher weight = more audit exposure when the document is absent.
const DOC_RISK_WEIGHT: Record<ChecklistDocType, number> = {
  'quyet-dinh-phe-duyet': 40,
  'to-trinh':             30,
  'hop-dong':             30,
  'khlcnt':               25,
  'hsyc':                 25,
  'bien-ban-nghiem-thu':  20,
  'bien-ban-ban-giao':    15,
  'thanh-toan':           10,
  'thanh-ly':              5,
};

// Certain missing documents force a minimum risk level regardless of the score sum.
// quyet-dinh-phe-duyet: without the approval decision the entire procurement is unlawful.
// The others carry mandatory legal obligations whose absence is HIGH by statute.
const DOC_FORCE_MIN: Partial<Record<ChecklistDocType, RiskLevel>> = {
  'quyet-dinh-phe-duyet': 'CRITICAL',
  'to-trinh':             'HIGH',
  'hop-dong':             'HIGH',
  'khlcnt':               'HIGH',
  'hsyc':                 'HIGH',
  'bien-ban-nghiem-thu':  'HIGH',
};

// Score → risk level (descending order, first match wins).
const RISK_THRESHOLDS: Array<[number, RiskLevel]> = [
  [40, 'CRITICAL'],
  [25, 'HIGH'],
  [15, 'MEDIUM'],
  [0,  'LOW'],
];

const RISK_RANK: Record<RiskLevel, number> = {
  CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0,
};

// Procurement method adds audit scrutiny complexity to the base score.
const METHOD_RISK_BONUS: Record<ProcurementMethod, number> = {
  'dau-thau-rong-rai':     5,
  'chao-hang-canh-tranh':  3,
  'mua-sam-truc-tiep':     2,
  'chi-dinh-thau':         1,
  'chi-dinh-thau-rut-gon': 0,
};

// Fund source adds State Audit / donor scrutiny.
const FUND_RISK_BONUS: Record<FundSource, number> = {
  'von-vay-oda':        5,
  'ngan-sach-nha-nuoc': 3,
  'von-su-nghiep':      1,
  'von-tu-co':          0,
};

// Document legal priority (from getDocumentLegalContext) maps to a risk modifier.
const PRIORITY_RISK_BONUS: Record<Priority, number> = {
  critical: 5, high: 3, medium: 1, low: 0,
};

// ─── Internal lookup tables ───────────────────────────────────────────────────

const METHOD_VI: Record<ProcurementMethod, string> = {
  'dau-thau-rong-rai':     'Đấu thầu rộng rãi',
  'chao-hang-canh-tranh':  'Chào hàng cạnh tranh',
  'mua-sam-truc-tiep':     'Mua sắm trực tiếp',
  'chi-dinh-thau':         'Chỉ định thầu',
  'chi-dinh-thau-rut-gon': 'Chỉ định thầu rút gọn',
};

const FUND_VI: Record<FundSource, string> = {
  'von-vay-oda':        'vốn ODA/vay ưu đãi',
  'ngan-sach-nha-nuoc': 'ngân sách nhà nước',
  'von-su-nghiep':      'chi thường xuyên sự nghiệp',
  'von-tu-co':          'nguồn thu tự chủ',
};

// Maps ChecklistDocType → v1.7 DocumentType for getDocumentLegalContext().
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

// Maps ChecklistDocType → v1.6 WorkflowDocType for determineApplicability().
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreToLevel(score: number): RiskLevel {
  for (const [threshold, level] of RISK_THRESHOLDS) {
    if (score >= threshold) return level;
  }
  return 'LOW';
}

function maxLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RISK_RANK[a] >= RISK_RANK[b] ? a : b;
}

function generateRecommendations(
  input:          RiskInput,
  riskLevel:      RiskLevel,
  applicableDocs: ApplicableDocument[],
): string[] {
  const recs: string[] = [];

  // Per missing document — urgency scales with risk level and forced minimum.
  for (const m of input.missingDocuments) {
    const forceMin = DOC_FORCE_MIN[m.docType];
    const effectiveLevel = forceMin ? maxLevel(forceMin, riskLevel) : riskLevel;
    if (effectiveLevel === 'CRITICAL') {
      recs.push(`Bổ sung ngay "${m.label}" — bắt buộc để tiếp tục quy trình đấu thầu`);
    } else if (effectiveLevel === 'HIGH') {
      recs.push(`Ưu tiên bổ sung "${m.label}" để giảm rủi ro kiểm toán`);
    } else if (effectiveLevel === 'MEDIUM') {
      recs.push(`Cần bổ sung "${m.label}" để hoàn thiện hồ sơ`);
    } else {
      recs.push(`Khuyến nghị bổ sung "${m.label}" để đảm bảo đầy đủ hồ sơ`);
    }
  }

  // Method-specific process checks.
  if (input.procurementMethod === 'dau-thau-rong-rai') {
    recs.push('Kiểm tra lịch sử đăng tải KHLCNT và kết quả lựa chọn nhà thầu trên Hệ thống mạng đấu thầu quốc gia');
  }
  if (input.procurementMethod === 'chao-hang-canh-tranh') {
    recs.push('Xác minh đủ số lượng báo giá theo yêu cầu tối thiểu của Nghị định 214/2025/NĐ-CP');
  }

  // Fund source checks.
  if (input.sourceOfFunds === 'ngan-sach-nha-nuoc') {
    recs.push('Xác nhận dự toán ngân sách đã được cấp có thẩm quyền phê duyệt trước khi triển khai');
  }
  if (input.sourceOfFunds === 'von-vay-oda') {
    recs.push('Đối chiếu với điều ước quốc tế và hướng dẫn của nhà tài trợ nước ngoài');
  }

  // Legal reference from applicability engine — cite the primary law or decree.
  const lawDoc = applicableDocs.find(d =>
    d.relevanceTags.includes('law') || d.relevanceTags.includes('decree'),
  );
  if (lawDoc) {
    recs.push(`Tham khảo: ${lawDoc.title}`);
  }

  return recs;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Evaluate the risk level of a procurement dossier.
 *
 * Scoring pipeline:
 *  1. Sum risk weights for each missing document.
 *  2. Track forced minimum risk level from DOC_FORCE_MIN.
 *  3. Count contextual warnings (skip "Thiếu" entries — already counted in step 1).
 *  4. Apply completionScore penalty (low completion = higher residual risk).
 *  5. Add procurement method + fund source modifiers.
 *  6. Call getDocumentLegalContext() for the document-type priority modifier.
 *  7. Convert score to level; apply forced minimum; final level = max(score, force).
 *  8. Call determineApplicability() to obtain legal doc references for recommendations.
 */
export function evaluateRisk(input: RiskInput): RiskResult {
  let riskScore = 0;
  const reasons: string[] = [];
  let forcedMin: RiskLevel = 'LOW';

  // ── Step 1–2: missing document weights + forced minimums ─────────────────
  for (const m of input.missingDocuments) {
    const weight = DOC_RISK_WEIGHT[m.docType] ?? 5;
    riskScore += weight;
    reasons.push(`Thiếu "${m.label}" (+${weight} điểm rủi ro)`);
    const force = DOC_FORCE_MIN[m.docType];
    if (force && RISK_RANK[force] > RISK_RANK[forcedMin]) {
      forcedMin = force;
    }
  }

  // ── Step 3: contextual warnings (skip "Thiếu" — already counted above) ──
  const contextual = input.warnings.filter(w => !w.includes('Thiếu'));
  const highWarn   = contextual.filter(w => w.startsWith('[HIGH]')).length;
  const medWarn    = contextual.filter(w => w.startsWith('[MEDIUM]')).length;
  const warnBonus  = highWarn * 5 + medWarn * 2;
  if (highWarn > 0)  reasons.push(`${highWarn} cảnh báo [HIGH] về quy trình (+${highWarn * 5} điểm)`);
  if (medWarn > 0)   reasons.push(`${medWarn} cảnh báo [MEDIUM] về quy trình (+${medWarn * 2} điểm)`);
  riskScore += warnBonus;

  // ── Step 4: completion score penalty ────────────────────────────────────
  if (input.completionScore < 25) {
    riskScore += 10;
    reasons.push(`Tỷ lệ hoàn thành rất thấp (${input.completionScore}%) (+10 điểm)`);
  } else if (input.completionScore < 50) {
    riskScore += 5;
    reasons.push(`Tỷ lệ hoàn thành thấp (${input.completionScore}%) (+5 điểm)`);
  } else if (input.completionScore < 75) {
    riskScore += 2;
    reasons.push(`Tỷ lệ hoàn thành chưa đạt 75% (${input.completionScore}%) (+2 điểm)`);
  }

  // ── Step 5: method + fund modifiers ─────────────────────────────────────
  const methodBonus = METHOD_RISK_BONUS[input.procurementMethod];
  if (methodBonus > 0) {
    riskScore += methodBonus;
    reasons.push(`Hình thức ${METHOD_VI[input.procurementMethod]} (+${methodBonus} điểm)`);
  }
  const fundBonus = FUND_RISK_BONUS[input.sourceOfFunds];
  if (fundBonus > 0) {
    riskScore += fundBonus;
    reasons.push(`Nguồn vốn ${FUND_VI[input.sourceOfFunds]} (+${fundBonus} điểm)`);
  }

  // ── Step 6: document-type priority modifier (uses documentLegalContext) ──
  const legalCtx = getDocumentLegalContext({
    documentType:      TO_DOC_TYPE[input.documentType],
    packageCategory:   'hang-hoa',   // neutral default — risk engine is pkg-agnostic
    procurementMethod: input.procurementMethod,
    sourceOfFunds:     input.sourceOfFunds,
  });
  const priorityBonus = PRIORITY_RISK_BONUS[legalCtx.priority];
  if (priorityBonus > 0) {
    riskScore += priorityBonus;
    reasons.push(`Tài liệu yêu cầu mức pháp lý "${legalCtx.priority}" (+${priorityBonus} điểm)`);
  }

  // ── Step 7: resolve final risk level ────────────────────────────────────
  const scoreLevel = scoreToLevel(riskScore);
  const riskLevel  = maxLevel(scoreLevel, forcedMin);

  // ── Step 8: recommendations (uses legalApplicabilityEngine) ─────────────
  const { applicableDocuments } = determineApplicability({
    packageCategory:   'hang-hoa',
    workflowDocType:   TO_WORKFLOW[input.documentType],
    procurementMethod: input.procurementMethod,
    fundSource:        input.sourceOfFunds,
  });
  const recommendations = generateRecommendations(input, riskLevel, applicableDocuments);

  return { riskLevel, riskScore, reasons, recommendations };
}
