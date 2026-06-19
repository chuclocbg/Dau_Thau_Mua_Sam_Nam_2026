/**
 * 8-H: AgentAuditExporter — 56 tests
 *
 * Groups:
 *   AE-01  (5)  Module exports — constants, function shape
 *   AE-02  (5)  Null inputs → fallback metadata (overallRisk='N/A', etc.)
 *   AE-03  (5)  LegalReviewer findings injection into HTML
 *   AE-04  (5)  RiskAgent findings injection into HTML
 *   AE-05  (5)  HTML document structure
 *   AE-06  (4)  Metadata shape — filename, counts, score
 *   AE-07  (5)  Clean output — empty findings produce clean-slate messages
 *   AE-08  (5)  Severity badge rendering — CRITICAL, HIGH, MEDIUM, LOW
 *   AE-09  (4)  XSS safety — HTML-special chars escaped in all fields
 *   AE-10  (4)  Mitigation plan rendering — priority, responsible, deadline
 *   AE-11  (4)  Legal basis section — deduplication and coverage
 *   AE-12  (5)  Integration — combined inputs produce complete, correct report
 */

import { describe, it, expect } from 'vitest';

import {
  buildAgentAuditReport,
  AUDIT_EXPORTER_VERSION,
  AUDIT_EXPORTER_FILENAME,
  type AgentAuditReport,
} from '../ai/agentAuditExporter';

import type { DossierReviewOutput } from '../agents/LegalReviewerAgent';
import type { RiskOutput }           from '../agents/RiskAgent';
import type { LegalFinding }         from '../ai/legalReviewer';

// ─── Fixture factories ────────────────────────────────────────────────────────

function makeFinding(overrides: Partial<LegalFinding> = {}): LegalFinding {
  return {
    severity:       'HIGH',
    code:           'LR-001',
    category:       'brand-locking',
    field:          'items[0].description',
    message:        'Phát hiện tên thương hiệu cụ thể trong tiêu chí kỹ thuật.',
    legalBasis:     'Điều 44 khoản 7 Luật Đấu thầu 22/2023/QH15',
    recommendation: 'Xóa tên thương hiệu, thay bằng tiêu chí kỹ thuật chức năng.',
    ...overrides,
  };
}

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

function makeDirtyDossier(): DossierReviewOutput {
  return {
    findings: [
      makeFinding({ severity: 'HIGH',   code: 'LR-001' }),
      makeFinding({ severity: 'MEDIUM', code: 'LR-002', message: 'Thiếu điều khoản bảo hành.' }),
    ],
    crossCheckIssues: [
      {
        severity:    'HIGH',
        doc1Id:      12,
        doc2Id:      28,
        field:       'dateDocIssue → dateBidClose',
        description: 'Khoảng cách ngày nhỏ hơn 7 ngày tối thiểu theo Điều 81 NĐ 214.',
      },
    ],
    complianceScore:  60,
    auditReadiness:   'conditional',
    recommendations:  ['Điều chỉnh tiêu chí kỹ thuật.', 'Gia hạn thời gian nộp hồ sơ.'],
    legalBasis:       ['Điều 44 khoản 7 Luật Đấu thầu 22/2023/QH15', 'Điều 81 Nghị định 214/2025/NĐ-CP'],
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
      estimatedImpact:   'Không có rủi ro kiểm toán đáng kể. Hồ sơ đạt chuẩn.',
    },
    mitigationPlan: [],
    legalBasis:     ['Khoản 1 Điều 10 Luật Đấu thầu 22/2023/QH15'],
  };
}

function makeDirtyRisk(): RiskOutput {
  const finding = makeFinding({ severity: 'HIGH', code: 'LR-001' });
  return {
    overallRisk: 'HIGH',
    riskMatrix: [
      {
        category:   'legal',
        severity:   'HIGH',
        finding,
        likelihood: 4,
        impact:     4,
        riskScore:  16,
      },
    ],
    systemicRisks: [
      {
        pattern:        '3 gói thầu cùng loại có ngày phê duyệt kết quả trùng nhau',
        severity:       'CRITICAL',
        occurrences:    3,
        affectedIds:    ['PKG-001', 'PKG-002', 'PKG-003'],
        recommendation: 'Kiểm tra tính độc lập giữa các quy trình phê duyệt.',
      },
    ],
    auditExposure: {
      probability:       'medium',
      potentialFindings: ['[LR-001] Phát hiện tên thương hiệu cụ thể trong tiêu chí kỹ thuật.'],
      estimatedImpact:   'Yêu cầu bổ sung hồ sơ, tạm dừng thanh toán, kiến nghị chấn chỉnh.',
    },
    mitigationPlan: [
      {
        priority:    1,
        action:      'Xóa tên thương hiệu, thay bằng tiêu chí kỹ thuật chức năng.',
        responsible: '[Tổ trưởng tổ chuyên gia]',
        deadline:    '2026-02-28',
        riskCodes:   ['LR-001'],
      },
      {
        priority:    2,
        action:      'Kiểm tra tính độc lập giữa các quy trình phê duyệt.',
        responsible: '[Tổ trưởng thẩm định độc lập]',
        riskCodes:   ['SYSTEMIC-CRITICAL'],
      },
    ],
    legalBasis: [
      'Điều 44 khoản 7 Luật Đấu thầu 22/2023/QH15',
      'Nghị định 214/2025/NĐ-CP — ngưỡng và phương thức lựa chọn nhà thầu',
    ],
  };
}

