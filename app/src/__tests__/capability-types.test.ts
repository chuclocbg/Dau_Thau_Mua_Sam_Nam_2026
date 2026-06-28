/**
 * Phase 18 — Capability Framework: Types tests
 *
 * Groups (13 × 3 = 39):
 *   CT-01  (3)  createCapabilityMetadata — shape and frozen arrays
 *   CT-02  (3)  createCapabilityMetadata — defaults for optional fields
 *   CT-03  (3)  createCapabilityRequest — shape and frozen metadata
 *   CT-04  (3)  createCapabilityRequest — optional operation field
 *   CT-05  (3)  createCapabilityResult — SUCCESS shape
 *   CT-06  (3)  createCapabilityResult — frozen messages and errors
 *   CT-07  (3)  createCapabilityResult — NOT_FOUND shape
 *   CT-08  (3)  createCapabilityResult — executedAt is ISO string
 *   CT-09  (3)  createCapabilityContext — request and metadata preserved
 *   CT-10  (3)  createCapabilityContext — traceId from context.traceId
 *   CT-11  (3)  createCapabilityContext — traceId falls back to requestId
 *   CT-12  (3)  CapabilityHooks — lifecycle hooks are callable
 *   CT-13  (3)  KNOWN_DOMAINS has exactly 6 governance domains
 */

import { describe, it, expect, vi } from 'vitest';
import { generateGovernanceContext } from '../application/governanceContext';
import {
  KNOWN_DOMAINS,
  createCapabilityMetadata,
  createCapabilityRequest,
  createCapabilityResult,
  createCapabilityContext,
  type CapabilityHooks,
  type CapabilityContext,
  type ValidationResult,
} from '../framework/capabilityTypes';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const META = createCapabilityMetadata({
  id:          'procurement-cap',
  name:        'Procurement Capability',
  domain:      'PROCUREMENT',
  version:     '1.0.0',
  description: 'Handles procurement governance.',
  inputSchema: ['packageValue', 'currentDate'],
  tags:        ['procurement', 'threshold'],
});

const CTX = generateGovernanceContext({
  actor:       { id: 'u-001', role: 'UNIT_HEAD' },
  currentDate: '2024-06-01',
  requestId:   'req-ct-001',
  packageValue: 50_000_000,
});

const REQ = createCapabilityRequest({
  domain:  'PROCUREMENT',
  context: CTX,
  metadata: { source: 'test' },
});

// ─── CT-01: createCapabilityMetadata — shape ──────────────────────────────────

describe('CT-01 createCapabilityMetadata shape and frozen arrays', () => {
  it('id, name, domain, version are set', () => {
    expect(META.id).toBe('procurement-cap');
    expect(META.name).toBe('Procurement Capability');
    expect(META.domain).toBe('PROCUREMENT');
    expect(META.version).toBe('1.0.0');
  });
  it('inputSchema is frozen', () => {
    expect(Object.isFrozen(META.inputSchema)).toBe(true);
  });
  it('tags are frozen', () => {
    expect(Object.isFrozen(META.tags)).toBe(true);
  });
});

// ─── CT-02: createCapabilityMetadata — defaults ───────────────────────────────

describe('CT-02 createCapabilityMetadata defaults for optional fields', () => {
  const minimal = createCapabilityMetadata({
    id: 'x', name: 'X', domain: 'ASSETS', version: '1', description: 'X cap',
  });
  it('inputSchema defaults to empty frozen array', () => {
    expect(minimal.inputSchema).toEqual([]);
    expect(Object.isFrozen(minimal.inputSchema)).toBe(true);
  });
  it('tags defaults to empty frozen array', () => {
    expect(minimal.tags).toEqual([]);
    expect(Object.isFrozen(minimal.tags)).toBe(true);
  });
  it('description is set', () => {
    expect(minimal.description).toBe('X cap');
  });
});

// ─── CT-03: createCapabilityRequest — shape ───────────────────────────────────

describe('CT-03 createCapabilityRequest shape and frozen metadata', () => {
  it('domain is set', () => {
    expect(REQ.domain).toBe('PROCUREMENT');
  });
  it('context is preserved', () => {
    expect(REQ.context.requestId).toBe('req-ct-001');
  });
  it('metadata is frozen', () => {
    expect(Object.isFrozen(REQ.metadata)).toBe(true);
  });
});

