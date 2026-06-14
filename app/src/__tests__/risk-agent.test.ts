/**
 * P6-04D: RiskAgent test suite
 *
 * Coverage:
 *   Group 0 — Module constants and capabilities          (4 tests,  MC-01..MC-04)
 *   Group 1 — detectSystemicRisks()                      (6 tests,  DS-01..DS-06)
 *   Group 2 — buildRiskMatrix()                          (8 tests,  RM-01..RM-08)
 *   Group 3 — calculateAuditExposure()                   (5 tests,  AE-01..AE-05)
 *   Group 4 — buildMitigationPlan()                      (5 tests,  MP-01..MP-05)
 *   Group 5 — RiskAgent.process()                        (10 tests, PA-01..PA-10)
 *   Group 6 — legalBasis collection and deduplication    (5 tests,  LB-01..LB-05)
 *
 * No vi.fn() / vi.mock() on P5 functions.  All P5 modules used read-only.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { AgentRegistry } from '../agents/AgentRegistry';
import {
  detectSystemicRisks,
  buildRiskMatrix,
  calculateAuditExposure,
  buildMitigationPlan,
  RISK_LEGAL_BASIS,
  RiskAgent,
} from '../agents/RiskAgent';

import type {
  RiskInput,
  RiskOutput,
  SystemicRisk,
  OverallRisk,
  RiskStateEvent,
} from '../agents/RiskAgent';
import type { AgentMessage }            from '../agents/types';
import type {
  LegalFinding,
  Severity,
  CrossCheckIssue,
  DossierReviewOutput,
} from '../agents/LegalReviewerAgent';
import type { ProcurementPackage }      from '../demoData';
import type { PlannerOutput }           from '../agents/PlannerAgent';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * Returns a fully-populated ProcurementPackage with all dates in valid
 * sequence, goods_consumable type, and clean (brand-free) specs.
 * Produces 0 P5-03 findings and 0 cross-check issues.
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
    dateProposal:         '2026-01-05',
    dateSurvey:           '2026-01-07',
    dateQuotes:           '2026-01-07',
    dateCompare:          '2026-01-07',
    dateKhlcnt:           '2026-01-10',
    dateKhlcntApprove:    '2026-01-15',
    dateExpertEstablish:  '2026-01-20',
    dateDocIssue:         '2026-02-01',
    dateBidClose:         '2026-02-10',
    dateEvaluate:         '2026-02-15',
    dateAppraise:         '2026-02-20',
    dateResultProposal:   '2026-02-22',
    dateResultApprove:    '2026-02-25',
    dateContractSign:     '2026-03-01',
    dateDelivery:         '2026-03-15',
    dateAcceptance:       '2026-03-20',
    dateLiquidation:      '2026-04-01',
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

/** Minimal LegalFinding for pure-function tests. */
function makeLegalFinding(
  severity: Severity,
  overrides: Partial<LegalFinding> = {},
): LegalFinding {
  return {
    severity,
    code:           'LR-TEST-001',
    category:       'brand-locking',
    field:          'specs',
    message:        'Phát hiện tên thương hiệu trong yêu cầu kỹ thuật.',
    legalBasis:     'Điều 44 khoản 7 Luật Đấu thầu 22/2023/QH15 — không khóa thương hiệu, không hạn chế xuất xứ',
    recommendation: 'Thay thế tên thương hiệu bằng thông số kỹ thuật chức năng.',
    ...overrides,
  };
}

/** Minimal CrossCheckIssue for pure-function tests. */
function makeCrossIssue(severity: Severity): CrossCheckIssue {
  return {
    severity,
    doc1Id:      17,
    doc2Id:      18,
    field:       'Ngày phê duyệt kết quả (Doc 17) → Ngày ký hợp đồng (Doc 18)',
    description: 'Ngày phê duyệt kết quả phải trước ngày ký hợp đồng.',
  };
}

/** Clean DossierReviewOutput with no findings or issues (complianceScore=100). */
function makeCleanDossierReview(): DossierReviewOutput {
  return {
    findings:         [],
    crossCheckIssues: [],
    complianceScore:  100,
    auditReadiness:   'ready',
    recommendations:  [],
    legalBasis:       [
      'Điều 38-41 Luật Đấu thầu 22/2023/QH15 — lập và phê duyệt kế hoạch lựa chọn nhà thầu',
    ],
  };
}

