import { describe, it, expect } from 'vitest';
import { reviewPackage } from '../ai/legalReviewer';
import { pkgS1Wins, makePkgWithTotal } from './fixtures';

// Helper to clone and modify a fixture package
const makePkg = (overrides: Partial<typeof pkgS1Wins>) => ({
  ...pkgS1Wins,
  ...overrides,
});

describe('P5-03 reviewPackage', () => {
  // --- Brand locking (LR-001) ---

  it('LR-001: flags brand name in item specs', () => {
    const pkg = makePkg({
      items: [{
        ...pkgS1Wins.items[0],
        name: 'Card đồ họa',
        specs: 'NVIDIA GTX 1650 hoặc tương đương',
      }],
    });
    const result = reviewPackage(pkg);
    const f = result.findings.find(f => f.code === 'LR-001');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('HIGH');
    expect(f!.legalBasis).toContain('Điều 44');
  });

  it('LR-001: no finding when specs are brand-free', () => {
    const pkg = makePkg({
      items: [{
        ...pkgS1Wins.items[0],
        name: 'Máy tính',
        specs: 'CPU ≥4 nhân, RAM ≥8 GB, SSD ≥256 GB',
      }],
    });
    const result = reviewPackage(pkg);
    expect(result.findings.filter(f => f.code === 'LR-001')).toHaveLength(0);
  });

  // --- Contract type (LR-002) ---

  it('LR-002: flags service + lump_sum mismatch', () => {
    const pkg = makePkg({ packageType: 'service', contractType: 'lump_sum' });
    const result = reviewPackage(pkg);
    const f = result.findings.find(f => f.code === 'LR-002');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('HIGH');
    expect(f!.legalBasis).toContain('Điều 62');
  });

  it('LR-002: no finding for service + unit_price', () => {
    const pkg = makePkg({ packageType: 'service', contractType: 'unit_price' });
    const result = reviewPackage(pkg);
    expect(result.findings.filter(f => f.code === 'LR-002')).toHaveLength(0);
  });

  it('LR-002: no finding for goods_fixed_asset + lump_sum', () => {
    const pkg = makePkg({ packageType: 'goods_fixed_asset', contractType: 'lump_sum' });
    const result = reviewPackage(pkg);
    expect(result.findings.filter(f => f.code === 'LR-002')).toHaveLength(0);
  });

  // --- Missing warranty (LR-004) ---

  it('LR-004: flags fixed asset with no warranty', () => {
    const pkg = makePkg({ packageType: 'goods_fixed_asset', warrantyMonths: 0 });
    const result = reviewPackage(pkg);
    const f = result.findings.find(f => f.code === 'LR-004');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('MEDIUM');
  });

  it('LR-004: no finding when warranty is set', () => {
    const pkg = makePkg({ packageType: 'goods_fixed_asset', warrantyMonths: 12 });
    const result = reviewPackage(pkg);
    expect(result.findings.filter(f => f.code === 'LR-004')).toHaveLength(0);
  });

  it('LR-004: no finding for consumable package (no warranty expected)', () => {
    const pkg = makePkg({ packageType: 'goods_consumable', warrantyMonths: 0 });
    const result = reviewPackage(pkg);
    expect(result.findings.filter(f => f.code === 'LR-004')).toHaveLength(0);
  });

  // --- Date gaps (LR-005) — reuses validateDateGaps ---

  it('LR-005: flags insufficient HSYC→bid-close gap', () => {
    const pkg = makePkg({
      dateDocIssue: '2026-06-10',
      dateBidClose: '2026-06-12', // only 2 days
    });
    const result = reviewPackage(pkg);
    const f = result.findings.find(f => f.code === 'LR-005');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('HIGH');
  });

  it('LR-005: no finding when date gaps are sufficient', () => {
    // fixtures have 7+ day gap (Jan 19 → Jan 26)
    const result = reviewPackage(pkgS1Wins);
    expect(result.findings.filter(f => f.code === 'LR-005')).toHaveLength(0);
  });

  // --- Missing supplier data (LR-009) ---

  it('LR-009: flags missing supplier 2/3 for large package', () => {
    const pkg = {
      ...makePkgWithTotal(600_000_000),
      supplier2Name: '',
      supplier3Name: '',
    };
    const result = reviewPackage(pkg);
    const f = result.findings.find(f => f.code === 'LR-009');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('HIGH');
  });

  it('LR-009: no finding for small package (< 500M)', () => {
    const pkg = {
      ...makePkgWithTotal(100_000_000),
      supplier2Name: '',
      supplier3Name: '',
    };
    const result = reviewPackage(pkg);
    expect(result.findings.filter(f => f.code === 'LR-009')).toHaveLength(0);
  });

  // --- Summary and severity aggregation ---

  it('returns hasCritical=true when any CRITICAL finding', () => {
    // Trigger LR-007: name says "đấu thầu rộng rãi" but value is small
    const pkg = makePkg({
      packageName: 'Gói đấu thầu rộng rãi mua sắm thiết bị',
      items: [{ ...pkgS1Wins.items[0], unitPrice: 100_000, quantity: 1 }],
    });
    const result = reviewPackage(pkg);
    expect(result.hasCritical).toBe(true);
    expect(result.summary).toContain('[CRITICAL]');
  });

  it('returns clean summary when no findings', () => {
    // pkgS1Wins is a clean, valid test fixture
    const pkg = makePkg({
      packageType: 'goods_fixed_asset',
      contractType: 'lump_sum',
      warrantyMonths: 12,
      items: [{ ...pkgS1Wins.items[0], specs: 'CPU ≥4 nhân, RAM ≥8 GB', name: 'Máy tính' }],
      supplier2Name: 'Công ty Beta',
      supplier3Name: 'Công ty Gamma',
    });
    const result = reviewPackage(pkg);
    // Only LOW findings (date asset increase) expected at most
    const nonLow = result.findings.filter(f => f.severity !== 'LOW');
    expect(nonLow).toHaveLength(0);
  });

  it('findings are sorted CRITICAL → HIGH → MEDIUM → LOW', () => {
    const pkg = makePkg({
      packageType: 'service',
      contractType: 'lump_sum',           // HIGH (LR-002)
      warrantyMonths: 0,                   // MEDIUM (LR-004) — not triggered for service
      items: [{
        ...pkgS1Wins.items[0],
        specs: 'Switch Cisco Catalyst',    // HIGH (LR-001)
      }],
    });
    const result = reviewPackage(pkg);
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    for (let i = 1; i < result.findings.length; i++) {
      expect(severityOrder[result.findings[i].severity])
        .toBeGreaterThanOrEqual(severityOrder[result.findings[i - 1].severity]);
    }
  });

  // --- Each finding has required fields ---

  it('all findings have required fields', () => {
    const pkg = makePkg({
      packageType: 'service',
      contractType: 'lump_sum',
      items: [{
        ...pkgS1Wins.items[0],
        specs: 'Panasonic inverter 9000 BTU',
      }],
    });
    const result = reviewPackage(pkg);
    for (const f of result.findings) {
      expect(f.code).toBeTruthy();
      expect(f.severity).toMatch(/^(CRITICAL|HIGH|MEDIUM|LOW)$/);
      expect(f.message.length).toBeGreaterThan(10);
      expect(f.legalBasis.length).toBeGreaterThan(5);
      expect(f.recommendation.length).toBeGreaterThan(5);
    }
  });
});
