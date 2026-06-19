/**
 * 8-H: AgentAuditExporter — builds an HTML audit summary from LegalReviewerAgent
 * (DossierReviewOutput) and RiskAgent (RiskOutput) findings for inclusion in the
 * procurement dossier ZIP export as file 25_BaoCaoKiemToanAgent.html.
 *
 * ZIP integration:
 *   Existing:  01_HSMS_…docx through 24_HSMS_…docx  (documentTemplates)
 *   This file: 25_BaoCaoKiemToanAgent.html            (agent audit report)
 *
 * Where findings are injected:
 *   LegalReviewer → findings[], crossCheckIssues[], complianceScore,
 *                   auditReadiness, recommendations[], legalBasis[]
 *   RiskAgent     → overallRisk, riskMatrix[], systemicRisks[],
 *                   auditExposure, mitigationPlan[], legalBasis[]
 *
 * Fallback when inputs are empty or null:
 *   null dossierReview → treated as { findings:[], crossCheckIssues:[],
 *                        complianceScore:100, auditReadiness:'ready',
 *                        recommendations:[], legalBasis:[] }
 *   null riskOutput    → treated as overallRisk:'CLEAN', all arrays empty
 *   Metadata fields:    overallRisk='N/A', auditReadiness='N/A',
 *                       complianceScore=null when the corresponding input is null
 *   The function never throws.
 */

import type { DossierReviewOutput } from '../agents/LegalReviewerAgent';
import type { RiskOutput, OverallRisk } from '../agents/RiskAgent';

// ─── Public constants ─────────────────────────────────────────────────────────

export const AUDIT_EXPORTER_VERSION  = '8-H';
export const AUDIT_EXPORTER_FILENAME = '25_BaoCaoKiemToanAgent.html';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface AgentAuditReport {
  /** HTML string ready for ZIP file inclusion as AUDIT_EXPORTER_FILENAME. */
  html:            string;
  /** Always '25_BaoCaoKiemToanAgent.html'. */
  filename:        string;
  /** LegalFinding count from dossierReview.findings (0 when dossierReview is null). */
  findingCount:    number;
  /** CrossCheckIssue count (0 when dossierReview is null). */
  crossCheckCount: number;
  /** RiskAgent overall verdict, or 'N/A' when riskOutput is null. */
  overallRisk:     OverallRisk | 'N/A';
  /** LegalReviewer audit readiness, or 'N/A' when dossierReview is null. */
  auditReadiness:  'ready' | 'conditional' | 'not-ready' | 'N/A';
  /** Compliance score 0–100, or null when dossierReview is null. */
  complianceScore: number | null;
  /** ISO-8601 timestamp of report generation. */
  generatedAt:     string;
}

// ─── HTML escape ──────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Section builders ─────────────────────────────────────────────────────────

function buildLegalFindingsSection(dr: DossierReviewOutput): string {
  if (dr.findings.length === 0) {
    return (
      '<section data-section="legal-findings">' +
      '<p>Không phát hiện vi phạm pháp lý.</p>' +
      '</section>'
    );
  }
  const rows = dr.findings.map(f =>
    `<tr data-finding="${esc(f.code)}" data-severity="${esc(f.severity)}">` +
    `<td>[${esc(f.severity)}]</td>` +
    `<td>${esc(f.code)}</td>` +
    `<td>${esc(f.message)}</td>` +
    `<td>${esc(f.legalBasis)}</td>` +
    `<td>${esc(f.recommendation)}</td>` +
    '</tr>'
  ).join('');
  return (
    '<section data-section="legal-findings">' +
    '<h2>Kết quả kiểm tra pháp lý</h2>' +
    '<table><thead><tr>' +
    '<th>Mức độ</th><th>Mã</th><th>Mô tả</th><th>Căn cứ pháp lý</th><th>Khuyến nghị</th>' +
    '</tr></thead>' +
    `<tbody>${rows}</tbody></table>` +
    '</section>'
  );
}

function buildCrossCheckSection(dr: DossierReviewOutput): string {
  if (dr.crossCheckIssues.length === 0) {
    return (
      '<section data-section="cross-check">' +
      '<p>Không phát hiện mâu thuẫn giữa các văn bản.</p>' +
      '</section>'
    );
  }
  const rows = dr.crossCheckIssues.map(i =>
    `<tr data-severity="${esc(i.severity)}">` +
    `<td>[${esc(i.severity)}]</td>` +
    `<td>Doc ${i.doc1Id} ↔ Doc ${i.doc2Id}</td>` +
    `<td>${esc(i.field)}</td>` +
    `<td>${esc(i.description)}</td>` +
    '</tr>'
  ).join('');
  return (
    '<section data-section="cross-check">' +
    '<h2>Mâu thuẫn giữa các văn bản</h2>' +
    '<table><thead><tr>' +
    '<th>Mức độ</th><th>Văn bản</th><th>Trường</th><th>Mô tả</th>' +
    '</tr></thead>' +
    `<tbody>${rows}</tbody></table>` +
    '</section>'
  );
}