/** Minimal PlannerOutput for integration tests. */
function makePlannerOutput(overrides: Partial<PlannerOutput> = {}): PlannerOutput {
  return {
    packages:          [],
    splitWarnings:     [],
    authorityChecks:   [],
    calendar:          { items: [], totalDays: 0 } as PlannerOutput['calendar'],
    totalEstimated:    100_000_000,
    budgetUtilization: -1,
    legalBasis:        ['Điều 38-41 Luật Đấu thầu 22/2023/QH15 — lập và phê duyệt KHLCNT'],
    confidence:        'high',
    warnings:          [],
    ...overrides,
  };
}

/** Builds an AgentMessage request targeting the risk agent. */
function makeRiskRequest(
  pkg:           ProcurementPackage,
  dossierReview: DossierReviewOutput,
  traceId:       string,
  overrides:     Partial<RiskInput> = {},
): AgentMessage {
  const payload: RiskInput = { pkg, dossierReview, ...overrides };
  return {
    traceId,
    from:      'user',
    to:        'risk',
    type:      'request',
    payload,
    timestamp: Date.now(),
  };
}

function createTestRegistry(): AgentRegistry {
  return new AgentRegistry();
}

// ─── Group 0: Module constants and capabilities ───────────────────────────────

describe('RiskAgent — module constants and capabilities', () => {
  it('MC-01: RISK_LEGAL_BASIS contains exactly 5 citations', () => {
    expect(RISK_LEGAL_BASIS).toHaveLength(5);
  });

  it('MC-02: RISK_LEGAL_BASIS includes Điều 44 khoản 6 (split prohibition)', () => {
    expect(RISK_LEGAL_BASIS.some(b => b.includes('khoản 6') && b.includes('chia nhỏ'))).toBe(true);
  });

  it('MC-03: getCapabilities() returns ≥ 5 capability strings', () => {
    const agent = new RiskAgent(createTestRegistry());
    expect(agent.getCapabilities().length).toBeGreaterThanOrEqual(5);
  });

  it('MC-04: agent.id === "risk"', () => {
    const agent = new RiskAgent(createTestRegistry());
    expect(agent.id).toBe('risk');
  });
});

// ─── Group 1: detectSystemicRisks() ──────────────────────────────────────────

describe('detectSystemicRisks()', () => {
  it('DS-01: empty list → no systemic risks', () => {
    expect(detectSystemicRisks([])).toHaveLength(0);
  });

  it('DS-02: single package → no systemic risks (minimum 2 required)', () => {
    expect(detectSystemicRisks([makePkg()])).toHaveLength(0);
  });

  it('DS-03: 3 packages same packageType + same dateResultApprove → CRITICAL risk (roadmap)', () => {
    const base = { packageType: 'goods_consumable' as const, dateResultApprove: '2026-02-25' };
    const pkgs = [
      makePkg({ ...base, packageName: 'Gói A' }),
      makePkg({ ...base, packageName: 'Gói B' }),
      makePkg({ ...base, packageName: 'Gói C' }),
    ];
    const risks      = detectSystemicRisks(pkgs);
    const syncRisk   = risks.find(r => r.severity === 'CRITICAL');
    expect(syncRisk).toBeDefined();
    expect(syncRisk!.occurrences).toBe(3);
    expect(syncRisk!.affectedIds).toHaveLength(3);
  });

  it('DS-04: 2 packages same packageType + same dateResultApprove → HIGH (not CRITICAL)', () => {
    const base = { packageType: 'goods_consumable' as const, dateResultApprove: '2026-02-25' };
    const pkgs = [
      makePkg({ ...base, packageName: 'Gói A' }),
      makePkg({ ...base, packageName: 'Gói B' }),
    ];
    const risks    = detectSystemicRisks(pkgs);
    const twoGroup = risks.find(r => r.occurrences === 2);
    expect(twoGroup).toBeDefined();
    expect(twoGroup!.severity).toBe('HIGH');
  });

  it('DS-05: same real supplier1Name in ≥3 packages → MEDIUM risk', () => {
    const supplier = 'Công ty TNHH Thiết bị Giáo dục ABC';   // non-placeholder
    const pkgs = [
      makePkg({ packageName: 'Gói A', supplier1Name: supplier }),
      makePkg({ packageName: 'Gói B', supplier1Name: supplier }),
      makePkg({ packageName: 'Gói C', supplier1Name: supplier }),
    ];
    const risks        = detectSystemicRisks(pkgs);
    const supplierRisk = risks.find(r => r.severity === 'MEDIUM');
    expect(supplierRisk).toBeDefined();
    expect(supplierRisk!.occurrences).toBe(3);
  });

  it('DS-06: placeholder supplier1Name starting with "[" → supplier pattern not triggered', () => {
    const pkgs = [
      makePkg({ packageName: 'Gói A', supplier1Name: '[Nhà cung cấp số 1]' }),
      makePkg({ packageName: 'Gói B', supplier1Name: '[Nhà cung cấp số 1]' }),
      makePkg({ packageName: 'Gói C', supplier1Name: '[Nhà cung cấp số 1]' }),
    ];
    const risks = detectSystemicRisks(pkgs);
    // Placeholder "[Nhà cung cấp số 1]" must be skipped — no MEDIUM supplier risk
    expect(risks.every(r => r.severity !== 'MEDIUM')).toBe(true);
  });
});

