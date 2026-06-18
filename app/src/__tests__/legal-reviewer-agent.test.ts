/**
 * P6-03D: LegalReviewerAgent test suite
 *
 * Coverage:
 *   Group 0 — Module constants and capabilities           (3 tests, MC-01..MC-03)
 *   Group 1 — detectCrossDocumentIssues()                 (6 tests, CC-01..CC-06)
 *   Group 2 — calculateComplianceScore()                  (5 tests, CS-01..CS-05)
 *   Group 3 — summarizeFindings()                         (5 tests, SF-01..SF-05)
 *   Group 4 — reviewPackage() pure function               (6 tests, RP-01..RP-06)
 *   Group 5 — LegalReviewerAgent.process()                (10 tests, PA-01..PA-10)
 *   Group 6 — legalBasis collection and deduplication     (4 tests, LB-01..LB-04)
 *
 * No vi.fn() / vi.mock() on P5 functions. All P5 modules used read-only.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { AgentRegistry } from '../agents/AgentRegistry';
import {
  detectCrossDocumentIssues,
  calculateComplianceScore,
  summarizeFindings,
  reviewPackage,
  REVIEWER_LEGAL_BASIS,
  LegalReviewerAgent,
} from '../agents/LegalReviewerAgent';

import type { AgentMessage }         from '../agents/types';
import type {
  CrossCheckIssue,
  DossierReviewInput,
  DossierReviewOutput,
  ReviewerStateEvent,
} from '../agents/LegalReviewerAgent';
import type { LegalFinding, Severity } from '../agents/LegalReviewerAgent';
import type { ProcurementPackage }    from '../demoData';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * Returns a fully-populated ProcurementPackage with all dates in valid
 * procurement sequence, goods_consumable type, and clean (brand-free) specs.
 * Produces 0 P5-03 findings and 0 cross-check issues — complianceScore=100.
 */
function makePkg(overrides: Partial<ProcurementPackage> = {}): ProcurementPackage {
  return {
    id:                      'test-pkg-1',
    packageName:             'Gói mua sắm vật tư tiêu hao',
    packageCode:             'TEST-VT-001',
    fundingSource:           'autonomy_fund',
    fundingSourceName:       'Quỹ phát triển hoạt động sự nghiệp',
    budgetYear:              2026,
    rectorName:              '[Tên Hiệu trưởng]',
    departmentName:          '[Tên đơn vị đề xuất]',
    departmentCode:          '[Mã phòng]',
    expertTeamLeader:        '[Tổ trưởng tổ chuyên gia]',
    expertTeamMember1:       '[Thành viên tổ chuyên gia]',
    expertTeamMember2:       '[Thành viên tổ chuyên gia]',
    appraisalLeader:         '[Tổ trưởng thẩm định độc lập]',
    appraisalMember:         '[Thành viên thẩm định độc lập]',
    supplier1Name:           '[Nhà cung cấp số 1]',
    supplier1Address:        '[Địa chỉ nhà cung cấp 1]',
    supplier1TaxCode:        '[Mã số thuế]',
    supplier1Representative: '[Người đại diện]',
    supplier1Position:       '[Chức vụ]',
    supplier2Name:           '[Nhà cung cấp số 2]',
    supplier2Address:        '[Địa chỉ nhà cung cấp 2]',
    supplier3Name:           '[Nhà cung cấp số 3]',
    supplier3Address:        '[Địa chỉ nhà cung cấp 3]',
    // Dates in valid procurement sequence with required minimum gaps
    dateProposal:         '2026-01-05',
    dateSurvey:           '2026-01-07',
    dateQuotes:           '2026-01-07',
    dateCompare:          '2026-01-07',
    dateKhlcnt:           '2026-01-10',
    dateKhlcntApprove:    '2026-01-15',
    dateExpertEstablish:  '2026-01-20',
    dateDocIssue:         '2026-02-01',
    dateBidClose:         '2026-02-10', // 9 days after docIssue ≥ 7 ✓
    dateEvaluate:         '2026-02-15', // after bidClose ✓
    dateAppraise:         '2026-02-20', // 5 days after evaluate ≥ 1 ✓
    dateResultProposal:   '2026-02-22',
    dateResultApprove:    '2026-02-25', // 5 days after appraise ≥ 1 ✓
    dateContractSign:     '2026-03-01', // after resultApprove ✓
    dateDelivery:         '2026-03-15', // after contractSign ✓
    dateAcceptance:       '2026-03-20', // 5 days after delivery ≥ 0 ✓
    dateLiquidation:      '2026-04-01', // after acceptance ✓
    dateAssetIncrease:    '',
    contractDurationDays: 30,
    contractType:         'lump_sum',
    warrantyMonths:       0,
    packageType:          'goods_consumable',
    items: [{
      id:             'item-1',
      name:           'Vật tư tiêu hao phục vụ đào tạo',
      unit:           'Bộ',
      quantity:       1,
      unitPrice:      100_000_000,
      specs:          'Đạt tiêu chuẩn chất lượng tối thiểu theo yêu cầu kỹ thuật.',
      supplier1Price: 100_000_000,
      supplier2Price: 0,
      supplier3Price: 0,
    }],
    ...overrides,
  };
}

