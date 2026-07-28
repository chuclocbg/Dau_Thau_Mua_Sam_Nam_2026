/**
 * Phase 18 — Capability Framework: Registry, Router, Executor tests
 *
 * Groups (13 × 3 = 39):
 *   CF-01  (3)  CapabilityRegistry.registerCapability — adds to registry
 *   CF-02  (3)  CapabilityRegistry.resolveCapability  — returns undefined for unknown
 *   CF-03  (3)  CapabilityRegistry.listCapabilities   — returns all metadata
 *   CF-04  (3)  CapabilityRegistry.listCapabilities   — empty before registration
 *   CF-05  (3)  CapabilityRouter.routeRequest         — routes to correct capability
 *   CF-06  (3)  CapabilityRouter.routeRequest         — undefined for unknown domain
 *   CF-07  (3)  CapabilityExecutor — NOT_FOUND when domain not registered
 *   CF-08  (3)  CapabilityExecutor — SUCCESS when capability executes
 *   CF-09  (3)  CapabilityExecutor — runs validate() before execute()
 *   CF-10  (3)  CapabilityExecutor — FAILED when validate() returns valid=false
 *   CF-11  (3)  CapabilityExecutor — calls lifecycle hooks in order
 *   CF-12  (3)  CapabilityExecutor — FAILED when execute() throws
 *   CF-13  (3)  buildCapabilityFramework factory
 */

import { describe, it, expect } from 'vitest';
import { generateGovernanceContext } from '../application/governanceContext';
import {
  createCapabilityMetadata,
  createCapabilityRequest,
  type Capability,
  type CapabilityHooks,
  type CapabilityContext,
  type ValidationResult,
} from '../framework/capabilityTypes';
import {
  CapabilityRegistry,
  CapabilityRouter,
  CapabilityExecutor,
  buildCapabilityFramework,
} from '../framework/capabilityFramework';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const CTX = generateGovernanceContext({
  actor:       { id: 'u-fw', role: 'UNIT_HEAD' },
  currentDate: '2024-06-01',
  requestId:   'req-fw-001',
  packageValue: 50_000_000,
});

function makeCapability(domain: string, result: unknown = { done: true }): Capability {
  return {
    metadata: createCapabilityMetadata({
      id:          `${domain.toLowerCase()}-cap`,
      name:        `${domain} Capability`,
      domain,
      version:     '1.0.0',
      description: `Handles ${domain} governance.`,
    }),
    execute: (_ctx) => result,
  };
}

function makeValidatingCapability(domain: string, passes: boolean): Capability {
  return {
    metadata: createCapabilityMetadata({
      id: `${domain.toLowerCase()}-val`, name: `${domain}`, domain, version: '1', description: domain,
    }),
    execute: (_ctx) => ({ validated: true }),
    validate: (_ctx): ValidationResult =>
      passes
        ? { valid: true,  messages: [] }
        : { valid: false, messages: ['Input is invalid.'] },
  };
}

function makeThrowingCapability(domain: string): Capability {
  return {
    metadata: createCapabilityMetadata({
      id: `${domain.toLowerCase()}-err`, name: domain, domain, version: '1', description: domain,
    }),
    execute: (_ctx) => { throw new Error('Execution failed.'); },
  };
}

const PROC_CAP  = makeCapability('PROCUREMENT', { verdict: 'PROCEED' });
const ASSET_CAP = makeCapability('ASSETS', { assetCount: 3 });
const REQ       = createCapabilityRequest({ domain: 'PROCUREMENT', context: CTX });

// ─── CF-01: registerCapability adds to registry ───────────────────────────────

describe('CF-01 CapabilityRegistry.registerCapability adds to registry', () => {
  it('resolveCapability returns capability after registration', () => {
    const reg = new CapabilityRegistry();
    reg.registerCapability(PROC_CAP);
    expect(reg.resolveCapability('PROCUREMENT')).toBe(PROC_CAP);
  });
  it('multiple capabilities coexist by domain', () => {
    const reg = new CapabilityRegistry();
    reg.registerCapability(PROC_CAP);
    reg.registerCapability(ASSET_CAP);
    expect(reg.resolveCapability('PROCUREMENT')).toBe(PROC_CAP);
    expect(reg.resolveCapability('ASSETS')).toBe(ASSET_CAP);
  });
  it('last registration wins for same domain', () => {
    const reg  = new CapabilityRegistry();
    const alt  = makeCapability('PROCUREMENT', { alt: true });
    reg.registerCapability(PROC_CAP);
    reg.registerCapability(alt);
    expect(reg.resolveCapability('PROCUREMENT')).toBe(alt);
  });
});