// ─── Group 2: buildRiskMatrix() ──────────────────────────────────────────────

describe('buildRiskMatrix()', () => {
  it('RM-01: empty dossierReview → empty matrix', () => {
    expect(buildRiskMatrix(makeCleanDossierReview())).toHaveLength(0);
  });

  it('RM-02: CRITICAL finding → likelihood=5, impact=5, riskScore=25', () => {
    const review = { ...makeCleanDossierReview(), findings: [makeLegalFinding('CRITICAL')] };
    const matrix = buildRiskMatrix(review);
    expect(matrix).toHaveLength(1);
    expect(matrix[0].likelihood).toBe(5);
    expect(matrix[0].impact).toBe(5);
    expect(matrix[0].riskScore).toBe(25);
  });

  it('RM-03: HIGH finding → riskScore=16 (4×4)', () => {
    const review = { ...makeCleanDossierReview(), findings: [makeLegalFinding('HIGH')] };
    const matrix = buildRiskMatrix(review);
    expect(matrix[0].riskScore).toBe(16);
  });

  it('RM-04: brand-locking finding → category="legal"', () => {
    const review = {
      ...makeCleanDossierReview(),
      findings: [makeLegalFinding('HIGH', { category: 'brand-locking' })],
    };
    expect(buildRiskMatrix(review)[0].category).toBe('legal');
  });

  it('RM-05: date-gap finding → category="timeline"', () => {
    const review = {
      ...makeCleanDossierReview(),
      findings: [makeLegalFinding('HIGH', { category: 'date-gap' })],
    };
    expect(buildRiskMatrix(review)[0].category).toBe('timeline');
  });

  it('RM-06: riskMatrix sorted by riskScore descending (roadmap)', () => {
    const review = {
      ...makeCleanDossierReview(),
      findings: [
        makeLegalFinding('LOW'),       // riskScore 4
        makeLegalFinding('CRITICAL'),  // riskScore 25
        makeLegalFinding('MEDIUM'),    // riskScore 9
      ],
    };
    const matrix = buildRiskMatrix(review);
    for (let i = 0; i < matrix.length - 1; i++) {
      expect(matrix[i].riskScore).toBeGreaterThanOrEqual(matrix[i + 1].riskScore);
    }
    expect(matrix[0].riskScore).toBe(25);
  });

  it('RM-07: CrossCheckIssue (doc1Id=17, doc2Id=18) → synthetic entry with code "CC-17-18", category="timeline"', () => {
    const review = {
      ...makeCleanDossierReview(),
      crossCheckIssues: [makeCrossIssue('CRITICAL')],
    };
    const matrix  = buildRiskMatrix(review);
    const ccEntry = matrix.find(e => e.finding.code.startsWith('CC-'));
    expect(ccEntry).toBeDefined();
    expect(ccEntry!.finding.code).toBe('CC-17-18');
    expect(ccEntry!.category).toBe('timeline');
    expect(ccEntry!.riskScore).toBe(25);   // CRITICAL → 5×5
  });

  it('RM-08: plannerOutput.splitWarnings included in matrix as "legal" category entries', () => {
    const splitWarning = makeLegalFinding('HIGH', {
      code:     'PA-001',
      category: 'split-detection',
      message:  'Nguy cơ chia nhỏ gói thầu.',
    });
    const plannerOutput = makePlannerOutput({ splitWarnings: [splitWarning] });
    const matrix        = buildRiskMatrix(makeCleanDossierReview(), plannerOutput);
    const splitEntry    = matrix.find(e => e.finding.code === 'PA-001');
    expect(splitEntry).toBeDefined();
    expect(splitEntry!.category).toBe('legal');
    expect(splitEntry!.riskScore).toBe(16);   // HIGH → 4×4
  });
});

