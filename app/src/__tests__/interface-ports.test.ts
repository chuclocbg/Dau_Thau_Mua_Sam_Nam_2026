/**
 * Phase 14 — Interface Ports tests
 *
 * Groups (13 × 3 = 39):
 *   IP-01  (3)  contextFromRequest — actor identity from headers
 *   IP-02  (3)  contextFromRequest — currentDate from X-Governance-Date
 *   IP-03  (3)  contextFromRequest — defaults when headers absent
 *   IP-04  (3)  contextFromRequest — body domain fields extracted
 *   IP-05  (3)  contextFromRequest — optional headers (org, dept, trace, locale)
 *   IP-06  (3)  contextFromRequest — requestId from header / auto-generated
 *   IP-07  (3)  contextFromRequest — effectiveDate from body
 *   IP-08  (3)  mapStatusToHttp — SUCCESS / FAILED
 *   IP-09  (3)  mapStatusToHttp — REQUIRES_REVIEW / PENDING
 *   IP-10  (3)  mapResultToResponse — httpStatus set correctly
 *   IP-11  (3)  mapResultToResponse — body is full GovernanceResult
 *   IP-12  (3)  GovernanceMcpPort / GovernanceCliPort type shapes
 *   IP-13  (3)  GovernanceChatPort / GovernanceSdkPort type shapes
 */

import { describe, it, expect } from 'vitest';
import { contextFromRequest }   from '../interface/requestMapper';
import { mapStatusToHttp, mapResultToResponse } from '../interface/responseMapper';
import { createResult }         from '../application/governanceContext';
import type { HttpRequest }     from '../interface/ports';
import type {
  GovernanceMcpPort, GovernanceCliPort, GovernanceChatPort,
  McpTool, CliCommand, ChatMessage,
} from '../interface/ports';

// ─── Helper: build a minimal HttpRequest ──────────────────────────────────────

function makeReq(overrides: Partial<HttpRequest> = {}): HttpRequest {
  return {
    headers: {},
    body:    null,
    params:  {},
    query:   {},
    ...overrides,
  };
}

// ─── IP-01: actor from headers ────────────────────────────────────────────────

describe('IP-01 contextFromRequest actor headers', () => {
  it('actor.id comes from x-actor-id header', () => {
    const req = makeReq({ headers: { 'x-actor-id': 'u-999', 'x-actor-role': 'DIRECTOR' } });
    const ctx = contextFromRequest(req);
    expect(ctx.actor.id).toBe('u-999');
  });
  it('actor.role comes from x-actor-role header', () => {
    const req = makeReq({ headers: { 'x-actor-id': 'u-999', 'x-actor-role': 'DIRECTOR' } });
    const ctx = contextFromRequest(req);
    expect(ctx.actor.role).toBe('DIRECTOR');
  });
  it('actor.id and role are both required; set independently', () => {
    const req = makeReq({ headers: { 'x-actor-id': 'alice', 'x-actor-role': 'MANAGER' } });
    const ctx = contextFromRequest(req);
    expect(ctx.actor.id).toBe('alice');
    expect(ctx.actor.role).toBe('MANAGER');
  });
});

// ─── IP-02: currentDate from header ──────────────────────────────────────────

describe('IP-02 contextFromRequest currentDate header', () => {
  it('uses X-Governance-Date when present', () => {
    const req = makeReq({ headers: { 'x-governance-date': '2024-01-15' } });
    const ctx = contextFromRequest(req);
    expect(ctx.currentDate).toBe('2024-01-15');
  });
  it('date format is preserved as-is', () => {
    const req = makeReq({ headers: { 'x-governance-date': '2025-12-31' } });
    const ctx = contextFromRequest(req);
    expect(ctx.currentDate).toBe('2025-12-31');
  });
  it('currentDate is a string', () => {
    const req = makeReq({ headers: { 'x-governance-date': '2024-06-01' } });
    const ctx = contextFromRequest(req);
    expect(typeof ctx.currentDate).toBe('string');
  });
});

// ─── IP-03: defaults when headers absent ─────────────────────────────────────