// ─── CF-02: resolveCapability — undefined for unknown ────────────────────────

describe('CF-02 CapabilityRegistry.resolveCapability returns undefined for unknown', () => {
  it('returns undefined for unregistered domain', () => {
    const reg = new CapabilityRegistry();
    expect(reg.resolveCapability('PROCUREMENT')).toBeUndefined();
  });
  it('returns undefined after registering a different domain', () => {
    const reg = new CapabilityRegistry();
    reg.registerCapability(ASSET_CAP);
    expect(reg.resolveCapability('PROCUREMENT')).toBeUndefined();
  });
  it('domain lookup is case-sensitive', () => {
    const reg = new CapabilityRegistry();
    reg.registerCapability(PROC_CAP);
    expect(reg.resolveCapability('procurement')).toBeUndefined();
  });
});

// ─── CF-03: listCapabilities — returns all metadata ─────────────────────────

describe('CF-03 CapabilityRegistry.listCapabilities returns all metadata', () => {
  it('returns one metadata entry after one registration', () => {
    const reg = new CapabilityRegistry();
    reg.registerCapability(PROC_CAP);
    expect(reg.listCapabilities()).toHaveLength(1);
  });
  it('returns two metadata entries after two registrations', () => {
    const reg = new CapabilityRegistry();
    reg.registerCapability(PROC_CAP);
    reg.registerCapability(ASSET_CAP);
    expect(reg.listCapabilities()).toHaveLength(2);
  });
  it('returned list is frozen', () => {
    const reg = new CapabilityRegistry();
    reg.registerCapability(PROC_CAP);
    expect(Object.isFrozen(reg.listCapabilities())).toBe(true);
  });
});

// ─── CF-04: listCapabilities — empty before registration ─────────────────────

describe('CF-04 CapabilityRegistry.listCapabilities empty before registration', () => {
  it('returns empty array from fresh registry', () => {
    expect(new CapabilityRegistry().listCapabilities()).toHaveLength(0);
  });
  it('result is frozen even when empty', () => {
    expect(Object.isFrozen(new CapabilityRegistry().listCapabilities())).toBe(true);
  });
  it('list is an array', () => {
    expect(Array.isArray(new CapabilityRegistry().listCapabilities())).toBe(true);
  });
});

// ─── CF-05: CapabilityRouter.routeRequest — resolves correctly ───────────────

describe('CF-05 CapabilityRouter.routeRequest routes to correct capability', () => {
  it('returns capability for registered domain', () => {
    const reg = new CapabilityRegistry();
    reg.registerCapability(PROC_CAP);
    expect(new CapabilityRouter(reg).routeRequest(REQ)).toBe(PROC_CAP);
  });
  it('routes two different domains correctly', () => {
    const reg = new CapabilityRegistry();
    reg.registerCapability(PROC_CAP);
    reg.registerCapability(ASSET_CAP);
    const router   = new CapabilityRouter(reg);
    const assetReq = createCapabilityRequest({ domain: 'ASSETS', context: CTX });
    expect(router.routeRequest(REQ)).toBe(PROC_CAP);
    expect(router.routeRequest(assetReq)).toBe(ASSET_CAP);
  });
  it('capability metadata domain matches request domain', () => {
    const reg = new CapabilityRegistry();
    reg.registerCapability(PROC_CAP);
    const cap = new CapabilityRouter(reg).routeRequest(REQ);
    expect(cap?.metadata.domain).toBe(REQ.domain);
  });
});

// ─── CF-06: CapabilityRouter.routeRequest — undefined for unknown ─────────────