/** Builds an AgentMessage request targeting the legal-reviewer agent. */
function makeReviewerRequest(
  pkg:           ProcurementPackage,
  traceId:       string,
  inputOverrides: Partial<DossierReviewInput> = {},
): AgentMessage {
  const payload: DossierReviewInput = {
    pkg,
    documentIds: Array.from({ length: 28 }, (_, i) => i + 1),
    methodCode:  'DIRECT_SELECTION_SIMPLIFIED',
    ...inputOverrides,
  };
  return {
    traceId,
    from:      'user',
    to:        'legal-reviewer',
    type:      'request',
    payload,
    timestamp: Date.now(),
  };
}

/** Makes a minimal LegalFinding for pure-function tests. */
function makeFinding(severity: Severity, recommendation = 'Khắc phục theo quy định.'): LegalFinding {
  return {
    severity,
    code:           'TEST-001',
    category:       'test',
    message:        'Test finding',
    legalBasis:     'Điều 44 khoản 7 Luật Đấu thầu 22/2023/QH15',
    recommendation,
  };
}

/** Makes a minimal CrossCheckIssue for pure-function tests. */
function makeCrossIssue(severity: Severity): CrossCheckIssue {
  return {
    severity,
    doc1Id:      17,
    doc2Id:      18,
    field:       'dateResultApprove → dateContractSign',
    description: 'Test cross-check issue',
  };
}

function createTestRegistry(): AgentRegistry {
  return new AgentRegistry();
}

// ─── Group 0: Module constants and capabilities ───────────────────────────────

describe('LegalReviewerAgent — module constants and capabilities', () => {
  it('MC-01: REVIEWER_LEGAL_BASIS contains exactly 5 citations', () => {
    expect(REVIEWER_LEGAL_BASIS).toHaveLength(5);
  });

  it('MC-02: REVIEWER_LEGAL_BASIS includes Điều 38-41 KHLCNT foundation reference', () => {
    expect(REVIEWER_LEGAL_BASIS.some(b => b.includes('Điều 38-41'))).toBe(true);
  });

  it('MC-03: getCapabilities() returns at least 5 capability strings', () => {
    const registry = createTestRegistry();
    const agent    = new LegalReviewerAgent(registry);
    expect(agent.getCapabilities().length).toBeGreaterThanOrEqual(5);
    expect(agent.id).toBe('legal-reviewer');
  });
});

// ─── Group 1: detectCrossDocumentIssues() ─────────────────────────────────────

