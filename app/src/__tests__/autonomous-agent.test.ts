/**
 * P6-06D: AutonomousAgent test suite
 *
 * Coverage:
 *   Group 0 — Module constants and capabilities       (4 tests, MC-01..MC-04)
 *   Group 1 — runPlanning()                           (4 tests, RP-01..RP-04)
 *   Group 2 — runSpecifying()                         (5 tests, RS-01..RS-05)
 *   Group 3 — runLegalReview()                        (5 tests, RL-01..RL-05)
 *   Group 4 — runRiskAssessment()                     (4 tests, RR-01..RR-04)
 *   Group 5 — buildSessionSummary()                   (4 tests, BS-01..BS-04)
 *   Group 6 — AutonomousAgent.process()               (20 tests, PA-01..PA-20)
 *
 * Stub agents provide sub-agent isolation — no vi.fn()/vi.mock() on
 * business logic.  All agent-message routing flows through AgentRegistry.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { AgentRegistry } from '../agents/AgentRegistry';
import {
  AUTONOMOUS_LEGAL_BASIS,
  AutonomousAgent,
  runPlanning,
  runSpecifying,
  runLegalReview,
  runRiskAssessment,
  buildSessionSummary,
} from '../agents/AutonomousAgent';

import type {
  AgentSession,
  AutonomousInput,
  AutonomousOutput,
  AutonomousStateEvent,
  WorkflowState,
} from '../agents/AutonomousAgent';
import type { AgentMessage, AgentId, IAgent } from '../agents/types';
import type { AISuggestion }                  from '../ai/packageGenerator';
import type { PlannerOutput, ProcurementCalendar } from '../agents/PlannerAgent';
import type { SpecOutput }                    from '../agents/SpecificationAgent';
import type { DossierReviewOutput }           from '../agents/LegalReviewerAgent';
import type { RiskOutput }                    from '../agents/RiskAgent';

// ─── Stub agent output builders ───────────────────────────────────────────────

function makeSuggestion(overrides: Partial<AISuggestion> = {}): AISuggestion {
  return {
    packageName:           'Máy tính xách tay phục vụ đào tạo',
    packageCode:           'STUB-PC-001',
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
    ...overrides,
  };
}

function makeStubCalendar(): ProcurementCalendar {
  return {
    budgetYear:           2026,
    entries:              [],
    totalByQuarter:       { Q1: 0, Q2: 0, Q3: 0, Q4: 0 },
    totalAnnual:          0,
    khlcntSubmissionDate: '2026-01-15',
  };
}

function makeStubPlannerOutput(overrides: Partial<PlannerOutput> = {}): PlannerOutput {
  return {
    packages:          [makeSuggestion()],
    splitWarnings:     [],
    authorityChecks:   [],
    calendar:          makeStubCalendar(),
    totalEstimated:    200_000_000,
    budgetUtilization: -1,
    legalBasis:        ['STUB-PLANNER-LEGAL-BASIS'],
    confidence:        'high',
    warnings:          [],
    ...overrides,
  };
}

function makeStubSpecOutput(overrides: Partial<SpecOutput> = {}): SpecOutput {
  return {
    specs:            'Tiêu chuẩn kỹ thuật tối thiểu theo yêu cầu chức năng.',
    reasoning:        ['Dựa trên yêu cầu chức năng, không khóa thương hiệu.'],
    brandWarnings:    [],
    alternatives:     [],
    complianceStatus: 'compliant',
    legalBasis:       ['STUB-SPEC-LEGAL-BASIS'],
    ...overrides,
  };
}

function makeStubDossierReview(overrides: Partial<DossierReviewOutput> = {}): DossierReviewOutput {
  return {
    findings:         [],
    crossCheckIssues: [],
    complianceScore:  95,
    auditReadiness:   'ready',
    recommendations:  [],
    legalBasis:       ['STUB-LEGAL-REVIEW-BASIS'],
    ...overrides,
  };
}

function makeStubRiskOutput(overrides: Partial<RiskOutput> = {}): RiskOutput {
  return {
    overallRisk:   'CLEAN',
    riskMatrix:    [],
    systemicRisks: [],
    auditExposure: {
      probability:       'low',
      potentialFindings: [],
      estimatedImpact:   'Rủi ro thấp, không có phát hiện quan trọng.',
    },
    mitigationPlan: [],
    legalBasis:     ['STUB-RISK-LEGAL-BASIS'],
    ...overrides,
  };
}

// ─── Stub agents ──────────────────────────────────────────────────────────────

class StubPlannerAgent implements IAgent {
  readonly id   = 'planner' as const;
  readonly name = 'Stub Planner';
  constructor(
    private readonly registry: AgentRegistry,
    private readonly output?: Partial<PlannerOutput>,
  ) {}
  async process(msg: AgentMessage): Promise<AgentMessage> {
    const response: AgentMessage = {
      traceId:   msg.traceId,
      from:      'planner',
      to:        msg.from as AgentId | 'user',
      type:      'response',
      payload:   makeStubPlannerOutput(this.output ?? {}),
      timestamp: Date.now(),
    };
    this.registry.log(response);
    return response;
  }
  getCapabilities() { return []; }
}

class StubSpecAgent implements IAgent {
  readonly id   = 'specification' as const;
  readonly name = 'Stub Specification';
  constructor(
    private readonly registry: AgentRegistry,
    private readonly output?: Partial<SpecOutput>,
  ) {}
  async process(msg: AgentMessage): Promise<AgentMessage> {
    const response: AgentMessage = {
      traceId:   msg.traceId,
      from:      'specification',
      to:        msg.from as AgentId | 'user',
      type:      'response',
      payload:   makeStubSpecOutput(this.output ?? {}),
      timestamp: Date.now(),
    };
    this.registry.log(response);
    return response;
  }
  getCapabilities() { return []; }
}

class StubLegalAgent implements IAgent {
  readonly id   = 'legal-reviewer' as const;
  readonly name = 'Stub Legal Reviewer';
  constructor(
    private readonly registry: AgentRegistry,
    private readonly output?: Partial<DossierReviewOutput>,
  ) {}
  async process(msg: AgentMessage): Promise<AgentMessage> {
    const response: AgentMessage = {
      traceId:   msg.traceId,
      from:      'legal-reviewer',
      to:        msg.from as AgentId | 'user',
      type:      'response',
      payload:   makeStubDossierReview(this.output ?? {}),
      timestamp: Date.now(),
    };
    this.registry.log(response);
    return response;
  }
  getCapabilities() { return []; }
}

class StubRiskAgent implements IAgent {
  readonly id   = 'risk' as const;
  readonly name = 'Stub Risk';
  constructor(
    private readonly registry: AgentRegistry,
    private readonly output?: Partial<RiskOutput>,
  ) {}
  async process(msg: AgentMessage): Promise<AgentMessage> {
    const response: AgentMessage = {
      traceId:   msg.traceId,
      from:      'risk',
      to:        msg.from as AgentId | 'user',
      type:      'response',
      payload:   makeStubRiskOutput(this.output ?? {}),
      timestamp: Date.now(),
    };
    this.registry.log(response);
    return response;
  }
  getCapabilities() { return []; }
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    sessionId:   'test-session-001',
    state:       'idle',
    goal:        'Mua sắm máy tính xách tay cho phòng thực hành',
    messageLog:  [],
    startedAt:   Date.now(),
    specRetries: 0,
    budgetYear:  2026,
    totalBudget: 200_000_000,
    ...overrides,
  };
}

function makeRequest(
  input:   AutonomousInput,
  traceId: string,
  from:    AgentId | 'user' = 'user',
): AgentMessage {
  return {
    traceId,
    from,
    to:        'autonomous',
    type:      'request',
    payload:   input,
    timestamp: Date.now(),
  };
}

function makeFullRegistry(opts: {
  plannerOutput?:  Partial<PlannerOutput>;
  specOutput?:     Partial<SpecOutput>;
  legalOutput?:    Partial<DossierReviewOutput>;
  riskOutput?:     Partial<RiskOutput>;
} = {}): AgentRegistry {
  const registry = new AgentRegistry();
  registry.register(new StubPlannerAgent(registry, opts.plannerOutput));
  registry.register(new StubSpecAgent(registry,    opts.specOutput));
  registry.register(new StubLegalAgent(registry,   opts.legalOutput));
  registry.register(new StubRiskAgent(registry,    opts.riskOutput));
  return registry;
}

// ─── Group 0: Module constants and capabilities ───────────────────────────────

describe('AutonomousAgent — module constants and capabilities', () => {
  it('MC-01: AUTONOMOUS_LEGAL_BASIS contains exactly 5 citations', () => {
    expect(AUTONOMOUS_LEGAL_BASIS).toHaveLength(5);
  });

  it('MC-02: every citation references a real Vietnamese legal instrument', () => {
    const hasLegalRef = (s: string) =>
      s.includes('Luật Đấu thầu') || s.includes('Nghị định');
    expect(AUTONOMOUS_LEGAL_BASIS.every(hasLegalRef)).toBe(true);
  });

  it('MC-03: AutonomousAgent.id === "autonomous"', () => {
    const registry = new AgentRegistry();
    const agent    = new AutonomousAgent(registry);
    expect(agent.id).toBe('autonomous');
  });

  it('MC-04: getCapabilities() returns ≥ 7 capability strings', () => {
    const registry = new AgentRegistry();
    const agent    = new AutonomousAgent(registry);
    expect(agent.getCapabilities().length).toBeGreaterThanOrEqual(7);
  });
});

// ─── Group 1: runPlanning() ───────────────────────────────────────────────────

describe('runPlanning()', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
    registry.register(new StubPlannerAgent(registry));
  });

  it('RP-01: populates plannerOutput in the returned session', async () => {
    const session = makeSession();
    const result  = await runPlanning(session, registry, 'trace-rp01');
    expect(result.plannerOutput).toBeDefined();
    expect(result.plannerOutput?.packages).toHaveLength(1);
  });

  it('RP-02: messageLog grows by exactly 2 (request + response)', async () => {
    const session = makeSession();
    const result  = await runPlanning(session, registry, 'trace-rp02');
    expect(result.messageLog).toHaveLength(2);
  });

  it('RP-03: first messageLog entry is the request routed to "planner"', async () => {
    const session = makeSession();
    const result  = await runPlanning(session, registry, 'trace-rp03');
    expect(result.messageLog[0].to).toBe('planner');
    expect(result.messageLog[0].from).toBe('autonomous');
    expect(result.messageLog[0].type).toBe('request');
  });

  it('RP-04: registry trace for traceId contains exactly 2 messages', async () => {
    const session = makeSession();
    await runPlanning(session, registry, 'trace-rp04');
    // registry.process logs request; stub logs response
    expect(registry.getTrace('trace-rp04')).toHaveLength(2);
  });
});

// ─── Group 2: runSpecifying() ─────────────────────────────────────────────────

describe('runSpecifying()', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
    registry.register(new StubSpecAgent(registry));
  });

  it('RS-01: populates pkg in the returned session', async () => {
    const session = makeSession({ plannerOutput: makeStubPlannerOutput() });
    const result  = await runSpecifying(session, registry, 'trace-rs01');
    expect(result.pkg).toBeDefined();
    expect(result.pkg!.items).toHaveLength(1);
  });

  it('RS-02: pkg.items[0].specs is populated from SpecOutput.specs', async () => {
    const session = makeSession({ plannerOutput: makeStubPlannerOutput() });
    const result  = await runSpecifying(session, registry, 'trace-rs02');
    expect(result.pkg!.items[0].specs).toBe(
      'Tiêu chuẩn kỹ thuật tối thiểu theo yêu cầu chức năng.',
    );
  });

  it('RS-03: specRetries incremented when stub returns brandWarnings', async () => {
    registry = new AgentRegistry();
    registry.register(new StubSpecAgent(registry, { brandWarnings: ['TestBrand'] }));
    const session = makeSession({ plannerOutput: makeStubPlannerOutput() });
    const result  = await runSpecifying(session, registry, 'trace-rs03');
    expect(result.specRetries).toBe(1);
  });

  it('RS-04: specRetries NOT incremented when brandWarnings is empty', async () => {
    const session = makeSession({ plannerOutput: makeStubPlannerOutput() });
    const result  = await runSpecifying(session, registry, 'trace-rs04');
    expect(result.specRetries).toBe(0);
  });

  it('RS-05: throws when plannerOutput.packages is empty', async () => {
    const session = makeSession({
      plannerOutput: makeStubPlannerOutput({ packages: [] }),
    });
    await expect(
      runSpecifying(session, registry, 'trace-rs05'),
    ).rejects.toThrow('runSpecifying');
  });
});

// ─── Group 3: runLegalReview() ────────────────────────────────────────────────

describe('runLegalReview()', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
    registry.register(new StubLegalAgent(registry));
  });

  it('RL-01: populates dossierReview in the returned session', async () => {
    const { buildMinimalProcurementPackage } = await import('../agents/PlannerAgent');
    const pkg     = buildMinimalProcurementPackage(makeSuggestion(), 2026);
    const session = makeSession({
      plannerOutput: makeStubPlannerOutput(),
      pkg,
    });
    const result = await runLegalReview(session, registry, 'trace-rl01');
    expect(result.dossierReview).toBeDefined();
    expect(result.dossierReview!.complianceScore).toBe(95);
  });

  it('RL-02: request payload includes documentIds 1..28', async () => {
    const { buildMinimalProcurementPackage } = await import('../agents/PlannerAgent');
    const pkg     = buildMinimalProcurementPackage(makeSuggestion(), 2026);
    const session = makeSession({
      plannerOutput: makeStubPlannerOutput(),
      pkg,
    });
    const result      = await runLegalReview(session, registry, 'trace-rl02');
    const requestMsg  = result.messageLog[0];
    const sentIds     = (requestMsg.payload as { documentIds: number[] }).documentIds;
    expect(sentIds).toHaveLength(28);
    expect(sentIds[0]).toBe(1);
    expect(sentIds[27]).toBe(28);
  });

  it('RL-03: methodCode taken from plannerOutput.packages[0].procurementMethodHint', async () => {
    const { buildMinimalProcurementPackage } = await import('../agents/PlannerAgent');
    const pkg     = buildMinimalProcurementPackage(makeSuggestion(), 2026);
    const session = makeSession({
      plannerOutput: makeStubPlannerOutput({
        packages: [makeSuggestion({ procurementMethodHint: 'OPEN_BIDDING' })],
      }),
      pkg,
    });
    const result     = await runLegalReview(session, registry, 'trace-rl03');
    const requestMsg = result.messageLog[0];
    expect(
      (requestMsg.payload as { methodCode: string }).methodCode,
    ).toBe('OPEN_BIDDING');
  });

  it('RL-04: methodCode falls back to DIRECT_SELECTION_SIMPLIFIED when no procurementMethodHint', async () => {
    const { buildMinimalProcurementPackage } = await import('../agents/PlannerAgent');
    const pkg     = buildMinimalProcurementPackage(makeSuggestion(), 2026);
    // plannerOutput has empty packages — forces fallback
    const session = makeSession({
      plannerOutput: makeStubPlannerOutput({ packages: [] }),
      pkg,
    });
    const result     = await runLegalReview(session, registry, 'trace-rl04');
    const requestMsg = result.messageLog[0];
    expect(
      (requestMsg.payload as { methodCode: string }).methodCode,
    ).toBe('DIRECT_SELECTION_SIMPLIFIED');
  });

  it('RL-05: throws when session.pkg is undefined', async () => {
    const session = makeSession({ plannerOutput: makeStubPlannerOutput() });
    await expect(
      runLegalReview(session, registry, 'trace-rl05'),
    ).rejects.toThrow('runLegalReview');
  });
});

// ─── Group 4: runRiskAssessment() ────────────────────────────────────────────

describe('runRiskAssessment()', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
    registry.register(new StubRiskAgent(registry));
  });

  it('RR-01: populates riskOutput in the returned session', async () => {
    const { buildMinimalProcurementPackage } = await import('../agents/PlannerAgent');
    const pkg     = buildMinimalProcurementPackage(makeSuggestion(), 2026);
    const session = makeSession({
      plannerOutput: makeStubPlannerOutput(),
      pkg,
      dossierReview: makeStubDossierReview(),
    });
    const result = await runRiskAssessment(session, registry, 'trace-rr01');
    expect(result.riskOutput).toBeDefined();
    expect(result.riskOutput!.overallRisk).toBe('CLEAN');
  });

  it('RR-02: messageLog grows by exactly 2 (request + response)', async () => {
    const { buildMinimalProcurementPackage } = await import('../agents/PlannerAgent');
    const pkg     = buildMinimalProcurementPackage(makeSuggestion(), 2026);
    const session = makeSession({
      pkg,
      dossierReview: makeStubDossierReview(),
    });
    const result = await runRiskAssessment(session, registry, 'trace-rr02');
    expect(result.messageLog).toHaveLength(2);
  });

  it('RR-03: throws when session.pkg is undefined', async () => {
    const session = makeSession({ dossierReview: makeStubDossierReview() });
    await expect(
      runRiskAssessment(session, registry, 'trace-rr03'),
    ).rejects.toThrow('runRiskAssessment');
  });

  it('RR-04: throws when session.dossierReview is undefined', async () => {
    const { buildMinimalProcurementPackage } = await import('../agents/PlannerAgent');
    const pkg     = buildMinimalProcurementPackage(makeSuggestion(), 2026);
    const session = makeSession({ pkg });
    await expect(
      runRiskAssessment(session, registry, 'trace-rr04'),
    ).rejects.toThrow('runRiskAssessment');
  });
});

// ─── Group 5: buildSessionSummary() ──────────────────────────────────────────

describe('buildSessionSummary()', () => {
  const ALL_STATES: WorkflowState[] = [
    'idle', 'planning', 'specifying', 'legal-review',
    'risk-assessment', 'ask-user', 'ready-for-export',
    'exporting', 'done', 'error',
  ];

  it('BS-01: all 10 states return a non-empty Vietnamese string', () => {
    for (const state of ALL_STATES) {
      const summary = buildSessionSummary(makeSession({ state }));
      expect(summary.length).toBeGreaterThan(0);
    }
  });

  it('BS-02: each state returns a unique summary string', () => {
    const summaries = ALL_STATES.map(s => buildSessionSummary(makeSession({ state: s })));
    const unique    = new Set(summaries);
    expect(unique.size).toBe(ALL_STATES.length);
  });

  it('BS-03: idle → expected Vietnamese text', () => {
    expect(buildSessionSummary(makeSession({ state: 'idle' }))).toBe(
      'Phiên làm việc chưa được khởi động.',
    );
  });

  it('BS-04: error → expected Vietnamese text', () => {
    expect(buildSessionSummary(makeSession({ state: 'error' }))).toBe(
      'Phiên làm việc kết thúc do lỗi; hồ sơ được lưu để kiểm tra.',
    );
  });
});

// ─── Group 6: AutonomousAgent.process() ──────────────────────────────────────

describe('AutonomousAgent.process() — action=run (success path)', () => {
  let registry: AgentRegistry;
  let agent:    AutonomousAgent;

  beforeEach(() => {
    registry = makeFullRegistry();
    agent    = new AutonomousAgent(registry);
  });

  it('PA-01: valid run → type="response" with preserved traceId', async () => {
    const msg      = makeRequest({ action: 'run', goal: 'Mua sắm máy tính' }, 'trace-PA01');
    const response = await agent.process(msg);
    expect(response.type).toBe('response');
    expect(response.traceId).toBe('trace-PA01');
  });

  it('PA-02: run → state machine emits 5 transitions in correct order', async () => {
    const msg = makeRequest({ action: 'run', goal: 'Mua sắm máy tính' }, 'trace-PA02');
    await agent.process(msg);
    const trace       = registry.getTrace('trace-PA02');
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

  it('PA-03: run → registry trace contains exactly 15 messages', async () => {
    const msg = makeRequest({ action: 'run', goal: 'Mua sắm máy tính' }, 'trace-PA03');
    await agent.process(msg);
    // 1 incoming + 5 events + 4 sub-agent requests + 4 sub-agent responses + 1 final response
    expect(registry.getTrace('trace-PA03')).toHaveLength(15);
  });

  it('PA-04: agent.state resets to "idle" after successful run', async () => {
    const msg = makeRequest({ action: 'run', goal: 'Mua sắm máy tính' }, 'trace-PA04');
    await agent.process(msg);
    expect((agent as unknown as { state: string }).state).toBe('idle');
  });

  it('PA-05: run → response.from === "autonomous"', async () => {
    const msg      = makeRequest({ action: 'run', goal: 'Mua sắm máy tính' }, 'trace-PA05');
    const response = await agent.process(msg);
    expect(response.from).toBe('autonomous');
  });

  it('PA-06: run → session.state === "ready-for-export" in output', async () => {
    const msg      = makeRequest({ action: 'run', goal: 'Mua sắm máy tính' }, 'trace-PA06');
    const response = await agent.process(msg);
    const output   = response.payload as AutonomousOutput;
    expect(output.session.state).toBe('ready-for-export');
  });

  it('PA-07: run → session.completedAt is a positive timestamp', async () => {
    const msg      = makeRequest({ action: 'run', goal: 'Mua sắm máy tính' }, 'trace-PA07');
    const response = await agent.process(msg);
    const output   = response.payload as AutonomousOutput;
    expect(output.session.completedAt).toBeGreaterThan(0);
  });

  it('PA-08: run → session.plannerOutput.packages[0] is present', async () => {
    const msg      = makeRequest({ action: 'run', goal: 'Mua sắm máy tính' }, 'trace-PA08');
    const response = await agent.process(msg);
    const output   = response.payload as AutonomousOutput;
    expect(output.session.plannerOutput?.packages).toHaveLength(1);
  });
});

describe('AutonomousAgent.process() — error paths', () => {
  let registry: AgentRegistry;
  let agent:    AutonomousAgent;

  beforeEach(() => {
    registry = makeFullRegistry();
    agent    = new AutonomousAgent(registry);
  });

  it('PA-09: null payload → error AUTONOMOUS_MISSING_ACTION', async () => {
    const msg: AgentMessage = {
      traceId: 'trace-PA09', from: 'user', to: 'autonomous',
      type: 'request', payload: null, timestamp: Date.now(),
    };
    const response = await agent.process(msg);
    expect(response.type).toBe('error');
    expect((response.payload as { code: string }).code).toBe('AUTONOMOUS_MISSING_ACTION');
  });

  it('PA-10: run without goal → error AUTONOMOUS_MISSING_GOAL', async () => {
    const msg      = makeRequest({ action: 'run' }, 'trace-PA10');
    const response = await agent.process(msg);
    expect(response.type).toBe('error');
    expect((response.payload as { code: string }).code).toBe('AUTONOMOUS_MISSING_GOAL');
  });

  it('PA-11: run with whitespace-only goal → error AUTONOMOUS_MISSING_GOAL', async () => {
    const msg      = makeRequest({ action: 'run', goal: '   ' }, 'trace-PA11');
    const response = await agent.process(msg);
    expect(response.type).toBe('error');
    expect((response.payload as { code: string }).code).toBe('AUTONOMOUS_MISSING_GOAL');
  });

  it('PA-12: agent.state resets to "idle" after error response', async () => {
    const msg = makeRequest({ action: 'run' }, 'trace-PA12');
    await agent.process(msg);
    expect((agent as unknown as { state: string }).state).toBe('idle');
  });

  it('PA-13: error response preserves traceId from request', async () => {
    const msg      = makeRequest({ action: 'run' }, 'trace-PA13');
    const response = await agent.process(msg);
    expect(response.type).toBe('error');
    expect(response.traceId).toBe('trace-PA13');
  });
});

describe('AutonomousAgent.process() — action=pause', () => {
  let registry: AgentRegistry;
  let agent:    AutonomousAgent;

  beforeEach(async () => {
    registry = makeFullRegistry();
    agent    = new AutonomousAgent(registry);
    await agent.process(makeRequest({ action: 'run', goal: 'Mua sắm thiết bị' }, 'trace-run-setup'));
  });

  it('PA-14: pause after run → type="response", session.state="ask-user"', async () => {
    const response = await agent.process(makeRequest({ action: 'pause' }, 'trace-PA14'));
    expect(response.type).toBe('response');
    const output   = response.payload as AutonomousOutput;
    expect(output.session.state).toBe('ask-user');
  });

  it('PA-15: pause → pendingQuestion is set with required=true', async () => {
    const response = await agent.process(makeRequest({ action: 'pause' }, 'trace-PA15'));
    const output   = response.payload as AutonomousOutput;
    expect(output.session.pendingQuestion).toBeDefined();
    expect(output.session.pendingQuestion!.required).toBe(true);
  });

  it('PA-16: pause (no prior session) → error AUTONOMOUS_CANNOT_PAUSE', async () => {
    const freshRegistry = makeFullRegistry();
    const freshAgent    = new AutonomousAgent(freshRegistry);
    const response      = await freshAgent.process(makeRequest({ action: 'pause' }, 'trace-PA16'));
    expect(response.type).toBe('error');
    expect((response.payload as { code: string }).code).toBe('AUTONOMOUS_CANNOT_PAUSE');
  });
});

describe('AutonomousAgent.process() — action=resume', () => {
  let registry:   AgentRegistry;
  let agent:      AutonomousAgent;
  let questionId: string;

  beforeEach(async () => {
    registry = makeFullRegistry();
    agent    = new AutonomousAgent(registry);
    await agent.process(makeRequest({ action: 'run', goal: 'Mua sắm thiết bị' }, 'trace-run-setup'));
    // Pause to enter ask-user state
    const pauseResponse = await agent.process(makeRequest({ action: 'pause' }, 'trace-pause-setup'));
    const pauseOutput   = pauseResponse.payload as AutonomousOutput;
    questionId          = pauseOutput.session.pendingQuestion!.questionId;
  });

  it('PA-17: resume after pause → type="response", session.state="ready-for-export"', async () => {
    const response = await agent.process(makeRequest({
      action:     'resume',
      userAnswer: { questionId, answer: 'Xác nhận tiếp tục' },
    }, 'trace-PA17'));
    expect(response.type).toBe('response');
    const output   = response.payload as AutonomousOutput;
    expect(output.session.state).toBe('ready-for-export');
  });

  it('PA-18: resume → pendingQuestion is cleared', async () => {
    const response = await agent.process(makeRequest({
      action:     'resume',
      userAnswer: { questionId, answer: 'Xác nhận tiếp tục' },
    }, 'trace-PA18'));
    const output   = response.payload as AutonomousOutput;
    expect(output.session.pendingQuestion).toBeUndefined();
  });

  it('PA-19: resume with wrong questionId → error AUTONOMOUS_ANSWER_MISMATCH', async () => {
    const response = await agent.process(makeRequest({
      action:     'resume',
      userAnswer: { questionId: 'wrong-id', answer: 'Không khớp' },
    }, 'trace-PA19'));
    expect(response.type).toBe('error');
    expect((response.payload as { code: string }).code).toBe('AUTONOMOUS_ANSWER_MISMATCH');
  });

  it('PA-20: resume without userAnswer → error AUTONOMOUS_MISSING_ANSWER', async () => {
    const response = await agent.process(makeRequest({ action: 'resume' }, 'trace-PA20'));
    expect(response.type).toBe('error');
    expect((response.payload as { code: string }).code).toBe('AUTONOMOUS_MISSING_ANSWER');
  });
});

describe('AutonomousAgent.process() — action=status and export', () => {
  let registry: AgentRegistry;
  let agent:    AutonomousAgent;

  beforeEach(async () => {
    registry = makeFullRegistry();
    agent    = new AutonomousAgent(registry);
    await agent.process(makeRequest({ action: 'run', goal: 'Mua sắm thiết bị' }, 'trace-run-setup'));
  });

  it('PA-21: status after run → type="response", session present', async () => {
    const response = await agent.process(makeRequest({ action: 'status' }, 'trace-PA21'));
    expect(response.type).toBe('response');
    const output   = response.payload as AutonomousOutput;
    expect(output.session).toBeDefined();
    expect(output.session.goal).toBe('Mua sắm thiết bị');
  });

  it('PA-22: status (no session) → error AUTONOMOUS_NO_SESSION', async () => {
    const freshRegistry = makeFullRegistry();
    const freshAgent    = new AutonomousAgent(freshRegistry);
    const response      = await freshAgent.process(makeRequest({ action: 'status' }, 'trace-PA22'));
    expect(response.type).toBe('error');
    expect((response.payload as { code: string }).code).toBe('AUTONOMOUS_NO_SESSION');
  });

  it('PA-23: export after run → returns session with populated messageLog', async () => {
    const response = await agent.process(makeRequest({ action: 'export' }, 'trace-PA23'));
    expect(response.type).toBe('response');
    const output   = response.payload as AutonomousOutput;
    expect(output.session.messageLog.length).toBeGreaterThan(0);
  });

  it('PA-24: export (no session) → error AUTONOMOUS_NO_SESSION', async () => {
    const freshRegistry = makeFullRegistry();
    const freshAgent    = new AutonomousAgent(freshRegistry);
    const response      = await freshAgent.process(makeRequest({ action: 'export' }, 'trace-PA24'));
    expect(response.type).toBe('error');
    expect((response.payload as { code: string }).code).toBe('AUTONOMOUS_NO_SESSION');
  });
});

describe('AutonomousAgent.process() — legalBasis collection', () => {
  let registry: AgentRegistry;
  let agent:    AutonomousAgent;
  let response: AgentMessage;

  beforeEach(async () => {
    registry = makeFullRegistry();
    agent    = new AutonomousAgent(registry);
    response = await agent.process(
      makeRequest({ action: 'run', goal: 'Mua sắm vật tư' }, 'trace-lb-setup'),
    );
  });

  it('PA-25: response.legalBasis contains all 5 AUTONOMOUS_LEGAL_BASIS entries', () => {
    for (const citation of AUTONOMOUS_LEGAL_BASIS) {
      expect(response.legalBasis).toContain(citation);
    }
  });

  it('PA-26: legalBasis is forwarded to both AgentMessage and AutonomousOutput', () => {
    const output = response.payload as AutonomousOutput;
    expect(response.legalBasis).toEqual(output.legalBasis);
  });

  it('PA-27: stub planner citation merged into legalBasis', () => {
    expect(response.legalBasis).toContain('STUB-PLANNER-LEGAL-BASIS');
  });

  it('PA-28: stub risk citation merged into legalBasis', () => {
    expect(response.legalBasis).toContain('STUB-RISK-LEGAL-BASIS');
  });

  it('PA-29: legalBasis is deduplicated (no repeated entries)', () => {
    const arr  = response.legalBasis ?? [];
    const set  = new Set(arr);
    expect(arr.length).toBe(set.size);
  });

  it('PA-30: summary in AutonomousOutput is a non-empty Vietnamese string', () => {
    const output = response.payload as AutonomousOutput;
    expect(output.summary.length).toBeGreaterThan(0);
  });
});