// ─── CT-04: createCapabilityRequest — optional operation ─────────────────────

describe('CT-04 createCapabilityRequest optional operation field', () => {
  it('operation is undefined when not provided', () => {
    expect(REQ.operation).toBeUndefined();
  });
  it('operation is set when provided', () => {
    const r = createCapabilityRequest({ domain: 'PROCUREMENT', context: CTX, operation: 'analyze' });
    expect(r.operation).toBe('analyze');
  });
  it('metadata defaults to empty when not provided', () => {
    const r = createCapabilityRequest({ domain: 'PROCUREMENT', context: CTX });
    expect(r.metadata).toEqual({});
  });
});

// ─── CT-05: createCapabilityResult — SUCCESS shape ───────────────────────────

describe('CT-05 createCapabilityResult SUCCESS shape', () => {
  const result = createCapabilityResult({
    status:       'SUCCESS',
    data:         { verdict: 'PROCEED' },
    domain:       'PROCUREMENT',
    capabilityId: 'procurement-cap',
  });
  it('status is SUCCESS', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('data is returned', () => {
    expect((result.data as { verdict: string }).verdict).toBe('PROCEED');
  });
  it('domain and capabilityId are set', () => {
    expect(result.domain).toBe('PROCUREMENT');
    expect(result.capabilityId).toBe('procurement-cap');
  });
});

// ─── CT-06: createCapabilityResult — frozen arrays ───────────────────────────

describe('CT-06 createCapabilityResult frozen messages and errors', () => {
  const result = createCapabilityResult({
    status:       'FAILED',
    domain:       'PROCUREMENT',
    capabilityId: 'procurement-cap',
    messages:     ['msg1'],
    errors:       ['err1'],
  });
  it('messages are frozen', () => {
    expect(Object.isFrozen(result.messages)).toBe(true);
  });
  it('errors are frozen', () => {
    expect(Object.isFrozen(result.errors)).toBe(true);
  });
  it('messages and errors content is preserved', () => {
    expect(result.messages[0]).toBe('msg1');
    expect(result.errors[0]).toBe('err1');
  });
});

// ─── CT-07: createCapabilityResult — NOT_FOUND ───────────────────────────────

describe('CT-07 createCapabilityResult NOT_FOUND shape', () => {
  const result = createCapabilityResult({
    status:       'NOT_FOUND',
    domain:       'UNKNOWN',
    capabilityId: '',
    errors:       ["No capability registered for domain 'UNKNOWN'."],
  });
  it('status is NOT_FOUND', () => {
    expect(result.status).toBe('NOT_FOUND');
  });
  it('data is undefined', () => {
    expect(result.data).toBeUndefined();
  });
  it('errors array has the message', () => {
    expect(result.errors[0]).toContain('UNKNOWN');
  });
});

// ─── CT-08: createCapabilityResult — executedAt ──────────────────────────────

describe('CT-08 createCapabilityResult executedAt is ISO string', () => {
  const result = createCapabilityResult({
    status: 'SUCCESS', domain: 'PROCUREMENT', capabilityId: 'cap',
  });
  it('executedAt matches ISO-8601 pattern', () => {
    expect(result.executedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it('executedAt is parseable as Date', () => {
    expect(Number.isFinite(new Date(result.executedAt).getTime())).toBe(true);
  });
  it('traceId is undefined when not provided', () => {
    expect(result.traceId).toBeUndefined();
  });
});

// ─── CT-09: createCapabilityContext — request and metadata ───────────────────

describe('CT-09 createCapabilityContext request and metadata preserved', () => {
  const capCtx = createCapabilityContext(REQ, META);
  it('request is preserved', () => {
    expect(capCtx.request.domain).toBe('PROCUREMENT');
  });
  it('metadata is preserved', () => {
    expect(capCtx.metadata.id).toBe('procurement-cap');
  });
  it('startedAt is ISO string', () => {
    expect(capCtx.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ─── CT-10: createCapabilityContext — traceId from context.traceId ───────────

describe('CT-10 createCapabilityContext traceId from context.traceId', () => {
  const tracedCtx = generateGovernanceContext({
    actor:       { id: 'u-002', role: 'DIRECTOR' },
    currentDate: '2024-06-01',
    requestId:   'req-ct-002',
    traceId:     'trace-abc-123',
  });
  const tracedReq = createCapabilityRequest({ domain: 'PROCUREMENT', context: tracedCtx });
  const capCtx    = createCapabilityContext(tracedReq, META);
  it('traceId is taken from context.traceId', () => {
    expect(capCtx.traceId).toBe('trace-abc-123');
  });
  it('traceId is a string', () => {
    expect(typeof capCtx.traceId).toBe('string');
  });
  it('startedAt differs from traceId', () => {
    expect(capCtx.startedAt).not.toBe(capCtx.traceId);
  });
});

// ─── CT-11: createCapabilityContext — traceId fallback to requestId ──────────

describe('CT-11 createCapabilityContext traceId falls back to requestId', () => {
  const capCtx = createCapabilityContext(REQ, META);
  it('traceId equals requestId when context.traceId is absent', () => {
    expect(capCtx.traceId).toBe(CTX.requestId);
  });
  it('traceId is defined', () => {
    expect(capCtx.traceId).toBeDefined();
  });
  it('traceId is req-ct-001', () => {
    expect(capCtx.traceId).toBe('req-ct-001');
  });
});

// ─── CT-12: CapabilityHooks — callable ───────────────────────────────────────

describe('CT-12 CapabilityHooks lifecycle hooks are callable', () => {
  it('all hook fields accept function values', () => {
    const DUMMY_CTX = createCapabilityContext(REQ, META);
    const DUMMY_VR: ValidationResult = { valid: true, messages: [] };
    const DUMMY_RES = createCapabilityResult({ status: 'SUCCESS', domain: 'PROCUREMENT', capabilityId: 'x' });
    const hooks: CapabilityHooks = {
      beforeValidation: vi.fn(),
      afterValidation:  vi.fn(),
      beforeExecution:  vi.fn(),
      afterExecution:   vi.fn(),
      onError:          vi.fn(),
    };
    hooks.beforeValidation!(DUMMY_CTX);
    hooks.afterValidation!(DUMMY_CTX, DUMMY_VR);
    hooks.beforeExecution!(DUMMY_CTX);
    hooks.afterExecution!(DUMMY_CTX, DUMMY_RES);
    hooks.onError!(DUMMY_CTX, new Error('oops'));
    expect(hooks.beforeValidation as ReturnType<typeof vi.fn>).toHaveBeenCalledOnce();
    expect(hooks.afterValidation  as ReturnType<typeof vi.fn>).toHaveBeenCalledOnce();
    expect(hooks.beforeExecution  as ReturnType<typeof vi.fn>).toHaveBeenCalledOnce();
  });
  it('afterExecution receives the result', () => {
    const called: string[] = [];
    const DUMMY_CTX = createCapabilityContext(REQ, META);
    const DUMMY_RES = createCapabilityResult({ status: 'SUCCESS', domain: 'PROCUREMENT', capabilityId: 'x' });
    const hooks: CapabilityHooks = {
      afterExecution: (_ctx: CapabilityContext, r) => { called.push(r.status); },
    };
    hooks.afterExecution!(DUMMY_CTX, DUMMY_RES);
    expect(called[0]).toBe('SUCCESS');
  });
  it('CapabilityHooks is structurally valid with partial fields', () => {
    const partial: CapabilityHooks = { beforeExecution: () => {} };
    expect(partial.beforeExecution).toBeDefined();
    expect(partial.afterExecution).toBeUndefined();
  });
});

// ─── CT-13: KNOWN_DOMAINS ─────────────────────────────────────────────────────

describe('CT-13 KNOWN_DOMAINS has exactly 6 governance domains', () => {
  it('has exactly 6 entries', () => {
    expect(KNOWN_DOMAINS).toHaveLength(6);
  });
  it('includes PROCUREMENT, ASSETS, HR, AUDIT, LEGAL, FINANCE', () => {
    const domains = [...KNOWN_DOMAINS];
    expect(domains).toContain('PROCUREMENT');
    expect(domains).toContain('ASSETS');
    expect(domains).toContain('HR');
    expect(domains).toContain('AUDIT');
    expect(domains).toContain('LEGAL');
    expect(domains).toContain('FINANCE');
  });
  it('is frozen (runtime immutable)', () => {
    expect(Object.isFrozen(KNOWN_DOMAINS)).toBe(true);
  });
});