describe('detectCrossDocumentIssues()', () => {
  it('CC-01: all dates empty — no false positives', () => {
    const pkg = makePkg({
      dateKhlcnt: '', dateKhlcntApprove: '', dateExpertEstablish: '',
      dateDocIssue: '', dateBidClose: '', dateEvaluate: '',
      dateAppraise: '', dateResultApprove: '', dateContractSign: '',
      dateDelivery: '', dateAcceptance: '', dateLiquidation: '',
    });
    expect(detectCrossDocumentIssues(pkg)).toHaveLength(0);
  });

  it('CC-02: correct date order — no issues', () => {
    expect(detectCrossDocumentIssues(makePkg())).toHaveLength(0);
  });

  it('CC-03: contract signed before result approved — CRITICAL issue (roadmap)', () => {
    const pkg    = makePkg({ dateResultApprove: '2026-03-10', dateContractSign: '2026-03-01' });
    const issues = detectCrossDocumentIssues(pkg);
    // doc1Id=17 (QĐ phê duyệt kết quả), doc2Id=18 (Hợp đồng)
    const contractIssue = issues.find(i => i.doc1Id === 17 && i.doc2Id === 18);
    expect(contractIssue).toBeDefined();
    expect(contractIssue!.severity).toBe('CRITICAL');
  });

  it('CC-04: acceptance before delivery — CRITICAL issue (roadmap)', () => {
    const pkg    = makePkg({ dateDelivery: '2026-03-20', dateAcceptance: '2026-03-15' });
    const issues = detectCrossDocumentIssues(pkg);
    // doc1Id=19 (Biên bản bàn giao), doc2Id=20 (Biên bản nghiệm thu)
    const acceptIssue = issues.find(i => i.doc1Id === 19 && i.doc2Id === 20);
    expect(acceptIssue).toBeDefined();
    expect(acceptIssue!.severity).toBe('CRITICAL');
  });

  it('CC-05: KHLCNT approved before submitted — CRITICAL issue', () => {
    const pkg    = makePkg({ dateKhlcnt: '2026-01-20', dateKhlcntApprove: '2026-01-10' });
    const issues = detectCrossDocumentIssues(pkg);
    const khlcntIssue = issues.find(i => i.field.includes('KHLCNT'));
    expect(khlcntIssue).toBeDefined();
    expect(khlcntIssue!.severity).toBe('CRITICAL');
  });

  it('CC-06: issue references correct document IDs (doc1Id=17, doc2Id=18 for contract/result)', () => {
    const pkg    = makePkg({ dateResultApprove: '2026-03-10', dateContractSign: '2026-03-01' });
    const issues = detectCrossDocumentIssues(pkg);
    const issue  = issues.find(i => i.doc1Id === 17 && i.doc2Id === 18);
    expect(issue).toBeDefined();
    expect(issue!.description).toContain('2026-03-10');
    expect(issue!.description).toContain('2026-03-01');
  });
});

// ─── Group 2: calculateComplianceScore() ─────────────────────────────────────

describe('calculateComplianceScore()', () => {
  it('CS-01: no findings, no cross-check issues → 100', () => {
    expect(calculateComplianceScore([], [])).toBe(100);
  });

  it('CS-02: one CRITICAL finding → 75 (100 − 25)', () => {
    expect(calculateComplianceScore([makeFinding('CRITICAL')], [])).toBe(75);
  });

  it('CS-03: one HIGH finding → 85 (100 − 15)', () => {
    expect(calculateComplianceScore([makeFinding('HIGH')], [])).toBe(85);
  });

  it('CS-04: one MEDIUM + one LOW finding → 89 (100 − 8 − 3)', () => {
    expect(calculateComplianceScore([makeFinding('MEDIUM'), makeFinding('LOW')], [])).toBe(89);
  });

  it('CS-05: many CRITICAL findings — floor at 0, never negative', () => {
    const findings = Array.from({ length: 6 }, () => makeFinding('CRITICAL'));
    expect(calculateComplianceScore(findings, [])).toBe(0);
  });
});

// ─── Group 3: summarizeFindings() ─────────────────────────────────────────────

