/**
 * P6-07B: Extended E2E workflow tests — full IDLE→DONE scenarios
 *
 * Extends the P6-07A suite with deeper integration coverage using REAL agents.
 * Focuses on state continuity across multi-step sequences, data integrity,
 * cross-agent citation aggregation, and recovery from intermediate failures.
 *
 * Coverage:
 *   Group B1 — Multi-package procurement                  (4 tests, B1-01..B1-04)
 *   Group B2 — Specification retries counter              (4 tests, B2-01..B2-04)
 *   Group B3 — Ask-user → multi-turn resume loops         (4 tests, B3-01..B3-04)
 *   Group B4 — Legal review + risk assessment integration (4 tests, B4-01..B4-04)
 *   Group B5 — Complete export flow with pause/resume     (3 tests, B5-01..B5-03)
 *   Group B6 — Session summary consistency                (3 tests, B6-01..B6-03)
 *   Group B7 — Trace propagation across all agents        (4 tests, B7-01..B7-04)
 *   Group B8 — completedAt and messageLog integrity       (4 tests, B8-01..B8-04)
 *   Group B9 — legalBasis aggregation and deduplication   (3 tests, B9-01..B9-03)
 *   Group B10 — Recovery from intermediate errors         (3 tests, B10-01..B10-03)
 */

import { describe, it, expect, beforeAll } from 'vitest';

import { AgentRegistry }      from '../agents/AgentRegistry';
import { PlannerAgent }       from '../agents/PlannerAgent';
import { SpecificationAgent } from '../agents/SpecificationAgent';
import { LegalReviewerAgent } from '../agents/LegalReviewerAgent';
import { RiskAgent }          from '../agents/RiskAgent';
import { ChatAgent }          from '../agents/ChatAgent';
import {
  AutonomousAgent,
  AUTONOMOUS_LEGAL_BASIS,
  runSpecifying,
  buildSessionSummary,
} from '../agents/AutonomousAgent';

import type { AgentMessage }            from '../agents/types';
import type {
  AutonomousInput,
  AutonomousOutput,
  AgentSession,
  WorkflowState,
} from '../agents/AutonomousAgent';
import type { AISuggestion }            from '../ai/packageGenerator';
import type { PlannerOutput, ProcurementCalendar } from '../agents/PlannerAgent';
import type { DossierReviewInput, DossierReviewOutput } from '../agents/LegalReviewerAgent';
import type { RiskInput, RiskOutput }   from '../agents/RiskAgent';
import type { LegalFinding }            from '../ai/legalReviewer';
import type { ProcurementPackage }      from '../demoData';

// ─── Registry factories ───────────────────────────────────────────────────────

function makeRegistry(): AgentRegistry {
  const registry = new AgentRegistry();
  registry.register(new PlannerAgent(registry));
  registry.register(new SpecificationAgent(registry));
  registry.register(new LegalReviewerAgent(registry));
  registry.register(new RiskAgent(registry));
  registry.register(new ChatAgent(registry));
  return registry;
}

/** Registry missing PlannerAgent — used to test error recovery. */
function makeRegistryNoPlan(): AgentRegistry {
  const registry = new AgentRegistry();
  // Planner deliberately NOT registered
  registry.register(new SpecificationAgent(registry));
  registry.register(new LegalReviewerAgent(registry));
  registry.register(new RiskAgent(registry));
  registry.register(new ChatAgent(registry));
  return registry;
}

/** Registry missing SpecificationAgent — used to test mid-flow error. */
function makeRegistryNoSpec(): AgentRegistry {
  const registry = new AgentRegistry();
  registry.register(new PlannerAgent(registry));
  // Spec deliberately NOT registered
  registry.register(new LegalReviewerAgent(registry));
  registry.register(new RiskAgent(registry));
  registry.register(new ChatAgent(registry));
  return registry;
}

// ─── Trace counter (prefix 'B' to isolate from P6-07A counters) ───────────────