describe('CF-06 CapabilityRouter.routeRequest undefined for unknown domain', () => {
  it('returns undefined for unregistered domain', () => {
    const reg = new CapabilityRegistry();
    expect(new CapabilityRouter(reg).routeRequest(REQ)).toBeUndefined();
  });
  it('returns undefined after registering a different domain', () => {
    const reg = new CapabilityRegistry();
    reg.registerCapability(ASSET_CAP);
    expect(new CapabilityRouter(reg).routeRequest(REQ)).toBeUndefined();
  });
  it('returns undefined for empty registry', () => {
    const router = new CapabilityRouter(new CapabilityRegistry());
    expect(router.routeRequest(REQ)).toBeUndefined();
  });
});

// ─── CF-07: CapabilityExecutor — NOT_FOUND ────────────────────────────────────

describe('CF-07 CapabilityExecutor NOT_FOUND when domain not registered', () => {
  it('status is NOT_FOUND', () => {
    const exec = new CapabilityExecutor(new CapabilityRegistry());
    expect(exec.executeCapability(REQ).status).toBe('NOT_FOUND');
  });
  it('errors array contains the domain name', () => {
    const exec = new CapabilityExecutor(new CapabilityRegistry());
    expect(exec.executeCapability(REQ).errors[0]).toContain('PROCUREMENT');
  });
  it('capabilityId is empty string', () => {
    const exec = new CapabilityExecutor(new CapabilityRegistry());
    expect(exec.executeCapability(REQ).capabilityId).toBe('');
  });
});

// ─── CF-08: CapabilityExecutor — SUCCESS ─────────────────────────────────────

describe('CF-08 CapabilityExecutor SUCCESS when capability executes', () => {
  it('status is SUCCESS', () => {
    const reg = new CapabilityRegistry();
    reg.registerCapability(PROC_CAP);
    expect(new CapabilityExecutor(reg).executeCapability(REQ).status).toBe('SUCCESS');
  });
  it('data is the capability output', () => {
    const reg = new CapabilityRegistry();
    reg.registerCapability(PROC_CAP);
    const result = new CapabilityExecutor(reg).executeCapability<{ verdict: string }>(REQ);
    expect(result.data?.verdict).toBe('PROCEED');
  });
  it('capabilityId matches registered capability id', () => {
    const reg = new CapabilityRegistry();
    reg.registerCapability(PROC_CAP);
    expect(new CapabilityExecutor(reg).executeCapability(REQ).capabilityId).toBe('procurement-cap');
  });
});

// ─── CF-09: CapabilityExecutor — runs validate() ─────────────────────────────

describe('CF-09 CapabilityExecutor runs validate() before execute()', () => {
  it('SUCCESS when validate returns valid=true', () => {
    const reg = new CapabilityRegistry();
    reg.registerCapability(makeValidatingCapability('PROCUREMENT', true));
    expect(new CapabilityExecutor(reg).executeCapability(REQ).status).toBe('SUCCESS');
  });
  it('capabilities without validate() default to valid', () => {
    const reg = new CapabilityRegistry();
    reg.registerCapability(makeCapability('PROCUREMENT'));
    expect(new CapabilityExecutor(reg).executeCapability(REQ).status).toBe('SUCCESS');
  });
  it('data is { validated: true } from the validating capability', () => {
    const reg = new CapabilityRegistry();
    reg.registerCapability(makeValidatingCapability('PROCUREMENT', true));
    const res = new CapabilityExecutor(reg).executeCapability<{ validated: boolean }>(REQ);
    expect(res.data?.validated).toBe(true);
  });
});

// ─── CF-10: CapabilityExecutor — FAILED on invalid ───────────────────────────

describe('CF-10 CapabilityExecutor FAILED when validate() returns valid=false', () => {
  it('status is FAILED', () => {
    const reg = new CapabilityRegistry();
    reg.registerCapability(makeValidatingCapability('PROCUREMENT', false));
    expect(new CapabilityExecutor(reg).executeCapability(REQ).status).toBe('FAILED');
  });
  it('errors array contains the validation message', () => {
    const reg = new CapabilityRegistry();
    reg.registerCapability(makeValidatingCapability('PROCUREMENT', false));
    expect(new CapabilityExecutor(reg).executeCapability(REQ).errors[0]).toBe('Input is invalid.');
  });
  it('data is undefined on FAILED', () => {
    const reg = new CapabilityRegistry();
    reg.registerCapability(makeValidatingCapability('PROCUREMENT', false));
    expect(new CapabilityExecutor(reg).executeCapability(REQ).data).toBeUndefined();
  });
});