function buildRiskMatrixSection(ro: RiskOutput): string {
  if (ro.riskMatrix.length === 0) {
    return (
      '<section data-section="risk-matrix">' +
      '<p>Ma trận rủi ro trống — không có rủi ro đáng kể.</p>' +
      '</section>'
    );
  }
  const rows = ro.riskMatrix.map(e =>
    `<tr data-severity="${esc(e.severity)}" data-risk-score="${e.riskScore}">` +
    `<td>[${esc(e.severity)}]</td>` +
    `<td>${esc(e.category)}</td>` +
    `<td>${esc(e.finding.code)}</td>` +
    `<td>${esc(e.finding.message)}</td>` +
    `<td>${e.likelihood}</td>` +
    `<td>${e.impact}</td>` +
    `<td>${e.riskScore}</td>` +
    '</tr>'
  ).join('');
  return (
    '<section data-section="risk-matrix">' +
    '<h2>Ma trận rủi ro</h2>' +
    '<table><thead><tr>' +
    '<th>Mức độ</th><th>Danh mục</th><th>Mã</th><th>Mô tả</th>' +
    '<th>Xác suất</th><th>Tác động</th><th>Điểm</th>' +
    '</tr></thead>' +
    `<tbody>${rows}</tbody></table>` +
    '</section>'
  );
}

function buildSystemicRisksSection(ro: RiskOutput): string {
  if (ro.systemicRisks.length === 0) {
    return (
      '<section data-section="systemic-risks">' +
      '<p>Không phát hiện rủi ro hệ thống.</p>' +
      '</section>'
    );
  }
  const items = ro.systemicRisks.map(r =>
    `<li data-severity="${esc(r.severity)}">` +
    `<strong>[${esc(r.severity)}]</strong> ${esc(r.pattern)} ` +
    `(${r.occurrences} gói) — ${esc(r.recommendation)}` +
    '</li>'
  ).join('');
  return (
    '<section data-section="systemic-risks">' +
    '<h2>Rủi ro hệ thống</h2>' +
    `<ul>${items}</ul>` +
    '</section>'
  );
}

function buildAuditExposureSection(ro: RiskOutput): string {
  const ex = ro.auditExposure;
  const findingsList = ex.potentialFindings.length > 0
    ? '<ul>' + ex.potentialFindings.map(f => `<li>${esc(f)}</li>`).join('') + '</ul>'
    : '<p>Không có kiến nghị kiểm toán dự kiến.</p>';
  return (
    '<section data-section="audit-exposure">' +
    '<h2>Đánh giá rủi ro kiểm toán</h2>' +
    `<p data-field="probability">Xác suất kiểm toán: <strong>${esc(ex.probability)}</strong></p>` +
    `<p data-field="estimated-impact">${esc(ex.estimatedImpact)}</p>` +
    findingsList +
    '</section>'
  );
}

function buildMitigationSection(ro: RiskOutput): string {
  if (ro.mitigationPlan.length === 0) {
    return (
      '<section data-section="mitigation">' +
      '<p>Không có biện pháp khắc phục cần thiết.</p>' +
      '</section>'
    );
  }
  const items = ro.mitigationPlan.map(s =>
    `<li data-priority="${s.priority}">` +
    `<strong>${s.priority}.</strong> ${esc(s.action)} — ` +
    `${esc(s.responsible)}` +
    (s.deadline ? ` (hạn: ${esc(s.deadline)})` : '') +
    '</li>'
  ).join('');
  return (
    '<section data-section="mitigation">' +
    '<h2>Kế hoạch khắc phục</h2>' +
    `<ol>${items}</ol>` +
    '</section>'
  );
}

function buildRecommendationsSection(dr: DossierReviewOutput): string {
  if (dr.recommendations.length === 0) {
    return (
      '<section data-section="recommendations">' +
      '<p>Không có khuyến nghị bổ sung.</p>' +
      '</section>'
    );
  }
  const items = dr.recommendations.map(r => `<li>${esc(r)}</li>`).join('');
  return (
    '<section data-section="recommendations">' +
    '<h2>Khuyến nghị</h2>' +
    `<ul>${items}</ul>` +
    '</section>'
  );
}