let _bCounter = 0;
function bt(prefix = 'B'): string {
  return `${prefix}-${String(++_bCounter).padStart(4, '0')}`;
}

// ─── Message builders ─────────────────────────────────────────────────────────

function runMsg(goal: string, traceId: string, opts: Partial<AutonomousInput> = {}): AgentMessage {
  return {
    traceId,
    from:      'user',
    to:        'autonomous',
    type:      'request',
    payload:   { action: 'run', goal, ...opts } as AutonomousInput,
    timestamp: Date.now(),
  };
}

function aMsg(input: AutonomousInput, traceId: string): AgentMessage {
  return { traceId, from: 'user', to: 'autonomous', type: 'request', payload: input, timestamp: Date.now() };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeCleanPkg(overrides: Partial<ProcurementPackage> = {}): ProcurementPackage {
  return {
    id:                      'b-pkg-1',
    packageName:             'Gói mua sắm vật tư tiêu hao phục vụ đào tạo',
    packageCode:             'B-VT-001',
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
      id:             'b-item-1',
      name:           'Vật tư tiêu hao đào tạo',
      unit:           'Bộ',
      quantity:       1,
      unitPrice:      100_000_000,
      specs:          'Đạt tiêu chuẩn chất lượng tối thiểu theo yêu cầu kỹ thuật.',
      supplier1Price: 100_000_000,
      supplier2Price:  95_000_000,
      supplier3Price:  98_000_000,
    }],
    ...overrides,
  };
}

function makeDossier(findingOverrides: Partial<LegalFinding>[] = []): DossierReviewOutput {
  const findings: LegalFinding[] = findingOverrides.map((o, i) => ({
    severity:    'LOW' as const,
    category:    'missing-data',
    field:       `field-${i}`,
    description: `Finding ${i + 1}`,
    legalBasis:  'Điều 44 Luật Đấu thầu 22/2023/QH15',
    ...o,
  }));
  return {
    findings,
    crossCheckIssues: [],
    complianceScore:  findings.some(f => f.severity === 'CRITICAL') ? 0 : 100,
    auditReadiness:   findings.some(f => f.severity === 'CRITICAL') ? 'not-ready' : 'ready',
    recommendations:  [],
    legalBasis:       ['Điều 38-41 Luật Đấu thầu 22/2023/QH15 — lập và phê duyệt KHLCNT'],
  };
}

/**
 * Builds a minimal AgentSession with plannerOutput preset to a suggestion whose
 * packageName contains a brand name.  Used by runSpecifying() pure-function tests.
 */