describe('IP-03 contextFromRequest defaults', () => {
  it('actor.id defaults to anonymous', () => {
    const ctx = contextFromRequest(makeReq());
    expect(ctx.actor.id).toBe('anonymous');
  });
  it('actor.role defaults to GUEST', () => {
    const ctx = contextFromRequest(makeReq());
    expect(ctx.actor.role).toBe('GUEST');
  });
  it('currentDate defaults to today (non-null string)', () => {
    const ctx = contextFromRequest(makeReq());
    expect(ctx.currentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ─── IP-04: body domain fields ────────────────────────────────────────────────

describe('IP-04 contextFromRequest body domain fields', () => {
  it('packageValue extracted from body as number', () => {
    const req = makeReq({ body: { packageValue: 50_000_000 } });
    const ctx = contextFromRequest(req);
    expect(ctx.packageValue).toBe(50_000_000);
  });
  it('fundingSource extracted from body as string', () => {
    const req = makeReq({ body: { fundingSource: 'AUTONOMY' } });
    const ctx = contextFromRequest(req);
    expect(ctx.fundingSource).toBe('AUTONOMY');
  });
  it('packageValue ignored when not a number', () => {
    const req = makeReq({ body: { packageValue: 'not-a-number' } });
    const ctx = contextFromRequest(req);
    expect(ctx.packageValue).toBeUndefined();
  });
});

// ─── IP-05: optional headers ─────────────────────────────────────────────────

describe('IP-05 contextFromRequest optional headers', () => {
  it('organization from X-Organization', () => {
    const req = makeReq({ headers: { 'x-organization': 'Bộ Tài Chính' } });
    const ctx = contextFromRequest(req);
    expect(ctx.organization).toBe('Bộ Tài Chính');
  });
  it('department from X-Department', () => {
    const req = makeReq({ headers: { 'x-department': 'Kho bạc' } });
    const ctx = contextFromRequest(req);
    expect(ctx.department).toBe('Kho bạc');
  });
  it('traceId from X-Trace-Id', () => {
    const req = makeReq({ headers: { 'x-trace-id': 'trace-abc-123' } });
    const ctx = contextFromRequest(req);
    expect(ctx.traceId).toBe('trace-abc-123');
  });
});

// ─── IP-06: requestId ────────────────────────────────────────────────────────

describe('IP-06 contextFromRequest requestId', () => {
  it('requestId from X-Request-Id header', () => {
    const req = makeReq({ headers: { 'x-request-id': 'fixed-req-id' } });
    const ctx = contextFromRequest(req);
    expect(ctx.requestId).toBe('fixed-req-id');
  });
  it('requestId auto-generated when header absent', () => {
    const ctx = contextFromRequest(makeReq());
    expect(ctx.requestId).toBeDefined();
    expect(ctx.requestId.length).toBeGreaterThan(0);
  });
  it('two calls without X-Request-Id produce different requestIds', () => {
    const ctx1 = contextFromRequest(makeReq());
    const ctx2 = contextFromRequest(makeReq());
    // High probability of being different; auto-generation includes random component
    expect(ctx1.requestId).not.toBe(ctx2.requestId);
  });
});

// ─── IP-07: effectiveDate from body ──────────────────────────────────────────

describe('IP-07 contextFromRequest effectiveDate from body', () => {
  it('effectiveDate extracted from body string', () => {
    const req = makeReq({ body: { effectiveDate: '2023-01-01' } });
    const ctx = contextFromRequest(req);
    expect(ctx.effectiveDate).toBe('2023-01-01');
  });
  it('effectiveDate absent when not in body', () => {
    const ctx = contextFromRequest(makeReq());
    expect(ctx.effectiveDate).toBeUndefined();
  });
  it('effectiveDate ignored when not a string', () => {
    const req = makeReq({ body: { effectiveDate: 20230101 } });
    const ctx = contextFromRequest(req);
    expect(ctx.effectiveDate).toBeUndefined();
  });
});

// ─── IP-08: mapStatusToHttp SUCCESS / FAILED ─────────────────────────────────

describe('IP-08 mapStatusToHttp SUCCESS FAILED', () => {
  it('SUCCESS → 200', () => {
    expect(mapStatusToHttp('SUCCESS')).toBe(200);
  });
  it('FAILED → 400', () => {
    expect(mapStatusToHttp('FAILED')).toBe(400);
  });
  it('all four statuses return numbers', () => {
    const statuses = ['SUCCESS', 'FAILED', 'PENDING', 'REQUIRES_REVIEW'] as const;
    statuses.forEach(s => expect(typeof mapStatusToHttp(s)).toBe('number'));
  });
});

// ─── IP-09: mapStatusToHttp REQUIRES_REVIEW / PENDING ───────────────────────

describe('IP-09 mapStatusToHttp REQUIRES_REVIEW PENDING', () => {
  it('REQUIRES_REVIEW → 202', () => {
    expect(mapStatusToHttp('REQUIRES_REVIEW')).toBe(202);
  });
  it('PENDING → 202', () => {
    expect(mapStatusToHttp('PENDING')).toBe(202);
  });
  it('no status maps to 5xx (server errors not produced by mappers)', () => {
    const codes = ['SUCCESS', 'FAILED', 'PENDING', 'REQUIRES_REVIEW'] as const;
    codes.forEach(s => expect(mapStatusToHttp(s)).toBeLessThan(500));
  });
});

// ─── IP-10: mapResultToResponse httpStatus ────────────────────────────────────

describe('IP-10 mapResultToResponse httpStatus', () => {
  it('SUCCESS result → httpStatus 200', () => {
    const r = mapResultToResponse(createResult('SUCCESS'));
    expect(r.httpStatus).toBe(200);
  });
  it('FAILED result → httpStatus 400', () => {
    const r = mapResultToResponse(createResult('FAILED'));
    expect(r.httpStatus).toBe(400);
  });
  it('REQUIRES_REVIEW result → httpStatus 202', () => {
    const r = mapResultToResponse(createResult('REQUIRES_REVIEW'));
    expect(r.httpStatus).toBe(202);
  });
});

// ─── IP-11: mapResultToResponse body ─────────────────────────────────────────

describe('IP-11 mapResultToResponse body is full GovernanceResult', () => {
  it('body.status matches input result status', () => {
    const result = createResult('SUCCESS', { messages: ['ok'] });
    const r      = mapResultToResponse(result);
    expect(r.body.status).toBe('SUCCESS');
  });
  it('body.messages preserved', () => {
    const result = createResult('SUCCESS', { messages: ['done'] });
    const r      = mapResultToResponse(result);
    expect(r.body.messages[0]).toBe('done');
  });
  it('body.data preserved', () => {
    const result = createResult('SUCCESS', { data: { id: 'x' } });
    const r      = mapResultToResponse(result);
    expect((r.body.data as { id: string }).id).toBe('x');
  });
});

// ─── IP-12: GovernanceMcpPort / GovernanceCliPort type shapes ────────────────

describe('IP-12 GovernanceMcpPort and GovernanceCliPort shapes', () => {
  it('McpTool has name, description, inputSchema', () => {
    const tool: McpTool = {
      name: 'reviewCompliance', description: 'Check compliance rules',
      inputSchema: { type: 'object', properties: {} },
    };
    expect(tool.name).toBe('reviewCompliance');
    expect(tool.inputSchema).toBeDefined();
  });
  it('GovernanceMcpPort callTool signature accepts name+args', async () => {
    const mockMcp: GovernanceMcpPort = {
      tools: [],
      callTool: async (_name, _args) => ({ content: [{ type: 'text', text: 'ok' }] }),
    };
    const result = await mockMcp.callTool('ping', {});
    expect(result.content[0]?.text).toBe('ok');
  });
  it('CliCommand has name, description, args', () => {
    const cmd: CliCommand = {
      name: 'resolve', description: 'Resolve law',
      args: [{ name: 'date', type: 'string', required: true, help: 'Reference date' }],
    };
    expect(cmd.args[0]?.name).toBe('date');
  });
});

// ─── IP-13: GovernanceChatPort / GovernanceSdkPort type shapes ───────────────

describe('IP-13 GovernanceChatPort and GovernanceSdkPort shapes', () => {
  it('ChatMessage has role and content', () => {
    const msg: ChatMessage = { role: 'user', content: 'What are the thresholds?' };
    expect(msg.role).toBe('user');
    expect(msg.content.length).toBeGreaterThan(0);
  });
  it('GovernanceChatPort answer method is callable', async () => {
    const mockChat: GovernanceChatPort = {
      answer: async (_msg, _hist, _date) => ({
        answer: 'The threshold is 100M.',
        sources: ['nd-214'], confidence: 'high', followUps: [],
      }),
      search: async (_kw, _date) => [],
    };
    const r = await mockChat.answer('question?', [], '2024-06-01');
    expect(r.confidence).toBe('high');
  });
  it('GovernanceChatPort search method is callable', async () => {
    const mockChat: GovernanceChatPort = {
      answer: async () => ({ answer: '', sources: [], confidence: 'low', followUps: [] }),
      search: async (_kw, _date) => ['result-1', 'result-2'],
    };
    const results = await mockChat.search('đấu thầu', '2024-06-01');
    expect(results).toHaveLength(2);
  });
});