// ─── AE-01 · Module exports — constants, function shape ──────────────────────

describe('AE-01 · Module exports', () => {
  it('AE-01-01: buildAgentAuditReport is a function', () => {
    expect(typeof buildAgentAuditReport).toBe('function');
  });

  it('AE-01-02: AUDIT_EXPORTER_VERSION equals "8-H"', () => {
    expect(AUDIT_EXPORTER_VERSION).toBe('8-H');
  });

  it('AE-01-03: AUDIT_EXPORTER_FILENAME equals "25_BaoCaoKiemToanAgent.html"', () => {
    expect(AUDIT_EXPORTER_FILENAME).toBe('25_BaoCaoKiemToanAgent.html');
  });

  it('AE-01-04: returns object with all required keys', () => {
    const report = buildAgentAuditReport(null, null);
    const keys: (keyof AgentAuditReport)[] = [
      'html', 'filename', 'findingCount', 'crossCheckCount',
      'overallRisk', 'auditReadiness', 'complianceScore', 'generatedAt',
    ];
    for (const key of keys) {
      expect(report).toHaveProperty(key);
    }
  });

  it('AE-01-05: generatedAt is a non-empty ISO-8601 string', () => {
    const report = buildAgentAuditReport(null, null);
    expect(typeof report.generatedAt).toBe('string');
    expect(report.generatedAt.length).toBeGreaterThan(0);
    expect(() => new Date(report.generatedAt).toISOString()).not.toThrow();
  });
});

// ─── AE-02 · Null inputs → fallback metadata ─────────────────────────────────

describe('AE-02 · Null inputs → fallback metadata', () => {
  it('AE-02-01: both null → html is a non-empty string', () => {
    const { html } = buildAgentAuditReport(null, null);
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(0);
  });

  it('AE-02-02: null riskOutput → overallRisk is "N/A"', () => {
    const { overallRisk } = buildAgentAuditReport(makeCleanDossier(), null);
    expect(overallRisk).toBe('N/A');
  });

  it('AE-02-03: null dossierReview → auditReadiness is "N/A"', () => {
    const { auditReadiness } = buildAgentAuditReport(null, makeCleanRisk());
    expect(auditReadiness).toBe('N/A');
  });

  it('AE-02-04: null dossierReview → complianceScore is null', () => {
    const { complianceScore } = buildAgentAuditReport(null, makeCleanRisk());
    expect(complianceScore).toBeNull();
  });

  it('AE-02-05: both null → findingCount is 0', () => {
    const { findingCount } = buildAgentAuditReport(null, null);
    expect(findingCount).toBe(0);
  });
});

// ─── AE-03 · LegalReviewer findings injection ────────────────────────────────

describe('AE-03 · LegalReviewer findings injection', () => {
  it('AE-03-01: findings[].code rendered in HTML', () => {
    const { html } = buildAgentAuditReport(makeDirtyDossier(), null);
    expect(html).toContain('LR-001');
    expect(html).toContain('LR-002');
  });

  it('AE-03-02: findings[].message rendered in HTML', () => {
    const { html } = buildAgentAuditReport(makeDirtyDossier(), null);
    expect(html).toContain('Phát hiện tên thương hiệu cụ thể trong tiêu chí kỹ thuật.');
  });

  it('AE-03-03: crossCheckIssues rendered with doc IDs', () => {
    const { html } = buildAgentAuditReport(makeDirtyDossier(), null);
    expect(html).toContain('Doc 12');
    expect(html).toContain('Doc 28');
  });

  it('AE-03-04: complianceScore from dossierReview shown in HTML', () => {
    const { html } = buildAgentAuditReport(makeDirtyDossier(), null);
    expect(html).toContain('60/100');
  });

  it('AE-03-05: auditReadiness from dossierReview in HTML body attribute', () => {
    const { html } = buildAgentAuditReport(makeDirtyDossier(), null);
    expect(html).toContain('data-audit-readiness="conditional"');
  });
});

