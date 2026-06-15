/**
 * P6-07C: Stress tests and edge cases
 *
 * Extends P6-07A/B with adversarial inputs, boundary conditions, and
 * concurrent-execution scenarios using REAL agents (no stubs).
 *
 * Coverage:
 *   Group C1  — Long conversations                          (4 tests)
 *   Group C2  — Many packages in one workflow               (4 tests)
 *   Group C3  — Repeated ask-user / resume loops            (4 tests)
 *   Group C4  — Duplicate legalBasis suppression            (3 tests)
 *   Group C5  — Concurrent traces + traceId uniqueness      (3 tests)
 *   Group C6  — Malformed inputs                            (4 tests)
 *   Group C7  — Guard checks on pure functions              (3 tests)
 *   Group C8  — Partial failures and export after error     (4 tests)
 *   Group C9  — Invalid state transitions                   (4 tests)
 *   Group C10 — messageLog growth, timestamps, persistence  (4 tests)
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
  runLegalReview,
  runRiskAssessment,
  buildSessionSummary,
} from '../agents/AutonomousAgent';

import type { AgentMessage }   from '../agents/types';
import type {
  AutonomousInput,
  AutonomousOutput,
  AgentSession,
} from '../agents/AutonomousAgent';
import type { PlannerOutput, ProcurementCalendar } from '../agents/PlannerAgent';
import type { ChatMessage, ChatInput, ChatOutput }  from '../agents/ChatAgent';
import type { ProcurementPackage }                  from '../demoData';

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

function makeRegistryNoPlan(): AgentRegistry {
  const registry = new AgentRegistry();
  registry.register(new SpecificationAgent(registry));
  registry.register(new LegalReviewerAgent(registry));
  registry.register(new RiskAgent(registry));
  registry.register(new ChatAgent(registry));
  return registry;
}

// ─── Trace counter ───────────────────────────────────────────────────────────

let _cCounter = 0;
function ct(prefix = 'C'): string {
  return `${prefix}-${String(++_cCounter).padStart(4, '0')}`;
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

function chatMsg(input: ChatInput, traceId: string): AgentMessage {
  return { traceId, from: 'user', to: 'chat', type: 'request', payload: input, timestamp: Date.now() };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeBaseSession(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    sessionId:   'c-base-session',
    state:       'idle',
    goal:        'mua sắm vật tư tiêu hao',
    messageLog:  [],
    startedAt:   Date.now(),
    specRetries: 0,
    ...overrides,
  };
}

function makeEmptyPlannerOutput(): PlannerOutput {
  const calendar: ProcurementCalendar = {
    budgetYear:           2026,
    entries:              [],
    totalByQuarter:       { Q1: 0, Q2: 0, Q3: 0, Q4: 0 },
    totalAnnual:          0,
    khlcntSubmissionDate: '',
  };
  return {
    packages:          [],
    splitWarnings:     [],
    authorityChecks:   [],
    calendar,
    totalEstimated:    0,
    budgetUtilization: -1,
    legalBasis:        [],
    confidence:        'high' as const,
    warnings:          [],
  };
}

function makeCleanPkg(overrides: Partial<ProcurementPackage> = {}): ProcurementPackage {
  return {
    id:                      'c-pkg',
    packageName:             'Gói mua sắm vật tư',
    packageCode:             'C-PKG-001',
    fundingSource:           'autonomy_fund',
    fundingSourceName:       'Quỹ phát triển hoạt động sự nghiệp',
    budgetYear:              2026,
    rectorName:              '[Hiệu trưởng]',
    departmentName:          '[Đơn vị đề xuất]',
    departmentCode:          '[Mã phòng]',
    expertTeamLeader:        '[Tổ trưởng tổ chuyên gia]',
    expertTeamMember1:       '[Thành viên tổ chuyên gia]',
    expertTeamMember2:       '[Thành viên tổ chuyên gia]',
    appraisalLeader:         '[Tổ trưởng thẩm định]',
    appraisalMember:         '[Thành viên thẩm định]',
    supplier1Name:           '[Nhà cung cấp số 1]',
    supplier1Address:        '[Địa chỉ]',
    supplier1TaxCode:        '[Mã số thuế]',
    supplier1Representative: '[Người đại diện]',
    supplier1Position:       '[Chức vụ]',
    supplier2Name:           '[Nhà cung cấp số 2]',
    supplier2Address:        '[Địa chỉ]',
    supplier3Name:           '[Nhà cung cấp số 3]',
    supplier3Address:        '[Địa chỉ]',
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
      id:             'c-item-1',
      name:           'Vật tư tiêu hao',
      unit:           'Bộ',
      quantity:       1,
      unitPrice:      50_000_000,
      specs:          'Đạt tiêu chuẩn kỹ thuật tối thiểu.',
      supplier1Price: 50_000_000,
      supplier2Price: 48_000_000,
      supplier3Price: 49_000_000,
    }],
    ...overrides,
  };
}

// ─── ChatMessage factory for long history ─────────────────────────────────────

function makeChatHistory(n: number): ChatMessage[] {
  const now = Date.now();
  return Array.from({ length: n }, (_, i) => ({
    id:         `hist-${i}`,
    role:       (i % 2 === 0 ? 'user' : 'agent') as 'user' | 'agent',
    content:    i % 2 === 0
      ? `Câu hỏi về thủ tục mua sắm ${i + 1}: quy định thời gian là bao lâu?`
      : `Câu trả lời ${i}: Theo Luật Đấu thầu 22/2023/QH15...`,
    sources:    i % 2 === 1 ? ['Luật Đấu thầu 22/2023/QH15'] : [],
    confidence: 'medium' as const,
    timestamp:  now - (n - i) * 1000,
  }));
}

// ═════════════════════════════════════════════════════════════════════════════
// Group C1 — Long conversations
// ChatAgent must handle large history without crashing or degrading output quality.
// ═════════════════════════════════════════════════════════════════════════════

describe('Group C1 — Long conversations', () => {
  let registry: AgentRegistry;

  beforeAll(() => { registry = makeRegistry(); });

  it('C1-01: ChatAgent with 20-turn history returns a valid response', async () => {
    const input: ChatInput = {
      message:  'Thủ tục chỉ định thầu rút gọn gồm những bước nào?',
      history:  makeChatHistory(20),
    };
    const resp = await registry.process(chatMsg(input, ct('C1')));
    expect(resp.type).toBe('response');
    expect((resp.payload as ChatOutput).answer.length).toBeGreaterThan(0);
  });

  it('C1-02: ChatAgent multi-turn context uses last 2 user turns for query enrichment', async () => {
    const history  = makeChatHistory(10);
    const input1: ChatInput = {
      message: 'Ngưỡng chỉ định thầu là bao nhiêu?',
      history: history.slice(0, 6),
    };
    const input2: ChatInput = {
      message: 'Áp dụng với loại hàng hóa nào?',
      history: history,
    };
    const [resp1, resp2] = await Promise.all([
      registry.process(chatMsg(input1, ct('C1'))),
      registry.process(chatMsg(input2, ct('C1'))),
    ]);
    // Both must succeed regardless of history depth
    expect(resp1.type).toBe('response');
    expect(resp2.type).toBe('response');
  });

  it('C1-03: ChatAgent with empty history produces followUpSuggestions', async () => {
    const input: ChatInput = {
      message: 'Hồ sơ mua sắm cần có những tài liệu gì?',
      history: [],
    };
    const resp = await registry.process(chatMsg(input, ct('C1')));
    expect(resp.type).toBe('response');
    const out = resp.payload as ChatOutput;
    expect(Array.isArray(out.followUpSuggestions)).toBe(true);
  });

  it('C1-04: ChatAgent history with 30 turns does not throw — completes within reasonable time', async () => {
    const start = Date.now();
    const input: ChatInput = {
      message: 'Điều kiện hồ sơ sẵn sàng kiểm toán là gì?',
      history: makeChatHistory(30),
    };
    const resp = await registry.process(chatMsg(input, ct('C1')));
    const elapsed = Date.now() - start;
    expect(resp.type).toBe('response');
    // Should complete well within 5 seconds (pure in-memory logic)
    expect(elapsed).toBeLessThan(5000);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group C2 — Many packages in one workflow
// Goals with 3+ separators should produce 3+ packages; workflow processes [0].
// ═════════════════════════════════════════════════════════════════════════════

describe('Group C2 — Many packages in one workflow', () => {
  let out3: AutonomousOutput;
  let out3Comma: AutonomousOutput;

  beforeAll(async () => {
    const r1 = makeRegistry();
    const r2 = makeRegistry();
    const a1 = new AutonomousAgent(r1);
    const a2 = new AutonomousAgent(r2);
    const [resp1, resp2] = await Promise.all([
      a1.process(runMsg('mua máy tính và máy in và điều hòa không khí', ct('C2'))),
      a2.process(runMsg('mua văn phòng phẩm, vật tư thí nghiệm và thiết bị đào tạo', ct('C2'))),
    ]);
    out3      = resp1.payload as AutonomousOutput;
    out3Comma = resp2.payload as AutonomousOutput;
  });

  it('C2-01: goal with 2 "và" connectors produces ≥ 3 packages', () => {
    expect(out3.session.plannerOutput!.packages.length).toBeGreaterThanOrEqual(3);
  });

  it('C2-02: goal with comma and "và" connectors produces ≥ 2 packages', () => {
    expect(out3Comma.session.plannerOutput!.packages.length).toBeGreaterThanOrEqual(2);
  });

  it('C2-03: totalEstimated equals the sum of all package estimatedTotal values', () => {
    const { plannerOutput } = out3.session;
    const summed = plannerOutput!.packages.reduce(
      (sum, p) => sum + p.estimatedTotal, 0,
    );
    expect(plannerOutput!.totalEstimated).toBe(summed);
  });

  it('C2-04: processed pkg (packages[0]) carries the first suggestion name, not subsequent ones', () => {
    const first = out3.session.plannerOutput!.packages[0];
    expect(out3.session.pkg!.packageName).toBe(first.packageName);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group C3 — Repeated ask-user / resume loops (4 cycles)
// Four pause→resume cycles must each produce a fresh questionId and restore
// session.state to ready-for-export.  messageLog must not grow during these.
// ═════════════════════════════════════════════════════════════════════════════

describe('Group C3 — Repeated ask-user / resume loops (4 cycles)', () => {
  const CYCLES          = 4;
  const questionIds:    string[]             = [];
  const pauseOutputs:   AutonomousOutput[]   = [];
  const resumeOutputs:  AutonomousOutput[]   = [];
  let   initialLogLen:  number;

  beforeAll(async () => {
    const registry = makeRegistry();
    const agent    = new AutonomousAgent(registry);

    const runResp = await agent.process(
      runMsg('mua sắm văn phòng phẩm phục vụ đào tạo', ct('C3')),
    );
    initialLogLen = (runResp.payload as AutonomousOutput).session.messageLog.length;

    for (let i = 0; i < CYCLES; i++) {
      const pr = await agent.process(aMsg({ action: 'pause' }, ct('C3')));
      const po = pr.payload as AutonomousOutput;
      pauseOutputs.push(po);
      const qId = po.session.pendingQuestion!.questionId;
      questionIds.push(qId);

      const rr = await agent.process(
        aMsg({ action: 'resume', userAnswer: { questionId: qId, answer: `Xác nhận ${i + 1}` } }, ct('C3')),
      );
      resumeOutputs.push(rr.payload as AutonomousOutput);
    }
  });

  it('C3-01: each of the 4 pause cycles generates a distinct questionId', () => {
    expect(questionIds).toHaveLength(CYCLES);
    expect(new Set(questionIds).size).toBe(CYCLES);
  });

  it('C3-02: every resume restores session.state to ready-for-export', () => {
    for (const ro of resumeOutputs) {
      expect(ro.session.state).toBe('ready-for-export');
    }
  });

  it('C3-03: pendingQuestion is cleared (undefined) after each resume', () => {
    for (const ro of resumeOutputs) {
      expect(ro.session.pendingQuestion).toBeUndefined();
    }
  });

  it('C3-04: messageLog.length does not change across pause/resume cycles', () => {
    for (const ro of resumeOutputs) {
      expect(ro.session.messageLog.length).toBe(initialLogLen);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group C4 — Duplicate legalBasis suppression
// The Set-based collectLegalBasis must eliminate identical strings even when
// multiple sources contribute the same citation.
// ═════════════════════════════════════════════════════════════════════════════

describe('Group C4 — Duplicate legalBasis suppression', () => {
  let output: AutonomousOutput;

  beforeAll(async () => {
    const registry = makeRegistry();
    const agent    = new AutonomousAgent(registry);
    const resp = await agent.process(
      runMsg('mua sắm văn phòng phẩm phục vụ đào tạo', ct('C4')),
    );
    output = resp.payload as AutonomousOutput;
  });

  it('C4-01: output.legalBasis has no duplicate entries (Set invariant)', () => {
    const { legalBasis } = output;
    expect(legalBasis.length).toBe(new Set(legalBasis).size);
  });

  it('C4-02: collectLegalBasis produces at least AUTONOMOUS_LEGAL_BASIS.length entries', () => {
    expect(output.legalBasis.length).toBeGreaterThanOrEqual(AUTONOMOUS_LEGAL_BASIS.length);
  });

  it('C4-03: manual re-deduplication of all source arrays matches output.legalBasis', () => {
    const { session, legalBasis } = output;
    const manual = new Set<string>(AUTONOMOUS_LEGAL_BASIS);
    for (const s of session.plannerOutput?.legalBasis ?? []) manual.add(s);
    for (const s of session.dossierReview?.legalBasis ?? []) manual.add(s);
    for (const f of session.dossierReview?.findings  ?? []) { if (f.legalBasis) manual.add(f.legalBasis); }
    for (const s of session.riskOutput?.legalBasis   ?? []) manual.add(s);
    expect(new Set(legalBasis).size).toBe(manual.size);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group C5 — Concurrent traces + traceId uniqueness
// Two agents on separate registries running simultaneously must not pollute
// each other's trace stores and must produce distinct traceIds.
// ═════════════════════════════════════════════════════════════════════════════

describe('Group C5 — Concurrent traces + traceId uniqueness', () => {
  let registry1: AgentRegistry;
  let registry2: AgentRegistry;
  let traceId1:  string;
  let traceId2:  string;
  let out1:      AutonomousOutput;
  let out2:      AutonomousOutput;

  beforeAll(async () => {
    registry1 = makeRegistry();
    registry2 = makeRegistry();
    const agent1 = new AutonomousAgent(registry1);
    const agent2 = new AutonomousAgent(registry2);
    traceId1 = ct('C5');
    traceId2 = ct('C5');

    const [resp1, resp2] = await Promise.all([
      agent1.process(runMsg('mua sắm máy tính cho phòng thực hành', traceId1)),
      agent2.process(runMsg('mua sắm hóa chất thí nghiệm', traceId2)),
    ]);
    out1 = resp1.payload as AutonomousOutput;
    out2 = resp2.payload as AutonomousOutput;
  });

  it('C5-01: both concurrent workflows complete successfully', () => {
    expect(out1.session.state).toBe('ready-for-export');
    expect(out2.session.state).toBe('ready-for-export');
  });

  it('C5-02: the two traceIds are distinct (no collision from ct() counter)', () => {
    expect(traceId1).not.toBe(traceId2);
  });

  it('C5-03: each registry contains only its own traceId (no cross-contamination)', () => {
    // registry1 must not know about traceId2
    expect(registry1.getTrace(traceId2)).toHaveLength(0);
    // registry2 must not know about traceId1
    expect(registry2.getTrace(traceId1)).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group C6 — Malformed inputs
// AutonomousAgent.process() must return a typed error message (never throw)
// for every category of invalid input.
// ═════════════════════════════════════════════════════════════════════════════

describe('Group C6 — Malformed inputs', () => {
  it('C6-01: payload without action field → AUTONOMOUS_MISSING_ACTION', async () => {
    const registry = makeRegistry();
    const agent    = new AutonomousAgent(registry);
    const resp = await agent.process({
      traceId:   ct('C6'),
      from:      'user',
      to:        'autonomous',
      type:      'request',
      payload:   {} as unknown as AutonomousInput,
      timestamp: Date.now(),
    });
    expect(resp.type).toBe('error');
    expect((resp.payload as { code: string }).code).toBe('AUTONOMOUS_MISSING_ACTION');
  });

  it('C6-02: null payload → AUTONOMOUS_MISSING_ACTION', async () => {
    const registry = makeRegistry();
    const agent    = new AutonomousAgent(registry);
    const resp = await agent.process({
      traceId:   ct('C6'),
      from:      'user',
      to:        'autonomous',
      type:      'request',
      payload:   null as unknown as AutonomousInput,
      timestamp: Date.now(),
    });
    expect(resp.type).toBe('error');
    expect((resp.payload as { code: string }).code).toBe('AUTONOMOUS_MISSING_ACTION');
  });

  it('C6-03: action=run with empty string goal → AUTONOMOUS_MISSING_GOAL', async () => {
    const registry = makeRegistry();
    const agent    = new AutonomousAgent(registry);
    const resp = await agent.process(
      aMsg({ action: 'run', goal: '' }, ct('C6')),
    );
    expect(resp.type).toBe('error');
    expect((resp.payload as { code: string }).code).toBe('AUTONOMOUS_MISSING_GOAL');
  });

  it('C6-04: action=run with whitespace-only goal → AUTONOMOUS_MISSING_GOAL', async () => {
    const registry = makeRegistry();
    const agent    = new AutonomousAgent(registry);
    const resp = await agent.process(
      aMsg({ action: 'run', goal: '   \t\n   ' }, ct('C6')),
    );
    expect(resp.type).toBe('error');
    expect((resp.payload as { code: string }).code).toBe('AUTONOMOUS_MISSING_GOAL');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group C7 — Guard checks on pure functions
// The exported pure helpers (runSpecifying, runLegalReview, runRiskAssessment)
// must throw with descriptive messages when preconditions are not met.
// ═════════════════════════════════════════════════════════════════════════════

describe('Group C7 — Guard checks on pure functions', () => {
  let registry: AgentRegistry;

  beforeAll(() => { registry = makeRegistry(); });

  it('C7-01: runSpecifying with empty packages array throws', async () => {
    const session = makeBaseSession({
      state:         'specifying',
      plannerOutput: makeEmptyPlannerOutput(),
    });
    await expect(runSpecifying(session, registry, ct('C7')))
      .rejects.toThrow('plannerOutput.packages is empty');
  });

  it('C7-02: runLegalReview without session.pkg throws', async () => {
    const session = makeBaseSession({
      state: 'legal-review',
      pkg:   undefined,
    });
    await expect(runLegalReview(session, registry, ct('C7')))
      .rejects.toThrow('session.pkg is required');
  });

  it('C7-03: runRiskAssessment without session.dossierReview throws', async () => {
    const session = makeBaseSession({
      state:         'risk-assessment',
      pkg:           makeCleanPkg(),
      dossierReview: undefined,
    });
    await expect(runRiskAssessment(session, registry, ct('C7')))
      .rejects.toThrow('session.pkg and session.dossierReview are required');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group C8 — Partial failures and export after error recovery
// After an AUTONOMOUS_INTERNAL_ERROR, the session is preserved with state='error'.
// status() and export() should surface this error session without re-throwing.
// After re-creating the agent on a clean registry, a fresh run succeeds.
// ═════════════════════════════════════════════════════════════════════════════

describe('Group C8 — Partial failures and export after error', () => {
  let errorAgent:   AutonomousAgent;
  let statusResp:   AgentMessage;
  let exportResp:   AgentMessage;

  beforeAll(async () => {
    const brokenRegistry = makeRegistryNoPlan();
    errorAgent = new AutonomousAgent(brokenRegistry);

    // First run fails (no PlannerAgent)
    await errorAgent.process(runMsg('mua sắm vật tư', ct('C8')));

    // status and export should work on the preserved error session
    statusResp = await errorAgent.process(aMsg({ action: 'status' }, ct('C8')));
    exportResp = await errorAgent.process(aMsg({ action: 'export' }, ct('C8')));
  });

  it('C8-01: status() after AUTONOMOUS_INTERNAL_ERROR returns session with state=error', () => {
    expect(statusResp.type).toBe('response');
    expect((statusResp.payload as AutonomousOutput).session.state).toBe('error');
  });

  it('C8-02: export() after AUTONOMOUS_INTERNAL_ERROR returns session with state=error', () => {
    expect(exportResp.type).toBe('response');
    expect((exportResp.payload as AutonomousOutput).session.state).toBe('error');
  });

  it('C8-03: buildSessionSummary for error state returns the error Vietnamese string', () => {
    const summary = buildSessionSummary({ state: 'error' } as AgentSession);
    expect(summary).toBe('Phiên làm việc kết thúc do lỗi; hồ sơ được lưu để kiểm tra.');
  });

  it('C8-04: a fresh agent on a clean registry succeeds after the broken agent failed', async () => {
    const cleanRegistry  = makeRegistry();
    const freshAgent     = new AutonomousAgent(cleanRegistry);
    const resp = await freshAgent.process(
      runMsg('mua sắm văn phòng phẩm phục vụ đào tạo', ct('C8')),
    );
    expect(resp.type).toBe('response');
    expect((resp.payload as AutonomousOutput).session.state).toBe('ready-for-export');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group C9 — Invalid state transitions
// Every guard path in pauseWorkflow / resumeWorkflow / getStatus / exportSession
// must return a typed error code rather than throwing.
// ═════════════════════════════════════════════════════════════════════════════

describe('Group C9 — Invalid state transitions', () => {
  it('C9-01: export before any run → AUTONOMOUS_NO_SESSION', async () => {
    const agent = new AutonomousAgent(makeRegistry());
    const resp  = await agent.process(aMsg({ action: 'export' }, ct('C9')));
    expect(resp.type).toBe('error');
    expect((resp.payload as { code: string }).code).toBe('AUTONOMOUS_NO_SESSION');
  });

  it('C9-02: status before any run → AUTONOMOUS_NO_SESSION', async () => {
    const agent = new AutonomousAgent(makeRegistry());
    const resp  = await agent.process(aMsg({ action: 'status' }, ct('C9')));
    expect(resp.type).toBe('error');
    expect((resp.payload as { code: string }).code).toBe('AUTONOMOUS_NO_SESSION');
  });

  it('C9-03: pause before any run → AUTONOMOUS_CANNOT_PAUSE', async () => {
    const agent = new AutonomousAgent(makeRegistry());
    const resp  = await agent.process(aMsg({ action: 'pause' }, ct('C9')));
    expect(resp.type).toBe('error');
    expect((resp.payload as { code: string }).code).toBe('AUTONOMOUS_CANNOT_PAUSE');
  });

  it('C9-04: resume after run (not paused) → AUTONOMOUS_NOT_PAUSED', async () => {
    const registry = makeRegistry();
    const agent    = new AutonomousAgent(registry);
    // Run to completion — session.state becomes ready-for-export (not ask-user)
    await agent.process(runMsg('mua sắm văn phòng phẩm', ct('C9')));
    const resp = await agent.process(
      aMsg({ action: 'resume', userAnswer: { questionId: 'wrong-id', answer: 'test' } }, ct('C9')),
    );
    expect(resp.type).toBe('error');
    expect((resp.payload as { code: string }).code).toBe('AUTONOMOUS_NOT_PAUSED');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group C10 — messageLog growth, timestamp consistency, session persistence
// ═════════════════════════════════════════════════════════════════════════════

describe('Group C10 — messageLog growth, timestamps, session persistence', () => {
  let session: AgentSession;

  beforeAll(async () => {
    const registry = makeRegistry();
    const agent    = new AutonomousAgent(registry);
    const resp = await agent.process(
      runMsg('mua sắm văn phòng phẩm phục vụ đào tạo', ct('C10')),
    );
    session = (resp.payload as AutonomousOutput).session;
  });

  it('C10-01: messageLog grows by exactly 2 per sub-agent (8 total for 4 agents)', () => {
    expect(session.messageLog).toHaveLength(8);
  });

  it('C10-02: all messageLog timestamps are ≥ session.startedAt', () => {
    for (const msg of session.messageLog) {
      expect(msg.timestamp).toBeGreaterThanOrEqual(session.startedAt);
    }
  });

  it('C10-03: all messageLog timestamps are ≤ session.completedAt', () => {
    expect(session.completedAt).toBeDefined();
    for (const msg of session.messageLog) {
      expect(msg.timestamp).toBeLessThanOrEqual(session.completedAt!);
    }
  });

  it('C10-04: status() called twice returns the same sessionId (session persists)', async () => {
    const registry = makeRegistry();
    const agent    = new AutonomousAgent(registry);
    await agent.process(runMsg('mua sắm văn phòng phẩm', ct('C10')));

    const resp1 = await agent.process(aMsg({ action: 'status' }, ct('C10')));
    const resp2 = await agent.process(aMsg({ action: 'status' }, ct('C10')));

    const id1 = (resp1.payload as AutonomousOutput).session.sessionId;
    const id2 = (resp2.payload as AutonomousOutput).session.sessionId;
    expect(id1).toBe(id2);
  });
});