// ─── Group 3: calculateAuditExposure() ───────────────────────────────────────

describe('calculateAuditExposure()', () => {
  it('AE-01: CRITICAL overallRisk → probability="high"', () => {
    expect(calculateAuditExposure([], 'CRITICAL').probability).toBe('high');
  });

  it('AE-02: HIGH overallRisk → probability="medium"', () => {
    expect(calculateAuditExposure([], 'HIGH').probability).toBe('medium');
  });

  it('AE-03: MEDIUM / LOW / CLEAN → probability="low"', () => {
    const levels: OverallRisk[] = ['MEDIUM', 'LOW', 'CLEAN'];
    for (const level of levels) {
      expect(calculateAuditExposure([], level).probability).toBe('low');
    }
  });

  it('AE-04: potentialFindings includes CRITICAL/HIGH messages but excludes LOW', () => {
    const review = {
      ...makeCleanDossierReview(),
      findings: [
        makeLegalFinding('CRITICAL', { code: 'LR-C01', message: 'Vi phạm nghiêm trọng về thương hiệu.' }),
        makeLegalFinding('LOW',      { code: 'LR-L01', message: 'Thiếu thông tin không quan trọng.' }),
      ],
    };
    const matrix               = buildRiskMatrix(review);
    const { potentialFindings } = calculateAuditExposure(matrix, 'CRITICAL');
    expect(potentialFindings.some(f => f.includes('LR-C01'))).toBe(true);
    expect(potentialFindings.some(f => f.includes('LR-L01'))).toBe(false);
  });

  it('AE-05: estimatedImpact is a non-empty Vietnamese string for every risk level', () => {
    const levels: OverallRisk[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'CLEAN'];
    for (const level of levels) {
      const { estimatedImpact } = calculateAuditExposure([], level);
      expect(estimatedImpact.length).toBeGreaterThan(0);
    }
  });
});

// ─── Group 4: buildMitigationPlan() ──────────────────────────────────────────

describe('buildMitigationPlan()', () => {
  it('MP-01: empty inputs → empty plan', () => {
    expect(buildMitigationPlan([], [])).toHaveLength(0);
  });

  it('MP-02: steps assigned priority 1, 2, 3, … (riskMatrix order preserved)', () => {
    const review = {
      ...makeCleanDossierReview(),
      findings: [
        makeLegalFinding('CRITICAL', { recommendation: 'Sửa lỗi thương hiệu ngay.' }),
        makeLegalFinding('LOW',      { recommendation: 'Bổ sung thông tin còn thiếu.' }),
      ],
    };
    const matrix = buildRiskMatrix(review);
    const steps  = buildMitigationPlan(matrix, []);
    expect(steps[0].priority).toBe(1);
    expect(steps[1].priority).toBe(2);
  });

  it('MP-03: duplicate recommendation texts are deduplicated (appear only once)', () => {
    const dupRec = 'Thay thế tên thương hiệu bằng thông số kỹ thuật chức năng.';
    const review = {
      ...makeCleanDossierReview(),
      findings: [
        makeLegalFinding('CRITICAL', { recommendation: dupRec }),
        makeLegalFinding('HIGH',     { recommendation: dupRec }),
      ],
    };
    const matrix = buildRiskMatrix(review);
    const steps  = buildMitigationPlan(matrix, []);
    expect(steps.filter(s => s.action === dupRec)).toHaveLength(1);
  });

  it('MP-04: CRITICAL/HIGH entries → responsible="[Tổ trưởng tổ chuyên gia]"', () => {
    const review = { ...makeCleanDossierReview(), findings: [makeLegalFinding('CRITICAL')] };
    const matrix = buildRiskMatrix(review);
    const steps  = buildMitigationPlan(matrix, []);
    expect(steps[0].responsible).toBe('[Tổ trưởng tổ chuyên gia]');
  });

  it('MP-05: CRITICAL systemic risk adds step with "[Tổ trưởng thẩm định độc lập]"', () => {
    const systemicRisk: SystemicRisk = {
      pattern:        '3 gói thầu cùng loại có ngày phê duyệt kết quả trùng nhau',
      severity:       'CRITICAL',
      occurrences:    3,
      affectedIds:    ['Gói A', 'Gói B', 'Gói C'],
      recommendation: 'Kiểm tra tính độc lập giữa các quy trình phê duyệt.',
    };
    const steps        = buildMitigationPlan([], [systemicRisk]);
    const systemicStep = steps.find(s => s.responsible === '[Tổ trưởng thẩm định độc lập]');
    expect(systemicStep).toBeDefined();
    expect(systemicStep!.riskCodes).toContain('SYSTEMIC-CRITICAL');
  });
});