// ─── AE-04 · RiskAgent findings injection ────────────────────────────────────

describe('AE-04 · RiskAgent findings injection', () => {
  it('AE-04-01: overallRisk in body data attribute', () => {
    const { html } = buildAgentAuditReport(null, makeDirtyRisk());
    expect(html).toContain('data-overall-risk="HIGH"');
  });

  it('AE-04-02: riskMatrix entry code rendered in HTML', () => {
    const { html } = buildAgentAuditReport(null, makeDirtyRisk());
    expect(html).toContain('LR-001');
  });

  it('AE-04-03: riskMatrix riskScore rendered in HTML', () => {
    const { html } = buildAgentAuditReport(null, makeDirtyRisk());
    expect(html).toContain('data-risk-score="16"');
  });

  it('AE-04-04: auditExposure.estimatedImpact in HTML', () => {
    const { html } = buildAgentAuditReport(null, makeDirtyRisk());
    expect(html).toContain('Yêu cầu bổ sung hồ sơ, tạm dừng thanh toán');
  });

  it('AE-04-05: auditExposure.probability in HTML', () => {
    const { html } = buildAgentAuditReport(null, makeDirtyRisk());
    expect(html).toContain('data-field="probability"');
    expect(html).toContain('medium');
  });
});

// ─── AE-05 · HTML document structure ─────────────────────────────────────────

describe('AE-05 · HTML document structure', () => {
  it('AE-05-01: starts with <!DOCTYPE html>', () => {
    const { html } = buildAgentAuditReport(null, null);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
  });

  it('AE-05-02: contains <html lang="vi">', () => {
    const { html } = buildAgentAuditReport(null, null);
    expect(html).toContain('<html lang="vi">');
  });

  it('AE-05-03: contains <title> element with institution name', () => {
    const { html } = buildAgentAuditReport(null, null);
    expect(html).toContain('<title>');
    expect(html).toContain('Trường Cao đẳng Kỹ thuật Công nghiệp');
  });

  it('AE-05-04: body has data-overall-risk attribute', () => {
    const { html } = buildAgentAuditReport(null, null);
    expect(html).toContain('data-overall-risk="N/A"');
  });

  it('AE-05-05: body has data-audit-readiness attribute', () => {
    const { html } = buildAgentAuditReport(null, null);
    expect(html).toContain('data-audit-readiness="N/A"');
  });
});

// ─── AE-06 · Metadata shape — filename, counts, score ────────────────────────

describe('AE-06 · Metadata shape', () => {
  it('AE-06-01: filename equals AUDIT_EXPORTER_FILENAME', () => {
    const { filename } = buildAgentAuditReport(null, null);
    expect(filename).toBe(AUDIT_EXPORTER_FILENAME);
  });

  it('AE-06-02: findingCount matches dossierReview.findings.length', () => {
    const dossier = makeDirtyDossier();
    const { findingCount } = buildAgentAuditReport(dossier, null);
    expect(findingCount).toBe(dossier.findings.length);
  });

  it('AE-06-03: crossCheckCount matches dossierReview.crossCheckIssues.length', () => {
    const dossier = makeDirtyDossier();
    const { crossCheckCount } = buildAgentAuditReport(dossier, null);
    expect(crossCheckCount).toBe(dossier.crossCheckIssues.length);
  });

  it('AE-06-04: complianceScore equals dossierReview.complianceScore when non-null', () => {
    const dossier = makeDirtyDossier();
    const { complianceScore } = buildAgentAuditReport(dossier, null);
    expect(complianceScore).toBe(dossier.complianceScore);
  });
});

// ─── AE-07 · Clean output — empty findings produce clean-slate messages ───────

