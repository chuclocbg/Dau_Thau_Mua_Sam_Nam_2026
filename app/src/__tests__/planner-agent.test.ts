/**
 * P6-01F: PlannerAgent test suite
 *
 * Coverage:
 *   Group 0 — AgentRegistry message contracts   (7 tests, RC-01..RC-07)
 *   Group 1 — parseGoalIntoItems                (5 tests, T01..T05)
 *   Group 2 — detectPackageSplitting            (8 tests, T06..T13)
 *   Group 3 — validateAuthority                 (6 tests, T14..T19)
 *   Group 4 — buildCalendar                     (5 tests, T20..T24)
 *   Group 5 — PlannerAgent.process()            (8 tests, T25..T30 + T31..T32)
 *   Group 6 — buildMinimalProcurementPackage    (3 tests, BMP-01..BMP-03)
 *   Group 7 — deepAnalysis integration          (2 tests, DA-01..DA-02)
 *   Group 8 — extras (generateTraceId, leadTime, quarter) (5 tests, TB-01..TB-05)
 *
 * No vi.fn() / vi.mock() on P5 functions. All P5 modules used read-only.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { AgentRegistry }         from '../agents/AgentRegistry';
import {
  generateTraceId,
  parseGoalIntoItems,
  detectPackageSplitting,
  validateAuthority,
  getProcurementLeadTime,
  assignQuarter,
  buildCalendar,
  buildMinimalProcurementPackage,
  PlannerAgent,
} from '../agents/PlannerAgent';

import type { AISuggestion }                  from '../ai/packageGenerator';
import type { AgentMessage }                  from '../agents/types';
import type { PlannerInput, PlannerOutput }   from '../agents/PlannerAgent';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeSuggestion(
  detectedCategory: string,
  estimatedTotal: number,
  overrides: Partial<AISuggestion> = {},
): AISuggestion {
  return {
    packageName:          `Gói ${detectedCategory}`,
    packageCode:          `PKG-${detectedCategory.toUpperCase().replace(/\s+/g, '-')}-001`,
    fundingSource:        'autonomy_fund',
    fundingSourceName:    'Quỹ phát triển hoạt động sự nghiệp của nhà trường',
    packageType:          'goods_fixed_asset',
    contractType:         'lump_sum',
    estimatedTotal,
    contractDurationDays: 30,
    procurementMethodHint:'DIRECT_SELECTION_SIMPLIFIED',
    detectedCategory,
    confidence:           'high',
    notes:                [],
    ...overrides,
  };
}

function makePlannerRequest(
  goal: string,
  traceId: string,
  inputOverrides: Partial<PlannerInput> = {},
): AgentMessage {
  const payload: PlannerInput = {
    naturalLanguageGoal: goal,
    budgetYear: 2026,
    ...inputOverrides,
  };
  return {
    traceId,
    from:      'user',
    to:        'planner',
    type:      'request',
    payload,
    timestamp: Date.now(),
  };
}

function createTestRegistry(): AgentRegistry {
  return new AgentRegistry();  // fresh instance per test — no shared state
}

// ─── Group 0: AgentRegistry message contracts ─────────────────────────────────

describe('AgentRegistry — message contracts', () => {
  let registry: AgentRegistry;
  beforeEach(() => { registry = createTestRegistry(); });

  it('RC-01: log() throws on empty traceId (audit invariant)', () => {
    const msg: AgentMessage = {
      traceId: '',           // empty — should throw
      from: 'user', to: 'planner', type: 'request', payload: null, timestamp: Date.now(),
    };
    expect(() => registry.log(msg)).toThrow('traceId is required');
  });

  it('RC-02: log() accepts a valid traceId without throwing', () => {
    const msg: AgentMessage = {
      traceId: 'rc-02', from: 'user', to: 'planner', type: 'request', payload: null, timestamp: Date.now(),
    };
    expect(() => registry.log(msg)).not.toThrow();
  });

  it('RC-03: getTrace() returns [] for unknown traceId', () => {
    expect(registry.getTrace('nonexistent')).toEqual([]);
  });

  it('RC-04: getTrace() returns logged messages in insertion order', () => {
    const a: AgentMessage = { traceId: 'rc-04', from: 'user',    to: 'planner', type: 'request',  payload: 'a', timestamp: 1 };
    const b: AgentMessage = { traceId: 'rc-04', from: 'planner', to: 'user',    type: 'response', payload: 'b', timestamp: 2 };
    registry.log(a);
    registry.log(b);
    const trace = registry.getTrace('rc-04');
    expect(trace).toHaveLength(2);
    expect(trace[0].payload).toBe('a');
    expect(trace[1].payload).toBe('b');
  });

  it('RC-05: process() routes message to registered agent', async () => {
    const echoAgent = {
      id:   'chat' as const,
      name: 'Echo',
      async process(msg: AgentMessage): Promise<AgentMessage> {
        return { ...msg, from: 'chat', to: 'user', type: 'response' };
      },
      getCapabilities: () => [],
    };
    registry.register(echoAgent);
    const msg: AgentMessage = {
      traceId: 'rc-05', from: 'user', to: 'chat', type: 'request', payload: null, timestamp: Date.now(),
    };
    const response = await registry.process(msg);
    expect(response.type).toBe('response');
    expect(response.from).toBe('chat');
  });

  it('RC-06: subscribe() + notifySubscribers() calls handler exactly once', () => {
    let callCount = 0;
    registry.subscribe('event', () => { callCount++; });
    const msg: AgentMessage = {
      traceId: 'rc-06', from: 'user', to: 'broadcast', type: 'event', payload: null, timestamp: Date.now(),
    };
    registry.notifySubscribers('event', msg);
    expect(callCount).toBe(1);
  });

  it('RC-07: broadcast message is returned without agent routing', async () => {
    const msg: AgentMessage = {
      traceId: 'rc-07', from: 'user', to: 'broadcast', type: 'event', payload: 'ping', timestamp: Date.now(),
    };
    const result = await registry.process(msg);
    expect(result).toBe(msg);       // same reference
    expect(result.payload).toBe('ping');
  });
});

// ─── Group 1: parseGoalIntoItems ──────────────────────────────────────────────

describe('parseGoalIntoItems', () => {
  it('T01: splits on "và" connector, no connector word in result', () => {
    const items = parseGoalIntoItems('20 máy tính và văn phòng phẩm');
    expect(items).toHaveLength(2);
    expect(items.every(i => !i.toLowerCase().includes(' và '))).toBe(true);
  });

  it('T02: splits on comma-separated list', () => {
    const items = parseGoalIntoItems('máy tính, bàn ghế, đèn chiếu');
    expect(items).toHaveLength(3);
  });

  it('T03: "để" in "máy tính để bàn" is not a split point', () => {
    const items = parseGoalIntoItems('20 máy tính để bàn');
    expect(items).toHaveLength(1);
    expect(items[0]).toContain('máy tính');
  });

  it('T04: empty string returns []', () => {
    expect(parseGoalIntoItems('')).toEqual([]);
  });

  it('T05: splits on "cùng với" connector', () => {
    const items = parseGoalIntoItems('máy tính cùng với bàn ghế');
    expect(items).toHaveLength(2);
  });
});

// ─── Group 2: detectPackageSplitting ──────────────────────────────────────────

describe('detectPackageSplitting', () => {
  it('T06: single package below threshold — no finding', () => {
    const pkgs = [makeSuggestion('cat1', 30_000_000)];
    expect(detectPackageSplitting(pkgs)).toHaveLength(0);
  });

  it('T07: two packages same category, combined 550M — CRITICAL PA-001', () => {
    const pkgs = [
      makeSuggestion('lab', 300_000_000),
      makeSuggestion('lab', 250_000_000),
    ];
    const findings = detectPackageSplitting(pkgs);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('CRITICAL');
    expect(findings[0].code).toBe('PA-001');
  });

  it('T08: two packages different categories — no finding', () => {
    const pkgs = [
      makeSuggestion('máy tính', 25_000_000),
      makeSuggestion('điều hòa', 30_000_000),
    ];
    expect(detectPackageSplitting(pkgs)).toHaveLength(0);
  });

  it('T09: combined 55M exceeds 50M threshold — CRITICAL', () => {
    const pkgs = [
      makeSuggestion('cat-50', 25_000_000),
      makeSuggestion('cat-50', 30_000_000),
    ];
    const findings = detectPackageSplitting(pkgs);
    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe('PA-001');
  });

  it('T10: combined 5.5B exceeds 5B threshold — CRITICAL', () => {
    const pkgs = [
      makeSuggestion('big-cat', 3_000_000_000),
      makeSuggestion('big-cat', 2_500_000_000),
    ];
    const findings = detectPackageSplitting(pkgs);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it('T11: existingPackages combined with new packages triggers split', () => {
    const existing  = [makeSuggestion('shared', 40_000_000)];
    const newPkgs   = [makeSuggestion('shared', 20_000_000)];
    const findings  = detectPackageSplitting(newPkgs, existing);
    expect(findings).toHaveLength(1);     // combined 60M > 50M threshold
  });

  it('T12: finding.legalBasis contains "Điều 44 khoản 6"', () => {
    const pkgs = [makeSuggestion('cat-12', 30_000_000), makeSuggestion('cat-12', 30_000_000)];
    const [finding] = detectPackageSplitting(pkgs);
    expect(finding.legalBasis).toContain('Điều 44 khoản 6');
  });

  it('T13: finding.recommendation contains "hợp nhất"', () => {
    const pkgs = [makeSuggestion('cat-13', 30_000_000), makeSuggestion('cat-13', 30_000_000)];
    const [finding] = detectPackageSplitting(pkgs);
    expect(finding.recommendation.toLowerCase()).toContain('hợp nhất');
  });
});

// ─── Group 3: validateAuthority ───────────────────────────────────────────────

describe('validateAuthority', () => {
  it('T14: ≤50M → rector_direct, khlcntRequired: false', () => {
    const result = validateAuthority(makeSuggestion('cat', 50_000_000));
    expect(result.approvalLevel).toBe('rector_direct');
    expect(result.khlcntRequired).toBe(false);
    expect(result.ministerialApproval).toBe(false);
  });

  it('T15: 51M → rector_with_khlcnt, khlcntRequired: true', () => {
    const result = validateAuthority(makeSuggestion('cat', 51_000_000));
    expect(result.approvalLevel).toBe('rector_with_khlcnt');
    expect(result.khlcntRequired).toBe(true);
  });

  it('T16: exactly 500M → rector_with_khlcnt (boundary inclusive)', () => {
    const result = validateAuthority(makeSuggestion('cat', 500_000_000));
    expect(result.approvalLevel).toBe('rector_with_khlcnt');
  });

  it('T17: 501M → ministry, ministerialApproval: true', () => {
    const result = validateAuthority(makeSuggestion('cat', 501_000_000));
    expect(result.approvalLevel).toBe('ministry');
    expect(result.ministerialApproval).toBe(true);
  });

  it('T18: legalBasis array contains TT 13/2026 reference', () => {
    const result = validateAuthority(makeSuggestion('cat', 200_000_000));
    expect(result.legalBasis.some(b => b.includes('13/2026'))).toBe(true);
  });

  it('T19: packageCode and packageName are copied from suggestion', () => {
    const suggestion = makeSuggestion('máy chiếu', 80_000_000);
    const result = validateAuthority(suggestion);
    expect(result.packageCode).toBe(suggestion.packageCode);
    expect(result.packageName).toBe(suggestion.packageName);
  });
});

// ─── Group 4: buildCalendar ───────────────────────────────────────────────────

describe('buildCalendar', () => {
  it('T20: entries.length === packages.length', () => {
    const pkgs = [makeSuggestion('a', 100_000_000), makeSuggestion('b', 200_000_000)];
    const cal  = buildCalendar(pkgs, 2026);
    expect(cal.entries).toHaveLength(pkgs.length);
  });

  it('T21: totalAnnual equals sum of all estimatedTotals', () => {
    const pkgs = [makeSuggestion('a', 100_000_000), makeSuggestion('b', 200_000_000)];
    const cal  = buildCalendar(pkgs, 2026);
    expect(cal.totalAnnual).toBe(300_000_000);
  });

  it('T22: goods_consumable package assigned to Q1', () => {
    const pkgs = [makeSuggestion('vpp', 10_000_000, { packageType: 'goods_consumable' })];
    const cal  = buildCalendar(pkgs, 2026);
    expect(cal.entries[0].quarter).toBe('Q1');
  });

  it('T23: khlcntSubmissionDate matches ISO date format', () => {
    const cal = buildCalendar([makeSuggestion('x', 50_000_000)], 2026);
    expect(cal.khlcntSubmissionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('T24: sum(totalByQuarter values) === totalAnnual', () => {
    const pkgs = [
      makeSuggestion('a', 100_000_000, { packageType: 'goods_consumable' }),
      makeSuggestion('b', 200_000_000, { packageType: 'goods_fixed_asset', estimatedTotal: 200_000_000 }),
    ];
    const cal = buildCalendar(pkgs, 2026);
    const quarterSum = Object.values(cal.totalByQuarter).reduce((s, v) => s + v, 0);
    expect(quarterSum).toBe(cal.totalAnnual);
  });
});

// ─── Group 5: PlannerAgent.process() ──────────────────────────────────────────

describe('PlannerAgent.process()', () => {
  let registry: AgentRegistry;
  let agent:    PlannerAgent;

  beforeEach(() => {
    registry = createTestRegistry();
    agent    = new PlannerAgent(registry);
  });

  it('T25: valid request returns response with preserved traceId', async () => {
    const msg      = makePlannerRequest('máy tính để bàn', 'trace-T25');
    const response = await agent.process(msg);
    expect(response.type).toBe('response');
    expect(response.traceId).toBe('trace-T25');
  });

  it('T26: registry trace contains ≥ 3 messages after processing', async () => {
    const msg = makePlannerRequest('máy tính để bàn', 'trace-T26');
    await agent.process(msg);
    const trace = registry.getTrace('trace-T26');
    expect(trace.length).toBeGreaterThanOrEqual(3);
  });

  it('T27: two items in same category → broadcast split-warning event', async () => {
    // "văn phòng phẩm 300" → qty=300, estimatedUnitPrice=150_000 → total=45M per item
    // Two stationery packages: combined 90M > 50M threshold → PA-001 fires
    const msg   = makePlannerRequest(
      'văn phòng phẩm 300 triệu và văn phòng phẩm 300 triệu',
      'trace-T27',
    );
    await agent.process(msg);
    const trace = registry.getTrace('trace-T27');
    const broadcasts = trace.filter(m => m.to === 'broadcast');
    expect(broadcasts.length).toBeGreaterThan(0);
  });

  it('T28: success response payload has packages, calendar, authorityChecks', async () => {
    const msg      = makePlannerRequest('máy tính để bàn', 'trace-T28');
    const response = await agent.process(msg);
    const output   = response.payload as PlannerOutput;
    expect(output.packages).toBeDefined();
    expect(output.calendar).toBeDefined();
    expect(output.authorityChecks).toBeDefined();
    expect(output.packages.length).toBeGreaterThan(0);
    expect(output.authorityChecks).toHaveLength(output.packages.length);
  });

  it('T29: agent.state resets to "idle" after successful process()', async () => {
    const msg = makePlannerRequest('máy tính để bàn', 'trace-T29');
    await agent.process(msg);
    expect((agent as unknown as { state: string }).state).toBe('idle');
  });

  it('T30: empty naturalLanguageGoal returns error with same traceId', async () => {
    const msg      = makePlannerRequest('', 'trace-T30');
    const response = await agent.process(msg);
    expect(response.type).toBe('error');
    expect(response.traceId).toBe('trace-T30');
  });

  it('T31: recognized input produces confidence "high" in output', async () => {
    const msg    = makePlannerRequest('máy tính để bàn', 'trace-T31');
    const resp   = await agent.process(msg);
    const output = resp.payload as PlannerOutput;
    expect(output.confidence).toBe('high');
  });

  it('T32: legalBasis always contains the KHLCNT foundation reference', async () => {
    const msg    = makePlannerRequest('máy tính để bàn', 'trace-T32');
    const resp   = await agent.process(msg);
    const output = resp.payload as PlannerOutput;
    expect(output.legalBasis.some(b => b.includes('Điều 38-41'))).toBe(true);
  });
});

// ─── Group 6: buildMinimalProcurementPackage ──────────────────────────────────

describe('buildMinimalProcurementPackage', () => {
  const suggestion = makeSuggestion('máy tính', 20_000_000, {
    packageCode: 'TEST-001',
    packageName: 'Gói test máy tính',
    packageType: 'goods_fixed_asset',
  });

  it('BMP-01: items array contains exactly 1 item', () => {
    const pkg = buildMinimalProcurementPackage(suggestion, 2026);
    expect(pkg.items).toHaveLength(1);
  });

  it('BMP-02: id is prefixed with "planner-preview-"', () => {
    const pkg = buildMinimalProcurementPackage(suggestion, 2026);
    expect(pkg.id).toBe('planner-preview-TEST-001');
  });

  it('BMP-03: warrantyMonths=12 for goods_fixed_asset, 0 for service', () => {
    const fixedAsset = buildMinimalProcurementPackage(suggestion, 2026);
    expect(fixedAsset.warrantyMonths).toBe(12);

    const svc = buildMinimalProcurementPackage(
      makeSuggestion('dịch vụ', 10_000_000, { packageType: 'service', packageCode: 'SVC-001' }),
      2026,
    );
    expect(svc.warrantyMonths).toBe(0);
  });
});

// ─── Group 7: deepAnalysis integration ────────────────────────────────────────

describe('PlannerAgent — deepAnalysis integration', () => {
  let registry: AgentRegistry;
  let agent:    PlannerAgent;

  beforeEach(() => {
    registry = createTestRegistry();
    agent    = new PlannerAgent(registry);
  });

  it('DA-01: deepAnalysis omitted → workflowResults is undefined', async () => {
    const msg    = makePlannerRequest('máy tính để bàn', 'trace-DA01');
    const resp   = await agent.process(msg);
    const output = resp.payload as PlannerOutput;
    expect(output.workflowResults).toBeUndefined();
  });

  it('DA-02: deepAnalysis: true → workflowResults.length equals packages.length', async () => {
    const msg    = makePlannerRequest('máy tính để bàn', 'trace-DA02', { deepAnalysis: true });
    const resp   = await agent.process(msg);
    const output = resp.payload as PlannerOutput;
    expect(output.workflowResults).toBeDefined();
    expect(output.workflowResults!.length).toBe(output.packages.length);
  });
});

// ─── Group 8: extras — generateTraceId, getProcurementLeadTime, assignQuarter ─

describe('extras', () => {
  it('TB-01: generateTraceId() returns a non-empty string', () => {
    const id = generateTraceId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('TB-02: generateTraceId() returns different values on successive calls', () => {
    expect(generateTraceId()).not.toBe(generateTraceId());
  });

  it('TB-03: getProcurementLeadTime("OPEN_BIDDING") → 90 days', () => {
    expect(getProcurementLeadTime('OPEN_BIDDING')).toBe(90);
  });

  it('TB-04: getProcurementLeadTime unknown key → 30 days (default)', () => {
    expect(getProcurementLeadTime('UNKNOWN_METHOD')).toBe(30);
  });

  it('TB-05: assignQuarter — service → Q1, large fixed_asset → Q3', () => {
    const service = makeSuggestion('dv', 10_000_000, { packageType: 'service' });
    const bigAsset = makeSuggestion('tb', 1_000_000_000, {
      packageType:   'goods_fixed_asset',
      estimatedTotal: 1_000_000_000,
    });
    expect(assignQuarter(service)).toBe('Q1');
    expect(assignQuarter(bigAsset)).toBe('Q3');
  });
});

// ─── Group 9: PlannerAgent identity + additional process details ───────────────

describe('PlannerAgent — identity and additional process details', () => {
  let registry: AgentRegistry;
  let agent:    PlannerAgent;

  beforeEach(() => {
    registry = createTestRegistry();
    agent    = new PlannerAgent(registry);
  });

  it('PL-01: agent.id === "planner"', () => {
    expect(agent.id).toBe('planner');
  });

  it('PL-02: agent.name === "Procurement Planner Agent"', () => {
    expect(agent.name).toBe('Procurement Planner Agent');
  });

  it('PL-03: getCapabilities() returns exactly 4 capability strings', () => {
    expect(agent.getCapabilities()).toHaveLength(4);
  });

  it('PL-04: parseGoalIntoItems("   ") → [] (whitespace-only is treated as empty)', () => {
    expect(parseGoalIntoItems('   ')).toEqual([]);
  });

  it('PL-05: buildMinimalProcurementPackage goods_consumable → warrantyMonths=0', () => {
    const s = makeSuggestion('vpp', 10_000_000, {
      packageType: 'goods_consumable',
      packageCode: 'VPP-001',
    });
    expect(buildMinimalProcurementPackage(s, 2026).warrantyMonths).toBe(0);
  });

  it('PL-06: process() success response.from === "planner"', async () => {
    const msg      = makePlannerRequest('máy tính để bàn', 'trace-PL06');
    const response = await agent.process(msg);
    expect(response.from).toBe('planner');
  });

  it('PL-07: process() with totalBudget provided → budgetUtilization ≥ 0 (not sentinel −1)', async () => {
    const msg    = makePlannerRequest('máy tính để bàn', 'trace-PL07', { totalBudget: 200_000_000 });
    const resp   = await agent.process(msg);
    const output = resp.payload as PlannerOutput;
    expect(output.budgetUtilization).toBeGreaterThanOrEqual(0);
  });
});