// ─── Group 5: RiskAgent.process() ────────────────────────────────────────────

describe('RiskAgent.process()', () => {
  let registry: AgentRegistry;
  let agent:    RiskAgent;

  beforeEach(() => {
    registry = createTestRegistry();
    agent    = new RiskAgent(registry);
  });

  it('PA-01: valid request → type="response" with preserved traceId', async () => {
    const msg      = makeRiskRequest(makePkg(), makeCleanDossierReview(), 'trace-PA01');
    const response = await agent.process(msg);
    expect(response.type).toBe('response');
    expect(response.traceId).toBe('trace-PA01');
  });

  it('PA-02: state machine traverses all 4 transitions in correct order', async () => {
    const msg = makeRiskRequest(makePkg(), makeCleanDossierReview(), 'trace-PA02');
    await agent.process(msg);
    const trace = registry.getTrace('trace-PA02');
    const stateEvents = trace
      .filter(m => m.type === 'event' && m.to === 'risk')
      .map(m => (m.payload as RiskStateEvent).nextState);
    expect(stateEvents).toEqual([
      'assessing-risk',
      'detecting-systemic',
      'computing-matrix',
      'composing-response',
    ]);
  });

  it('PA-03: trace contains ≥ 6 messages after successful process()', async () => {
    const msg = makeRiskRequest(makePkg(), makeCleanDossierReview(), 'trace-PA03');
    await agent.process(msg);
    expect(registry.getTrace('trace-PA03').length).toBeGreaterThanOrEqual(6);
  });

  it('PA-04: agent.state resets to "idle" after success', async () => {
    const msg = makeRiskRequest(makePkg(), makeCleanDossierReview(), 'trace-PA04');
    await agent.process(msg);
    expect((agent as unknown as { state: string }).state).toBe('idle');
  });

  it('PA-05: agent.state resets to "idle" after error (null pkg)', async () => {
    const msg: AgentMessage = {
      traceId: 'trace-PA05', from: 'user', to: 'risk',
      type: 'request',
      payload: { pkg: null, dossierReview: makeCleanDossierReview() },
      timestamp: Date.now(),
    };
    await agent.process(msg);
    expect((agent as unknown as { state: string }).state).toBe('idle');
  });

  it('PA-06: null pkg → error with code RISK_EMPTY_INPUT', async () => {
    const msg: AgentMessage = {
      traceId: 'trace-PA06', from: 'user', to: 'risk',
      type: 'request',
      payload: { pkg: null, dossierReview: makeCleanDossierReview() },
      timestamp: Date.now(),
    };
    const response = await agent.process(msg);
    expect(response.type).toBe('error');
    expect((response.payload as { code: string }).code).toBe('RISK_EMPTY_INPUT');
  });

  it('PA-07: null dossierReview → error with code RISK_EMPTY_INPUT', async () => {
    const msg: AgentMessage = {
      traceId: 'trace-PA07', from: 'user', to: 'risk',
      type: 'request',
      payload: { pkg: makePkg(), dossierReview: null },
      timestamp: Date.now(),
    };
    const response = await agent.process(msg);
    expect(response.type).toBe('error');
    expect((response.payload as { code: string }).code).toBe('RISK_EMPTY_INPUT');
  });

  it('PA-08: error response preserves traceId from request', async () => {
    const msg: AgentMessage = {
      traceId: 'trace-PA08', from: 'user', to: 'risk',
      type: 'request',
      payload: { pkg: null, dossierReview: null },
      timestamp: Date.now(),
    };
    const response = await agent.process(msg);
    expect(response.traceId).toBe('trace-PA08');
  });

  it('PA-09: response.from === "risk"', async () => {
    const msg      = makeRiskRequest(makePkg(), makeCleanDossierReview(), 'trace-PA09');
    const response = await agent.process(msg);
    expect(response.from).toBe('risk');
  });

  it('PA-10: 3 packages with same type + same dateResultApprove → CRITICAL systemic risk broadcast', async () => {
    const base = { packageType: 'goods_consumable' as const, dateResultApprove: '2026-02-25' };
    const msg  = makeRiskRequest(
      makePkg({ ...base }),
      makeCleanDossierReview(),
      'trace-PA10',
      {
        historicalPackages: [
          makePkg({ ...base, packageName: 'Gói B lịch sử' }),
          makePkg({ ...base, packageName: 'Gói C lịch sử' }),
        ],
      },
    );
    await agent.process(msg);
    const trace      = registry.getTrace('trace-PA10');
    const broadcasts = trace.filter(m => m.to === 'broadcast');
    expect(broadcasts.length).toBeGreaterThan(0);
    const payload = broadcasts[0].payload as { systemicRisks: SystemicRisk[] };
    expect(payload.systemicRisks[0].severity).toBe('CRITICAL');
  });
});

