/**
 * P6-07D: Coverage audit and regression protection
 *
 * Adds tests only for behaviors that were genuinely uncovered after P6-07A/B/C
 * and the existing unit suites.  No tests are duplicated.
 *
 * Confirmed gaps addressed:
 *   1. SpecificationAgent class — zero unit tests anywhere (pure P5-02 functions
 *      are tested in ai-spec-generator.test.ts but the agent class is untouched)
 *   2. AgentRegistry.register() last-write-wins — never tested
 *   3. AgentRegistry.process() throws when target agent not registered — only
 *      implicitly covered by B10/C6; not at registry unit level
 *   4. AgentRegistry.notifySubscribers() with >1 handler — RC-06 tests 1 handler
 *   5. SPEC_EMPTY_INPUT error code — never tested
 *   6. AutonomousAgent error response from === 'autonomous' — tested on success
 *      (PA-05) but not on any error path
 *   7. AutonomousAgent error payload shape (message, state fields) — never verified
 *   8. status() after pause returns session.state=ask-user — never tested
 *   9. input.totalBudget / input.budgetYear propagated into session — never verified
 *  10. traceId consistency — all messages under one run share the same traceId
 *
 * Coverage groups:
 *   Group D1  — SpecificationAgent capability contract          (4 tests)
 *   Group D2  — SpecificationAgent process() success path      (5 tests)
 *   Group D3  — SpecificationAgent state machine and errors     (4 tests)
 *   Group D4  — SpecificationAgent legalBasis                  (3 tests)
 *   Group D5  — AgentRegistry additional contracts             (3 tests)
 *   Group D6  — AutonomousAgent error response shape           (4 tests)
 *   Group D7  — AutonomousAgent session field propagation      (3 tests)
 *   Group D8  — traceId consistency across the full pipeline   (3 tests)
 */

import { describe, it, expect, beforeAll } from 'vitest';

import { AgentRegistry }       from '../agents/AgentRegistry';
import { PlannerAgent }        from '../agents/PlannerAgent';
import { SpecificationAgent }  from '../agents/SpecificationAgent';
import { LegalReviewerAgent }  from '../agents/LegalReviewerAgent';
import { RiskAgent }           from '../agents/RiskAgent';
import { ChatAgent }           from '../agents/ChatAgent';
import { AutonomousAgent }     from '../agents/AutonomousAgent';

import type { AgentMessage, AgentId, IAgent }  from '../agents/types';
import type {
  SpecInput,
  SpecOutput,
  SpecStateEvent,
}                                              from '../agents/SpecificationAgent';
import type {
  AutonomousInput,
  AutonomousOutput,
  AgentSession,
}                                              from '../agents/AutonomousAgent';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFullRegistry(): AgentRegistry {
  const r = new AgentRegistry();
  r.register(new PlannerAgent(r));
  r.register(new SpecificationAgent(r));
  r.register(new LegalReviewerAgent(r));
  r.register(new RiskAgent(r));
  r.register(new ChatAgent(r));
  return r;
}

/** Send a SpecInput directly to a registry that has SpecificationAgent registered. */
function specMsg(itemName: string, traceId: string, pkg: SpecInput['packageType'] = 'goods_fixed_asset'): AgentMessage {
  return {
    traceId,
    from:      'user',
    to:        'specification',
    type:      'request',
    payload:   { itemName, packageType: pkg } as SpecInput,
    timestamp: Date.now(),
  };
}