function buildLegalBasisSection(dr: DossierReviewOutput, ro: RiskOutput): string {
  const combined = [...new Set([...dr.legalBasis, ...ro.legalBasis])];
  if (combined.length === 0) {
    return (
      '<section data-section="legal-basis">' +
      '<p>Không có căn cứ pháp lý.</p>' +
      '</section>'
    );
  }
  const items = combined.map(b => `<li>${esc(b)}</li>`).join('');
  return (
    '<section data-section="legal-basis">' +
    '<h2>Căn cứ pháp lý</h2>' +
    `<ul>${items}</ul>` +
    '</section>'
  );
}

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Builds a complete HTML audit summary from LegalReviewerAgent and RiskAgent output.
 *
 * Null inputs are treated as clean (no findings).  Always resolves; never throws.
 *
 * @param dossierReview - Output from LegalReviewerAgent.reviewPackage(), or null.
 * @param riskOutput    - Output from RiskAgent.process(), or null.
 * @returns AgentAuditReport — always fully populated, even when both inputs are null.
 */
export function buildAgentAuditReport(
  dossierReview: DossierReviewOutput | null,
  riskOutput:    RiskOutput          | null,
): AgentAuditReport {
  const generatedAt = new Date().toISOString();

  const emptyDossier: DossierReviewOutput = {
    findings:         [],
    crossCheckIssues: [],
    complianceScore:  100,
    auditReadiness:   'ready',
    recommendations:  [],
    legalBasis:       [],
  };

  const emptyRisk: RiskOutput = {
    overallRisk:   'CLEAN',
    riskMatrix:    [],
    systemicRisks: [],
    auditExposure: {
      probability:       'low',
      potentialFindings: [],
      estimatedImpact:   'Không có rủi ro kiểm toán đáng kể. Hồ sơ đạt chuẩn.',
    },
    mitigationPlan: [],
    legalBasis:     [],
  };

  const dr = dossierReview ?? emptyDossier;
  const ro = riskOutput    ?? emptyRisk;

  const findingCount    = dr.findings.length;
  const crossCheckCount = dr.crossCheckIssues.length;
  const overallRisk: OverallRisk | 'N/A' = riskOutput    !== null ? ro.overallRisk    : 'N/A';
  const auditReadiness: AgentAuditReport['auditReadiness'] =
    dossierReview !== null ? dr.auditReadiness : 'N/A';
  const complianceScore: number | null =
    dossierReview !== null ? dr.complianceScore : null;

  const isClean =
    findingCount    === 0 &&
    crossCheckCount === 0 &&
    ro.riskMatrix.length === 0 &&
    ro.systemicRisks.length === 0;

  const cleanBanner = isClean
    ? '<p data-field="clean">Không phát hiện rủi ro kiểm toán đáng kể.</p>\n'
    : '';

  const html = [
    '<!DOCTYPE html>',
    '<html lang="vi">',
    '<head><meta charset="UTF-8">',
    '<title>Báo Cáo Kiểm Toán Agent — Trường Cao đẳng Kỹ thuật Công nghiệp</title>',
    '</head>',
    `<body data-overall-risk="${esc(overallRisk)}"` +
    ` data-audit-readiness="${esc(auditReadiness)}"` +
    (complianceScore !== null ? ` data-compliance-score="${complianceScore}"` : '') +
    ` data-generated-at="${esc(generatedAt)}">`,
    '<h1>Báo Cáo Kiểm Toán Agent</h1>',
    '<p>Đơn vị: Trường Cao đẳng Kỹ thuật Công nghiệp</p>',
    `<p data-field="overall-risk">Mức độ rủi ro tổng thể: <strong>${esc(overallRisk)}</strong></p>`,
    complianceScore !== null
      ? `<p data-field="compliance-score">Điểm tuân thủ: <strong>${complianceScore}/100</strong></p>`
      : '<p data-field="compliance-score">Điểm tuân thủ: <strong>N/A</strong></p>',
    `<p data-field="audit-readiness">Sẵn sàng kiểm toán: <strong>${esc(auditReadiness)}</strong></p>`,
    cleanBanner,
    buildLegalFindingsSection(dr),
    buildCrossCheckSection(dr),
    buildRiskMatrixSection(ro),
    buildSystemicRisksSection(ro),
    buildAuditExposureSection(ro),
    buildMitigationSection(ro),
    buildRecommendationsSection(dr),
    buildLegalBasisSection(dr, ro),
    `<footer><p>Phiên bản: ${AUDIT_EXPORTER_VERSION} | Tạo lúc: ${esc(generatedAt)}</p></footer>`,
    '</body>',
    '</html>',
  ].join('\n');

  return {
    html,
    filename:     AUDIT_EXPORTER_FILENAME,
    findingCount,
    crossCheckCount,
    overallRisk,
    auditReadiness,
    complianceScore,
    generatedAt,
  };
}