// ─── Group 6: legalBasis collection and deduplication ─────────────────────────

describe('RiskAgent — legalBasis collection and deduplication', () => {
  let registry: AgentRegistry;
  let agent:    RiskAgent;

  beforeEach(() => {
    registry = createTestRegistry();
    agent    = new RiskAgent(registry);
  });

  it('LB-01: response.legalBasis includes all 5 RISK_LEGAL_BASIS entries', async () => {
    const msg      = makeRiskRequest(makePkg(), makeCleanDossierReview(), 'trace-LB01');
    const response = await agent.process(msg);
    const lb       = (response.payload as RiskOutput).legalBasis;
    for (const basis of RISK_LEGAL_BASIS) {
      expect(lb).toContain(basis);
    }
  });

  it('LB-02: response.legalBasis includes dossierReview.legalBasis (P6-03 citations)', async () => {
    const p6_03_basis = 'Điều 38-41 Luật Đấu thầu 22/2023/QH15 — lập và phê duyệt kế hoạch lựa chọn nhà thầu';
    const review      = { ...makeCleanDossierReview(), legalBasis: [p6_03_basis] };
    const msg         = makeRiskRequest(makePkg(), review, 'trace-LB02');
    const response    = await agent.process(msg);
    const lb          = (response.payload as RiskOutput).legalBasis;
    expect(lb).toContain(p6_03_basis);
  });

  it('LB-03: response.legalBasis has no duplicate entries', async () => {
    // Use a basis already in RISK_LEGAL_BASIS to force a potential duplicate
    const sharedBasis = 'Điều 44 khoản 7 Luật Đấu thầu 22/2023/QH15 — không khóa thương hiệu, không hạn chế xuất xứ';
    const review = {
      ...makeCleanDossierReview(),
      findings:  [makeLegalFinding('HIGH', { legalBasis: sharedBasis })],
      legalBasis: [sharedBasis],
    };
    const msg      = makeRiskRequest(makePkg(), review, 'trace-LB03');
    const response = await agent.process(msg);
    const lb       = (response.payload as RiskOutput).legalBasis;
    expect(new Set(lb).size).toBe(lb.length);
  });

  it('LB-04: plannerOutput.legalBasis entries merged into response.legalBasis', async () => {
    const plannerBasis  = 'Điều 38-41 Luật Đấu thầu 22/2023/QH15 — lập và phê duyệt KHLCNT (P6-01 citation)';
    const plannerOutput = makePlannerOutput({ legalBasis: [plannerBasis] });
    const msg = makeRiskRequest(
      makePkg(),
      makeCleanDossierReview(),
      'trace-LB04',
      { plannerOutput },
    );
    const response = await agent.process(msg);
    const lb       = (response.payload as RiskOutput).legalBasis;
    expect(lb).toContain(plannerBasis);
  });

  it('LB-05: finding.legalBasis from riskMatrix entries included in response.legalBasis', async () => {
    const findingBasis = 'Điều 81 Nghị định 214/2025/NĐ-CP — khoảng cách thời gian tối thiểu giữa các bước';
    const review = {
      ...makeCleanDossierReview(),
      findings: [makeLegalFinding('HIGH', { legalBasis: findingBasis })],
    };
    const msg      = makeRiskRequest(makePkg(), review, 'trace-LB05');
    const response = await agent.process(msg);
    const lb       = (response.payload as RiskOutput).legalBasis;
    expect(lb).toContain(findingBasis);
  });
});