describe('summarizeFindings()', () => {
  function makeOutput(
    overrides: Partial<DossierReviewOutput>,
  ): DossierReviewOutput {
    return {
      findings:         [],
      crossCheckIssues: [],
      complianceScore:  100,
      auditReadiness:   'ready',
      recommendations:  [],
      legalBasis:       [...REVIEWER_LEGAL_BASIS],
      ...overrides,
    };
  }

  it('SF-01: auditReadiness "ready" → summary line contains score/100', () => {
    const recs = summarizeFindings(makeOutput({ complianceScore: 100, auditReadiness: 'ready' }));
    expect(recs.some(r => r.includes('100/100'))).toBe(true);
  });

  it('SF-02: auditReadiness "not-ready" → summary contains CHƯA SẴN SÀNG', () => {
    const recs = summarizeFindings(makeOutput({ complianceScore: 40, auditReadiness: 'not-ready' }));
    expect(recs.some(r => r.includes('CHƯA SẴN SÀNG'))).toBe(true);
  });

  it('SF-03: auditReadiness "conditional" → summary contains CÓ ĐIỀU KIỆN', () => {
    const recs = summarizeFindings(makeOutput({ complianceScore: 65, auditReadiness: 'conditional' }));
    expect(recs.some(r => r.includes('CÓ ĐIỀU KIỆN'))).toBe(true);
  });

  it('SF-04: duplicate P5-03 recommendations are deduplicated', () => {
    const dupRec = 'Điều chỉnh ngày tháng theo quy định tối thiểu.';
    const output = makeOutput({
      findings: [
        makeFinding('HIGH', dupRec),
        makeFinding('HIGH', dupRec),
      ],
      complianceScore: 70,
      auditReadiness:  'conditional',
    });
    const recs        = summarizeFindings(output);
    const occurrences = recs.filter(r => r.includes(dupRec));
    expect(occurrences).toHaveLength(1);
  });

  it('SF-05: cross-check issue description appears in recommendations', () => {
    const issue = makeCrossIssue('CRITICAL');
    const output = makeOutput({
      crossCheckIssues: [issue],
      complianceScore:  80,
      auditReadiness:   'not-ready',
    });
    const recs = summarizeFindings(output);
    expect(recs.some(r => r.includes(issue.description))).toBe(true);
  });
});

// ─── Group 4: reviewPackage() pure function ───────────────────────────────────

describe('reviewPackage() — dossier-level orchestrator', () => {
  it('RP-01: clean package → complianceScore=100, auditReadiness="ready"', () => {
    const output = reviewPackage({ pkg: makePkg(), documentIds: [], methodCode: 'DIRECT_SELECTION_SIMPLIFIED' });
    expect(output.complianceScore).toBe(100);
    expect(output.auditReadiness).toBe('ready');
    expect(output.findings).toHaveLength(0);
    expect(output.crossCheckIssues).toHaveLength(0);
  });

  it('RP-02: package with brand name in specs → findings include brand-locking', () => {
    const pkg = makePkg({
      items: [{
        id: 'item-2', name: 'Máy tính Dell XPS', unit: 'Bộ',
        quantity: 1, unitPrice: 50_000_000,
        specs: 'Dell XPS 15 — chip Intel Core i7, RAM 16GB',
        supplier1Price: 50_000_000, supplier2Price: 0, supplier3Price: 0,
      }],
    });
    const output = reviewPackage({ pkg, documentIds: [], methodCode: 'DIRECT_SELECTION_SIMPLIFIED' });
    expect(output.findings.some(f => f.category === 'brand-locking')).toBe(true);
  });

  it('RP-03: inverted dates → crossCheckIssues not empty', () => {
    const pkg    = makePkg({ dateResultApprove: '2026-03-10', dateContractSign: '2026-03-01' });
    const output = reviewPackage({ pkg, documentIds: [], methodCode: 'DIRECT_SELECTION_SIMPLIFIED' });
    expect(output.crossCheckIssues.length).toBeGreaterThan(0);
    expect(output.crossCheckIssues.some(c => c.severity === 'CRITICAL')).toBe(true);
  });

  it('RP-04: legalBasis always contains all REVIEWER_LEGAL_BASIS entries', () => {
    const output = reviewPackage({ pkg: makePkg(), documentIds: [], methodCode: 'DIRECT_SELECTION_SIMPLIFIED' });
    for (const basis of REVIEWER_LEGAL_BASIS) {
      expect(output.legalBasis).toContain(basis);
    }
  });

  it('RP-05: auditReadiness="not-ready" when CRITICAL finding exists (roadmap)', () => {
    // Package name keyword "đấu thầu rộng rãi" + value < 5B → LR-007 CRITICAL
    const pkg    = makePkg({ packageName: 'Đấu thầu rộng rãi thiết bị đào tạo' });
    const output = reviewPackage({ pkg, documentIds: [], methodCode: 'DIRECT_SELECTION_SIMPLIFIED' });
    expect(output.auditReadiness).toBe('not-ready');
    expect(output.findings.some(f => f.severity === 'CRITICAL')).toBe(true);
  });

  it('RP-06: recommendations non-empty for any package', () => {
    const output = reviewPackage({ pkg: makePkg(), documentIds: [], methodCode: 'DIRECT_SELECTION_SIMPLIFIED' });
    expect(output.recommendations.length).toBeGreaterThan(0);
    expect(output.recommendations.some(r => r.includes('100/100'))).toBe(true);
  });
});

