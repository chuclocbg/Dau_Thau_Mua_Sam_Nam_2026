/**
 * Package integration — MasterData + RuleEngine + WorkflowEngine
 *
 * Groups (13 × 3 = 39):
 *   PG-01  validatePackageAgainstMasterData — all valid
 *   PG-02  validatePackageAgainstMasterData — unknown department
 *   PG-03  validatePackageAgainstMasterData — inactive fund source
 *   PG-04  validatePackageAgainstMasterData — unknown packageType + method
 *   PG-05  evaluatePackageWithRuleEngine — returns ProcurementDecision
 *   PG-06  evaluatePackageWithRuleEngine — classification matches packageType
 *   PG-07  evaluatePackageWithRuleEngine — method selection
 *   PG-08  createPackageWithWorkflow — happy path returns pkg + workflow
 *   PG-09  createPackageWithWorkflow — workflow starts in DRAFT
 *   PG-10  createPackageWithWorkflow — throws on unknown packageType
 *   PG-11  linkWorkflowToPackage — sets workflowId
 *   PG-12  linkWorkflowToPackage — throws for unknown package
 *   PG-13  buildPackageSummary — returns code, name, value, status, decision
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validatePackageAgainstMasterData,
  evaluatePackageWithRuleEngine,
  createPackageWithWorkflow,
  linkWorkflowToPackage,
  buildPackageSummary,
} from '../procurement/package/packageIntegration';
import { createMemoryPackageRepositories } from '../procurement/package/memoryPackageRepositories';
import {
  createMemoryMasterDataRepositories, seedDefaultData,
} from '../masterdata/masterdataFactory';
import type { MasterDataRepositories } from '../masterdata/masterdataRepository';
import type { ProcurementPackage } from '../procurement/package/packageTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePkg(o: Partial<ProcurementPackage> = {}): ProcurementPackage {
  return {
    id: 'pkg-001', packageCode: 'DTMS/2026/001', packageName: 'Mua sắm máy tính',
    description: '', packageType: 'GOODS', procurementMethod: 'OPEN_TENDER',
    estimatedValue: 500_000_000, fundSource: 'STATE', budgetYear: 'BY-2026',
    department: 'PHONG-TC', owner: 'NV001', status: 'DRAFT',
    schedule: {}, funding: [], participants: [],
    createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z',
    ...o,
  };
}

// master data repos seeded with standard data + a PHONG-TC department
async function makeSeededMasterRepos(): Promise<MasterDataRepositories> {
  const r = createMemoryMasterDataRepositories();
  await seedDefaultData(r);
  await r.departments.create({ code: 'PHONG-TC', name: 'Phòng Tài chính', isActive: true, isArchived: false, level: 1 });
  return r;
}

// ─── PG-01: validatePackageAgainstMasterData — valid ─────────────────────────

describe('PG-01 validatePackageAgainstMasterData passes for all valid codes', () => {
  let masterRepos: MasterDataRepositories;

  beforeEach(async () => { masterRepos = await makeSeededMasterRepos(); });

  it('returns valid=true for seeded package', async () => {
    const result = await validatePackageAgainstMasterData(makePkg(), masterRepos);
    expect(result.valid).toBe(true);
  });
  it('errors array is empty when valid', async () => {
    const result = await validatePackageAgainstMasterData(makePkg(), masterRepos);
    expect(result.errors).toHaveLength(0);
  });
  it('SERVICE packageType with DIRECT_APPOINTMENT passes', async () => {
    const result = await validatePackageAgainstMasterData(
      makePkg({ packageType: 'SERVICE', procurementMethod: 'DIRECT_APPOINTMENT' }),
      masterRepos,
    );
    expect(result.valid).toBe(true);
  });
});

// ─── PG-02: unknown department ───────────────────────────────────────────────

describe('PG-02 validatePackageAgainstMasterData fails on unknown department', () => {
  let masterRepos: MasterDataRepositories;

  beforeEach(async () => { masterRepos = await makeSeededMasterRepos(); });

  it('returns valid=false for unknown department', async () => {
    const result = await validatePackageAgainstMasterData(
      makePkg({ department: 'UNKNOWN-DEPT' }), masterRepos,
    );
    expect(result.valid).toBe(false);
  });
  it('error mentions the department code', async () => {
    const result = await validatePackageAgainstMasterData(
      makePkg({ department: 'GHOST' }), masterRepos,
    );
    expect(result.errors.some(e => e.includes('GHOST'))).toBe(true);
  });
  it('archived department is rejected', async () => {
    const d = await masterRepos.departments.findByCode('PHONG-TC');
    await masterRepos.departments.archive(d!.id);
    const result = await validatePackageAgainstMasterData(makePkg(), masterRepos);
    expect(result.valid).toBe(false);
  });
});

// ─── PG-03: inactive fund source ─────────────────────────────────────────────

describe('PG-03 validatePackageAgainstMasterData fails on inactive fund source', () => {
  let masterRepos: MasterDataRepositories;

  beforeEach(async () => { masterRepos = await makeSeededMasterRepos(); });

  it('unknown fund source code fails', async () => {
    const result = await validatePackageAgainstMasterData(
      makePkg({ fundSource: 'UNKNOWN_FS' }), masterRepos,
    );
    expect(result.valid).toBe(false);
  });
  it('error mentions fund source', async () => {
    const result = await validatePackageAgainstMasterData(
      makePkg({ fundSource: 'GRANT' }), masterRepos,
    );
    expect(result.errors.some(e => e.includes('GRANT'))).toBe(true);
  });
  it('archived STATE fund source fails', async () => {
    const fs = await masterRepos.fundSources.findByCode('STATE');
    await masterRepos.fundSources.archive(fs!.id);
    const result = await validatePackageAgainstMasterData(makePkg(), masterRepos);
    expect(result.valid).toBe(false);
  });
});

// ─── PG-04: unknown packageType + method ─────────────────────────────────────

describe('PG-04 validatePackageAgainstMasterData fails on unknown type or method', () => {
  let masterRepos: MasterDataRepositories;

  beforeEach(async () => { masterRepos = await makeSeededMasterRepos(); });

  it('unknown packageType fails', async () => {
    const result = await validatePackageAgainstMasterData(
      makePkg({ packageType: 'UNKNOWN_TYPE' }), masterRepos,
    );
    expect(result.valid).toBe(false);
  });
  it('unknown procurementMethod fails', async () => {
    const result = await validatePackageAgainstMasterData(
      makePkg({ procurementMethod: 'GHOST_METHOD' }), masterRepos,
    );
    expect(result.valid).toBe(false);
  });
  it('multiple unknowns produce multiple errors', async () => {
    const result = await validatePackageAgainstMasterData(
      makePkg({ packageType: 'BAD', procurementMethod: 'BAD', department: 'BAD' }), masterRepos,
    );
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── PG-05: evaluatePackageWithRuleEngine — decision shape ───────────────────

describe('PG-05 evaluatePackageWithRuleEngine returns ProcurementDecision', () => {
  it('returns an object with packageClassification field', () => {
    const decision = evaluatePackageWithRuleEngine(makePkg());
    expect(decision).toHaveProperty('packageClassification');
  });
  it('returns threshold and method decisions', () => {
    const decision = evaluatePackageWithRuleEngine(makePkg());
    expect(decision).toHaveProperty('threshold');
    expect(decision).toHaveProperty('method');
  });
  it('returns evaluations array', () => {
    const decision = evaluatePackageWithRuleEngine(makePkg());
    expect(Array.isArray(decision.evaluations)).toBe(true);
  });
});

// ─── PG-06: evaluatePackageWithRuleEngine — classification ───────────────────

describe('PG-06 evaluatePackageWithRuleEngine classification matches packageType', () => {
  it('GOODS package → GOODS classification', () => {
    const decision = evaluatePackageWithRuleEngine(makePkg({ packageType: 'GOODS' }));
    expect(decision.packageClassification.packageType).toBe('GOODS');
  });
  it('CONSTRUCTION package → CONSTRUCTION classification', () => {
    const decision = evaluatePackageWithRuleEngine(makePkg({ packageType: 'CONSTRUCTION' }));
    expect(decision.packageClassification.packageType).toBe('CONSTRUCTION');
  });
  it('threshold value matches estimatedValue', () => {
    const decision = evaluatePackageWithRuleEngine(makePkg({ estimatedValue: 500_000_000 }));
    expect(decision.threshold.value).toBe(500_000_000);
  });
});

// ─── PG-07: evaluatePackageWithRuleEngine — method ───────────────────────────

describe('PG-07 evaluatePackageWithRuleEngine returns method decision', () => {
  it('method is a non-empty string', () => {
    const decision = evaluatePackageWithRuleEngine(makePkg());
    expect(decision.method.method.length).toBeGreaterThan(0);
  });
  it('legalDocuments is an array', () => {
    const decision = evaluatePackageWithRuleEngine(makePkg());
    expect(Array.isArray(decision.legalDocuments)).toBe(true);
  });
  it('asOfDate is set from package.createdAt', () => {
    const decision = evaluatePackageWithRuleEngine(makePkg({ createdAt: '2026-07-15T00:00:00Z' }));
    expect(decision.asOfDate).toBe('2026-07-15');
  });
});

// ─── PG-08: createPackageWithWorkflow — happy path ───────────────────────────

describe('PG-08 createPackageWithWorkflow returns pkg + workflow', () => {
  let masterRepos: MasterDataRepositories;

  beforeEach(async () => { masterRepos = await makeSeededMasterRepos(); });

  it('returns pkg and workflow objects', async () => {
    const result = await createPackageWithWorkflow(makePkg(), masterRepos, 'NV001');
    expect(result).toHaveProperty('pkg');
    expect(result).toHaveProperty('workflow');
  });
  it('pkg is the same package passed in', async () => {
    const pkg = makePkg({ packageCode: 'TEST/001' });
    const result = await createPackageWithWorkflow(pkg, masterRepos, 'NV001');
    expect(result.pkg.packageCode).toBe('TEST/001');
  });
  it('workflow has a context property', async () => {
    const result = await createPackageWithWorkflow(makePkg(), masterRepos, 'NV001');
    expect(result.workflow).toHaveProperty('context');
  });
});

// ─── PG-09: workflow starts in DRAFT state ───────────────────────────────────

describe('PG-09 createPackageWithWorkflow workflow starts in DRAFT', () => {
  let masterRepos: MasterDataRepositories;

  beforeEach(async () => { masterRepos = await makeSeededMasterRepos(); });

  it('workflow context currentState is DRAFT', async () => {
    const result = await createPackageWithWorkflow(makePkg(), masterRepos, 'NV001');
    expect(result.workflow.context.currentState).toBe('DRAFT');
  });
  it('workflow status is ACTIVE', async () => {
    const result = await createPackageWithWorkflow(makePkg(), masterRepos, 'NV001');
    expect(result.workflow.context.status).toBe('ACTIVE');
  });
  it('workflow history has at least 1 entry (CREATE event)', async () => {
    const result = await createPackageWithWorkflow(makePkg(), masterRepos, 'NV001');
    expect(result.workflow.history.entries.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── PG-10: createPackageWithWorkflow — unknown packageType ──────────────────

describe('PG-10 createPackageWithWorkflow throws on unknown packageType in master data', () => {
  let masterRepos: MasterDataRepositories;

  beforeEach(async () => { masterRepos = await makeSeededMasterRepos(); });

  it('throws for unknown packageTypeCode', async () => {
    await expect(
      createPackageWithWorkflow(makePkg({ packageType: 'UNKNOWN' }), masterRepos, 'NV001'),
    ).rejects.toThrow();
  });
  it('throws for unknown procurementMethod', async () => {
    await expect(
      createPackageWithWorkflow(makePkg({ procurementMethod: 'GHOST' }), masterRepos, 'NV001'),
    ).rejects.toThrow();
  });
  it('error message identifies the bad code', async () => {
    const err = await createPackageWithWorkflow(
      makePkg({ packageType: 'BAD_CODE' }), masterRepos, 'NV001',
    ).catch(e => e);
    expect(err.message).toMatch(/BAD_CODE/);
  });
});

// ─── PG-11: linkWorkflowToPackage — sets workflowId ─────────────────────────

describe('PG-11 linkWorkflowToPackage sets workflowId on package', () => {
  it('workflowId is set on the package', async () => {
    const repos = createMemoryPackageRepositories();
    const pkg = await repos.packages.create({
      packageCode: 'X', packageName: 'X', description: '', packageType: 'GOODS',
      procurementMethod: 'OPEN_TENDER', estimatedValue: 1, fundSource: 'STATE',
      budgetYear: 'B', department: 'D', owner: 'O', status: 'DRAFT',
      schedule: {}, funding: [], participants: [],
    });
    const updated = await linkWorkflowToPackage(pkg.id, 'wf-123', repos);
    expect(updated.workflowId).toBe('wf-123');
  });
  it('workflowId can be updated to a new value', async () => {
    const repos = createMemoryPackageRepositories();
    const pkg = await repos.packages.create({
      packageCode: 'Y', packageName: 'Y', description: '', packageType: 'SERVICE',
      procurementMethod: 'DIRECT_APPOINTMENT', estimatedValue: 1, fundSource: 'ODA',
      budgetYear: 'B', department: 'D', owner: 'O', status: 'ACTIVE',
      schedule: {}, funding: [], participants: [],
    });
    await linkWorkflowToPackage(pkg.id, 'wf-OLD', repos);
    const u = await linkWorkflowToPackage(pkg.id, 'wf-NEW', repos);
    expect(u.workflowId).toBe('wf-NEW');
  });
  it('other package fields are unchanged after link', async () => {
    const repos = createMemoryPackageRepositories();
    const pkg = await repos.packages.create({
      packageCode: 'Z', packageName: 'Name Z', description: '', packageType: 'GOODS',
      procurementMethod: 'OPEN_TENDER', estimatedValue: 500, fundSource: 'STATE',
      budgetYear: 'B', department: 'D', owner: 'O', status: 'DRAFT',
      schedule: {}, funding: [], participants: [],
    });
    const u = await linkWorkflowToPackage(pkg.id, 'wf-Z', repos);
    expect(u.packageName).toBe('Name Z');
    expect(u.estimatedValue).toBe(500);
  });
});

// ─── PG-12: linkWorkflowToPackage — unknown package ──────────────────────────

describe('PG-12 linkWorkflowToPackage throws for unknown package', () => {
  it('throws Error for unknown packageId', async () => {
    const repos = createMemoryPackageRepositories();
    await expect(linkWorkflowToPackage('ghost', 'wf-1', repos)).rejects.toThrow();
  });
  it('error message mentions packageId', async () => {
    const repos = createMemoryPackageRepositories();
    const err = await linkWorkflowToPackage('missing-pkg', 'wf', repos).catch(e => e);
    expect(err.message).toMatch(/missing-pkg/);
  });
  it('repos remain unchanged after failed link', async () => {
    const repos = createMemoryPackageRepositories();
    try { await linkWorkflowToPackage('x', 'wf', repos); } catch {}
    expect(await repos.packages.count()).toBe(0);
  });
});

// ─── PG-13: buildPackageSummary ──────────────────────────────────────────────

describe('PG-13 buildPackageSummary returns summary with rule engine decision', () => {
  it('has packageCode, packageName, estimatedValue, status', () => {
    const summary = buildPackageSummary(makePkg());
    expect(summary.packageCode).toBe('DTMS/2026/001');
    expect(summary.packageName).toBe('Mua sắm máy tính');
    expect(summary.estimatedValue).toBe(500_000_000);
    expect(summary.status).toBe('DRAFT');
  });
  it('ruleEngineDecision is a ProcurementDecision', () => {
    const summary = buildPackageSummary(makePkg());
    expect(summary.ruleEngineDecision).toHaveProperty('packageClassification');
    expect(summary.ruleEngineDecision).toHaveProperty('method');
  });
  it('ruleEngineDecision.packageClassification.packageType matches package', () => {
    const summary = buildPackageSummary(makePkg({ packageType: 'CONSTRUCTION' }));
    expect(summary.ruleEngineDecision.packageClassification.packageType).toBe('CONSTRUCTION');
  });
});
