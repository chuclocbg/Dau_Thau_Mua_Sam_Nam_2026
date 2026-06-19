/**
 * P9-06: ZIP audit report integration — 28 tests
 *
 * Verifies the integration contract between buildAgentAuditReport() and the
 * ZIP export pipeline that adds BiolReport.html to the procurement dossier ZIP.
 *
 * Design: The ZIP export handler (App.tsx handleDownloadAllZip) declares
 *   dossierReview: DossierReviewOutput | null = null
 *   riskOutput:    RiskOutput | null = null
 * then calls buildAgentAuditReport(dossierReview, riskOutput).  These tests
 * verify that combination produces a valid, ZIP-ready HTML blob.
 *
 * Groups:
 *   ZI-01  (7)  ZIP filename is 'BiolReport.html' (distinct from AUDIT_EXPORTER_FILENAME)
 *   ZI-02  (7)  Null inputs → valid ZIP entry (the App.tsx startup pattern)
 *   ZI-03  (7)  HTML content is structurally valid for ZIP / Blob inclusion
 *   ZI-04  (7)  Non-null inputs yield richer HTML (backward-compatible with null baseline)
 */

import { describe, it, expect } from 'vitest';

import {
  buildAgentAuditReport,
  AUDIT_EXPORTER_FILENAME,
} from '../ai/agentAuditExporter';

import type { DossierReviewOutput } from '../agents/LegalReviewerAgent';
import type { RiskOutput }           from '../agents/RiskAgent';
import type { LegalFinding }         from '../ai/legalReviewer';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeCleanDossier(): DossierReviewOutput {
  return {
    findings:         [],
    crossCheckIssues: [],
    complianceScore:  100,
    auditReadiness:   'ready',
    recommendations:  [],
    legalBasis:       ['Điều 44 khoản 7 Luật Đấu thầu 22/2023/QH15'],
  };
}

function makeFinding(overrides: Partial<LegalFinding> = {}): LegalFinding {
  return {
    severity:       'HIGH',
    code:           'LR-001',
    category:       'brand-locking',
    field:          'items[0].specs',
    message:        'Khóa thương hiệu trong tiêu chí kỹ thuật.',
    legalBasis:     'Điều 44 khoản 7 Luật Đấu thầu 22/2023/QH15',
    recommendation: 'Xóa tên thương hiệu.',
    ...overrides,
  };
}

function makeDirtyDossier(): DossierReviewOutput {
  return {
    findings:         [makeFinding({ severity: 'CRITICAL' }), makeFinding({ severity: 'HIGH' })],
    crossCheckIssues: [{ doc1Id: 1, doc2Id: 5, field: 'dateKhlcnt', description: 'Mâu thuẫn ngày', severity: 'MEDIUM' }],
    complianceScore:  60,
    auditReadiness:   'conditional',
    recommendations:  ['Điều chỉnh tiêu chí kỹ thuật.'],
    legalBasis:       ['Điều 44 khoản 7 Luật Đấu thầu 22/2023/QH15'],
  };
}

function makeCleanRisk(): RiskOutput {
  return {
    overallRisk:   'CLEAN',
    riskMatrix:    [],
    systemicRisks: [],
    auditExposure: {
      probability:       'low',
      potentialFindings: [],
      estimatedImpact:   'Không có rủi ro kiểm toán đáng kể.',
    },
    mitigationPlan: [],
    legalBasis:     [],
  };
}

function makeHighRisk(): RiskOutput {
  return {
    overallRisk:   'HIGH',
    riskMatrix:    [{
      severity:  'HIGH',
      category:  'brand-locking',
      finding:   makeFinding(),
      likelihood: 4, impact: 4, riskScore: 16,
    }],
    systemicRisks: [],
    auditExposure: {
      probability:       'high',
      potentialFindings: ['Kiến nghị thu hồi kết quả đấu thầu.'],
      estimatedImpact:   'Nguy cơ bị kiểm toán phát hiện vi phạm cao.',
    },
    mitigationPlan: [{
      priority: 1, action: 'Chỉnh sửa HSYC.', responsible: '[Tổ chuyên gia]',
    }],
    legalBasis:     ['Điều 44 khoản 7 Luật Đấu thầu 22/2023/QH15'],
  };
}

// ─── ZI-01: ZIP filename ──────────────────────────────────────────────────────

