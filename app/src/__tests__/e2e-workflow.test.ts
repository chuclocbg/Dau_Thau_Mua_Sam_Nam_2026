/**
 * P6-07A: End-to-end workflow tests
 *
 * Tests the full multi-agent pipeline using REAL agents — no stubs.
 * Each group creates fresh agent instances to prevent state leakage.
 * Expensive full-workflow runs are shared within a group via beforeAll.
 *
 * Coverage:
 *   Group E1 — Normal full AutonomousAgent run            (6 tests, E1-01..E1-06)
 *   Group E2 — Trace completeness and state-machine order (4 tests, E2-01..E2-04)
 *   Group E3 — ChatAgent integration with package context (3 tests, E3-01..E3-03)
 *   Group E4 — SpecificationAgent brand-lock detection    (3 tests, E4-01..E4-03)
 *   Group E5 — LegalReviewerAgent cross-doc inconsistency (4 tests, E5-01..E5-04)
 *   Group E6 — RiskAgent risk escalation                  (3 tests, E6-01..E6-03)
 *   Group E7 — AutonomousAgent pause / resume flow        (4 tests, E7-01..E7-04)
 *   Group E8 — Export flow                                (3 tests, E8-01..E8-03)
 *   Group E9 — Error recovery                             (4 tests, E9-01..E9-04)
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
} from '../agents/AutonomousAgent';

import type { AgentMessage }            from '../agents/types';
import type {
  AutonomousInput,
  AutonomousOutput,
  AutonomousStateEvent,
} from '../agents/AutonomousAgent';
import type { SpecInput, SpecOutput }   from '../agents/SpecificationAgent';
import type {
  DossierReviewInput,
  DossierReviewOutput,
  CrossCheckIssue,
} from '../agents/LegalReviewerAgent';
import type { RiskInput, RiskOutput }   from '../agents/RiskAgent';
import type { ChatInput, ChatOutput }   from '../agents/ChatAgent';
import type { LegalFinding }            from '../ai/legalReviewer';
import type { ProcurementPackage }      from '../demoData';

// ─── Registry factory ─────────────────────────────────────────────────────────

/** Creates a fresh AgentRegistry with all five sub-agents registered. */
function makeRegistry(): AgentRegistry {
  const registry = new AgentRegistry();
  registry.register(new PlannerAgent(registry));
  registry.register(new SpecificationAgent(registry));
  registry.register(new LegalReviewerAgent(registry));
  registry.register(new RiskAgent(registry));
  registry.register(new ChatAgent(registry));
  return registry;
}

// ─── Trace ID counter ─────────────────────────────────────────────────────────

let _counter = 0;
function nextTrace(prefix = 'E2E'): string {
  return `${prefix}-${String(++_counter).padStart(4, '0')}`;
}

// ─── Request builders ─────────────────────────────────────────────────────────

function makeAutonomousMsg(
  input: AutonomousInput,
  traceId: string,
): AgentMessage {
  return {
    traceId,
    from:      'user',
    to:        'autonomous',
    type:      'request',
    payload:   input,
    timestamp: Date.now(),
  };
}

function makeRunMsg(goal: string, traceId: string): AgentMessage {
  return makeAutonomousMsg({ action: 'run', goal }, traceId);
}

// ─── Fixture: clean procurement package ───────────────────────────────────────

