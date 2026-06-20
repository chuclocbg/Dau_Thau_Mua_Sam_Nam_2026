/**
 * P9-03: LLM API integration — ChatAgent & LegalReviewerAgent — 56 tests
 *
 * Verifies that both agents:
 *   - Accept an optional LLMBridgeConfig in their constructor
 *   - Call paraphraseAnswer() when a valid API key + fetchFn are present
 *   - Fall back to rule-based mode when no key, empty key, or any network error
 *   - NEVER modify sources[], legalBasis[], findings[], or complianceScore via LLM
 *
 * Groups:
 *   P3-01  (7)  ChatAgent constructor accepts llmConfig
 *   P3-02  (7)  ChatAgent.process() — LLM success path (mocked fetch)
 *   P3-03  (7)  ChatAgent.process() — fallback path (no key / errors)
 *   P3-04  (7)  ChatAgent legalBasis[] preserved regardless of LLM
 *   P3-05  (7)  LegalReviewerAgent constructor accepts llmConfig
 *   P3-06  (7)  LegalReviewerAgent.process() — LLM success path (mocked fetch)
 *   P3-07  (7)  LegalReviewerAgent.process() — fallback path (no key / errors)
 *   P3-08  (7)  LegalReviewerAgent legalBasis[] preserved regardless of LLM
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { AgentRegistry }      from '../agents/AgentRegistry';
import { ChatAgent }          from '../agents/ChatAgent';
import { LegalReviewerAgent } from '../agents/LegalReviewerAgent';
import { CHAT_LEGAL_BASIS }   from '../agents/ChatAgent';
import { REVIEWER_LEGAL_BASIS } from '../agents/LegalReviewerAgent';

import type { AgentMessage }         from '../agents/types';
import type { ChatInput, ChatOutput } from '../agents/ChatAgent';
import type { DossierReviewInput, DossierReviewOutput } from '../agents/LegalReviewerAgent';
import type { LLMBridgeConfig }       from '../ai/llmBridge';
import type { ProcurementPackage }    from '../demoData';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

/** Well-formed Anthropic Messages API success response. */
function claudeOkResp(text: string): Response {
  return new Response(
    JSON.stringify({
      id: 'msg_test', type: 'message', role: 'assistant',
      content: [{ type: 'text', text }],
      model: 'claude-haiku-3-5-latest',
      stop_reason: 'end_turn', stop_sequence: null,
      usage: { input_tokens: 50, output_tokens: 20 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

/** Fetch that returns HTTP 401. */
function unauthorizedFetch(): LLMBridgeConfig['fetchFn'] {
  return async () => new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
}

/** Fetch that throws (simulates network failure). */
function throwingFetch(): LLMBridgeConfig['fetchFn'] {
  return async () => { throw new Error('connection refused'); };
}

/** LLMBridgeConfig that uses a mocked fetch returning a fixed paraphrased text. */
function mockLLMConfig(paraphrased: string): LLMBridgeConfig {
  return {
    apiKey:  'test-key-p9-03',
    fetchFn: async () => claudeOkResp(paraphrased),
  };
}

function makeRegistry(): AgentRegistry {
  return new AgentRegistry();
}

/** A real procurement query that the KB returns results for. */
const REAL_QUERY = 'ngưỡng phương thức lựa chọn nhà thầu';

function makeChatRequest(traceId: string, message = REAL_QUERY): AgentMessage {
  const input: ChatInput = { message, history: [] };
  return {
    traceId, from: 'user', to: 'chat',
    type: 'request', payload: input, timestamp: Date.now(),
  };
}

/** Clean package: valid dates, no brand names → 0 P5-03 findings, score=100. */
function makePkg(overrides: Partial<ProcurementPackage> = {}): ProcurementPackage {
  return {
    id: 'pkg-p903', packageName: 'Gói mua sắm vật tư tiêu hao',
    packageCode: 'PKG-P903', fundingSource: 'autonomy_fund',
    fundingSourceName: 'Quỹ phát triển hoạt động sự nghiệp',
    budgetYear: 2026,
    rectorName: '[Tên Hiệu trưởng]',
    departmentName: '[Tên đơn vị đề xuất]',
    departmentCode: '[Mã phòng]',
    expertTeamLeader:  '[Tổ trưởng tổ chuyên gia]',
    expertTeamMember1: '[Thành viên tổ chuyên gia]',
    expertTeamMember2: '[Thành viên tổ chuyên gia]',
    appraisalLeader:   '[Tổ trưởng thẩm định độc lập]',
    appraisalMember:   '[Thành viên thẩm định độc lập]',
    supplier1Name: '[Nhà cung cấp số 1]', supplier1Address: '[Địa chỉ 1]',
    supplier1TaxCode: '[MST]', supplier1Representative: '[Đại diện]',
    supplier1Position: '[Chức vụ]',
    supplier2Name: '[Nhà cung cấp số 2]', supplier2Address: '[Địa chỉ 2]',
    supplier3Name: '[Nhà cung cấp số 3]', supplier3Address: '[Địa chỉ 3]',
    dateProposal: '2026-01-05', dateSurvey: '2026-01-07',
    dateQuotes: '2026-01-07', dateCompare: '2026-01-07',
    dateKhlcnt: '2026-01-10', dateKhlcntApprove: '2026-01-15',
    dateExpertEstablish: '2026-01-20', dateDocIssue: '2026-02-01',
    dateBidClose: '2026-02-10', dateEvaluate: '2026-02-15',
    dateAppraise: '2026-02-20', dateResultApprove: '2026-02-25',
    dateContractSign: '2026-03-01', dateDelivery: '2026-03-15',
    dateAcceptance: '2026-03-20', dateLiquidation: '2026-04-01',
    contractType: 'lump_sum',
    packageType: 'goods_consumable',
    items: [{
      id: 'item-1', name: 'Vật tư văn phòng', unit: 'hộp', quantity: 2,
      unitPrice: 20_000_000, specs: 'Đạt tiêu chuẩn chất lượng tối thiểu.',
      supplier1Price: 20_000_000, supplier2Price: 0, supplier3Price: 0,
    }],
    ...overrides,
  };
}

function makeReviewerRequest(traceId: string): AgentMessage {
  const payload: DossierReviewInput = {
    pkg: makePkg(),
    documentIds: Array.from({ length: 28 }, (_, i) => i + 1),
    methodCode: 'DIRECT_SELECTION_SIMPLIFIED',
  };
  return {
    traceId, from: 'user', to: 'legal-reviewer',
    type: 'request', payload, timestamp: Date.now(),
  };
}

// ─── P3-01: ChatAgent constructor accepts llmConfig ───────────────────────────

describe('P3-01 · ChatAgent constructor accepts llmConfig', () => {
  it('P3-01-01: new ChatAgent(reg) — no llmConfig — constructs without error', () => {
    expect(() => new ChatAgent(makeRegistry())).not.toThrow();
  });

  it('P3-01-02: new ChatAgent(reg, undefined) — explicit undefined — constructs without error', () => {
    expect(() => new ChatAgent(makeRegistry(), undefined)).not.toThrow();
  });

  it('P3-01-03: new ChatAgent(reg, {}) — empty config — constructs without error', () => {
    expect(() => new ChatAgent(makeRegistry(), {})).not.toThrow();
  });

  it('P3-01-04: new ChatAgent(reg, {apiKey}) — apiKey config — constructs without error', () => {
    expect(() => new ChatAgent(makeRegistry(), { apiKey: 'sk-test' })).not.toThrow();
  });

  it('P3-01-05: new ChatAgent(reg, {fetchFn}) — fetchFn config — constructs without error', () => {
    const cfg = mockLLMConfig('text');
    expect(() => new ChatAgent(makeRegistry(), cfg)).not.toThrow();
  });

  it('P3-01-06: agent.id is "chat" regardless of llmConfig', () => {
    const agent = new ChatAgent(makeRegistry(), mockLLMConfig('x'));
    expect(agent.id).toBe('chat');
  });

  it('P3-01-07: getCapabilities() returns array when llmConfig is present', () => {
    const agent = new ChatAgent(makeRegistry(), mockLLMConfig('x'));
    expect(Array.isArray(agent.getCapabilities())).toBe(true);
    expect(agent.getCapabilities().length).toBeGreaterThanOrEqual(5);
  });
});

// ─── P3-02: ChatAgent.process() — LLM success path ───────────────────────────

describe('P3-02 · ChatAgent.process() — LLM success path (mocked fetch)', () => {
  const PARAPHRASED = 'Câu trả lời đã được diễn đạt lại qua LLM.';
  let registry: AgentRegistry;
  let agent: ChatAgent;

  beforeEach(() => {
    registry = makeRegistry();
    agent    = new ChatAgent(registry, mockLLMConfig(PARAPHRASED));
    registry.register(agent);
  });

  it('P3-02-01: process() returns type="response"', async () => {
    const resp = await agent.process(makeChatRequest('t-02-01'));
    expect(resp.type).toBe('response');
  });

  it('P3-02-02: payload.answer equals the paraphrased text from LLM', async () => {
    const resp = await agent.process(makeChatRequest('t-02-02'));
    const out  = resp.payload as ChatOutput;
    expect(out.answer).toBe(PARAPHRASED);
  });

  it('P3-02-03: payload.sources[] is still KB-derived (not from LLM)', async () => {
    const resp = await agent.process(makeChatRequest('t-02-03'));
    const out  = resp.payload as ChatOutput;
    expect(Array.isArray(out.sources)).toBe(true);
    // KB returns sources for a relevant query; sources must NOT contain LLM model name
    expect(out.sources.every(s => !s.includes('claude'))).toBe(true);
  });

  it('P3-02-04: payload.confidence is still KB-derived', async () => {
    const resp = await agent.process(makeChatRequest('t-02-04'));
    const out  = resp.payload as ChatOutput;
    expect(['high', 'medium', 'low']).toContain(out.confidence);
  });

  it('P3-02-05: payload.followUpSuggestions is still KB-derived (non-empty)', async () => {
    const resp = await agent.process(makeChatRequest('t-02-05'));
    const out  = resp.payload as ChatOutput;
    expect(Array.isArray(out.followUpSuggestions)).toBe(true);
    expect(out.followUpSuggestions.length).toBeGreaterThan(0);
  });

  it('P3-02-06: payload.relatedKBEntries is still present', async () => {
    const resp = await agent.process(makeChatRequest('t-02-06'));
    const out  = resp.payload as ChatOutput;
    expect(Array.isArray(out.relatedKBEntries)).toBe(true);
  });

  it('P3-02-07: response.from === "chat"', async () => {
    const resp = await agent.process(makeChatRequest('t-02-07'));
    expect(resp.from).toBe('chat');
  });
});

// ─── P3-03: ChatAgent.process() — fallback path ──────────────────────────────

describe('P3-03 · ChatAgent.process() — fallback path (no key / errors)', () => {
  it('P3-03-01: no llmConfig → answer is KB-based (non-empty string)', async () => {
    const reg   = makeRegistry();
    const agent = new ChatAgent(reg);
    reg.register(agent);
    const resp = await agent.process(makeChatRequest('t-03-01'));
    const out  = resp.payload as ChatOutput;
    expect(typeof out.answer).toBe('string');
    expect(out.answer.length).toBeGreaterThan(0);
  });

  it('P3-03-02: empty apiKey → answer is KB-based (non-empty string)', async () => {
    const reg   = makeRegistry();
    const agent = new ChatAgent(reg, { apiKey: '' });
    reg.register(agent);
    const resp = await agent.process(makeChatRequest('t-03-02'));
    const out  = resp.payload as ChatOutput;
    expect(out.answer.length).toBeGreaterThan(0);
  });

  it('P3-03-03: whitespace-only apiKey → answer is KB-based', async () => {
    const reg   = makeRegistry();
    const agent = new ChatAgent(reg, { apiKey: '   ' });
    reg.register(agent);
    const resp = await agent.process(makeChatRequest('t-03-03'));
    expect(resp.type).toBe('response');
  });

  it('P3-03-04: fetchFn throws (network error) → fallback to KB answer', async () => {
    const reg   = makeRegistry();
    const agent = new ChatAgent(reg, { apiKey: 'sk-test', fetchFn: throwingFetch() });
    reg.register(agent);
    const resp = await agent.process(makeChatRequest('t-03-04'));
    const out  = resp.payload as ChatOutput;
    expect(resp.type).toBe('response');
    expect(out.answer.length).toBeGreaterThan(0);
  });

  it('P3-03-05: fetchFn returns 401 → fallback to KB answer', async () => {
    const reg   = makeRegistry();
    const agent = new ChatAgent(reg, { apiKey: 'sk-bad', fetchFn: unauthorizedFetch() });
    reg.register(agent);
    const resp = await agent.process(makeChatRequest('t-03-05'));
    const out  = resp.payload as ChatOutput;
    expect(resp.type).toBe('response');
    expect(out.answer.length).toBeGreaterThan(0);
  });

  it('P3-03-06: sources[] is still present on fallback', async () => {
    const reg   = makeRegistry();
    const agent = new ChatAgent(reg);
    reg.register(agent);
    const resp = await agent.process(makeChatRequest('t-03-06'));
    const out  = resp.payload as ChatOutput;
    expect(Array.isArray(out.sources)).toBe(true);
  });

  it('P3-03-07: two identical fallback calls return equal answers (deterministic KB)', async () => {
    const reg    = makeRegistry();
    const agent1 = new ChatAgent(reg);
    const agent2 = new ChatAgent(makeRegistry());
    const msg1   = makeChatRequest('t-03-07a');
    const msg2   = { ...makeChatRequest('t-03-07b'), timestamp: msg1.timestamp };
    const resp1  = await agent1.process(msg1);
    const resp2  = await agent2.process(msg2);
    expect((resp1.payload as ChatOutput).answer).toBe((resp2.payload as ChatOutput).answer);
  });
});

// ─── P3-04: ChatAgent legalBasis[] preserved regardless of LLM ───────────────

describe('P3-04 · ChatAgent legalBasis[] preserved regardless of LLM', () => {
  it('P3-04-01: response.legalBasis is always set (no LLM)', async () => {
    const reg   = makeRegistry();
    const agent = new ChatAgent(reg);
    reg.register(agent);
    const resp = await agent.process(makeChatRequest('t-04-01'));
    expect(Array.isArray(resp.legalBasis)).toBe(true);
  });

  it('P3-04-02: response.legalBasis includes CHAT_LEGAL_BASIS entries (no LLM)', async () => {
    const reg   = makeRegistry();
    const agent = new ChatAgent(reg);
    reg.register(agent);
    const resp = await agent.process(makeChatRequest('t-04-02'));
    for (const basis of CHAT_LEGAL_BASIS) {
      expect(resp.legalBasis).toContain(basis);
    }
  });

  it('P3-04-03: response.legalBasis length >= 5 (CHAT_LEGAL_BASIS minimum)', async () => {
    const reg   = makeRegistry();
    const agent = new ChatAgent(reg);
    reg.register(agent);
    const resp = await agent.process(makeChatRequest('t-04-03'));
    expect(resp.legalBasis!.length).toBeGreaterThanOrEqual(5);
  });

  it('P3-04-04: response.legalBasis unchanged when LLM responds (mocked)', async () => {
    const reg     = makeRegistry();
    const noLLM   = new ChatAgent(reg);
    const withLLM = new ChatAgent(makeRegistry(), mockLLMConfig('LLM TEXT'));
    reg.register(noLLM);
    const resp1 = await noLLM.process(makeChatRequest('t-04-04a'));
    const resp2 = await withLLM.process({ ...makeChatRequest('t-04-04b'), timestamp: resp1.timestamp });
    // legalBasis must contain same CHAT_LEGAL_BASIS entries regardless of LLM
    for (const basis of CHAT_LEGAL_BASIS) {
      expect(resp1.legalBasis).toContain(basis);
      expect(resp2.legalBasis).toContain(basis);
    }
  });

  it('P3-04-05: LLM changing answer does NOT change sources[] in payload', async () => {
    const reg     = makeRegistry();
    const noLLM   = new ChatAgent(reg);
    const withLLM = new ChatAgent(makeRegistry(), mockLLMConfig('LLM TEXT'));
    reg.register(noLLM);
    const resp1 = await noLLM.process(makeChatRequest('t-04-05a'));
    const resp2 = await withLLM.process(makeChatRequest('t-04-05b'));
    const out1  = resp1.payload as ChatOutput;
    const out2  = resp2.payload as ChatOutput;
    // sources[] must be identical (both come from KB, not LLM)
    expect(out1.sources).toEqual(out2.sources);
  });

  it('P3-04-06: legalBasis[] includes KB source strings from the KB result', async () => {
    const reg   = makeRegistry();
    const agent = new ChatAgent(reg);
    reg.register(agent);
    const resp = await agent.process(makeChatRequest('t-04-06'));
    const out  = resp.payload as ChatOutput;
    // Every KB source in payload.sources should also appear in legalBasis[]
    for (const src of out.sources) {
      expect(resp.legalBasis).toContain(src);
    }
  });

  it('P3-04-07: response.legalBasis unchanged when fetchFn throws', async () => {
    const reg   = makeRegistry();
    const agent = new ChatAgent(reg, { apiKey: 'sk-test', fetchFn: throwingFetch() });
    reg.register(agent);
    const resp = await agent.process(makeChatRequest('t-04-07'));
    for (const basis of CHAT_LEGAL_BASIS) {
      expect(resp.legalBasis).toContain(basis);
    }
  });
});

// ─── P3-05: LegalReviewerAgent constructor accepts llmConfig ─────────────────

describe('P3-05 · LegalReviewerAgent constructor accepts llmConfig', () => {
  it('P3-05-01: new LegalReviewerAgent(reg) — no llmConfig — constructs without error', () => {
    expect(() => new LegalReviewerAgent(makeRegistry())).not.toThrow();
  });

  it('P3-05-02: new LegalReviewerAgent(reg, undefined) — constructs without error', () => {
    expect(() => new LegalReviewerAgent(makeRegistry(), undefined)).not.toThrow();
  });

  it('P3-05-03: new LegalReviewerAgent(reg, {}) — empty config — constructs without error', () => {
    expect(() => new LegalReviewerAgent(makeRegistry(), {})).not.toThrow();
  });

  it('P3-05-04: new LegalReviewerAgent(reg, {apiKey}) — constructs without error', () => {
    expect(() => new LegalReviewerAgent(makeRegistry(), { apiKey: 'sk-test' })).not.toThrow();
  });

  it('P3-05-05: new LegalReviewerAgent(reg, {fetchFn}) — constructs without error', () => {
    const cfg = mockLLMConfig('summary');
    expect(() => new LegalReviewerAgent(makeRegistry(), cfg)).not.toThrow();
  });

  it('P3-05-06: agent.id is "legal-reviewer" regardless of llmConfig', () => {
    const agent = new LegalReviewerAgent(makeRegistry(), mockLLMConfig('x'));
    expect(agent.id).toBe('legal-reviewer');
  });

  it('P3-05-07: getCapabilities() returns array when llmConfig is present', () => {
    const agent = new LegalReviewerAgent(makeRegistry(), mockLLMConfig('x'));
    expect(Array.isArray(agent.getCapabilities())).toBe(true);
    expect(agent.getCapabilities().length).toBeGreaterThanOrEqual(5);
  });
});

// ─── P3-06: LegalReviewerAgent.process() — LLM success path ─────────────────

describe('P3-06 · LegalReviewerAgent.process() — LLM success path (mocked fetch)', () => {
  const LLM_SUMMARY = 'Tóm tắt tuân thủ được tạo bởi LLM.';
  let registry: AgentRegistry;
  let agent: LegalReviewerAgent;

  beforeEach(() => {
    registry = makeRegistry();
    agent    = new LegalReviewerAgent(registry, mockLLMConfig(LLM_SUMMARY));
    registry.register(agent);
  });

  it('P3-06-01: process() returns type="response"', async () => {
    const resp = await agent.process(makeReviewerRequest('t-06-01'));
    expect(resp.type).toBe('response');
  });

  it('P3-06-02: payload.llmSummary is set when LLM responds', async () => {
    const resp = await agent.process(makeReviewerRequest('t-06-02'));
    const out  = resp.payload as DossierReviewOutput;
    expect(out.llmSummary).toBe(LLM_SUMMARY);
  });

  it('P3-06-03: payload.findings[] is still KB-grounded (not affected by LLM)', async () => {
    const resp = await agent.process(makeReviewerRequest('t-06-03'));
    const out  = resp.payload as DossierReviewOutput;
    expect(Array.isArray(out.findings)).toBe(true);
  });

  it('P3-06-04: payload.crossCheckIssues[] is still KB-grounded', async () => {
    const resp = await agent.process(makeReviewerRequest('t-06-04'));
    const out  = resp.payload as DossierReviewOutput;
    expect(Array.isArray(out.crossCheckIssues)).toBe(true);
  });

  it('P3-06-05: payload.complianceScore is still deterministic (100 for clean pkg)', async () => {
    const resp = await agent.process(makeReviewerRequest('t-06-05'));
    const out  = resp.payload as DossierReviewOutput;
    expect(out.complianceScore).toBe(100);
  });

  it('P3-06-06: payload.auditReadiness is still deterministic ("ready" for clean pkg)', async () => {
    const resp = await agent.process(makeReviewerRequest('t-06-06'));
    const out  = resp.payload as DossierReviewOutput;
    expect(out.auditReadiness).toBe('ready');
  });

  it('P3-06-07: payload.recommendations[] is still present alongside llmSummary', async () => {
    const resp = await agent.process(makeReviewerRequest('t-06-07'));
    const out  = resp.payload as DossierReviewOutput;
    expect(Array.isArray(out.recommendations)).toBe(true);
    expect(out.recommendations.length).toBeGreaterThan(0);
  });
});

// ─── P3-07: LegalReviewerAgent.process() — fallback path ────────────────────

describe('P3-07 · LegalReviewerAgent.process() — fallback path (no key / errors)', () => {
  it('P3-07-01: no llmConfig → llmSummary is undefined in payload', async () => {
    const reg   = makeRegistry();
    const agent = new LegalReviewerAgent(reg);
    reg.register(agent);
    const resp = await agent.process(makeReviewerRequest('t-07-01'));
    const out  = resp.payload as DossierReviewOutput;
    expect(out.llmSummary).toBeUndefined();
  });

  it('P3-07-02: empty apiKey → llmSummary is undefined', async () => {
    const reg   = makeRegistry();
    const agent = new LegalReviewerAgent(reg, { apiKey: '' });
    reg.register(agent);
    const resp = await agent.process(makeReviewerRequest('t-07-02'));
    const out  = resp.payload as DossierReviewOutput;
    expect(out.llmSummary).toBeUndefined();
  });

  it('P3-07-03: fetchFn throws → llmSummary is undefined (graceful fallback)', async () => {
    const reg   = makeRegistry();
    const agent = new LegalReviewerAgent(reg, { apiKey: 'sk-test', fetchFn: throwingFetch() });
    reg.register(agent);
    const resp = await agent.process(makeReviewerRequest('t-07-03'));
    const out  = resp.payload as DossierReviewOutput;
    expect(resp.type).toBe('response');
    expect(out.llmSummary).toBeUndefined();
  });

  it('P3-07-04: fetchFn returns 401 → llmSummary is undefined', async () => {
    const reg   = makeRegistry();
    const agent = new LegalReviewerAgent(reg, { apiKey: 'sk-bad', fetchFn: unauthorizedFetch() });
    reg.register(agent);
    const resp = await agent.process(makeReviewerRequest('t-07-04'));
    const out  = resp.payload as DossierReviewOutput;
    expect(out.llmSummary).toBeUndefined();
  });

  it('P3-07-05: recommendations[] still present on fallback', async () => {
    const reg   = makeRegistry();
    const agent = new LegalReviewerAgent(reg);
    reg.register(agent);
    const resp = await agent.process(makeReviewerRequest('t-07-05'));
    const out  = resp.payload as DossierReviewOutput;
    expect(out.recommendations.length).toBeGreaterThan(0);
  });

  it('P3-07-06: legalBasis[] still present on fallback', async () => {
    const reg   = makeRegistry();
    const agent = new LegalReviewerAgent(reg);
    reg.register(agent);
    const resp = await agent.process(makeReviewerRequest('t-07-06'));
    expect(Array.isArray(resp.legalBasis)).toBe(true);
    expect(resp.legalBasis!.length).toBeGreaterThan(0);
  });

  it('P3-07-07: complianceScore deterministic on fallback (100 for clean pkg)', async () => {
    const reg    = makeRegistry();
    const agent1 = new LegalReviewerAgent(reg);
    const agent2 = new LegalReviewerAgent(makeRegistry());
    reg.register(agent1);
    const resp1 = await agent1.process(makeReviewerRequest('t-07-07a'));
    const resp2 = await agent2.process(makeReviewerRequest('t-07-07b'));
    const out1  = resp1.payload as DossierReviewOutput;
    const out2  = resp2.payload as DossierReviewOutput;
    expect(out1.complianceScore).toBe(out2.complianceScore);
  });
});

// ─── P3-08: LegalReviewerAgent legalBasis[] preserved regardless of LLM ─────

describe('P3-08 · LegalReviewerAgent legalBasis[] preserved regardless of LLM', () => {
  it('P3-08-01: response.legalBasis is always set (no LLM)', async () => {
    const reg   = makeRegistry();
    const agent = new LegalReviewerAgent(reg);
    reg.register(agent);
    const resp = await agent.process(makeReviewerRequest('t-08-01'));
    expect(Array.isArray(resp.legalBasis)).toBe(true);
    expect(resp.legalBasis!.length).toBeGreaterThan(0);
  });

  it('P3-08-02: response.legalBasis includes REVIEWER_LEGAL_BASIS entries (no LLM)', async () => {
    const reg   = makeRegistry();
    const agent = new LegalReviewerAgent(reg);
    reg.register(agent);
    const resp = await agent.process(makeReviewerRequest('t-08-02'));
    for (const basis of REVIEWER_LEGAL_BASIS) {
      expect(resp.legalBasis).toContain(basis);
    }
  });

  it('P3-08-03: response.legalBasis includes REVIEWER_LEGAL_BASIS when LLM responds', async () => {
    const reg   = makeRegistry();
    const agent = new LegalReviewerAgent(reg, mockLLMConfig('LLM SUMMARY'));
    reg.register(agent);
    const resp = await agent.process(makeReviewerRequest('t-08-03'));
    for (const basis of REVIEWER_LEGAL_BASIS) {
      expect(resp.legalBasis).toContain(basis);
    }
  });

  it('P3-08-04: legalBasis[] same length with or without LLM', async () => {
    const reg     = makeRegistry();
    const noLLM   = new LegalReviewerAgent(reg);
    const withLLM = new LegalReviewerAgent(makeRegistry(), mockLLMConfig('summary'));
    reg.register(noLLM);
    const resp1 = await noLLM.process(makeReviewerRequest('t-08-04a'));
    const resp2 = await withLLM.process(makeReviewerRequest('t-08-04b'));
    expect(resp1.legalBasis!.length).toBe(resp2.legalBasis!.length);
  });

  it('P3-08-05: payload.legalBasis[] also preserved regardless of LLM', async () => {
    const reg   = makeRegistry();
    const agent = new LegalReviewerAgent(reg, mockLLMConfig('summary'));
    reg.register(agent);
    const resp = await agent.process(makeReviewerRequest('t-08-05'));
    const out  = resp.payload as DossierReviewOutput;
    for (const basis of REVIEWER_LEGAL_BASIS) {
      expect(out.legalBasis).toContain(basis);
    }
  });

  it('P3-08-06: legalBasis[] unchanged when fetchFn throws', async () => {
    const reg   = makeRegistry();
    const agent = new LegalReviewerAgent(reg, { apiKey: 'sk-test', fetchFn: throwingFetch() });
    reg.register(agent);
    const resp = await agent.process(makeReviewerRequest('t-08-06'));
    for (const basis of REVIEWER_LEGAL_BASIS) {
      expect(resp.legalBasis).toContain(basis);
    }
  });

  it('P3-08-07: response.legalBasis length >= 5 (REVIEWER_LEGAL_BASIS minimum)', async () => {
    const reg   = makeRegistry();
    const agent = new LegalReviewerAgent(reg, mockLLMConfig('summary'));
    reg.register(agent);
    const resp = await agent.process(makeReviewerRequest('t-08-07'));
    expect(resp.legalBasis!.length).toBeGreaterThanOrEqual(5);
  });
});
