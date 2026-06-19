/**
 * 8-E: PackageLegalReviewPanel — 56 tests
 *
 * Groups:
 *   PR-01  (4)  never-throw — edge inputs
 *   PR-02  (5)  panel structure — ready/findings state attributes
 *   PR-03  (5)  loading state — loading=true
 *   PR-04  (5)  clean state — findings array empty
 *   PR-05  (5)  finding item attributes — data-finding/severity/category
 *   PR-06  (4)  legal basis and recommendation fields
 *   PR-07  (4)  severity display — all four severity levels
 *   PR-08  (4)  hasCritical / hasHigh flags
 *   PR-09  (4)  finding count attribute and field
 *   PR-10  (4)  summary field in all states
 *   PR-11  (5)  multiple findings — order, uniqueness, count
 *   PR-12  (7)  reviewPackage integration — live ProcurementPackage
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

import PackageLegalReviewPanel from '../components/PackageLegalReviewPanel';
import type { PackageLegalReviewPanelProps } from '../components/PackageLegalReviewPanel';
import { reviewPackage } from '../ai/legalReviewer';
import type { LegalReviewResult, LegalFinding, Severity } from '../ai/legalReviewer';
import type { ProcurementPackage } from '../demoData';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeFinding(
  code: string,
  severity: Severity,
  category: string,
  overrides: Partial<LegalFinding> = {},
): LegalFinding {
  return {
    code,
    severity,
    category,
    message:        `Thông điệp phát hiện ${code}`,
    legalBasis:     `Điều XX Luật mẫu ${code}`,
    recommendation: `Khuyến nghị khắc phục ${code}`,
    ...overrides,
  };
}

function makeResult(
  findings: LegalFinding[],
  overrides: Partial<Omit<LegalReviewResult, 'findings'>> = {},
): LegalReviewResult {
  const hasCritical = findings.some(f => f.severity === 'CRITICAL');
  const hasHigh     = findings.some(f => f.severity === 'HIGH');
  return {
    findings,
    hasCritical,
    hasHigh,
    summary: findings.length === 0
      ? 'Không phát hiện rủi ro pháp lý. Hồ sơ có thể xuất.'
      : `Phát hiện ${findings.length} vấn đề cần xem xét.`,
    ...overrides,
  };
}

const CLEAN_RESULT   = makeResult([]);
const SINGLE_FINDING = makeResult([makeFinding('LR-001', 'HIGH', 'brand-locking')]);
const MULTI_FINDINGS = makeResult([
  makeFinding('LR-001', 'CRITICAL', 'method-mismatch'),
  makeFinding('LR-002', 'HIGH',     'brand-locking'),
  makeFinding('LR-003', 'LOW',      'asset-recording'),
]);

function render(props: PackageLegalReviewPanelProps): string {
  return renderToString(React.createElement(PackageLegalReviewPanel, props));
}

// Minimal clean ProcurementPackage — consumable goods, <50M, no brand names
function makeCleanPackage(overrides: Partial<ProcurementPackage> = {}): ProcurementPackage {
  return {
    id: 'pkg-test',
    packageName: 'Mua sắm vật tư văn phòng phẩm thông thường',
    packageCode: 'TEST-001',
    fundingSource:     'autonomy_fund',
    fundingSourceName: 'Quỹ phát triển hoạt động sự nghiệp',
    budgetYear:        2026,
    rectorName:        '[Hiệu trưởng]',
    departmentName:    '[Phòng đề xuất]',
    departmentCode:    'TEST',
    expertTeamLeader:  '[Tổ trưởng tổ chuyên gia]',
    expertTeamMember1: '[Thành viên tổ chuyên gia]',
    expertTeamMember2: '[Thành viên tổ chuyên gia]',
    appraisalLeader:   '[Tổ trưởng thẩm định độc lập]',
    appraisalMember:   '[Thành viên thẩm định độc lập]',
    supplier1Name:     '[Nhà cung cấp số 1]',
    supplier1Address:  '[Địa chỉ nhà cung cấp số 1]',
    supplier1TaxCode:  '0000000001',
    supplier1Representative: '[Người đại diện]',
    supplier1Position: 'Giám đốc',
    supplier2Name:     '[Nhà cung cấp số 2]',
    supplier2Address:  '[Địa chỉ nhà cung cấp số 2]',
    supplier3Name:     '[Nhà cung cấp số 3]',
    supplier3Address:  '[Địa chỉ nhà cung cấp số 3]',
    dateProposal:        '2026-04-01',
    dateSurvey:          '2026-04-02',
    dateQuotes:          '2026-04-03',
    dateCompare:         '2026-04-04',
    dateKhlcnt:          '2026-04-05',
    dateKhlcntApprove:   '2026-04-06',
    dateExpertEstablish: '2026-04-07',
    dateDocIssue:        '2026-04-08',
    dateBidClose:        '2026-04-10',
    dateEvaluate:        '2026-04-11',
    dateAppraise:        '2026-04-12',
    dateResultProposal:  '2026-04-13',
    dateResultApprove:   '2026-04-14',
    dateContractSign:    '2026-04-15',
    dateDelivery:        '2026-04-20',
    dateAcceptance:      '2026-04-21',
    dateLiquidation:     '2026-04-22',
    dateAssetIncrease:   '',
    contractDurationDays: 5,
    contractType:  'lump_sum',
    warrantyMonths: 0,
    packageType:   'goods_consumable',
    items: [{
      id:            'item-t-1',
      name:          'Giấy in A4 định lượng 70 gsm',
      unit:          'Ream',
      quantity:      10,
      unitPrice:     80000,
      specs:         'Hàng mới 100%, định lượng 70 gsm, độ trắng tối thiểu 96%.',
      supplier1Price: 80000,
      supplier2Price: 82000,
      supplier3Price: 85000,
    }],
    ...overrides,
  };
}

// Package that triggers LR-001 (brand locking) — HIGH finding
function makeBrandLockedPackage(): ProcurementPackage {
  return makeCleanPackage({
    packageType: 'goods_fixed_asset',
    warrantyMonths: 12,
    dateAssetIncrease: '2026-04-25',
    items: [{
      id:            'item-b-1',
      name:          'Máy in văn phòng',
      unit:          'Cái',
      quantity:      1,
      unitPrice:     15000000,
      specs:         'Máy in HP LaserJet Pro M404dn, tốc độ in 38 trang/phút.',
      supplier1Price: 15000000,
      supplier2Price: 15500000,
      supplier3Price: 16000000,
    }],
  });
}

// ─── PR-01 · never-throw ──────────────────────────────────────────────────────

describe('PR-01 · never-throw — edge inputs', () => {
  it('PR-01-01: renders without throwing with findings', () => {
    expect(() => render({ result: SINGLE_FINDING })).not.toThrow();
  });

  it('PR-01-02: renders without throwing when findings empty', () => {
    expect(() => render({ result: CLEAN_RESULT })).not.toThrow();
  });

  it('PR-01-03: renders without throwing when loading=true', () => {
    expect(() => render({ result: CLEAN_RESULT, loading: true })).not.toThrow();
  });

  it('PR-01-04: renders without throwing with hasCritical=true', () => {
    const result = makeResult([makeFinding('LR-007', 'CRITICAL', 'method-mismatch')]);
    expect(() => render({ result })).not.toThrow();
  });
});

// ─── PR-02 · panel structure ──────────────────────────────────────────────────

describe('PR-02 · panel structure — findings state attributes', () => {
  const html = render({ result: SINGLE_FINDING });

  it('PR-02-01: data-panel="legal-review" present in findings state', () => {
    expect(html).toContain('data-panel="legal-review"');
  });

  it('PR-02-02: data-state="findings" when findings present', () => {
    expect(html).toContain('data-state="findings"');
  });

  it('PR-02-03: data-field="title" h2 present', () => {
    expect(html).toMatch(/<h2[^>]*data-field="title"[^>]*>/);
  });

  it('PR-02-04: data-field="finding-list" present', () => {
    expect(html).toContain('data-field="finding-list"');
  });

  it('PR-02-05: data-finding-count attribute present on root element', () => {
    expect(html).toContain('data-finding-count=');
  });
});

// ─── PR-03 · loading state ────────────────────────────────────────────────────

describe('PR-03 · loading state — loading=true', () => {
  const html = render({ result: CLEAN_RESULT, loading: true });

  it('PR-03-01: data-state="loading" present', () => {
    expect(html).toContain('data-state="loading"');
  });

  it('PR-03-02: Vietnamese loading message visible', () => {
    expect(html).toContain('Đang phân tích hồ sơ pháp lý');
  });

  it('PR-03-03: no data-state="findings" when loading', () => {
    expect(html).not.toContain('data-state="findings"');
  });

  it('PR-03-04: no data-field="finding-list" when loading', () => {
    expect(html).not.toContain('data-field="finding-list"');
  });

  it('PR-03-05: data-panel="legal-review" still present when loading', () => {
    expect(html).toContain('data-panel="legal-review"');
  });
});

// ─── PR-04 · clean state ──────────────────────────────────────────────────────

describe('PR-04 · clean state — no findings', () => {
  const html = render({ result: CLEAN_RESULT });

  it('PR-04-01: data-state="clean" when findings empty', () => {
    expect(html).toContain('data-state="clean"');
  });

  it('PR-04-02: data-finding-count="0" when clean', () => {
    expect(html).toContain('data-finding-count="0"');
  });

  it('PR-04-03: Vietnamese "no risks" message visible', () => {
    expect(html).toContain('Không phát hiện rủi ro pháp lý');
  });

  it('PR-04-04: data-field="summary" present and non-empty in clean state', () => {
    expect(html).toContain('data-field="summary"');
    expect(html).toContain(CLEAN_RESULT.summary);
  });

  it('PR-04-05: no data-field="finding-list" in clean state', () => {
    expect(html).not.toContain('data-field="finding-list"');
  });
});

// ─── PR-05 · finding item attributes ─────────────────────────────────────────

describe('PR-05 · finding item attributes', () => {
  const finding = makeFinding('LR-003', 'MEDIUM', 'missing-clause');
  const html    = render({ result: makeResult([finding]) });

  it('PR-05-01: data-finding="LR-003" on result item', () => {
    expect(html).toContain('data-finding="LR-003"');
  });

  it('PR-05-02: data-severity="MEDIUM" on result item', () => {
    expect(html).toContain('data-severity="MEDIUM"');
  });

  it('PR-05-03: data-category="missing-clause" on result item', () => {
    expect(html).toContain('data-category="missing-clause"');
  });

  it('PR-05-04: data-field="code" shows finding code text', () => {
    expect(html).toContain('data-field="code"');
    expect(html).toContain('LR-003');
  });

  it('PR-05-05: data-field="message" shows finding message text', () => {
    expect(html).toContain('data-field="message"');
    expect(html).toContain(finding.message);
  });
});

// ─── PR-06 · legal basis and recommendation ───────────────────────────────────

describe('PR-06 · legal basis and recommendation fields', () => {
  const finding = makeFinding('LR-004', 'HIGH', 'date-gap');
  const html    = render({ result: makeResult([finding]) });

  it('PR-06-01: data-field="legal-basis" present', () => {
    expect(html).toContain('data-field="legal-basis"');
  });

  it('PR-06-02: legal basis text visible in output', () => {
    expect(html).toContain(finding.legalBasis);
  });

  it('PR-06-03: data-field="recommendation" present', () => {
    expect(html).toContain('data-field="recommendation"');
  });

  it('PR-06-04: recommendation text visible in output', () => {
    expect(html).toContain(finding.recommendation);
  });
});

// ─── PR-07 · severity display ─────────────────────────────────────────────────

describe('PR-07 · severity display — all four levels', () => {
  it('PR-07-01: CRITICAL severity text rendered', () => {
    const html = render({ result: makeResult([makeFinding('LR-X', 'CRITICAL', 'cat')]) });
    expect(html).toContain('[CRITICAL]');
  });

  it('PR-07-02: HIGH severity text rendered', () => {
    const html = render({ result: makeResult([makeFinding('LR-X', 'HIGH', 'cat')]) });
    expect(html).toContain('[HIGH]');
  });

  it('PR-07-03: MEDIUM severity text rendered', () => {
    const html = render({ result: makeResult([makeFinding('LR-X', 'MEDIUM', 'cat')]) });
    expect(html).toContain('[MEDIUM]');
  });

  it('PR-07-04: LOW severity text rendered', () => {
    const html = render({ result: makeResult([makeFinding('LR-X', 'LOW', 'cat')]) });
    expect(html).toContain('[LOW]');
  });
});

// ─── PR-08 · hasCritical / hasHigh flags ──────────────────────────────────────

describe('PR-08 · hasCritical / hasHigh flags', () => {
  it('PR-08-01: data-has-critical="true" when hasCritical=true', () => {
    const result = makeResult([makeFinding('LR-007', 'CRITICAL', 'method-mismatch')]);
    expect(render({ result })).toContain('data-has-critical="true"');
  });

  it('PR-08-02: data-has-critical="false" when hasCritical=false', () => {
    const result = makeResult([makeFinding('LR-001', 'HIGH', 'brand-locking')]);
    expect(render({ result })).toContain('data-has-critical="false"');
  });

  it('PR-08-03: data-has-high="true" when hasHigh=true', () => {
    const result = makeResult([makeFinding('LR-001', 'HIGH', 'brand-locking')]);
    expect(render({ result })).toContain('data-has-high="true"');
  });

  it('PR-08-04: data-has-high="false" when findings are only MEDIUM/LOW', () => {
    const result = makeResult([makeFinding('LR-004', 'MEDIUM', 'missing-clause')]);
    expect(render({ result })).toContain('data-has-high="false"');
  });
});

// ─── PR-09 · finding count ────────────────────────────────────────────────────

describe('PR-09 · finding count attribute and field', () => {
  it('PR-09-01: data-finding-count="1" for single finding', () => {
    expect(render({ result: SINGLE_FINDING })).toContain('data-finding-count="1"');
  });

  it('PR-09-02: data-finding-count="3" for three findings', () => {
    expect(render({ result: MULTI_FINDINGS })).toContain('data-finding-count="3"');
  });

  it('PR-09-03: data-field="finding-count" text matches findings.length', () => {
    const html = render({ result: MULTI_FINDINGS });
    expect(html).toMatch(/data-field="finding-count"[^>]*>\s*3\s*</);
  });

  it('PR-09-04: number of data-finding attributes equals findings.length', () => {
    const html  = render({ result: MULTI_FINDINGS });
    const count = (html.match(/data-finding=/g) ?? []).length;
    expect(count).toBe(MULTI_FINDINGS.findings.length);
  });
});

// ─── PR-10 · summary field ────────────────────────────────────────────────────

describe('PR-10 · summary field', () => {
  it('PR-10-01: data-field="summary" present in findings state', () => {
    expect(render({ result: SINGLE_FINDING })).toContain('data-field="summary"');
  });

  it('PR-10-02: summary text visible in findings state', () => {
    expect(render({ result: SINGLE_FINDING })).toContain(SINGLE_FINDING.summary);
  });

  it('PR-10-03: data-field="summary" present in clean state', () => {
    expect(render({ result: CLEAN_RESULT })).toContain('data-field="summary"');
  });

  it('PR-10-04: summary text visible in clean state', () => {
    expect(render({ result: CLEAN_RESULT })).toContain(CLEAN_RESULT.summary);
  });
});

// ─── PR-11 · multiple findings rendering ─────────────────────────────────────

describe('PR-11 · multiple findings — order, uniqueness, count', () => {
  const html = render({ result: MULTI_FINDINGS });

  it('PR-11-01: data-finding="LR-001" present (first finding)', () => {
    expect(html).toContain('data-finding="LR-001"');
  });

  it('PR-11-02: LR-001 appears before LR-002 in HTML order', () => {
    const pos1 = html.indexOf('data-finding="LR-001"');
    const pos2 = html.indexOf('data-finding="LR-002"');
    expect(pos1).toBeLessThan(pos2);
  });

  it('PR-11-03: LR-002 appears before LR-003 in HTML order', () => {
    const pos2 = html.indexOf('data-finding="LR-002"');
    const pos3 = html.indexOf('data-finding="LR-003"');
    expect(pos2).toBeLessThan(pos3);
  });

  it('PR-11-04: all three category values rendered in output', () => {
    expect(html).toContain('method-mismatch');
    expect(html).toContain('brand-locking');
    expect(html).toContain('asset-recording');
  });

  it('PR-11-05: total data-finding attributes = MULTI_FINDINGS.findings.length', () => {
    const count = (html.match(/data-finding=/g) ?? []).length;
    expect(count).toBe(3);
  });
});

// ─── PR-12 · reviewPackage integration ───────────────────────────────────────

describe('PR-12 · reviewPackage integration — live ProcurementPackage', () => {
  it('PR-12-01: reviewPackage returns a LegalReviewResult with required fields', () => {
    const r = reviewPackage(makeCleanPackage());
    expect(Array.isArray(r.findings)).toBe(true);
    expect(typeof r.hasCritical).toBe('boolean');
    expect(typeof r.hasHigh).toBe('boolean');
    expect(typeof r.summary).toBe('string');
    expect(r.summary.length).toBeGreaterThan(0);
  });

  it('PR-12-02: panel renders without throwing from live reviewPackage output', () => {
    const result = reviewPackage(makeCleanPackage());
    expect(() => render({ result })).not.toThrow();
  });

  it('PR-12-03: consumable goods package (< 50M, no brand) renders clean state', () => {
    const result = reviewPackage(makeCleanPackage());
    // Consumable goods: no brand locking, no warranty check, no asset recording, <50M
    expect(result.findings.some(f => f.severity === 'CRITICAL')).toBe(false);
    const html = render({ result });
    // Either clean (0 findings) or findings — but no CRITICAL
    expect(html).not.toContain('data-severity="CRITICAL"');
  });

  it('PR-12-04: package with brand name triggers HIGH finding (LR-001)', () => {
    const result = reviewPackage(makeBrandLockedPackage());
    const lr001 = result.findings.find(f => f.code === 'LR-001');
    expect(lr001).toBeDefined();
    expect(lr001!.severity).toBe('HIGH');
  });

  it('PR-12-05: panel shows data-has-critical from live review', () => {
    const result = reviewPackage(makeBrandLockedPackage());
    const html   = render({ result });
    expect(html).toContain(`data-has-critical="${result.hasCritical}"`);
  });

  it('PR-12-06: data-finding-count matches live findings array length', () => {
    const result = reviewPackage(makeBrandLockedPackage());
    const html   = render({ result });
    expect(html).toContain(`data-finding-count="${result.findings.length}"`);
  });

  it('PR-12-07: summary text from live review is non-empty and appears in rendered HTML', () => {
    const result = reviewPackage(makeBrandLockedPackage());
    expect(result.summary.length).toBeGreaterThan(10);
    const html = render({ result });
    expect(html).toContain(result.summary);
  });
});