function makeCleanPkg(overrides: Partial<ProcurementPackage> = {}): ProcurementPackage {
  return {
    id:                      'e2e-pkg-1',
    packageName:             'Gói mua sắm vật tư tiêu hao phục vụ đào tạo',
    packageCode:             'E2E-VT-001',
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
      id:             'e2e-item-1',
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

// ─── Fixture: minimal DossierReviewOutput ─────────────────────────────────────

function makeCleanDossier(findingOverrides: Partial<LegalFinding>[] = []): DossierReviewOutput {
  const findings: LegalFinding[] = findingOverrides.map((o, i) => ({
    severity:    'LOW' as const,
    category:    'missing-data',
    field:       'test-field',
    description: `Test finding ${i + 1}`,
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

// ═════════════════════════════════════════════════════════════════════════════
// Group E1 — Normal full AutonomousAgent run
// Uses a single shared run to avoid re-running the full pipeline per test.
// ═════════════════════════════════════════════════════════════════════════════

describe('Group E1 — Normal full AutonomousAgent run', () => {
  let response: AgentMessage;
  let output:   AutonomousOutput;

  beforeAll(async () => {
    const registry = makeRegistry();
    const agent    = new AutonomousAgent(registry);
    const traceId  = nextTrace('E1');
    response = await agent.process(makeRunMsg('mua sắm văn phòng phẩm phục vụ đào tạo', traceId));
    output   = response.payload as AutonomousOutput;
  });

  it('E1-01: response type is response (not error)', () => {
    expect(response.type).toBe('response');
  });

  it('E1-02: session.state is ready-for-export', () => {
    expect(output.session.state).toBe('ready-for-export');
  });

  it('E1-03: plannerOutput is populated with at least one package', () => {
    expect(output.session.plannerOutput).toBeDefined();
    expect(output.session.plannerOutput!.packages.length).toBeGreaterThan(0);
  });

  it('E1-04: session.pkg is assembled from planner output', () => {
    expect(output.session.pkg).toBeDefined();
    expect(output.session.pkg!.items.length).toBeGreaterThan(0);
  });

  it('E1-05: dossierReview has a numeric complianceScore in [0, 100]', () => {
    const review = output.session.dossierReview;
    expect(review).toBeDefined();
    expect(typeof review!.complianceScore).toBe('number');
    expect(review!.complianceScore).toBeGreaterThanOrEqual(0);
    expect(review!.complianceScore).toBeLessThanOrEqual(100);
  });

  it('E1-06: riskOutput.overallRisk is a valid OverallRisk value', () => {
    const risk = output.session.riskOutput;
    expect(risk).toBeDefined();
    expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'CLEAN']).toContain(risk!.overallRisk);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group E2 — Trace completeness and state-machine order
// ═════════════════════════════════════════════════════════════════════════════

describe('Group E2 — Trace completeness and state-machine order', () => {
  let registry: AgentRegistry;
  let traceId:  string;

  beforeAll(async () => {
    registry = makeRegistry();
    const agent = new AutonomousAgent(registry);
    traceId = nextTrace('E2');
    await agent.process(makeRunMsg('mua sắm văn phòng phẩm phục vụ đào tạo', traceId));
  });

  it('E2-01: trace contains at least 10 messages (1 incoming + events + 4×2 sub-agent + 1 response)', () => {
    const trace = registry.getTrace(traceId);
    expect(trace.length).toBeGreaterThanOrEqual(10);
  });

  it('E2-02: state machine transitions follow planning→specifying→legal-review→risk-assessment→ready-for-export', () => {
    const trace = registry.getTrace(traceId);
    const stateEvents = trace
      .filter(m => m.type === 'event' && m.to === 'autonomous')
      .map(m => (m.payload as AutonomousStateEvent).nextState);
    expect(stateEvents).toEqual([
      'planning',
      'specifying',
      'legal-review',
      'risk-assessment',
      'ready-for-export',
    ]);
  });

  it('E2-03: every message in the trace carries the session traceId', () => {
    const trace = registry.getTrace(traceId);
    expect(trace.length).toBeGreaterThan(0);
    for (const msg of trace) {
      expect(msg.traceId).toBe(traceId);
    }
  });

  it('E2-04: response legalBasis includes the first AUTONOMOUS_LEGAL_BASIS entry', () => {
    const trace    = registry.getTrace(traceId);
    const response = trace.find(m => m.type === 'response' && m.from === 'autonomous');
    expect(response).toBeDefined();
    const output = response!.payload as AutonomousOutput;
    expect(output.legalBasis).toContain(AUTONOMOUS_LEGAL_BASIS[0]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group E3 — ChatAgent integration with package context
// ═════════════════════════════════════════════════════════════════════════════

describe('Group E3 — ChatAgent integration with package context', () => {
  let registry: AgentRegistry;

  beforeAll(() => {
    registry = makeRegistry();
  });

  it('E3-01: ChatAgent returns a response (not error) for a legal question', async () => {
    const chatInput: ChatInput = {
      message: 'Ngưỡng chào hàng cạnh tranh là bao nhiêu?',
      history: [],
    };
    const msg: AgentMessage = {
      traceId:   nextTrace('E3'),
      from:      'user',
      to:        'chat',
      type:      'request',
      payload:   chatInput,
      timestamp: Date.now(),
    };
    const agent    = new ChatAgent(registry);
    const response = await agent.process(msg);
    expect(response.type).toBe('response');
  });

  it('E3-02: ChatAgent answer is non-empty for a procurement threshold question', async () => {
    const chatInput: ChatInput = {
      message: 'Phương thức chỉ định thầu rút gọn áp dụng khi nào?',
      history: [],
    };
    const msg: AgentMessage = {
      traceId:   nextTrace('E3'),
      from:      'user',
      to:        'chat',
      type:      'request',
      payload:   chatInput,
      timestamp: Date.now(),
    };
    const agent    = new ChatAgent(registry);
    const response = await agent.process(msg);
    const chatOut  = response.payload as ChatOutput;
    expect(chatOut.answer.length).toBeGreaterThan(10);
  });

  it('E3-03: ChatAgent with package context attaches relatedFindings or returns valid output', async () => {
    const pkg = makeCleanPkg({
      packageName: 'Gói máy tính với spec thương hiệu',
      items: [{
        id:             'e3-item-1',
        name:           'Máy tính để bàn',
        unit:           'Bộ',
        quantity:       5,
        unitPrice:      15_000_000,
        specs:          'Card đồ họa NVIDIA GTX 1650 hoặc tương đương',
        supplier1Price: 15_000_000,
        supplier2Price: 14_500_000,
        supplier3Price: 15_200_000,
      }],
    });
    const chatInput: ChatInput = {
      message:        'Yêu cầu kỹ thuật này có vi phạm khóa thương hiệu không?',
      packageContext: pkg,
      history:        [],
    };
    const msg: AgentMessage = {
      traceId:   nextTrace('E3'),
      from:      'user',
      to:        'chat',
      type:      'request',
      payload:   chatInput,
      timestamp: Date.now(),
    };
    const agent    = new ChatAgent(registry);
    const response = await agent.process(msg);
    expect(response.type).toBe('response');
    const chatOut = response.payload as ChatOutput;
    // With a package context containing brand names, either relatedFindings are attached
    // or the confidence is at least defined.
    expect(['high', 'medium', 'low']).toContain(chatOut.confidence);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group E4 — SpecificationAgent brand-lock detection
// ═════════════════════════════════════════════════════════════════════════════

describe('Group E4 — SpecificationAgent brand-lock detection', () => {
  let registry: AgentRegistry;
  let output:   SpecOutput;

  beforeAll(async () => {
    registry = makeRegistry();
    const agent = new SpecificationAgent(registry);
    const input: SpecInput = {
      itemName:    'Máy tính Dell XPS 13 phục vụ đào tạo',
      packageType: 'goods_fixed_asset',
    };
    const msg: AgentMessage = {
      traceId:   nextTrace('E4'),
      from:      'user',
      to:        'specification',
      type:      'request',
      payload:   input,
      timestamp: Date.now(),
    };
    const resp = await agent.process(msg);
    output = resp.payload as SpecOutput;
  });

  it('E4-01: brandWarnings is non-empty when item name contains a brand', () => {
    expect(output.brandWarnings.length).toBeGreaterThan(0);
  });

  it('E4-02: complianceStatus is warning or violation (not compliant)', () => {
    expect(['warning', 'violation']).toContain(output.complianceStatus);
  });

  it('E4-03: alternatives are suggested for the detected brand', () => {
    expect(output.alternatives.length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group E5 — LegalReviewerAgent cross-document inconsistency
// ═════════════════════════════════════════════════════════════════════════════

describe('Group E5 — LegalReviewerAgent cross-document inconsistency', () => {
  let registry: AgentRegistry;

  beforeAll(() => {
    registry = makeRegistry();
  });

  it('E5-01: cross-check detects issue when dateContractSign is before dateResultApprove', async () => {
    // Inversion: contract signed (Feb 24) BEFORE result approved (Feb 25) — normal.
    // But we flip it: result approved (Mar 5) AFTER contract signed (Mar 1) → issue.
    // To trigger CRITICAL inversion, set dateResultApprove AFTER dateContractSign:
    const pkg = makeCleanPkg({
      dateResultApprove: '2026-03-10', // AFTER dateContractSign 2026-03-01 → inverted
      dateContractSign:  '2026-03-01',
    });
    const input: DossierReviewInput = {
      pkg,
      documentIds: Array.from({ length: 28 }, (_, i) => i + 1),
      methodCode:  'DIRECT_SELECTION_SIMPLIFIED',
    };
    const msg: AgentMessage = {
      traceId:   nextTrace('E5'),
      from:      'user',
      to:        'legal-reviewer',
      type:      'request',
      payload:   input,
      timestamp: Date.now(),
    };
    const agent    = new LegalReviewerAgent(registry);
    const response = await agent.process(msg);
    const out      = response.payload as DossierReviewOutput;
    expect(out.crossCheckIssues.length).toBeGreaterThan(0);
  });

  it('E5-02: cross-check issue for result-approved-after-contract-signed is CRITICAL', async () => {
    // contractAfterResult: dateResultApprove must be BEFORE dateContractSign.
    // Inversion: result approved (Mar 10) AFTER contract signed (Mar 1) → CRITICAL.
    const pkg = makeCleanPkg({
      dateResultApprove: '2026-03-10', // AFTER contractSign → inverted → CRITICAL
      dateContractSign:  '2026-03-01',
    });
    const input: DossierReviewInput = {
      pkg,
      documentIds: Array.from({ length: 28 }, (_, i) => i + 1),
      methodCode:  'DIRECT_SELECTION_SIMPLIFIED',
    };
    const msg: AgentMessage = {
      traceId:   nextTrace('E5'),
      from:      'user',
      to:        'legal-reviewer',
      type:      'request',
      payload:   input,
      timestamp: Date.now(),
    };
    const agent    = new LegalReviewerAgent(registry);
    const response = await agent.process(msg);
    const out      = response.payload as DossierReviewOutput;
    const hasCritical = out.crossCheckIssues.some(i => i.severity === 'CRITICAL');
    expect(hasCritical).toBe(true);
  });

  it('E5-03: auditReadiness is not-ready when there are CRITICAL cross-check issues', async () => {
    // Acceptance BEFORE delivery → CRITICAL
    const pkg = makeCleanPkg({
      dateDelivery:   '2026-03-20',
      dateAcceptance: '2026-03-10', // BEFORE delivery
    });
    const input: DossierReviewInput = {
      pkg,
      documentIds: Array.from({ length: 28 }, (_, i) => i + 1),
      methodCode:  'DIRECT_SELECTION_SIMPLIFIED',
    };
    const msg: AgentMessage = {
      traceId:   nextTrace('E5'),
      from:      'user',
      to:        'legal-reviewer',
      type:      'request',
      payload:   input,
      timestamp: Date.now(),
    };
    const agent    = new LegalReviewerAgent(registry);
    const response = await agent.process(msg);
    const out      = response.payload as DossierReviewOutput;
    expect(out.auditReadiness).toBe('not-ready');
  });

  it('E5-04: clean package with all dates in valid sequence has zero cross-check issues', async () => {
    const pkg = makeCleanPkg();
    const input: DossierReviewInput = {
      pkg,
      documentIds: Array.from({ length: 28 }, (_, i) => i + 1),
      methodCode:  'DIRECT_SELECTION_SIMPLIFIED',
    };
    const msg: AgentMessage = {
      traceId:   nextTrace('E5'),
      from:      'user',
      to:        'legal-reviewer',
      type:      'request',
      payload:   input,
      timestamp: Date.now(),
    };
    const agent    = new LegalReviewerAgent(registry);
    const response = await agent.process(msg);
    const out      = response.payload as DossierReviewOutput;
    expect(out.crossCheckIssues.length).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group E6 — RiskAgent risk escalation
// ═════════════════════════════════════════════════════════════════════════════

describe('Group E6 — RiskAgent risk escalation', () => {
  let registry: AgentRegistry;

  beforeAll(() => {
    registry = makeRegistry();
  });

  it('E6-01: CRITICAL finding in dossier → overallRisk is CRITICAL', async () => {
    const input: RiskInput = {
      pkg:           makeCleanPkg(),
      dossierReview: makeCleanDossier([{
        severity:    'CRITICAL',
        category:    'brand-locking',
        description: 'Yêu cầu kỹ thuật khóa thương hiệu — vi phạm Điều 44 khoản 7',
        legalBasis:  'Điều 44 khoản 7 Luật Đấu thầu 22/2023/QH15',
      }]),
    };
    const msg: AgentMessage = {
      traceId:   nextTrace('E6'),
      from:      'user',
      to:        'risk',
      type:      'request',
      payload:   input,
      timestamp: Date.now(),
    };
    const agent    = new RiskAgent(registry);
    const response = await agent.process(msg);
    const out      = response.payload as RiskOutput;
    expect(out.overallRisk).toBe('CRITICAL');
  });

  it('E6-02: zero findings and zero cross-check issues → overallRisk is CLEAN', async () => {
    const input: RiskInput = {
      pkg:           makeCleanPkg(),
      dossierReview: makeCleanDossier(), // no findings
    };
    const msg: AgentMessage = {
      traceId:   nextTrace('E6'),
      from:      'user',
      to:        'risk',
      type:      'request',
      payload:   input,
      timestamp: Date.now(),
    };
    const agent    = new RiskAgent(registry);
    const response = await agent.process(msg);
    const out      = response.payload as RiskOutput;
    expect(out.overallRisk).toBe('CLEAN');
  });

  it('E6-03: riskMatrix entries are sorted by riskScore descending', async () => {
    const input: RiskInput = {
      pkg: makeCleanPkg(),
      dossierReview: makeCleanDossier([
        { severity: 'LOW',      category: 'missing-data',  description: 'LOW finding'      },
        { severity: 'CRITICAL', category: 'brand-locking', description: 'CRITICAL finding' },
        { severity: 'HIGH',     category: 'method-mismatch', description: 'HIGH finding'   },
      ]),
    };
    const msg: AgentMessage = {
      traceId:   nextTrace('E6'),
      from:      'user',
      to:        'risk',
      type:      'request',
      payload:   input,
      timestamp: Date.now(),
    };
    const agent    = new RiskAgent(registry);
    const response = await agent.process(msg);
    const out      = response.payload as RiskOutput;
    for (let i = 1; i < out.riskMatrix.length; i++) {
      expect(out.riskMatrix[i - 1].riskScore).toBeGreaterThanOrEqual(out.riskMatrix[i].riskScore);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group E7 — AutonomousAgent pause / resume flow
// ═════════════════════════════════════════════════════════════════════════════

describe('Group E7 — AutonomousAgent pause / resume flow', () => {
  // All four tests share one agent instance to test the sequential pause→resume flow.
  let agent:         AutonomousAgent;
  let registry:      AgentRegistry;
  let pauseResponse: AgentMessage;
  let pendingQuestionId: string;

  beforeAll(async () => {
    registry = makeRegistry();
    agent    = new AutonomousAgent(registry);

    // 1. Complete a run first so session.state = 'ready-for-export'
    await agent.process(makeRunMsg('mua sắm văn phòng phẩm phục vụ đào tạo', nextTrace('E7')));

    // 2. Pause
    pauseResponse = await agent.process(
      makeAutonomousMsg({ action: 'pause' }, nextTrace('E7')),
    );
    const pauseOut = pauseResponse.payload as AutonomousOutput;
    pendingQuestionId = pauseOut.session.pendingQuestion!.questionId;
  });

  it('E7-01: pause after run returns response (not error)', () => {
    expect(pauseResponse.type).toBe('response');
  });

  it('E7-02: session.state is ask-user after pause and pendingQuestion is set', () => {
    const pauseOut = pauseResponse.payload as AutonomousOutput;
    expect(pauseOut.session.state).toBe('ask-user');
    expect(pauseOut.session.pendingQuestion).toBeDefined();
  });

  it('E7-03: resume with correct questionId → session.state becomes ready-for-export', async () => {
    const resumeResp = await agent.process(
      makeAutonomousMsg(
        {
          action:     'resume',
          userAnswer: { questionId: pendingQuestionId, answer: 'Xác nhận tiếp tục xử lý hồ sơ' },
        },
        nextTrace('E7'),
      ),
    );
    expect(resumeResp.type).toBe('response');
    const resumeOut = resumeResp.payload as AutonomousOutput;
    expect(resumeOut.session.state).toBe('ready-for-export');
  });

  it('E7-04: resume with wrong questionId → error AUTONOMOUS_ANSWER_MISMATCH', async () => {
    // Fresh agent + fresh run + fresh pause to get a valid ask-user state
    const freshRegistry = makeRegistry();
    const freshAgent    = new AutonomousAgent(freshRegistry);
    await freshAgent.process(makeRunMsg('mua sắm trang thiết bị', nextTrace('E7')));
    await freshAgent.process(makeAutonomousMsg({ action: 'pause' }, nextTrace('E7')));

    const mismatchResp = await freshAgent.process(
      makeAutonomousMsg(
        {
          action:     'resume',
          userAnswer: { questionId: 'wrong-question-id-that-does-not-match', answer: 'test' },
        },
        nextTrace('E7'),
      ),
    );
    expect(mismatchResp.type).toBe('error');
    expect((mismatchResp.payload as { code: string }).code).toBe('AUTONOMOUS_ANSWER_MISMATCH');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group E8 — Export flow
// ═════════════════════════════════════════════════════════════════════════════

describe('Group E8 — Export flow', () => {
  let agent:          AutonomousAgent;
  let exportResponse: AgentMessage;

  beforeAll(async () => {
    const registry = makeRegistry();
    agent = new AutonomousAgent(registry);

    // Complete a run
    await agent.process(makeRunMsg('mua sắm văn phòng phẩm phục vụ đào tạo', nextTrace('E8')));

    // Export
    exportResponse = await agent.process(
      makeAutonomousMsg({ action: 'export' }, nextTrace('E8')),
    );
  });

  it('E8-01: export returns a response (not error)', () => {
    expect(exportResponse.type).toBe('response');
  });

  it('E8-02: exported session contains a non-empty messageLog', () => {
    const out = exportResponse.payload as AutonomousOutput;
    expect(out.session.messageLog.length).toBeGreaterThan(0);
  });

  it('E8-03: exported session.completedAt is set (workflow fully completed)', () => {
    const out = exportResponse.payload as AutonomousOutput;
    expect(out.session.completedAt).toBeDefined();
    expect(out.session.completedAt).toBeGreaterThan(out.session.startedAt);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group E9 — Error recovery
// process() must never throw — all errors return error AgentMessages.
// ═════════════════════════════════════════════════════════════════════════════

describe('Group E9 — Error recovery', () => {
  it('E9-01: missing goal → error code AUTONOMOUS_MISSING_GOAL', async () => {
    const registry = makeRegistry();
    const agent    = new AutonomousAgent(registry);
    const resp = await agent.process(
      makeAutonomousMsg({ action: 'run', goal: '' }, nextTrace('E9')),
    );
    expect(resp.type).toBe('error');
    expect((resp.payload as { code: string }).code).toBe('AUTONOMOUS_MISSING_GOAL');
  });

  it('E9-02: missing action → error code AUTONOMOUS_MISSING_ACTION', async () => {
    const registry = makeRegistry();
    const agent    = new AutonomousAgent(registry);
    const msg: AgentMessage = {
      traceId:   nextTrace('E9'),
      from:      'user',
      to:        'autonomous',
      type:      'request',
      payload:   {},        // no action field
      timestamp: Date.now(),
    };
    const resp = await agent.process(msg);
    expect(resp.type).toBe('error');
    expect((resp.payload as { code: string }).code).toBe('AUTONOMOUS_MISSING_ACTION');
  });

  it('E9-03: resume without prior run → error code AUTONOMOUS_NOT_PAUSED', async () => {
    const registry = makeRegistry();
    const agent    = new AutonomousAgent(registry);
    const resp = await agent.process(
      makeAutonomousMsg(
        { action: 'resume', userAnswer: { questionId: 'any-id', answer: 'any' } },
        nextTrace('E9'),
      ),
    );
    expect(resp.type).toBe('error');
    expect((resp.payload as { code: string }).code).toBe('AUTONOMOUS_NOT_PAUSED');
  });

  it('E9-04: status call without prior run → error code AUTONOMOUS_NO_SESSION', async () => {
    const registry = makeRegistry();
    const agent    = new AutonomousAgent(registry);
    const resp = await agent.process(
      makeAutonomousMsg({ action: 'status' }, nextTrace('E9')),
    );
    expect(resp.type).toBe('error');
    expect((resp.payload as { code: string }).code).toBe('AUTONOMOUS_NO_SESSION');
  });
});
