/**
 * P6-02: SpecificationAgent test suite — 56 tests
 *
 * Groups:
 *   SA1  — reviewSpec() brand-free           (4 tests)
 *   SA2  — reviewSpec() brand detection       (5 tests)
 *   SA3  — suggestAlternatives() no brands    (3 tests)
 *   SA4  — suggestAlternatives() categories   (6 tests)
 *   SA5  — generateSpecWithReasoning basic    (5 tests)
 *   SA6  — complianceStatus logic             (5 tests)
 *   SA7  — reasoning array content            (4 tests)
 *   SA8  — batchGenerate() basic              (5 tests)
 *   SA9  — batchGenerate() overallStatus      (4 tests)
 *   SA10 — SpecificationAgent identity        (3 tests)
 *   SA11 — process() success paths            (6 tests)
 *   SA12 — process() error / never-throw      (6 tests)
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { AgentRegistry } from '../agents/AgentRegistry';
import {
  reviewSpec,
  suggestAlternatives,
  generateSpecWithReasoning,
  batchGenerate,
  SpecificationAgent,
} from '../agents/SpecificationAgent';
import type { SpecInput } from '../agents/SpecificationAgent';
import type { AgentMessage } from '../agents/types';
import type { LegalFinding } from '../ai/legalReviewer';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let registry: AgentRegistry;
let agent:    SpecificationAgent;

function makeFinding(
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
  basis = 'Điều XX khoản Y Luật Đấu thầu 22/2023/QH15',
): LegalFinding {
  return {
    severity,
    code:           'TEST-001',
    category:       'test',
    message:        'Test finding',
    legalBasis:     basis,
    recommendation: 'Fix it',
  };
}

function makeMsg(
  payload: unknown,
  traceId: string,
  from: AgentMessage['from'] = 'user',
): AgentMessage {
  return {
    traceId,
    from,
    to:        'specification',
    type:      'request',
    payload,
    timestamp: Date.now(),
  };
}

const CLEAN_INPUT: SpecInput = {
  itemName:    'Máy tính để bàn',
  packageType: 'goods_fixed_asset',
};

const BRAND_INPUT: SpecInput = {
  itemName:    'Máy tính Dell Core i7',
  packageType: 'goods_fixed_asset',
};

// ─── SA1: reviewSpec() brand-free ─────────────────────────────────────────────

describe('SA1 — reviewSpec() brand-free', () => {
  it('SA1-01: empty string and empty itemName returns []', () => {
    expect(reviewSpec('', '')).toEqual([]);
  });

  it('SA1-02: generic spec text without brands returns []', () => {
    const spec = 'CPU ≥3 GHz, RAM ≥8 GB, SSD ≥256 GB, bảo hành 24 tháng';
    expect(reviewSpec(spec)).toEqual([]);
  });

  it('SA1-03: clean itemName only (no specs) returns []', () => {
    expect(reviewSpec('', 'Máy tính để bàn văn phòng')).toEqual([]);
  });

  it('SA1-04: brand-free specs and brand-free itemName combined return []', () => {
    expect(reviewSpec('Băng thông ≥1 Gbps, hỗ trợ VLAN', 'Thiết bị chuyển mạch LAN')).toEqual([]);
  });
});

// ─── SA2: reviewSpec() brand detection ────────────────────────────────────────

describe('SA2 — reviewSpec() brand detection', () => {
  it('SA2-01: "Dell" in specs is detected', () => {
    const result = reviewSpec('Máy tính Dell i7 RAM 16GB');
    expect(result.some(b => /dell/i.test(b))).toBe(true);
  });

  it('SA2-02: "Panasonic" in specs is detected', () => {
    const result = reviewSpec('Điều hòa Panasonic 12000 BTU');
    expect(result.some(b => /panasonic/i.test(b))).toBe(true);
  });

  it('SA2-03: "Cisco" in specs is detected', () => {
    const result = reviewSpec('Switch mạng Cisco 24 cổng Gigabit');
    expect(result.some(b => /cisco/i.test(b))).toBe(true);
  });

  it('SA2-04: brand only in itemName (second param) is detected via combined scan', () => {
    const result = reviewSpec('CPU ≥3 GHz, RAM ≥8 GB', 'Máy tính Lenovo ThinkPad');
    expect(result.some(b => /lenovo/i.test(b))).toBe(true);
  });

  it('SA2-05: multiple brands in combined text yield multiple entries', () => {
    const result = reviewSpec('Máy in Canon kết nối driver Epson tương thích');
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── SA3: suggestAlternatives() no brands ─────────────────────────────────────

describe('SA3 — suggestAlternatives() no brands', () => {
  it('SA3-01: empty brandWarnings returns []', () => {
    expect(suggestAlternatives('', [])).toEqual([]);
  });

  it('SA3-02: empty brandWarnings with non-empty specs still returns []', () => {
    expect(suggestAlternatives('CPU ≥3 GHz, RAM ≥8 GB', [])).toEqual([]);
  });

  it('SA3-03: result.length === 0 when no brand warnings', () => {
    expect(suggestAlternatives('specs here', []).length).toBe(0);
  });
});

// ─── SA4: suggestAlternatives() category alternatives ─────────────────────────

describe('SA4 — suggestAlternatives() category alternatives', () => {
  it('SA4-01: Dell brand → at least 2 entries; first is generic catch-all', () => {
    const result = suggestAlternatives('', ['Dell']);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0]).toContain('tương đương');
  });

  it('SA4-02: Panasonic brand → category alternative mentions inverter or COP', () => {
    const result = suggestAlternatives('', ['Panasonic']);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[1]).toMatch(/inverter|COP|R-32|nhãn năng lượng/i);
  });

  it('SA4-03: Merck brand → alternative mentions Certificate of Analysis', () => {
    const result = suggestAlternatives('', ['Merck']);
    expect(result.some(a => a.includes('Certificate of Analysis'))).toBe(true);
  });

  it('SA4-04: Canon brand → alternative mentions dpi or trang/phút', () => {
    const result = suggestAlternatives('', ['Canon']);
    expect(result.some(a => /dpi|trang\/phút/i.test(a))).toBe(true);
  });

  it('SA4-05: Cisco brand → alternative mentions VLAN or Gbps', () => {
    const result = suggestAlternatives('', ['Cisco']);
    expect(result.some(a => /VLAN|Gbps/i.test(a))).toBe(true);
  });

  it('SA4-06: unknown brand → exactly 2 entries (generic + per-brand fallback)', () => {
    const result = suggestAlternatives('', ['Brandex999']);
    expect(result.length).toBe(2);
    expect(result[0]).toContain('tương đương');
    expect(result[1]).toContain('thương hiệu');
  });
});

// ─── SA5: generateSpecWithReasoning() basic structure ─────────────────────────

describe('SA5 — generateSpecWithReasoning() basic structure', () => {
  it('SA5-01: returns specs as a string', () => {
    const out = generateSpecWithReasoning(CLEAN_INPUT);
    expect(typeof out.specs).toBe('string');
  });

  it('SA5-02: returns reasoning as a non-empty array', () => {
    const out = generateSpecWithReasoning(CLEAN_INPUT);
    expect(Array.isArray(out.reasoning)).toBe(true);
    expect(out.reasoning.length).toBeGreaterThan(0);
  });

  it('SA5-03: returns brandWarnings as an array', () => {
    const out = generateSpecWithReasoning(CLEAN_INPUT);
    expect(Array.isArray(out.brandWarnings)).toBe(true);
  });

  it('SA5-04: returns alternatives as an array', () => {
    const out = generateSpecWithReasoning(CLEAN_INPUT);
    expect(Array.isArray(out.alternatives)).toBe(true);
  });

  it('SA5-05: legalBasis includes Điều 44 khoản 7 citation', () => {
    const out = generateSpecWithReasoning(CLEAN_INPUT);
    expect(Array.isArray(out.legalBasis)).toBe(true);
    expect(out.legalBasis.some(b => b.includes('Điều 44'))).toBe(true);
  });
});

// ─── SA6: complianceStatus logic ──────────────────────────────────────────────

describe('SA6 — complianceStatus logic', () => {
  it('SA6-01: brand-free itemName → compliant', () => {
    expect(generateSpecWithReasoning(CLEAN_INPUT).complianceStatus).toBe('compliant');
  });

  it('SA6-02: Dell in itemName → warning', () => {
    expect(generateSpecWithReasoning(BRAND_INPUT).complianceStatus).toBe('warning');
  });

  it('SA6-03: Dell in itemName + CRITICAL legalFinding → violation', () => {
    const input: SpecInput = { ...BRAND_INPUT, legalFindings: [makeFinding('CRITICAL')] };
    expect(generateSpecWithReasoning(input).complianceStatus).toBe('violation');
  });

  it('SA6-04: Dell in itemName + HIGH (non-critical) finding → warning, not violation', () => {
    const input: SpecInput = { ...BRAND_INPUT, legalFindings: [makeFinding('HIGH')] };
    expect(generateSpecWithReasoning(input).complianceStatus).toBe('warning');
  });

  it('SA6-05: brand-free itemName + CRITICAL finding → still compliant (brands gate the status)', () => {
    const input: SpecInput = { ...CLEAN_INPUT, legalFindings: [makeFinding('CRITICAL')] };
    expect(generateSpecWithReasoning(input).complianceStatus).toBe('compliant');
  });
});

// ─── SA7: reasoning array content ─────────────────────────────────────────────

describe('SA7 — reasoning array content', () => {
  it('SA7-01: known item "Máy tính để bàn" produces non-empty reasoning', () => {
    const out = generateSpecWithReasoning(CLEAN_INPUT);
    expect(out.reasoning.length).toBeGreaterThan(0);
  });

  it('SA7-02: every reasoning entry is a non-empty string', () => {
    const out = generateSpecWithReasoning(CLEAN_INPUT);
    for (const entry of out.reasoning) {
      expect(typeof entry).toBe('string');
      expect(entry.trim().length).toBeGreaterThan(0);
    }
  });

  it('SA7-03: unknown item type → reasoning still non-empty (uses fallback spec text)', () => {
    const out = generateSpecWithReasoning({
      itemName:    'Dụng cụ đặc biệt không rõ loại xyz123',
      packageType: 'goods_fixed_asset',
    });
    expect(out.reasoning.length).toBeGreaterThan(0);
  });

  it('SA7-04: reasoning entries include the packageType tag', () => {
    const out = generateSpecWithReasoning(CLEAN_INPUT);
    const joined = out.reasoning.join(' ');
    expect(joined).toContain('goods_fixed_asset');
  });
});

// ─── SA8: batchGenerate() basic ───────────────────────────────────────────────

describe('SA8 — batchGenerate() basic', () => {
  it('SA8-01: empty items → empty results, zero brand warnings, compliant', () => {
    const out = batchGenerate({ items: [] });
    expect(out.results).toEqual([]);
    expect(out.totalBrandWarnings).toBe(0);
    expect(out.overallComplianceStatus).toBe('compliant');
  });

  it('SA8-02: single item → results.length === 1', () => {
    const out = batchGenerate({ items: [CLEAN_INPUT] });
    expect(out.results.length).toBe(1);
  });

  it('SA8-03: three items → results.length === 3', () => {
    const out = batchGenerate({ items: [CLEAN_INPUT, CLEAN_INPUT, CLEAN_INPUT] });
    expect(out.results.length).toBe(3);
  });

  it('SA8-04: sharedContext containing a brand affects unknown-item brandWarnings', () => {
    const out = batchGenerate({
      items:         [{ itemName: 'Dụng cụ thí nghiệm không rõ loại', packageType: 'goods_fixed_asset' }],
      sharedContext: 'Dell laptop yêu cầu kèm theo',
    });
    // Unknown item uses existingSpecs as spec → reviewSpec detects 'Dell'
    expect(out.overallComplianceStatus).not.toBe('compliant');
  });

  it('SA8-05: totalBrandWarnings is the sum across all items', () => {
    const out = batchGenerate({
      items: [
        { itemName: 'Máy tính Dell', packageType: 'goods_fixed_asset' },           // 1 brand
        { itemName: 'Điều hòa Daikin Panasonic', packageType: 'goods_fixed_asset' }, // 2 brands
      ],
    });
    expect(out.totalBrandWarnings).toBe(3);
  });
});

// ─── SA9: batchGenerate() overallComplianceStatus ─────────────────────────────

describe('SA9 — batchGenerate() overallComplianceStatus', () => {
  it('SA9-01: all compliant items → overall compliant', () => {
    const out = batchGenerate({ items: [CLEAN_INPUT, CLEAN_INPUT] });
    expect(out.overallComplianceStatus).toBe('compliant');
  });

  it('SA9-02: one warning item among clean items → overall warning', () => {
    const out = batchGenerate({ items: [CLEAN_INPUT, BRAND_INPUT] });
    expect(out.overallComplianceStatus).toBe('warning');
  });

  it('SA9-03: one violation item → overall violation', () => {
    const violation: SpecInput = { ...BRAND_INPUT, legalFindings: [makeFinding('CRITICAL')] };
    const out = batchGenerate({ items: [violation] });
    expect(out.overallComplianceStatus).toBe('violation');
  });

  it('SA9-04: violation and warning mixed → overall violation (worst status wins)', () => {
    const violation: SpecInput = { ...BRAND_INPUT, legalFindings: [makeFinding('CRITICAL')] };
    const out = batchGenerate({ items: [violation, BRAND_INPUT] });
    expect(out.overallComplianceStatus).toBe('violation');
  });
});

// ─── SA10: SpecificationAgent identity ────────────────────────────────────────

describe('SA10 — SpecificationAgent identity', () => {
  beforeEach(() => {
    registry = new AgentRegistry();
    agent    = new SpecificationAgent(registry);
  });

  it('SA10-01: id === "specification"', () => {
    expect(agent.id).toBe('specification');
  });

  it('SA10-02: name === "Specification Agent"', () => {
    expect(agent.name).toBe('Specification Agent');
  });

  it('SA10-03: getCapabilities() includes all four capabilities', () => {
    const caps = agent.getCapabilities();
    expect(caps).toContain('spec-generation');
    expect(caps).toContain('brand-detection');
    expect(caps).toContain('alternative-suggestion');
    expect(caps).toContain('batch-spec-processing');
  });
});

// ─── SA11: process() success paths ────────────────────────────────────────────

describe('SA11 — process() success paths', () => {
  beforeEach(() => {
    registry = new AgentRegistry();
    agent    = new SpecificationAgent(registry);
  });

  it('SA11-01: valid input → response type is "response"', async () => {
    const res = await agent.process(makeMsg(CLEAN_INPUT, 'trace-sa11-01'));
    expect(res.type).toBe('response');
  });

  it('SA11-02: response.from === "specification"', async () => {
    const res = await agent.process(makeMsg(CLEAN_INPUT, 'trace-sa11-02'));
    expect(res.from).toBe('specification');
  });

  it('SA11-03: response.to matches the original sender', async () => {
    const res = await agent.process(makeMsg(CLEAN_INPUT, 'trace-sa11-03', 'planner'));
    expect(res.to).toBe('planner');
  });

  it('SA11-04: payload has SpecOutput fields specs, reasoning, brandWarnings', async () => {
    const res = await agent.process(makeMsg(CLEAN_INPUT, 'trace-sa11-04'));
    const p = res.payload as Record<string, unknown>;
    expect(typeof p['specs']).toBe('string');
    expect(Array.isArray(p['reasoning'])).toBe(true);
    expect(Array.isArray(p['brandWarnings'])).toBe(true);
  });

  it('SA11-05: response.legalBasis is a non-empty array', async () => {
    const res = await agent.process(makeMsg(CLEAN_INPUT, 'trace-sa11-05'));
    expect(Array.isArray(res.legalBasis)).toBe(true);
    expect((res.legalBasis ?? []).length).toBeGreaterThan(0);
  });

  it('SA11-06: registry trace has logged messages after process()', async () => {
    const traceId = 'trace-sa11-06';
    await agent.process(makeMsg(CLEAN_INPUT, traceId));
    expect(registry.getTrace(traceId).length).toBeGreaterThan(0);
  });
});

// ─── SA12: process() error paths and never-throws ─────────────────────────────

describe('SA12 — process() error / never-throw', () => {
  beforeEach(() => {
    registry = new AgentRegistry();
    agent    = new SpecificationAgent(registry);
  });

  it('SA12-01: empty itemName → type is "error"', async () => {
    const res = await agent.process(
      makeMsg({ itemName: '', packageType: 'goods_fixed_asset' }, 'trace-sa12-01'),
    );
    expect(res.type).toBe('error');
  });

  it('SA12-02: error payload code === "SPEC_EMPTY_INPUT"', async () => {
    const res = await agent.process(
      makeMsg({ itemName: '', packageType: 'goods_fixed_asset' }, 'trace-sa12-02'),
    );
    const p = res.payload as Record<string, unknown>;
    expect(p['code']).toBe('SPEC_EMPTY_INPUT');
  });

  it('SA12-03: whitespace-only itemName → type is "error"', async () => {
    const res = await agent.process(
      makeMsg({ itemName: '   ', packageType: 'goods_fixed_asset' }, 'trace-sa12-03'),
    );
    expect(res.type).toBe('error');
  });

  it('SA12-04: after error, state resets — next valid call returns "response"', async () => {
    await agent.process(
      makeMsg({ itemName: '', packageType: 'goods_fixed_asset' }, 'trace-sa12-04a'),
    );
    const res = await agent.process(makeMsg(CLEAN_INPUT, 'trace-sa12-04b'));
    expect(res.type).toBe('response');
  });

  it('SA12-05: process() never throws — null payload resolves to error message', async () => {
    const badMsg = makeMsg(null, 'trace-sa12-05');
    await expect(agent.process(badMsg)).resolves.toBeDefined();
  });

  it('SA12-06: error response.from === "specification"', async () => {
    const res = await agent.process(
      makeMsg({ itemName: '', packageType: 'goods_fixed_asset' }, 'trace-sa12-06'),
    );
    expect(res.from).toBe('specification');
  });
});