// ─── CF-11: CapabilityExecutor — hooks in order ──────────────────────────────

describe('CF-11 CapabilityExecutor calls lifecycle hooks in order', () => {
  it('hooks fire in beforeValidation → afterValidation → beforeExecution → afterExecution order', () => {
    const callOrder: string[] = [];
    const hooks: CapabilityHooks = {
      beforeValidation: () => { callOrder.push('beforeValidation'); },
      afterValidation:  () => { callOrder.push('afterValidation');  },
      beforeExecution:  () => { callOrder.push('beforeExecution');  },
      afterExecution:   () => { callOrder.push('afterExecution');   },
    };
    const reg = new CapabilityRegistry();
    reg.registerCapability(PROC_CAP);
    new CapabilityExecutor(reg, hooks).executeCapability(REQ);
    expect(callOrder).toEqual([
      'beforeValidation', 'afterValidation', 'beforeExecution', 'afterExecution',
    ]);
  });
  it('afterExecution hook receives the SUCCESS result', () => {
    const received: string[] = [];
    const hooks: CapabilityHooks = {
      afterExecution: (_ctx: CapabilityContext, r) => { received.push(r.status); },
    };
    const reg = new CapabilityRegistry();
    reg.registerCapability(PROC_CAP);
    new CapabilityExecutor(reg, hooks).executeCapability(REQ);
    expect(received[0]).toBe('SUCCESS');
  });
  it('afterExecution is still called after validation FAILED', () => {
    const called: string[] = [];
    const hooks: CapabilityHooks = {
      afterExecution: (_ctx: CapabilityContext, r) => { called.push(r.status); },
    };
    const reg = new CapabilityRegistry();
    reg.registerCapability(makeValidatingCapability('PROCUREMENT', false));
    new CapabilityExecutor(reg, hooks).executeCapability(REQ);
    expect(called[0]).toBe('FAILED');
  });
});

// ─── CF-12: CapabilityExecutor — FAILED when execute() throws ────────────────

describe('CF-12 CapabilityExecutor FAILED when execute() throws', () => {
  it('status is FAILED when capability throws', () => {
    const reg = new CapabilityRegistry();
    reg.registerCapability(makeThrowingCapability('PROCUREMENT'));
    expect(new CapabilityExecutor(reg).executeCapability(REQ).status).toBe('FAILED');
  });
  it('errors array contains the thrown Error message', () => {
    const reg = new CapabilityRegistry();
    reg.registerCapability(makeThrowingCapability('PROCUREMENT'));
    expect(new CapabilityExecutor(reg).executeCapability(REQ).errors[0]).toBe('Execution failed.');
  });
  it('onError hook is called with the thrown error', () => {
    const caught: unknown[] = [];
    const hooks: CapabilityHooks = { onError: (_ctx, err) => { caught.push(err); } };
    const reg = new CapabilityRegistry();
    reg.registerCapability(makeThrowingCapability('PROCUREMENT'));
    new CapabilityExecutor(reg, hooks).executeCapability(REQ);
    expect((caught[0] as Error).message).toBe('Execution failed.');
  });
});

// ─── CF-13: buildCapabilityFramework factory ─────────────────────────────────

describe('CF-13 buildCapabilityFramework factory', () => {
  it('returns registry, router, and executor', () => {
    const fw = buildCapabilityFramework();
    expect(fw.registry).toBeInstanceOf(CapabilityRegistry);
    expect(fw.router).toBeInstanceOf(CapabilityRouter);
    expect(fw.executor).toBeInstanceOf(CapabilityExecutor);
  });
  it('registered capability is immediately routable', () => {
    const fw = buildCapabilityFramework();
    fw.registry.registerCapability(PROC_CAP);
    expect(fw.router.routeRequest(REQ)).toBe(PROC_CAP);
  });
  it('full round-trip: register → execute → SUCCESS', () => {
    const fw = buildCapabilityFramework();
    fw.registry.registerCapability(PROC_CAP);
    const result = fw.executor.executeCapability(REQ);
    expect(result.status).toBe('SUCCESS');
    expect(result.domain).toBe('PROCUREMENT');
  });
});