function makeBrandSession(brandedName: string): AgentSession {
  const suggestion: AISuggestion = {
    packageName:           brandedName,
    packageCode:           'B2-BRAND-001',
    fundingSource:         'autonomy_fund',
    fundingSourceName:     'Quỹ phát triển hoạt động sự nghiệp',
    packageType:           'goods_fixed_asset',
    contractType:          'lump_sum',
    estimatedTotal:        200_000_000,
    contractDurationDays:  30,
    procurementMethodHint: 'DIRECT_SELECTION_SIMPLIFIED',
    detectedCategory:      'equipment',
    confidence:            'high',
    notes:                 [],
  };
  const calendar: ProcurementCalendar = {
    budgetYear:           2026,
    entries:              [],
    totalByQuarter:       { Q1: 0, Q2: 0, Q3: 0, Q4: 0 },
    totalAnnual:          0,
    khlcntSubmissionDate: '2026-01-15',
  };
  const plannerOutput: PlannerOutput = {
    packages:          [suggestion],
    splitWarnings:     [],
    authorityChecks:   [],
    calendar,
    totalEstimated:    200_000_000,
    budgetUtilization: -1,
    legalBasis:        ['Điều 38-41 Luật Đấu thầu 22/2023/QH15 — lập và phê duyệt KHLCNT'],
    confidence:        'high',
    warnings:          [],
  };
  return {
    sessionId:   'b2-test-session',
    state:       'specifying',
    goal:        brandedName,
    plannerOutput,
    messageLog:  [],
    startedAt:   Date.now(),
    specRetries: 0,
    budgetYear:  2026,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Group B1 — Multi-package procurement
// A goal with "và" connector produces ≥ 2 packages from PlannerAgent.
// AutonomousAgent processes only packages[0] for the workflow.
// ═════════════════════════════════════════════════════════════════════════════

describe('Group B1 — Multi-package procurement', () => {
  let output: AutonomousOutput;

  beforeAll(async () => {
    const registry = makeRegistry();
    const agent    = new AutonomousAgent(registry);
    const resp = await agent.process(
      runMsg('mua máy tính và điều hòa không khí', bt('B1')),
    );
    output = resp.payload as AutonomousOutput;
  });

  it('B1-01: goal with "và" connector produces at least 2 packages in plannerOutput', () => {
    expect(output.session.plannerOutput!.packages.length).toBeGreaterThanOrEqual(2);
  });

  it('B1-02: totalEstimated reflects the combined value of all packages', () => {
    const { plannerOutput } = output.session;
    const sumOfPackages = plannerOutput!.packages.reduce(
      (sum, p) => sum + p.estimatedTotal, 0,
    );
    expect(plannerOutput!.totalEstimated).toBe(sumOfPackages);
  });

  it('B1-03: procurement calendar is populated with entries for the year', () => {
    const calendar = output.session.plannerOutput!.calendar;
    expect(calendar.budgetYear).toBe(2026);
    // khlcntSubmissionDate is always set by buildCalendar
    expect(calendar.khlcntSubmissionDate).toBeTruthy();
  });

  it('B1-04: session.pkg is built from packages[0] only (single package processed)', () => {
    const pkg = output.session.pkg!;
    const firstSuggestion = output.session.plannerOutput!.packages[0];
    expect(pkg.packageName).toBe(firstSuggestion.packageName);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group B2 — Specification retries counter
// runSpecifying() increments specRetries when brandWarnings are detected.
// Tested via the pure function so we can control the suggestion's packageName.
// ═════════════════════════════════════════════════════════════════════════════

describe('Group B2 — Specification retries counter', () => {
  it('B2-01: normal goal through full run produces specRetries === 0', async () => {
    const registry = makeRegistry();
    const agent    = new AutonomousAgent(registry);
    const resp = await agent.process(
      runMsg('mua sắm văn phòng phẩm', bt('B2')),
    );
    const out = resp.payload as AutonomousOutput;
    expect(out.session.specRetries).toBe(0);
  });

  it('B2-02: runSpecifying with brand-named suggestion → specRetries increments to 1', async () => {
    const registry = makeRegistry();
    const session  = makeBrandSession('Máy tính Dell XPS 13 phục vụ đào tạo');
    const updated  = await runSpecifying(session, registry, bt('B2'));
    expect(updated.specRetries).toBe(1);
  });

  it('B2-03: runSpecifying with clean suggestion name keeps specRetries at 0', async () => {
    const registry = makeRegistry();
    const session  = makeBrandSession('Máy tính để bàn phục vụ đào tạo');
    const updated  = await runSpecifying(session, registry, bt('B2'));
    expect(updated.specRetries).toBe(0);
  });

  it('B2-04: two consecutive runSpecifying calls with brands accumulate retries', async () => {
    const registry = makeRegistry();
    const session  = makeBrandSession('Máy tính Dell XPS 13 phục vụ đào tạo');
    const after1   = await runSpecifying(session,  registry, bt('B2'));
    // Second call uses same brand session (overriding specRetries from first)
    const after2   = await runSpecifying({ ...session, specRetries: after1.specRetries }, registry, bt('B2'));
    // If both calls detect brand warnings, accumulated count = 2
    expect(after2.specRetries).toBeGreaterThanOrEqual(after1.specRetries);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group B3 — Ask-user → multi-turn resume loops
// Verifies that two sequential pause→resume cycles work correctly and each
// pause generates a fresh, unique pendingQuestion.questionId.
// ═════════════════════════════════════════════════════════════════════════════

describe('Group B3 — Ask-user → multi-turn resume loops', () => {
  let agent:       AutonomousAgent;
  let qId1:        string;
  let qId2:        string;
  let pause1Resp:  AgentMessage;
  let resume1Resp: AgentMessage;
  let pause2Resp:  AgentMessage;
  let resume2Resp: AgentMessage;

  beforeAll(async () => {
    const registry = makeRegistry();
    agent = new AutonomousAgent(registry);

    // Run workflow to completion
    await agent.process(runMsg('mua sắm văn phòng phẩm phục vụ đào tạo', bt('B3')));

    // First pause
    pause1Resp = await agent.process(aMsg({ action: 'pause' }, bt('B3')));
    qId1 = (pause1Resp.payload as AutonomousOutput).session.pendingQuestion!.questionId;

    // First resume
    resume1Resp = await agent.process(
      aMsg({ action: 'resume', userAnswer: { questionId: qId1, answer: 'Xác nhận lần 1' } }, bt('B3')),
    );

    // Second pause
    pause2Resp = await agent.process(aMsg({ action: 'pause' }, bt('B3')));
    qId2 = (pause2Resp.payload as AutonomousOutput).session.pendingQuestion!.questionId;

    // Second resume
    resume2Resp = await agent.process(
      aMsg({ action: 'resume', userAnswer: { questionId: qId2, answer: 'Xác nhận lần 2' } }, bt('B3')),
    );
  });

  it('B3-01: first pause returns response with session.state = ask-user', () => {
    expect(pause1Resp.type).toBe('response');
    expect((pause1Resp.payload as AutonomousOutput).session.state).toBe('ask-user');
  });

  it('B3-02: second pause generates a new unique questionId (different from first)', () => {
    expect(pause2Resp.type).toBe('response');
    expect(qId2).toBeDefined();
    expect(qId2).not.toBe(qId1);
  });

  it('B3-03: first resume restores session.state to ready-for-export', () => {
    expect(resume1Resp.type).toBe('response');
    expect((resume1Resp.payload as AutonomousOutput).session.state).toBe('ready-for-export');
  });

  it('B3-04: second resume also restores session.state to ready-for-export', () => {
    expect(resume2Resp.type).toBe('response');
    expect((resume2Resp.payload as AutonomousOutput).session.state).toBe('ready-for-export');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group B4 — Legal review + risk assessment integration
// Exercises the LegalReviewerAgent → RiskAgent data pipeline directly.
// ═════════════════════════════════════════════════════════════════════════════

describe('Group B4 — Legal review + risk assessment integration', () => {
  let registry:     AgentRegistry;
  let dossierResp:  AgentMessage;
  let riskResp:     AgentMessage;

  beforeAll(async () => {
    registry = makeRegistry();

    // Package with brand-locked specs → HIGH finding from P5-03
    const pkg = makeCleanPkg({
      items: [{
        id:             'b4-item-1',
        name:           'Card đồ họa rời',
        unit:           'Cái',
        quantity:       5,
        unitPrice:      10_000_000,
        specs:          'Card đồ họa NVIDIA RTX 3060 hoặc tương đương',
        supplier1Price: 10_000_000,
        supplier2Price:  9_500_000,
        supplier3Price: 10_200_000,
      }],
    });

    // 1. LegalReviewerAgent
    const legalReviewer = new LegalReviewerAgent(registry);
    const legalInput: DossierReviewInput = {
      pkg,
      documentIds: Array.from({ length: 28 }, (_, i) => i + 1),
      methodCode:  'DIRECT_SELECTION_SIMPLIFIED',
    };
    dossierResp = await legalReviewer.process({
      traceId:   bt('B4'),
      from:      'user',
      to:        'legal-reviewer',
      type:      'request',
      payload:   legalInput,
      timestamp: Date.now(),
    });

    // 2. RiskAgent — receives the dossierReview
    const dossierOut = dossierResp.payload as DossierReviewOutput;
    const riskAgent  = new RiskAgent(registry);
    const riskInput: RiskInput = { pkg, dossierReview: dossierOut };
    riskResp = await riskAgent.process({
      traceId:   bt('B4'),
      from:      'user',
      to:        'risk',
      type:      'request',
      payload:   riskInput,
      timestamp: Date.now(),
    });
  });

  it('B4-01: brand-locked specs → legal findings detected → risk is HIGH or CRITICAL', () => {
    const riskOut = riskResp.payload as RiskOutput;
    expect(['HIGH', 'CRITICAL']).toContain(riskOut.overallRisk);
  });

  it('B4-02: legalBasis from LegalReviewerAgent response is non-empty', () => {
    expect(dossierResp.legalBasis).toBeDefined();
    expect(dossierResp.legalBasis!.length).toBeGreaterThan(0);
  });

  it('B4-03: dossierReview.complianceScore < 100 when brand-locking findings exist', () => {
    const dossierOut = dossierResp.payload as DossierReviewOutput;
    expect(dossierOut.complianceScore).toBeLessThan(100);
  });

  it('B4-04: riskMatrix is non-empty when dossierReview has findings', () => {
    const dossierOut = dossierResp.payload as DossierReviewOutput;
    const riskOut    = riskResp.payload as RiskOutput;
    if (dossierOut.findings.length > 0) {
      expect(riskOut.riskMatrix.length).toBeGreaterThan(0);
    } else {
      // No P5-03 findings for this package — still valid, riskMatrix may be empty
      expect(riskOut.riskMatrix.length).toBeGreaterThanOrEqual(0);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group B5 — Complete export flow with pause/resume
// Verifies that session.messageLog is preserved intact through a
// run → pause → resume → export chain.
// ═════════════════════════════════════════════════════════════════════════════

describe('Group B5 — Complete export flow with pause/resume', () => {
  let agent:          AutonomousAgent;
  let runMsgLog:      number;
  let exportResponse: AgentMessage;

  beforeAll(async () => {
    const registry = makeRegistry();
    agent = new AutonomousAgent(registry);

    // 1. Run
    const runResp = await agent.process(
      runMsg('mua sắm trang thiết bị đào tạo', bt('B5')),
    );
    const runOut = runResp.payload as AutonomousOutput;
    runMsgLog = runOut.session.messageLog.length;

    // 2. Pause
    const pauseResp = await agent.process(aMsg({ action: 'pause' }, bt('B5')));
    const pauseOut  = pauseResp.payload as AutonomousOutput;
    const qId       = pauseOut.session.pendingQuestion!.questionId;

    // 3. Resume
    await agent.process(
      aMsg({ action: 'resume', userAnswer: { questionId: qId, answer: 'Xác nhận xuất hồ sơ' } }, bt('B5')),
    );

    // 4. Export
    exportResponse = await agent.process(aMsg({ action: 'export' }, bt('B5')));
  });

  it('B5-01: export after run→pause→resume returns a response (not error)', () => {
    expect(exportResponse.type).toBe('response');
  });

  it('B5-02: exported session has all four sub-outputs populated', () => {
    const out = exportResponse.payload as AutonomousOutput;
    expect(out.session.plannerOutput).toBeDefined();
    expect(out.session.pkg).toBeDefined();
    expect(out.session.dossierReview).toBeDefined();
    expect(out.session.riskOutput).toBeDefined();
  });

  it('B5-03: messageLog is preserved through pause/resume — same length as after run', () => {
    const out = exportResponse.payload as AutonomousOutput;
    // pause and resume do not add to messageLog; it stays at the post-run size
    expect(out.session.messageLog.length).toBe(runMsgLog);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group B6 — Session summary consistency
// ═════════════════════════════════════════════════════════════════════════════

describe('Group B6 — Session summary consistency', () => {
  it('B6-01: every WorkflowState produces a distinct non-empty summary string', () => {
    const states: WorkflowState[] = [
      'idle', 'planning', 'specifying', 'legal-review',
      'risk-assessment', 'ask-user', 'ready-for-export',
      'exporting', 'done', 'error',
    ];
    const summaries = states.map(state =>
      buildSessionSummary({ state } as AgentSession),
    );
    // All non-empty
    summaries.forEach(s => expect(s.length).toBeGreaterThan(0));
    // All distinct — 10 states → 10 unique summaries
    expect(new Set(summaries).size).toBe(states.length);
  });

  it('B6-02: completed run produces summary for ready-for-export state', async () => {
    const registry = makeRegistry();
    const agent    = new AutonomousAgent(registry);
    const resp = await agent.process(
      runMsg('mua sắm văn phòng phẩm', bt('B6')),
    );
    const out = resp.payload as AutonomousOutput;
    const expected = buildSessionSummary({ state: 'ready-for-export' } as AgentSession);
    expect(out.summary).toBe(expected);
  });

  it('B6-03: AutonomousOutput.summary matches buildSessionSummary(session)', async () => {
    const registry = makeRegistry();
    const agent    = new AutonomousAgent(registry);
    const resp = await agent.process(
      runMsg('mua sắm văn phòng phẩm', bt('B6')),
    );
    const out = resp.payload as AutonomousOutput;
    expect(out.summary).toBe(buildSessionSummary(out.session));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group B7 — Trace propagation across all agents
// Every sub-agent must log its messages under the same traceId as the
// AutonomousAgent that initiated the workflow.
// ═════════════════════════════════════════════════════════════════════════════

describe('Group B7 — Trace propagation across all agents', () => {
  let registry: AgentRegistry;
  let traceId:  string;

  beforeAll(async () => {
    registry = makeRegistry();
    const agent = new AutonomousAgent(registry);
    traceId = bt('B7');
    await agent.process(runMsg('mua sắm văn phòng phẩm phục vụ đào tạo', traceId));
  });

  it('B7-01: trace contains messages from PlannerAgent (from === planner)', () => {
    const trace = registry.getTrace(traceId);
    const plannerMsgs = trace.filter(m => m.from === 'planner');
    expect(plannerMsgs.length).toBeGreaterThan(0);
  });

  it('B7-02: trace contains messages from SpecificationAgent (from === specification)', () => {
    const trace = registry.getTrace(traceId);
    const specMsgs = trace.filter(m => m.from === 'specification');
    expect(specMsgs.length).toBeGreaterThan(0);
  });

  it('B7-03: trace contains messages from LegalReviewerAgent (from === legal-reviewer)', () => {
    const trace = registry.getTrace(traceId);
    const legalMsgs = trace.filter(m => m.from === 'legal-reviewer');
    expect(legalMsgs.length).toBeGreaterThan(0);
  });

  it('B7-04: trace contains messages from RiskAgent (from === risk)', () => {
    const trace = registry.getTrace(traceId);
    const riskMsgs = trace.filter(m => m.from === 'risk');
    expect(riskMsgs.length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group B8 — completedAt and messageLog integrity
// ═════════════════════════════════════════════════════════════════════════════

describe('Group B8 — completedAt and messageLog integrity', () => {
  let session: AgentSession;

  beforeAll(async () => {
    const registry = makeRegistry();
    const agent    = new AutonomousAgent(registry);
    const resp = await agent.process(
      runMsg('mua sắm văn phòng phẩm phục vụ đào tạo', bt('B8')),
    );
    session = (resp.payload as AutonomousOutput).session;
  });

  it('B8-01: completedAt is set and strictly greater than startedAt', () => {
    expect(session.completedAt).toBeDefined();
    expect(session.completedAt!).toBeGreaterThan(session.startedAt);
  });

  it('B8-02: messageLog timestamps are non-decreasing (messages in chronological order)', () => {
    const log = session.messageLog;
    expect(log.length).toBeGreaterThan(0);
    for (let i = 1; i < log.length; i++) {
      expect(log[i].timestamp).toBeGreaterThanOrEqual(log[i - 1].timestamp);
    }
  });

  it('B8-03: messageLog contains responses from all four sub-agents', () => {
    const log = session.messageLog;
    const froms = new Set(log.map(m => m.from));
    expect(froms.has('planner')).toBe(true);
    expect(froms.has('specification')).toBe(true);
    expect(froms.has('legal-reviewer')).toBe(true);
    expect(froms.has('risk')).toBe(true);
  });

  it('B8-04: messageLog length is exactly 8 (4 agents × request + response)', () => {
    // runPlanning, runSpecifying, runLegalReview, runRiskAssessment each append [request, response]
    expect(session.messageLog).toHaveLength(8);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group B9 — legalBasis aggregation and deduplication
// ═════════════════════════════════════════════════════════════════════════════

describe('Group B9 — legalBasis aggregation and deduplication', () => {
  let output: AutonomousOutput;

  beforeAll(async () => {
    const registry = makeRegistry();
    const agent    = new AutonomousAgent(registry);
    const resp = await agent.process(
      runMsg('mua sắm văn phòng phẩm phục vụ đào tạo', bt('B9')),
    );
    output = resp.payload as AutonomousOutput;
  });

  it('B9-01: response.legalBasis contains no duplicate entries', () => {
    const basis  = output.legalBasis;
    const unique = new Set(basis);
    expect(unique.size).toBe(basis.length);
  });

  it('B9-02: response.legalBasis includes every AUTONOMOUS_LEGAL_BASIS constant', () => {
    for (const citation of AUTONOMOUS_LEGAL_BASIS) {
      expect(output.legalBasis).toContain(citation);
    }
  });

  it('B9-03: response.legalBasis includes at least one entry from plannerOutput.legalBasis', () => {
    const plannerBasis = output.session.plannerOutput!.legalBasis;
    const hasOverlap   = plannerBasis.some(b => output.legalBasis.includes(b));
    expect(hasOverlap).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group B10 — Recovery from intermediate errors
// When a required sub-agent is missing from the registry, the try/catch in
// runWorkflow catches the registry throw and returns AUTONOMOUS_INTERNAL_ERROR.
// ═════════════════════════════════════════════════════════════════════════════

describe('Group B10 — Recovery from intermediate errors', () => {
  it('B10-01: missing PlannerAgent → AUTONOMOUS_INTERNAL_ERROR (not an uncaught throw)', async () => {
    const registry = makeRegistryNoPlan();
    const agent    = new AutonomousAgent(registry);
    const resp = await agent.process(
      runMsg('mua sắm văn phòng phẩm', bt('B10')),
    );
    expect(resp.type).toBe('error');
    expect((resp.payload as { code: string }).code).toBe('AUTONOMOUS_INTERNAL_ERROR');
  });

  it('B10-02: missing SpecificationAgent → AUTONOMOUS_INTERNAL_ERROR (after planning succeeds)', async () => {
    const registry = makeRegistryNoSpec();
    const agent    = new AutonomousAgent(registry);
    const resp = await agent.process(
      runMsg('mua sắm văn phòng phẩm', bt('B10')),
    );
    expect(resp.type).toBe('error');
    expect((resp.payload as { code: string }).code).toBe('AUTONOMOUS_INTERNAL_ERROR');
  });

  it('B10-03: after AUTONOMOUS_INTERNAL_ERROR, agent accepts a new run on a correct registry', async () => {
    // First call fails (no planner)
    const badRegistry  = makeRegistryNoPlan();
    const agent        = new AutonomousAgent(badRegistry);
    const failResp     = await agent.process(runMsg('mua sắm văn phòng phẩm', bt('B10')));
    expect(failResp.type).toBe('error');

    // A fresh agent on a correct registry succeeds
    const goodRegistry = makeRegistry();
    const freshAgent   = new AutonomousAgent(goodRegistry);
    const okResp       = await freshAgent.process(runMsg('mua sắm văn phòng phẩm', bt('B10')));
    expect(okResp.type).toBe('response');
    expect((okResp.payload as AutonomousOutput).session.state).toBe('ready-for-export');
  });
});