// ─── Group 5: LegalReviewerAgent.process() ────────────────────────────────────

describe('LegalReviewerAgent.process()', () => {
  let registry: AgentRegistry;
  let agent:    LegalReviewerAgent;

  beforeEach(() => {
    registry = createTestRegistry();
    agent    = new LegalReviewerAgent(registry);
  });

  it('PA-01: valid request returns type="response" with preserved traceId', async () => {
    const msg      = makeReviewerRequest(makePkg(), 'trace-PA01');
    const response = await agent.process(msg);
    expect(response.type).toBe('response');
    expect(response.traceId).toBe('trace-PA01');
  });

  it('PA-02: state machine traverses all 4 transitions in correct order', async () => {
    const msg = makeReviewerRequest(makePkg(), 'trace-PA02');
    await agent.process(msg);
    const trace = registry.getTrace('trace-PA02');
    const stateEvents = trace
      .filter(m => m.type === 'event' && m.to === 'legal-reviewer')
      .map(m => (m.payload as ReviewerStateEvent).nextState);
    expect(stateEvents).toEqual([
      'reviewing-package',
      'cross-checking',
      'computing-score',
      'composing-response',
    ]);
  });

  it('PA-03: registry trace contains ≥ 6 messages after successful processing', async () => {
    const msg = makeReviewerRequest(makePkg(), 'trace-PA03');
    await agent.process(msg);
    expect(registry.getTrace('trace-PA03').length).toBeGreaterThanOrEqual(6);
  });

  it('PA-04: agent.state resets to "idle" after successful process()', async () => {
    const msg = makeReviewerRequest(makePkg(), 'trace-PA04');
    await agent.process(msg);
    expect((agent as unknown as { state: string }).state).toBe('idle');
  });

  it('PA-05: agent.state resets to "idle" after error', async () => {
    const msg: AgentMessage = {
      traceId: 'trace-PA05', from: 'user', to: 'legal-reviewer',
      type: 'request', payload: { pkg: null }, timestamp: Date.now(),
    };
    await agent.process(msg);
    expect((agent as unknown as { state: string }).state).toBe('idle');
  });

  it('PA-06: null pkg → error response with code REVIEWER_EMPTY_INPUT', async () => {
    const msg: AgentMessage = {
      traceId: 'trace-PA06', from: 'user', to: 'legal-reviewer',
      type: 'request', payload: { pkg: null }, timestamp: Date.now(),
    };
    const response = await agent.process(msg);
    expect(response.type).toBe('error');
    expect((response.payload as { code: string }).code).toBe('REVIEWER_EMPTY_INPUT');
  });

  it('PA-07: error response preserves traceId from request', async () => {
    const msg: AgentMessage = {
      traceId: 'trace-PA07', from: 'user', to: 'legal-reviewer',
      type: 'request', payload: { pkg: null }, timestamp: Date.now(),
    };
    const response = await agent.process(msg);
    expect(response.traceId).toBe('trace-PA07');
  });

  it('PA-08: success response.from === "legal-reviewer"', async () => {
    const msg      = makeReviewerRequest(makePkg(), 'trace-PA08');
    const response = await agent.process(msg);
    expect(response.from).toBe('legal-reviewer');
  });

  it('PA-09: CRITICAL cross-check issue → broadcast event appears in trace', async () => {
    // dateContractSign before dateResultApprove → CRITICAL crossCheckIssue → broadcast
    const pkg = makePkg({ dateResultApprove: '2026-03-10', dateContractSign: '2026-03-01' });
    const msg = makeReviewerRequest(pkg, 'trace-PA09');
    await agent.process(msg);
    const trace      = registry.getTrace('trace-PA09');
    const broadcasts = trace.filter(m => m.to === 'broadcast');
    expect(broadcasts.length).toBeGreaterThan(0);
  });

  it('PA-10: clean package (no CRITICAL) → no broadcast event in trace', async () => {
    const msg = makeReviewerRequest(makePkg(), 'trace-PA10');
    await agent.process(msg);
    const trace      = registry.getTrace('trace-PA10');
    const broadcasts = trace.filter(m => m.to === 'broadcast');
    expect(broadcasts).toHaveLength(0);
  });
});