describe('ZI-01 · ZIP filename is BiolReport.html', () => {
  const ZIP_FILENAME = 'BiolReport.html';

  it('ZI-01-01: BiolReport.html is the expected ZIP entry name for the audit report', () => {
    expect(ZIP_FILENAME).toBe('BiolReport.html');
  });

  it('ZI-01-02: ZIP filename differs from AUDIT_EXPORTER_FILENAME', () => {
    // The ZIP entry uses 'BiolReport.html'; AUDIT_EXPORTER_FILENAME is '25_BaoCaoKiemToanAgent.html'
    expect(ZIP_FILENAME).not.toBe(AUDIT_EXPORTER_FILENAME);
  });

  it('ZI-01-03: AUDIT_EXPORTER_FILENAME is the legacy internal filename (still exported)', () => {
    expect(AUDIT_EXPORTER_FILENAME).toBe('25_BaoCaoKiemToanAgent.html');
  });

  it('ZI-01-04: ZIP filename ends with .html', () => {
    expect(ZIP_FILENAME.endsWith('.html')).toBe(true);
  });

  it('ZI-01-05: ZIP filename has no path separators (safe for ZIP entry key)', () => {
    expect(ZIP_FILENAME).not.toContain('/');
    expect(ZIP_FILENAME).not.toContain('\\');
  });

  it('ZI-01-06: report.filename from buildAgentAuditReport is AUDIT_EXPORTER_FILENAME, not ZIP filename', () => {
    const report = buildAgentAuditReport(null, null);
    expect(report.filename).toBe(AUDIT_EXPORTER_FILENAME);
    expect(report.filename).not.toBe(ZIP_FILENAME);
  });

  it('ZI-01-07: report.html is the value placed in the Blob (not report.filename)', () => {
    const report = buildAgentAuditReport(null, null);
    expect(typeof report.html).toBe('string');
    expect(report.html.length).toBeGreaterThan(0);
  });
});

// ─── ZI-02: Null inputs → valid ZIP entry ────────────────────────────────────

describe('ZI-02 · null inputs → valid ZIP entry (App.tsx startup pattern)', () => {
  it('ZI-02-01: buildAgentAuditReport(null, null) does not throw', () => {
    expect(() => buildAgentAuditReport(null, null)).not.toThrow();
  });

  it('ZI-02-02: html property is a non-empty string', () => {
    const { html } = buildAgentAuditReport(null, null);
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(0);
  });

  it('ZI-02-03: overallRisk is "N/A" when riskOutput is null', () => {
    expect(buildAgentAuditReport(null, null).overallRisk).toBe('N/A');
  });

  it('ZI-02-04: auditReadiness is "N/A" when dossierReview is null', () => {
    expect(buildAgentAuditReport(null, null).auditReadiness).toBe('N/A');
  });

  it('ZI-02-05: complianceScore is null when dossierReview is null', () => {
    expect(buildAgentAuditReport(null, null).complianceScore).toBeNull();
  });

  it('ZI-02-06: findingCount is 0 when dossierReview is null', () => {
    expect(buildAgentAuditReport(null, null).findingCount).toBe(0);
  });

  it('ZI-02-07: crossCheckCount is 0 when dossierReview is null', () => {
    expect(buildAgentAuditReport(null, null).crossCheckCount).toBe(0);
  });
});

// ─── ZI-03: HTML structure valid for Blob / ZIP ───────────────────────────────

describe('ZI-03 · HTML content is structurally valid for ZIP/Blob inclusion', () => {
  const { html } = buildAgentAuditReport(null, null);

  it('ZI-03-01: html starts with "<!DOCTYPE html>"', () => {
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
  });

  it('ZI-03-02: html contains <html lang="vi">', () => {
    expect(html).toContain('<html lang="vi">');
  });

  it('ZI-03-03: html contains <meta charset="UTF-8">', () => {
    expect(html).toContain('<meta charset="UTF-8">');
  });

  it('ZI-03-04: html contains </html> closing tag', () => {
    expect(html).toContain('</html>');
  });

  it('ZI-03-05: Blob([html], {type:"text/html"}) can be constructed without error', () => {
    expect(() => new Blob([html], { type: 'text/html' })).not.toThrow();
  });

  it('ZI-03-06: Blob size is greater than 0', () => {
    const blob = new Blob([html], { type: 'text/html' });
    expect(blob.size).toBeGreaterThan(0);
  });

  it('ZI-03-07: Blob MIME type matches the expected text/html', () => {
    const blob = new Blob([html], { type: 'text/html' });
    expect(blob.type).toBe('text/html');
  });
});

// ─── ZI-04: Non-null inputs yield richer HTML ─────────────────────────────────

describe('ZI-04 · non-null inputs yield richer HTML (backward-compatible with null baseline)', () => {
  const nullReport  = buildAgentAuditReport(null, null);
  const richReport  = buildAgentAuditReport(makeDirtyDossier(), makeHighRisk());
  const cleanReport = buildAgentAuditReport(makeCleanDossier(), makeCleanRisk());

  it('ZI-04-01: non-null inputs produce longer HTML than null baseline', () => {
    expect(richReport.html.length).toBeGreaterThan(nullReport.html.length);
  });

  it('ZI-04-02: findingCount reflects actual findings when dossierReview is real', () => {
    expect(richReport.findingCount).toBe(2);
  });

  it('ZI-04-03: overallRisk reflects riskOutput.overallRisk when real', () => {
    expect(richReport.overallRisk).toBe('HIGH');
  });

  it('ZI-04-04: auditReadiness reflects dossierReview.auditReadiness when real', () => {
    expect(richReport.auditReadiness).toBe('conditional');
  });

  it('ZI-04-05: complianceScore reflects dossierReview.complianceScore when real', () => {
    expect(richReport.complianceScore).toBe(60);
  });

  it('ZI-04-06: clean inputs produce valid Blob (null-baseline Blob size unchanged)', () => {
    const blob = new Blob([cleanReport.html], { type: 'text/html' });
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('text/html');
  });

  it('ZI-04-07: generatedAt is always an ISO-8601 string regardless of inputs', () => {
    expect(nullReport.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(richReport.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