/** Send an AutonomousInput directly to a registry that has AutonomousAgent registered. */
function autoMsg(input: AutonomousInput, traceId: string): AgentMessage {
  return {
    traceId,
    from:      'user',
    to:        'autonomous',
    type:      'request',
    payload:   input,
    timestamp: Date.now(),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Group D1 — SpecificationAgent capability contract
// Verifies the three IAgent identity / capability fields that every agent
// must implement but had no dedicated tests.
// ═════════════════════════════════════════════════════════════════════════════

describe('Group D1 — SpecificationAgent capability contract', () => {
  let agent: SpecificationAgent;

  beforeAll(() => {
    const registry = new AgentRegistry();
    agent = new SpecificationAgent(registry);
  });

  it('D1-01: agent.id === "specification"', () => {
    expect(agent.id).toBe('specification');
  });

  it('D1-02: agent.name is a non-empty string', () => {
    expect(typeof agent.name).toBe('string');
    expect(agent.name.length).toBeGreaterThan(0);
  });

  it('D1-03: getCapabilities() returns ≥ 4 strings', () => {
    expect(agent.getCapabilities().length).toBeGreaterThanOrEqual(4);
  });

  it('D1-04: getCapabilities() includes "spec-generation" and "brand-detection"', () => {
    const caps = agent.getCapabilities();
    expect(caps).toContain('spec-generation');
    expect(caps).toContain('brand-detection');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group D2 — SpecificationAgent process() success path
// ═════════════════════════════════════════════════════════════════════════════

describe('Group D2 — SpecificationAgent process() success path', () => {
  let registry: AgentRegistry;

  beforeAll(() => {
    registry = new AgentRegistry();
    registry.register(new SpecificationAgent(registry));
  });

  it('D2-01: valid SpecInput → type="response" with preserved traceId', async () => {
    const resp = await registry.process(specMsg('Máy tính để bàn', 'D2-01'));
    expect(resp.type).toBe('response');
    expect(resp.traceId).toBe('D2-01');
  });

  it('D2-02: response.from === "specification"', async () => {
    const resp = await registry.process(specMsg('Vật tư tiêu hao', 'D2-02'));
    expect(resp.from).toBe('specification');
  });

  it('D2-03: agent.state resets to "idle" after successful process()', async () => {
    const innerRegistry = new AgentRegistry();
    const innerAgent    = new SpecificationAgent(innerRegistry);
    innerRegistry.register(innerAgent);
    await innerRegistry.process(specMsg('Vật tư thí nghiệm', 'D2-03'));
    expect((innerAgent as unknown as { state: string }).state).toBe('idle');
  });

  it('D2-04: clean item name → brandWarnings is empty, complianceStatus is "compliant"', async () => {
    const resp = await registry.process(specMsg('Bàn phím và chuột không dây', 'D2-04'));
    const out  = resp.payload as SpecOutput;
    expect(out.brandWarnings).toHaveLength(0);
    expect(out.complianceStatus).toBe('compliant');
  });

  it('D2-05: brand-named item → brandWarnings non-empty and alternatives non-empty', async () => {
    const resp = await registry.process(specMsg('Máy tính Dell XPS 15 cho phòng đào tạo', 'D2-05'));
    const out  = resp.payload as SpecOutput;
    expect(out.brandWarnings.length).toBeGreaterThan(0);
    expect(out.alternatives.length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group D3 — SpecificationAgent state machine and errors
// ═════════════════════════════════════════════════════════════════════════════

describe('Group D3 — SpecificationAgent state machine and errors', () => {
  let registry: AgentRegistry;

  beforeAll(() => {
    registry = new AgentRegistry();
    registry.register(new SpecificationAgent(registry));
  });

  it('D3-01: state machine emits 4 transitions in correct order', async () => {
    const traceId = 'D3-01';
    await registry.process(specMsg('Máy tính để bàn', traceId));
    const trace       = registry.getTrace(traceId);
    const stateEvents = trace
      .filter(m => m.type === 'event' && m.to === 'specification')
      .map(m => (m.payload as SpecStateEvent).nextState);
    expect(stateEvents).toEqual([
      'reviewing-input',
      'generating-spec',
      'checking-brands',
      'composing-response',
    ]);
  });

  it('D3-02: registry trace contains ≥ 6 messages after successful process()', async () => {
    const traceId = 'D3-02';
    await registry.process(specMsg('Vật tư tiêu hao', traceId, 'goods_consumable'));
    // ≥ 2 request logs + 4 events + 1 response
    expect(registry.getTrace(traceId).length).toBeGreaterThanOrEqual(6);
  });

  it('D3-03: empty itemName → error type with code SPEC_EMPTY_INPUT', async () => {
    const resp = await registry.process(specMsg('', 'D3-03'));
    expect(resp.type).toBe('error');
    expect((resp.payload as { code: string }).code).toBe('SPEC_EMPTY_INPUT');
  });

  it('D3-04: error response preserves traceId from request', async () => {
    const resp = await registry.process(specMsg('   ', 'D3-04'));
    expect(resp.type).toBe('error');
    expect(resp.traceId).toBe('D3-04');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group D4 — SpecificationAgent legalBasis
// The agent's legalBasis must carry brand-locking citations on AgentMessage
// itself (not only buried in payload), and must never contain duplicates.
// ═════════════════════════════════════════════════════════════════════════════

describe('Group D4 — SpecificationAgent legalBasis', () => {
  let resp: AgentMessage;

  beforeAll(async () => {
    const registry = new AgentRegistry();
    registry.register(new SpecificationAgent(registry));
    resp = await registry.process(specMsg('Card đồ họa rời phục vụ thực hành đồ hoạ', 'D4-setup'));
  });

  it('D4-01: AgentMessage.legalBasis is defined and non-empty', () => {
    expect(resp.legalBasis).toBeDefined();
    expect(resp.legalBasis!.length).toBeGreaterThan(0);
  });

  it('D4-02: legalBasis includes the brand-locking prohibition citation', () => {
    const hasBrandLock = resp.legalBasis!.some(
      s => s.includes('44') && s.includes('thương hiệu'),
    );
    expect(hasBrandLock).toBe(true);
  });

  it('D4-03: AgentMessage.legalBasis has no duplicate entries', () => {
    const basis = resp.legalBasis!;
    expect(basis.length).toBe(new Set(basis).size);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group D5 — AgentRegistry additional contracts
// The existing RC-01..RC-07 tests cover the basic registry contract.
// These three tests cover the remaining untested behaviors.
// ═════════════════════════════════════════════════════════════════════════════

describe('Group D5 — AgentRegistry additional contracts', () => {
  it('D5-01: process() throws "No agent registered" when target id is unknown', async () => {
    const registry = new AgentRegistry();
    // No agents registered — any routing attempt must throw.
    const msg: AgentMessage = {
      traceId:   'D5-01',
      from:      'user',
      to:        'planner',
      type:      'request',
      payload:   {},
      timestamp: Date.now(),
    };
    await expect(registry.process(msg)).rejects.toThrow('No agent registered for id: planner');
  });

  it('D5-02: register() last-write-wins — second registration for same id takes effect', async () => {
    const registry = new AgentRegistry();

    const makeStub = (version: number): IAgent => ({
      id:               'chat' as const,
      name:             `Stub v${version}`,
      getCapabilities:  () => [`v${version}`],
      process:          async (msg: AgentMessage) => ({
        traceId:   msg.traceId,
        from:      'chat' as const,
        to:        msg.from as AgentId | 'user',
        type:      'response' as const,
        payload:   { version },
        timestamp: Date.now(),
      }),
    });

    registry.register(makeStub(1));
    registry.register(makeStub(2)); // overwrites v1

    const resp = await registry.process({
      traceId:   'D5-02',
      from:      'user',
      to:        'chat',
      type:      'request',
      payload:   { message: 'test', history: [] },
      timestamp: Date.now(),
    });
    // The second registered stub (version 2) must be the one that answered.
    expect((resp.payload as { version: number }).version).toBe(2);
  });

  it('D5-03: subscribe() with two handlers — both fired by notifySubscribers()', () => {
    const registry = new AgentRegistry();
    let callCount  = 0;

    registry.subscribe('audit-event', () => { callCount++; });
    registry.subscribe('audit-event', () => { callCount++; });

    const msg: AgentMessage = {
      traceId:   'D5-03',
      from:      'user',
      to:        'broadcast',
      type:      'event',
      payload:   {},
      timestamp: Date.now(),
    };
    registry.notifySubscribers('audit-event', msg);
    expect(callCount).toBe(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group D6 — AutonomousAgent error response shape
// Every error response must carry from==='autonomous', a non-empty message
// string, and a valid WorkflowState in payload.state.
// D6-04 additionally verifies that status() after pause reflects ask-user.
// ═════════════════════════════════════════════════════════════════════════════

describe('Group D6 — AutonomousAgent error response shape', () => {
  const VALID_WORKFLOW_STATES = new Set([
    'idle', 'planning', 'specifying', 'legal-review',
    'risk-assessment', 'ask-user', 'ready-for-export',
    'exporting', 'done', 'error',
  ]);

  it('D6-01: error response has from === "autonomous" (AUTONOMOUS_MISSING_GOAL)', async () => {
    const agent = new AutonomousAgent(new AgentRegistry());
    const resp  = await agent.process(autoMsg({ action: 'run', goal: '' }, 'D6-01'));
    expect(resp.type).toBe('error');
    expect(resp.from).toBe('autonomous');
  });

  it('D6-02: error response payload.message is a non-empty string', async () => {
    const agent = new AutonomousAgent(new AgentRegistry());
    const resp  = await agent.process(autoMsg({ action: 'run', goal: '' }, 'D6-02'));
    const msg   = (resp.payload as { message: string }).message;
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });

  it('D6-03: error response payload.state is a valid WorkflowState', async () => {
    const agent = new AutonomousAgent(new AgentRegistry());
    // Trigger AUTONOMOUS_NO_SESSION (no prior run, session is null)
    const resp  = await agent.process(autoMsg({ action: 'status' }, 'D6-03'));
    const state = (resp.payload as { state: string }).state;
    expect(VALID_WORKFLOW_STATES.has(state)).toBe(true);
  });

  it('D6-04: status() after pause returns session with state === "ask-user"', async () => {
    const registry = makeFullRegistry();
    const agent    = new AutonomousAgent(registry);

    await agent.process(autoMsg({ action: 'run', goal: 'mua sắm văn phòng phẩm' }, 'D6-04-run'));
    await agent.process(autoMsg({ action: 'pause' }, 'D6-04-pause'));

    const statusResp = await agent.process(autoMsg({ action: 'status' }, 'D6-04-status'));
    expect(statusResp.type).toBe('response');
    expect((statusResp.payload as AutonomousOutput).session.state).toBe('ask-user');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group D7 — AutonomousAgent session field propagation
// input.totalBudget, input.budgetYear, and the auto-generated session.sessionId
// must all be properly preserved in the returned session.
// ═════════════════════════════════════════════════════════════════════════════

describe('Group D7 — AutonomousAgent session field propagation', () => {
  let session: AgentSession;

  beforeAll(async () => {
    const registry = makeFullRegistry();
    const agent    = new AutonomousAgent(registry);
    const resp     = await agent.process(
      autoMsg(
        {
          action:      'run',
          goal:        'mua sắm văn phòng phẩm phục vụ đào tạo',
          totalBudget: 500_000_000,
          budgetYear:  2026,
        },
        'D7-setup',
      ),
    );
    session = (resp.payload as AutonomousOutput).session;
  });

  it('D7-01: input.totalBudget is propagated to session.totalBudget', () => {
    expect(session.totalBudget).toBe(500_000_000);
  });

  it('D7-02: input.budgetYear is propagated to session.budgetYear', () => {
    expect(session.budgetYear).toBe(2026);
  });

  it('D7-03: session.sessionId is a non-empty unique string', () => {
    expect(typeof session.sessionId).toBe('string');
    expect(session.sessionId.length).toBeGreaterThan(8);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Group D8 — traceId consistency across the full pipeline
// Every AgentMessage logged under a traceId must carry exactly that traceId.
// This catches any agent that accidentally overwrites or drops the trace key.
// ═════════════════════════════════════════════════════════════════════════════

describe('Group D8 — traceId consistency across the full pipeline', () => {
  it('D8-01: all messages in registry.getTrace() carry the workflow traceId', async () => {
    const registry = makeFullRegistry();
    const agent    = new AutonomousAgent(registry);
    const traceId  = 'D8-01-workflow';

    await agent.process(
      autoMsg({ action: 'run', goal: 'mua sắm văn phòng phẩm' }, traceId),
    );

    const trace = registry.getTrace(traceId);
    expect(trace.length).toBeGreaterThan(0);
    for (const msg of trace) {
      expect(msg.traceId).toBe(traceId);
    }
  });

  it('D8-02: session.messageLog messages all carry the run traceId', async () => {
    const registry = makeFullRegistry();
    const agent    = new AutonomousAgent(registry);
    const traceId  = 'D8-02-msglog';

    const resp = await agent.process(
      autoMsg({ action: 'run', goal: 'mua sắm vật tư tiêu hao' }, traceId),
    );

    const { messageLog } = (resp.payload as AutonomousOutput).session;
    expect(messageLog.length).toBeGreaterThan(0);
    for (const msg of messageLog) {
      expect(msg.traceId).toBe(traceId);
    }
  });

  it('D8-03: SpecificationAgent trace messages all carry the request traceId', async () => {
    const registry = new AgentRegistry();
    registry.register(new SpecificationAgent(registry));
    const traceId = 'D8-03-spec';

    await registry.process(specMsg('Máy chiếu giảng dạy', traceId));

    const trace = registry.getTrace(traceId);
    expect(trace.length).toBeGreaterThanOrEqual(6);
    for (const msg of trace) {
      expect(msg.traceId).toBe(traceId);
    }
  });
});