// ─── Group 6: legalBasis collection and deduplication ─────────────────────────

describe('LegalReviewerAgent — legalBasis collection and deduplication', () => {
  let registry: AgentRegistry;
  let agent:    LegalReviewerAgent;

  beforeEach(() => {
    registry = createTestRegistry();
    agent    = new LegalReviewerAgent(registry);
  });

  it('LB-01: response.legalBasis includes Điều 38-41 KHLCNT foundation reference', async () => {
    const msg      = makeReviewerRequest(makePkg(), 'trace-LB01');
    const response = await agent.process(msg);
    const legalBasis = (response.payload as DossierReviewOutput).legalBasis;
    expect(legalBasis.some(b => b.includes('Điều 38-41'))).toBe(true);
  });

  it('LB-02: response.legalBasis includes Khoản 1 Điều 10 fair-competition reference', async () => {
    const msg      = makeReviewerRequest(makePkg(), 'trace-LB02');
    const response = await agent.process(msg);
    const legalBasis = (response.payload as DossierReviewOutput).legalBasis;
    expect(legalBasis.some(b => b.includes('Điều 10') && b.includes('cạnh tranh'))).toBe(true);
  });

  it('LB-03: legalBasis has no duplicate entries', async () => {
    const msg      = makeReviewerRequest(makePkg(), 'trace-LB03');
    const response = await agent.process(msg);
    const legalBasis = (response.payload as DossierReviewOutput).legalBasis;
    const unique   = new Set(legalBasis);
    expect(unique.size).toBe(legalBasis.length);
  });

  it('LB-04: clean package response.legalBasis contains all 5 REVIEWER_LEGAL_BASIS entries', async () => {
    const msg      = makeReviewerRequest(makePkg(), 'trace-LB04');
    const response = await agent.process(msg);
    const legalBasis = (response.payload as DossierReviewOutput).legalBasis;
    for (const basis of REVIEWER_LEGAL_BASIS) {
      expect(legalBasis).toContain(basis);
    }
  });
});

// ─── Group 7: Additional module constants + pure function tests ───────────────

describe('LegalReviewerAgent — additional constants and pure functions', () => {
  it('MC-04: agent.name === "Legal Reviewer Agent"', () => {
    expect(new LegalReviewerAgent(createTestRegistry()).name).toBe('Legal Reviewer Agent');
  });

  it('CS-06: CRITICAL cross-check issue deducts 20 → score 80', () => {
    expect(calculateComplianceScore([], [makeCrossIssue('CRITICAL')])).toBe(80);
  });

  it('CS-07: HIGH cross-check issue deducts 10 → score 90', () => {
    expect(calculateComplianceScore([], [makeCrossIssue('HIGH')])).toBe(90);
  });

  it('CS-08: MEDIUM cross-check issue deducts 5 → score 95', () => {
    expect(calculateComplianceScore([], [makeCrossIssue('MEDIUM')])).toBe(95);
  });

  it('CS-09: LOW cross-check issue deducts 2 → score 98', () => {
    expect(calculateComplianceScore([], [makeCrossIssue('LOW')])).toBe(98);
  });

  it('CS-10: CRITICAL finding (−25) + CRITICAL cross-check (−20) → score 55', () => {
    expect(
      calculateComplianceScore([makeFinding('CRITICAL')], [makeCrossIssue('CRITICAL')]),
    ).toBe(55);
  });

  it('CC-07: expertEstablish before khlcntApprove → HIGH issue (doc11→doc13)', () => {
    const pkg    = makePkg({ dateKhlcntApprove: '2026-01-20', dateExpertEstablish: '2026-01-10' });
    const issues = detectCrossDocumentIssues(pkg);
    const issue  = issues.find(i => i.doc1Id === 11 && i.doc2Id === 13);
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('HIGH');
  });

  it('CC-08: docIssue before expertEstablish → CRITICAL issue (doc13→doc12)', () => {
    const pkg    = makePkg({ dateExpertEstablish: '2026-02-10', dateDocIssue: '2026-02-01' });
    const issues = detectCrossDocumentIssues(pkg);
    const issue  = issues.find(i => i.doc1Id === 13 && i.doc2Id === 12);
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('CRITICAL');
  });

  it('CC-09: bidClose before docIssue → CRITICAL issue (doc12→doc28)', () => {
    const pkg    = makePkg({ dateDocIssue: '2026-02-20', dateBidClose: '2026-02-10' });
    const issues = detectCrossDocumentIssues(pkg);
    const issue  = issues.find(i => i.doc1Id === 12 && i.doc2Id === 28);
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('CRITICAL');
  });

  it('RP-07: HIGH-only cross-check issue → auditReadiness="conditional"', () => {
    // evaluate (Feb 25) after appraise (Feb 15) → HIGH cross-check, no CRITICAL
    const pkg    = makePkg({ dateEvaluate: '2026-02-25', dateAppraise: '2026-02-15' });
    const output = reviewPackage({ pkg, documentIds: [], methodCode: 'DIRECT_SELECTION_SIMPLIFIED' });
    expect(output.auditReadiness).toBe('conditional');
    expect(output.crossCheckIssues.some(c => c.severity === 'HIGH')).toBe(true);
  });
});

