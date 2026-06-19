/**
 * P8-E2E: End-to-end UI tests for Phase 8 panels — 56 tests
 *
 * Covers:
 *   - AgentOutputPanel (8-B) — specialist agent metadata
 *   - ChatInterfacePanel (8-A) — packageContext wiring
 *   - LegalKBPanel (8-D) — live searchLegalKB integration
 *   - PackageLegalReviewPanel (8-E) — live reviewPackage integration
 *   - createAgentSystem() Phase 8 bundle fields (planner, spec, legal, risk)
 *   - Multi-panel interaction
 *   - SSR consistency and XSS safety
 *   - App.tsx-style: all 5 Phase 8 panels from one bundle
 *
 * All rendering via renderToString (SSR-compatible, no async calls).
 *
 * Groups:
 *   P8E-01  (5)  createAgentSystem — Phase 8 specialist bundle fields
 *   P8E-02  (5)  AgentOutputPanel — renders from bundle specialists
 *   P8E-03  (5)  ChatInterfacePanel — packageContext wiring (8-A)
 *   P8E-04  (5)  LegalKBPanel — live searchLegalKB structural integration
 *   P8E-05  (5)  PackageLegalReviewPanel — live reviewPackage structural integration
 *   P8E-06  (4)  Multi-panel — AgentOutputPanel + LegalKBPanel
 *   P8E-07  (4)  Multi-panel — LegalKBPanel + PackageLegalReviewPanel
 *   P8E-08  (4)  Bundle shape — all Phase 8 specialist keys
 *   P8E-09  (4)  Capability integrity — specialist agents
 *   P8E-10  (4)  KB integrity — 21 entries after 8-C expansion
 *   P8E-11  (5)  SSR consistency — determinism and XSS safety
 *   P8E-12  (6)  App.tsx-style — all 5 Phase 8 panels from one bundle
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

import AgentOutputPanel        from '../components/AgentOutputPanel';
import LegalKBPanel            from '../components/LegalKBPanel';
import PackageLegalReviewPanel from '../components/PackageLegalReviewPanel';
import ChatInterfacePanel      from '../components/ChatInterfacePanel';
import { createAgentSystem }   from '../components/AgentProviderPanel';
import { searchLegalKB, LEGAL_KB } from '../ai/legalKnowledgeBase';
import { reviewPackage }       from '../ai/legalReviewer';
import type { ProcurementPackage } from '../demoData';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeCleanPackage(overrides: Partial<ProcurementPackage> = {}): ProcurementPackage {
  return {
    id: 'p8e-pkg',
    packageName: 'Mua sắm vật tư văn phòng phẩm thông thường',
    packageCode: 'P8E-001',
    fundingSource:     'autonomy_fund',
    fundingSourceName: 'Quỹ phát triển hoạt động sự nghiệp',
    budgetYear:        2026,
    rectorName:        '[Hiệu trưởng]',
    departmentName:    '[Phòng đề xuất]',
    departmentCode:    'P8E',
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
    dateProposal:        '2026-01-10',
    dateSurvey:          '2026-01-12',
    dateQuotes:          '2026-01-14',
    dateCompare:         '2026-01-16',
    dateKhlcnt:          '2026-01-20',
    dateKhlcntApprove:   '2026-01-25',
    dateExpertEstablish: '2026-02-01',
    dateDocIssue:        '2026-02-05',
    dateBidClose:        '2026-02-15',
    dateEvaluate:        '2026-02-16',
    dateAppraise:        '2026-02-17',
    dateResultProposal:  '2026-02-18',
    dateResultApprove:   '2026-02-19',
    dateContractSign:    '2026-02-20',
    dateDelivery:        '2026-02-25',
    dateAcceptance:      '2026-02-26',
    dateLiquidation:     '2026-02-27',
    dateAssetIncrease:   '',
    contractDurationDays: 5,
    contractType:    'lump_sum',
    warrantyMonths:  0,
    packageType:     'goods_consumable',
    items: [{
      id:            'item-p8e-1',
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

function makeBrandLockedPackage(): ProcurementPackage {
  return makeCleanPackage({
    packageType:    'goods_fixed_asset',
    warrantyMonths: 12,
    dateAssetIncrease: '2026-04-25',
    items: [{
      id:            'item-p8e-bl',
      name:          'Máy in văn phòng',
      unit:          'Cái',
      quantity:      1,
      unitPrice:     15_000_000,
      specs:         'Máy in HP LaserJet Pro M404dn, tốc độ in 38 trang/phút.',
      supplier1Price: 15_000_000,
      supplier2Price: 15_500_000,
      supplier3Price: 16_000_000,
    }],
  });
}

// ─── P8E-01 · createAgentSystem — Phase 8 specialist bundle fields ────────────

describe('P8E-01 · createAgentSystem — Phase 8 specialist bundle fields', () => {
  const bundle = createAgentSystem();

  it('P8E-01-01: bundle has planner key', () => {
    expect(bundle).toHaveProperty('planner');
  });

  it('P8E-01-02: bundle has spec key', () => {
    expect(bundle).toHaveProperty('spec');
  });

  it('P8E-01-03: bundle has legal key', () => {
    expect(bundle).toHaveProperty('legal');
  });

  it('P8E-01-04: bundle has risk key', () => {
    expect(bundle).toHaveProperty('risk');
  });

  it('P8E-01-05: bundle has exactly 8 top-level keys', () => {
    const keys = Object.keys(bundle);
    expect(keys).toHaveLength(8);
    expect(keys).toContain('registry');
    expect(keys).toContain('agents');
    expect(keys).toContain('autonomous');
    expect(keys).toContain('chat');
  });
});

// ─── P8E-02 · AgentOutputPanel — renders from bundle specialists ──────────────

describe('P8E-02 · AgentOutputPanel — renders from bundle specialists', () => {
  const { planner, spec, legal, risk } = createAgentSystem();

  it('P8E-02-01: renders without throwing', () => {
    expect(() =>
      renderToString(React.createElement(AgentOutputPanel, { planner, spec, legal, risk })),
    ).not.toThrow();
  });

  it('P8E-02-02: has data-panel="agent-output"', () => {
    const html = renderToString(React.createElement(AgentOutputPanel, { planner, spec, legal, risk }));
    expect(html).toContain('data-panel="agent-output"');
  });

  it('P8E-02-03: has data-state="ready"', () => {
    const html = renderToString(React.createElement(AgentOutputPanel, { planner, spec, legal, risk }));
    expect(html).toContain('data-state="ready"');
  });

  it('P8E-02-04: has data-agent-count=4', () => {
    const html = renderToString(React.createElement(AgentOutputPanel, { planner, spec, legal, risk }));
    expect(html).toContain('data-agent-count="4"');
  });

  it('P8E-02-05: all 4 specialist agent IDs in output', () => {
    const html = renderToString(React.createElement(AgentOutputPanel, { planner, spec, legal, risk }));
    expect(html).toContain('data-agent-id="planner"');
    expect(html).toContain('data-agent-id="specification"');
    expect(html).toContain('data-agent-id="legal-reviewer"');
    expect(html).toContain('data-agent-id="risk"');
  });
});

// ─── P8E-03 · ChatInterfacePanel — packageContext wiring (8-A) ───────────────

describe('P8E-03 · ChatInterfacePanel — packageContext wiring (8-A)', () => {
  const { chat } = createAgentSystem();
  const pkg = makeCleanPackage();

  it('P8E-03-01: renders without throwing with packageContext', () => {
    expect(() =>
      renderToString(React.createElement(ChatInterfacePanel, { agent: chat, packageContext: pkg })),
    ).not.toThrow();
  });

  it('P8E-03-02: has data-panel="chat-interface"', () => {
    const html = renderToString(React.createElement(ChatInterfacePanel, { agent: chat, packageContext: pkg }));
    expect(html).toContain('data-panel="chat-interface"');
  });

  it('P8E-03-03: data-field="package-context" rendered when packageContext provided', () => {
    const html = renderToString(React.createElement(ChatInterfacePanel, { agent: chat, packageContext: pkg }));
    expect(html).toContain('data-field="package-context"');
  });

  it('P8E-03-04: data-package-code matches fixture packageCode', () => {
    const html = renderToString(React.createElement(ChatInterfacePanel, { agent: chat, packageContext: pkg }));
    expect(html).toContain(`data-package-code="${pkg.packageCode}"`);
  });

  it('P8E-03-05: data-field="package-name" contains packageName text', () => {
    const html = renderToString(React.createElement(ChatInterfacePanel, { agent: chat, packageContext: pkg }));
    expect(html).toContain('data-field="package-name"');
    expect(html).toContain(pkg.packageName);
  });
});

// ─── P8E-04 · LegalKBPanel — live searchLegalKB structural integration ────────

describe('P8E-04 · LegalKBPanel — live searchLegalKB structural integration', () => {
  const query   = 'mua sắm chào hàng cạnh tranh';
  const results = searchLegalKB(query, 5);

  it('P8E-04-01: renders without throwing with live results', () => {
    expect(() =>
      renderToString(React.createElement(LegalKBPanel, { query, results })),
    ).not.toThrow();
  });

  it('P8E-04-02: has data-panel="legal-kb"', () => {
    const html = renderToString(React.createElement(LegalKBPanel, { query, results }));
    expect(html).toContain('data-panel="legal-kb"');
  });

  it('P8E-04-03: data-state="ready" for non-empty results', () => {
    const html = renderToString(React.createElement(LegalKBPanel, { query, results }));
    expect(html).toContain('data-state="ready"');
  });

  it('P8E-04-04: data-result-count matches result array length', () => {
    const html = renderToString(React.createElement(LegalKBPanel, { query, results }));
    expect(html).toContain(`data-result-count="${results.length}"`);
  });

  it('P8E-04-05: first result rendered with data-result-id attribute', () => {
    const html = renderToString(React.createElement(LegalKBPanel, { query, results }));
    expect(html).toContain(`data-result-id="${results[0].entry.id}"`);
  });
});

// ─── P8E-05 · PackageLegalReviewPanel — live reviewPackage integration ────────

describe('P8E-05 · PackageLegalReviewPanel — live reviewPackage structural integration', () => {
  it('P8E-05-01: renders without throwing with clean package', () => {
    const result = reviewPackage(makeCleanPackage());
    expect(() =>
      renderToString(React.createElement(PackageLegalReviewPanel, { result })),
    ).not.toThrow();
  });

  it('P8E-05-02: has data-panel="legal-review"', () => {
    const result = reviewPackage(makeCleanPackage());
    const html   = renderToString(React.createElement(PackageLegalReviewPanel, { result }));
    expect(html).toContain('data-panel="legal-review"');
  });

  it('P8E-05-03: data-state="clean" for clean package with no findings', () => {
    const result = reviewPackage(makeCleanPackage());
    const html   = renderToString(React.createElement(PackageLegalReviewPanel, { result }));
    expect(html).toContain('data-state="clean"');
  });

  it('P8E-05-04: data-state="findings" for brand-locked package', () => {
    const result = reviewPackage(makeBrandLockedPackage());
    const html   = renderToString(React.createElement(PackageLegalReviewPanel, { result }));
    expect(html).toContain('data-state="findings"');
  });

  it('P8E-05-05: finding items rendered for brand-locked package', () => {
    const result = reviewPackage(makeBrandLockedPackage());
    const html   = renderToString(React.createElement(PackageLegalReviewPanel, { result }));
    expect(html).toContain('data-finding="LR-001"');
  });
});

// ─── P8E-06 · Multi-panel — AgentOutputPanel + LegalKBPanel ──────────────────

describe('P8E-06 · Multi-panel — AgentOutputPanel + LegalKBPanel', () => {
  const { planner, spec, legal, risk } = createAgentSystem();
  const query   = 'ngưỡng phương thức lựa chọn';
  const results = searchLegalKB(query, 3);

  it('P8E-06-01: AgentOutputPanel renders without throwing', () => {
    expect(() =>
      renderToString(React.createElement(AgentOutputPanel, { planner, spec, legal, risk })),
    ).not.toThrow();
  });

  it('P8E-06-02: LegalKBPanel renders without throwing', () => {
    expect(() =>
      renderToString(React.createElement(LegalKBPanel, { query, results })),
    ).not.toThrow();
  });

  it('P8E-06-03: AgentOutputPanel has data-state="ready"', () => {
    const html = renderToString(React.createElement(AgentOutputPanel, { planner, spec, legal, risk }));
    expect(html).toContain('data-state="ready"');
  });

  it('P8E-06-04: LegalKBPanel has data-state="ready"', () => {
    const html = renderToString(React.createElement(LegalKBPanel, { query, results }));
    expect(html).toContain('data-state="ready"');
  });
});

// ─── P8E-07 · Multi-panel — LegalKBPanel + PackageLegalReviewPanel ───────────

describe('P8E-07 · Multi-panel — LegalKBPanel + PackageLegalReviewPanel', () => {
  const query   = 'hợp đồng mua sắm';
  const results = searchLegalKB(query, 3);
  const result  = reviewPackage(makeCleanPackage());

  it('P8E-07-01: LegalKBPanel renders without throwing', () => {
    expect(() =>
      renderToString(React.createElement(LegalKBPanel, { query, results })),
    ).not.toThrow();
  });

  it('P8E-07-02: PackageLegalReviewPanel renders without throwing', () => {
    expect(() =>
      renderToString(React.createElement(PackageLegalReviewPanel, { result })),
    ).not.toThrow();
  });

  it('P8E-07-03: LegalKBPanel has data-panel="legal-kb"', () => {
    const html = renderToString(React.createElement(LegalKBPanel, { query, results }));
    expect(html).toContain('data-panel="legal-kb"');
  });

  it('P8E-07-04: PackageLegalReviewPanel has data-panel="legal-review"', () => {
    const html = renderToString(React.createElement(PackageLegalReviewPanel, { result }));
    expect(html).toContain('data-panel="legal-review"');
  });
});

// ─── P8E-08 · Bundle shape — all Phase 8 specialist keys ─────────────────────

describe('P8E-08 · Bundle shape — all Phase 8 specialist keys', () => {
  const bundle = createAgentSystem();

  it('P8E-08-01: bundle.planner is non-null', () => {
    expect(bundle.planner).toBeDefined();
    expect(bundle.planner).not.toBeNull();
  });

  it('P8E-08-02: bundle.spec is non-null', () => {
    expect(bundle.spec).toBeDefined();
    expect(bundle.spec).not.toBeNull();
  });

  it('P8E-08-03: bundle.legal is non-null', () => {
    expect(bundle.legal).toBeDefined();
    expect(bundle.legal).not.toBeNull();
  });

  it('P8E-08-04: bundle.risk is non-null', () => {
    expect(bundle.risk).toBeDefined();
    expect(bundle.risk).not.toBeNull();
  });
});

// ─── P8E-09 · Capability integrity — specialist agents ───────────────────────

describe('P8E-09 · Capability integrity — specialist agents', () => {
  const { planner, spec, legal, risk } = createAgentSystem();

  it('P8E-09-01: spec agent has exactly 4 capabilities', () => {
    expect(spec.getCapabilities()).toHaveLength(4);
  });

  it('P8E-09-02: legal agent has exactly 5 capabilities', () => {
    expect(legal.getCapabilities()).toHaveLength(5);
  });

  it('P8E-09-03: risk agent has exactly 5 capabilities', () => {
    expect(risk.getCapabilities()).toHaveLength(5);
  });

  it('P8E-09-04: planner agent has exactly 4 capabilities', () => {
    expect(planner.getCapabilities()).toHaveLength(4);
  });
});

// ─── P8E-10 · KB integrity — 21 entries after 8-C expansion ──────────────────

describe('P8E-10 · KB integrity — 21 entries after 8-C expansion', () => {
  it('P8E-10-01: LEGAL_KB has exactly 21 entries', () => {
    expect(LEGAL_KB).toHaveLength(21);
  });

  it('P8E-10-02: 8-C entries kb-016 through kb-021 all present', () => {
    const ids = LEGAL_KB.map(e => e.id);
    for (const id of ['kb-016', 'kb-017', 'kb-018', 'kb-019', 'kb-020', 'kb-021']) {
      expect(ids).toContain(id);
    }
  });

  it('P8E-10-03: searchLegalKB returns at most 5 results when limit=5', () => {
    const results = searchLegalKB('mua sắm', 5);
    expect(results.length).toBeLessThanOrEqual(5);
    expect(results.length).toBeGreaterThan(0);
  });

  it('P8E-10-04: all LEGAL_KB entries have required fields', () => {
    for (const entry of LEGAL_KB) {
      expect(entry.id).toBeTruthy();
      expect(entry.title).toBeTruthy();
      expect(entry.source).toBeTruthy();
      expect(Array.isArray(entry.keywords)).toBe(true);
      expect(entry.content).toBeTruthy();
    }
  });
});

// ─── P8E-11 · SSR consistency — determinism and XSS safety ───────────────────

describe('P8E-11 · SSR consistency — determinism and XSS safety', () => {
  it('P8E-11-01: AgentOutputPanel output is deterministic for same props', () => {
    const { planner, spec, legal, risk } = createAgentSystem();
    const props = { planner, spec, legal, risk };
    const html1 = renderToString(React.createElement(AgentOutputPanel, props));
    const html2 = renderToString(React.createElement(AgentOutputPanel, props));
    expect(html1).toBe(html2);
  });

  it('P8E-11-02: LegalKBPanel output is deterministic for same props', () => {
    const query   = 'kiểm tra pháp lý';
    const results = searchLegalKB(query, 5);
    const props   = { query, results };
    const html1   = renderToString(React.createElement(LegalKBPanel, props));
    const html2   = renderToString(React.createElement(LegalKBPanel, props));
    expect(html1).toBe(html2);
  });

  it('P8E-11-03: PackageLegalReviewPanel output is deterministic for same props', () => {
    const result = reviewPackage(makeCleanPackage());
    const props  = { result };
    const html1  = renderToString(React.createElement(PackageLegalReviewPanel, props));
    const html2  = renderToString(React.createElement(PackageLegalReviewPanel, props));
    expect(html1).toBe(html2);
  });

  it('P8E-11-04: no <script> tags in any Phase 8 panel output', () => {
    const { planner, spec, legal, risk, chat } = createAgentSystem();
    const pkg     = makeCleanPackage();
    const query   = 'đấu thầu';
    const results = searchLegalKB(query, 3);
    const result  = reviewPackage(pkg);
    const panels  = [
      renderToString(React.createElement(AgentOutputPanel, { planner, spec, legal, risk })),
      renderToString(React.createElement(LegalKBPanel, { query, results })),
      renderToString(React.createElement(PackageLegalReviewPanel, { result })),
      renderToString(React.createElement(ChatInterfacePanel, { agent: chat, packageContext: pkg })),
    ];
    for (const html of panels) {
      expect(html).not.toContain('<script');
    }
  });

  it('P8E-11-05: XSS payload in packageName is escaped in ChatInterfacePanel output', () => {
    const { chat } = createAgentSystem();
    const pkg  = makeCleanPackage({ packageName: '<script>alert(1)</script>' });
    const html = renderToString(React.createElement(ChatInterfacePanel, { agent: chat, packageContext: pkg }));
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

// ─── P8E-12 · App.tsx-style — all 5 Phase 8 panels from one bundle ───────────

describe('P8E-12 · App.tsx-style — all 5 Phase 8 panels from one bundle', () => {
  const bundle  = createAgentSystem();
  const pkg     = makeCleanPackage();
  const query   = pkg.packageName;
  const results = searchLegalKB(query, 5);
  const review  = reviewPackage(pkg);

  it('P8E-12-01: AgentOutputPanel renders from bundle.planner/spec/legal/risk', () => {
    expect(() =>
      renderToString(React.createElement(AgentOutputPanel, {
        planner: bundle.planner,
        spec:    bundle.spec,
        legal:   bundle.legal,
        risk:    bundle.risk,
      })),
    ).not.toThrow();
  });

  it('P8E-12-02: ChatInterfacePanel renders from bundle.chat with packageContext', () => {
    expect(() =>
      renderToString(React.createElement(ChatInterfacePanel, {
        agent:          bundle.chat,
        packageContext: pkg,
      })),
    ).not.toThrow();
  });

  it('P8E-12-03: LegalKBPanel renders with live searchLegalKB results', () => {
    expect(() =>
      renderToString(React.createElement(LegalKBPanel, { query, results })),
    ).not.toThrow();
  });

  it('P8E-12-04: PackageLegalReviewPanel renders with live reviewPackage result', () => {
    expect(() =>
      renderToString(React.createElement(PackageLegalReviewPanel, { result: review })),
    ).not.toThrow();
  });

  it('P8E-12-05: all Phase 8 panels have correct data-panel attributes', () => {
    const aoHtml  = renderToString(React.createElement(AgentOutputPanel, {
      planner: bundle.planner, spec: bundle.spec, legal: bundle.legal, risk: bundle.risk,
    }));
    const chatHtml = renderToString(React.createElement(ChatInterfacePanel, {
      agent: bundle.chat, packageContext: pkg,
    }));
    const kbHtml  = renderToString(React.createElement(LegalKBPanel, { query, results }));
    const rvHtml  = renderToString(React.createElement(PackageLegalReviewPanel, { result: review }));
    expect(aoHtml).toContain('data-panel="agent-output"');
    expect(chatHtml).toContain('data-panel="chat-interface"');
    expect(kbHtml).toContain('data-panel="legal-kb"');
    expect(rvHtml).toContain('data-panel="legal-review"');
  });

  it('P8E-12-06: no Phase 8 panel throws when rendered from single bundle', () => {
    const panels = [
      () => renderToString(React.createElement(AgentOutputPanel, {
        planner: bundle.planner, spec: bundle.spec, legal: bundle.legal, risk: bundle.risk,
      })),
      () => renderToString(React.createElement(ChatInterfacePanel, {
        agent: bundle.chat, packageContext: pkg,
      })),
      () => renderToString(React.createElement(LegalKBPanel, { query, results })),
      () => renderToString(React.createElement(PackageLegalReviewPanel, { result: review })),
    ];
    for (const render of panels) {
      expect(render).not.toThrow();
    }
  });
});