describe('AE-07 · Clean output', () => {
  it('AE-07-01: empty findings → "Không phát hiện vi phạm pháp lý."', () => {
    const { html } = buildAgentAuditReport(makeCleanDossier(), null);
    expect(html).toContain('Không phát hiện vi phạm pháp lý.');
  });

  it('AE-07-02: empty riskMatrix → "Ma trận rủi ro trống"', () => {
    const { html } = buildAgentAuditReport(null, makeCleanRisk());
    expect(html).toContain('Ma trận rủi ro trống');
  });

  it('AE-07-03: empty crossCheckIssues → "Không phát hiện mâu thuẫn giữa các văn bản."', () => {
    const { html } = buildAgentAuditReport(makeCleanDossier(), null);
    expect(html).toContain('Không phát hiện mâu thuẫn giữa các văn bản.');
  });

  it('AE-07-04: all empty → shows "Không phát hiện rủi ro kiểm toán đáng kể."', () => {
    const { html } = buildAgentAuditReport(makeCleanDossier(), makeCleanRisk());
    expect(html).toContain('Không phát hiện rủi ro kiểm toán đáng kể.');
  });

  it('AE-07-05: empty systemicRisks → "Không phát hiện rủi ro hệ thống."', () => {
    const { html } = buildAgentAuditReport(null, makeCleanRisk());
    expect(html).toContain('Không phát hiện rủi ro hệ thống.');
  });
});

// ─── AE-08 · Severity badge rendering ────────────────────────────────────────

describe('AE-08 · Severity badge rendering', () => {
  it('AE-08-01: CRITICAL finding → [CRITICAL] in HTML', () => {
    const dossier: DossierReviewOutput = {
      ...makeCleanDossier(),
      findings: [makeFinding({ severity: 'CRITICAL', code: 'LR-999' })],
      complianceScore: 40,
      auditReadiness: 'not-ready',
    };
    const { html } = buildAgentAuditReport(dossier, null);
    expect(html).toContain('[CRITICAL]');
  });

  it('AE-08-02: HIGH finding → [HIGH] in HTML', () => {
    const { html } = buildAgentAuditReport(makeDirtyDossier(), null);
    expect(html).toContain('[HIGH]');
  });

  it('AE-08-03: MEDIUM finding → [MEDIUM] in HTML', () => {
    const dossier: DossierReviewOutput = {
      ...makeCleanDossier(),
      findings: [makeFinding({ severity: 'MEDIUM', code: 'LR-003' })],
      complianceScore: 80,
      auditReadiness: 'ready',
    };
    const { html } = buildAgentAuditReport(dossier, null);
    expect(html).toContain('[MEDIUM]');
  });

  it('AE-08-04: LOW finding → [LOW] in HTML', () => {
    const dossier: DossierReviewOutput = {
      ...makeCleanDossier(),
      findings: [makeFinding({ severity: 'LOW', code: 'LR-004' })],
      complianceScore: 90,
      auditReadiness: 'ready',
    };
    const { html } = buildAgentAuditReport(dossier, null);
    expect(html).toContain('[LOW]');
  });

  it('AE-08-05: systemic risk with CRITICAL severity → [CRITICAL] badge', () => {
    const { html } = buildAgentAuditReport(null, makeDirtyRisk());
    expect(html).toContain('[CRITICAL]');
  });
});

// ─── AE-09 · XSS safety — HTML-special chars escaped ────────────────────────

describe('AE-09 · XSS safety', () => {
  it('AE-09-01: < in finding.message is escaped to &lt;', () => {
    const dossier: DossierReviewOutput = {
      ...makeCleanDossier(),
      findings: [makeFinding({ message: 'Giá trị <50 triệu VND.' })],
      complianceScore: 80,
      auditReadiness: 'ready',
    };
    const { html } = buildAgentAuditReport(dossier, null);
    expect(html).toContain('&lt;50 triệu VND.');
    expect(html).not.toContain('<50 triệu');
  });

  it('AE-09-02: > in finding.message is escaped to &gt;', () => {
    const dossier: DossierReviewOutput = {
      ...makeCleanDossier(),
      findings: [makeFinding({ message: 'Ngưỡng >100 triệu.' })],
      complianceScore: 80,
      auditReadiness: 'ready',
    };
    const { html } = buildAgentAuditReport(dossier, null);
    expect(html).toContain('&gt;100 triệu.');
  });

  it('AE-09-03: & in systemic pattern is escaped to &amp;', () => {
    const risk: RiskOutput = {
      ...makeCleanRisk(),
      overallRisk: 'MEDIUM',
      systemicRisks: [{
        pattern:        'Vi phạm khoản 1 & 2 Điều 44.',
        severity:       'MEDIUM',
        occurrences:    2,
        affectedIds:    ['PKG-A'],
        recommendation: 'Khắc phục ngay.',
      }],
    };
    const { html } = buildAgentAuditReport(null, risk);
    expect(html).toContain('&amp;');
    expect(html).not.toMatch(/khoản 1 & 2/);
  });

  it('AE-09-04: " in finding.code is escaped to &quot;', () => {
    const dossier: DossierReviewOutput = {
      ...makeCleanDossier(),
      findings: [makeFinding({ code: 'LR-"XSS"' })],
      complianceScore: 80,
      auditReadiness: 'ready',
    };
    const { html } = buildAgentAuditReport(dossier, null);
    expect(html).toContain('&quot;');
  });
});