// ─── Group 8: Additional process() + legalBasis tests ─────────────────────────

describe('LegalReviewerAgent — additional process() and legalBasis', () => {
  let registry: AgentRegistry;
  let agent:    LegalReviewerAgent;

  beforeEach(() => {
    registry = createTestRegistry();
    agent    = new LegalReviewerAgent(registry);
  });

  it('PA-11: agent.state is "idle" before any process() call', () => {
    expect((agent as unknown as { state: string }).state).toBe('idle');
  });

  it('PA-12: null payload → error with code REVIEWER_EMPTY_INPUT', async () => {
    const msg: AgentMessage = {
      traceId:   'trace-PA12',
      from:      'user',
      to:        'legal-reviewer',
      type:      'request',
      payload:   null,
      timestamp: Date.now(),
    };
    const response = await agent.process(msg);
    expect(response.type).toBe('error');
    expect((response.payload as { code: string }).code).toBe('REVIEWER_EMPTY_INPUT');
  });

  it('PA-13: consecutive sequential process() calls both return type="response"', async () => {
    const msg1 = makeReviewerRequest(makePkg(), 'trace-PA13a');
    const msg2 = makeReviewerRequest(makePkg(), 'trace-PA13b');
    const r1   = await agent.process(msg1);
    const r2   = await agent.process(msg2);
    expect(r1.type).toBe('response');
    expect(r2.type).toBe('response');
  });

  it('PA-14: response.payload is DossierReviewOutput with all required fields', async () => {
    const msg    = makeReviewerRequest(makePkg(), 'trace-PA14');
    const resp   = await agent.process(msg);
    const output = resp.payload as DossierReviewOutput;
    expect(output).toHaveProperty('findings');
    expect(output).toHaveProperty('crossCheckIssues');
    expect(output).toHaveProperty('complianceScore');
    expect(output).toHaveProperty('auditReadiness');
    expect(output).toHaveProperty('recommendations');
    expect(output).toHaveProperty('legalBasis');
  });

  it('LB-05: response.legalBasis (AgentMessage level) includes all REVIEWER_LEGAL_BASIS entries', async () => {
    const msg      = makeReviewerRequest(makePkg(), 'trace-LB05');
    const response = await agent.process(msg);
    for (const basis of REVIEWER_LEGAL_BASIS) {
      expect(response.legalBasis).toContain(basis);
    }
  });

  it('LB-06: response.legalBasis (AgentMessage level) has no duplicate entries', async () => {
    const msg      = makeReviewerRequest(makePkg(), 'trace-LB06');
    const response = await agent.process(msg);
    const lb       = response.legalBasis ?? [];
    expect(new Set(lb).size).toBe(lb.length);
  });

  it('SF-06: summarizeFindings includes [CRITICAL] severity tag for critical findings', () => {
    const output: DossierReviewOutput = {
      findings:         [makeFinding('CRITICAL', 'Khắc phục vi phạm ngay.')],
      crossCheckIssues: [],
      complianceScore:  75,
      auditReadiness:   'not-ready',
      recommendations:  [],
      legalBasis:       [...REVIEWER_LEGAL_BASIS],
    };
    const recs = summarizeFindings(output);
    expect(recs.some(r => r.includes('[CRITICAL]'))).toBe(true);
  });
});