// ─── AE-10 · Mitigation plan rendering ───────────────────────────────────────

describe('AE-10 · Mitigation plan rendering', () => {
  it('AE-10-01: steps rendered with priority number', () => {
    const { html } = buildAgentAuditReport(null, makeDirtyRisk());
    expect(html).toContain('data-priority="1"');
    expect(html).toContain('data-priority="2"');
  });

  it('AE-10-02: responsible placeholder preserved verbatim', () => {
    const { html } = buildAgentAuditReport(null, makeDirtyRisk());
    expect(html).toContain('[Tổ trưởng tổ chuyên gia]');
    expect(html).toContain('[Tổ trưởng thẩm định độc lập]');
  });

  it('AE-10-03: empty mitigationPlan → "Không có biện pháp khắc phục cần thiết."', () => {
    const { html } = buildAgentAuditReport(null, makeCleanRisk());
    expect(html).toContain('Không có biện pháp khắc phục cần thiết.');
  });

  it('AE-10-04: deadline rendered when present', () => {
    const { html } = buildAgentAuditReport(null, makeDirtyRisk());
    expect(html).toContain('hạn: 2026-02-28');
  });
});

// ─── AE-11 · Legal basis section ─────────────────────────────────────────────

describe('AE-11 · Legal basis section', () => {
  it('AE-11-01: dossierReview.legalBasis items appear in HTML', () => {
    const { html } = buildAgentAuditReport(makeDirtyDossier(), null);
    expect(html).toContain('Điều 81 Nghị định 214/2025/NĐ-CP');
  });

  it('AE-11-02: riskOutput.legalBasis items appear in HTML', () => {
    const { html } = buildAgentAuditReport(null, makeDirtyRisk());
    expect(html).toContain('Nghị định 214/2025/NĐ-CP — ngưỡng và phương thức lựa chọn nhà thầu');
  });

  it('AE-11-03: shared citations deduplicated in legal-basis section — appear once there', () => {
    const sharedCitation = 'Điều 44 khoản 7 Luật Đấu thầu 22/2023/QH15';
    const { html } = buildAgentAuditReport(makeDirtyDossier(), makeDirtyRisk());
    const sectionMatch = html.match(/<section data-section="legal-basis">[\s\S]*?<\/section>/);
    expect(sectionMatch).not.toBeNull();
    const section = sectionMatch![0];
    const occurrences = section.split(sharedCitation).length - 1;
    expect(occurrences).toBe(1);
  });

  it('AE-11-04: footer contains version string', () => {
    const { html } = buildAgentAuditReport(null, null);
    expect(html).toContain(`Phiên bản: ${AUDIT_EXPORTER_VERSION}`);
  });
});

// ─── AE-12 · Integration — combined inputs produce complete, correct report ───

describe('AE-12 · Integration', () => {
  it('AE-12-01: full inputs → HTML length > 500 characters', () => {
    const { html } = buildAgentAuditReport(makeDirtyDossier(), makeDirtyRisk());
    expect(html.length).toBeGreaterThan(500);
  });

  it('AE-12-02: clean dossier (non-null) → auditReadiness = "ready"', () => {
    const { auditReadiness } = buildAgentAuditReport(makeCleanDossier(), makeCleanRisk());
    expect(auditReadiness).toBe('ready');
  });

  it('AE-12-03: clean risk (non-null) → overallRisk = "CLEAN"', () => {
    const { overallRisk } = buildAgentAuditReport(makeCleanDossier(), makeCleanRisk());
    expect(overallRisk).toBe('CLEAN');
  });

  it('AE-12-04: null riskOutput with non-null dossier → overallRisk "N/A", auditReadiness from dossier', () => {
    const dossier = makeDirtyDossier();
    const { overallRisk, auditReadiness } = buildAgentAuditReport(dossier, null);
    expect(overallRisk).toBe('N/A');
    expect(auditReadiness).toBe(dossier.auditReadiness);
  });

  it('AE-12-05: body data-compliance-score attribute absent when dossierReview is null', () => {
    const { html } = buildAgentAuditReport(null, makeDirtyRisk());
    expect(html).not.toContain('data-compliance-score');
  });
});
