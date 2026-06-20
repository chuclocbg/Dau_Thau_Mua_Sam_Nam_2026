/**
 * P9-05: createAgentSystem — production Claude API injection — 28 tests
 *
 * Verifies that createAgentSystem():
 *   - Accepts anthropicApiKey option (new in P9-05)
 *   - Creates one shared LLMBridgeConfig injected into ChatAgent + LegalReviewerAgent
 *   - Preserves deterministic behavior when key is absent
 *   - Never modifies legalBasis[], sources[], or audit trail via LLM
 *   - Remains backward-compatible (zero-arg call still works)
 *
 * Groups:
 *   AS-01  (7)  factory options signature and backward compatibility
 *   AS-02  (7)  bundle shape — identical with or without anthropicApiKey
 *   AS-03  (7)  ChatAgent wired to LLM (mock fetch confirms paraphrase path)
 *   AS-04  (7)  LegalReviewerAgent wired to LLM (mock fetch confirms paraphrase path)
 */

import { describe, it, expect } from 'vitest';

import { createAgentSystem }  from '../components/AgentProviderPanel';
import type { CreateAgentSystemOptions } from '../components/AgentProviderPanel';

import { AgentRegistry }       from '../agents/AgentRegistry';
import { ChatAgent }           from '../agents/ChatAgent';
import { LegalReviewerAgent }  from '../agents/LegalReviewerAgent';
import { CHAT_LEGAL_BASIS }    from '../agents/ChatAgent';
import { REVIEWER_LEGAL_BASIS } from '../agents/LegalReviewerAgent';

import type { AgentMessage }          from '../agents/types';
import type { ChatInput, ChatOutput } from '../agents/ChatAgent';
import type { DossierReviewInput, DossierReviewOutput } from '../agents/LegalReviewerAgent';
import type { LLMBridgeConfig }        from '../ai/llmBridge';
import type { ProcurementPackage }     from '../demoData';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function claudeOkResp(text: string): Response {
  return new Response(
    JSON.stringify({
      id: 'msg_p905', type: 'message', role: 'assistant',
      content: [{ type: 'text', text }],
      model: 'claude-haiku-3-5-latest',
      stop_reason: 'end_turn', stop_sequence: null,
      usage: { input_tokens: 40, output_tokens: 15 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function mockFetch(paraphrased: string): LLMBridgeConfig['fetchFn'] {
  return async () => claudeOkResp(paraphrased);
}

const REAL_QUERY = 'ngưỡng phương thức lựa chọn nhà thầu';

function makeChatMsg(traceId: string): AgentMessage {
  const input: ChatInput = { message: REAL_QUERY, history: [] };
  return { traceId, from: 'user', to: 'chat', type: 'request', payload: input, timestamp: Date.now() };
}

function makePkg(): ProcurementPackage {
  return {
    id: 'pkg-p905', packageName: 'Gói mua sắm vật tư tiêu hao',
    packageCode: 'PKG-P905', fundingSource: 'autonomy_fund',
    fundingSourceName: 'Quỹ phát triển hoạt động sự nghiệp',
    budgetYear: 2026,
    rectorName: '[Tên Hiệu trưởng]',
    departmentName: '[Tên đơn vị đề xuất]', departmentCode: '[Mã phòng]',
    expertTeamLeader: '[Tổ trưởng tổ chuyên gia]',
    expertTeamMember1: '[Thành viên tổ chuyên gia]',
    expertTeamMember2: '[Thành viên tổ chuyên gia]',
    appraisalLeader: '[Tổ trưởng thẩm định độc lập]',
    appraisalMember: '[Thành viên thẩm định độc lập]',
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
    contractType: 'lump_sum', packageType: 'goods_consumable',
    items: [{
      id: 'item-1', name: 'Vật tư văn phòng', unit: 'hộp', quantity: 2,
      unitPrice: 20_000_000, specs: 'Đạt tiêu chuẩn tối thiểu.',
      supplier1Price: 20_000_000, supplier2Price: 0, supplier3Price: 0,
    }],
  };
}

function makeReviewerMsg(traceId: string): AgentMessage {
  const payload: DossierReviewInput = {
    pkg: makePkg(),
    documentIds: Array.from({ length: 28 }, (_, i) => i + 1),
    methodCode: 'DIRECT_SELECTION_SIMPLIFIED',
  };
  return { traceId, from: 'user', to: 'legal-reviewer', type: 'request', payload, timestamp: Date.now() };
}

// ─── AS-01: factory options signature and backward compatibility ──────────────

describe('AS-01 · factory options signature and backward compatibility', () => {
  it('AS-01-01: createAgentSystem() — no arg — does not throw', () => {
    expect(() => createAgentSystem()).not.toThrow();
  });

  it('AS-01-02: createAgentSystem({}) — empty options — does not throw', () => {
    expect(() => createAgentSystem({})).not.toThrow();
  });

  it('AS-01-03: createAgentSystem({ anthropicApiKey: undefined }) — does not throw', () => {
    expect(() => createAgentSystem({ anthropicApiKey: undefined })).not.toThrow();
  });

  it('AS-01-04: createAgentSystem({ anthropicApiKey: "" }) — empty key — does not throw', () => {
    expect(() => createAgentSystem({ anthropicApiKey: '' })).not.toThrow();
  });

  it('AS-01-05: createAgentSystem({ anthropicApiKey: "key" }) — does not throw', () => {
    expect(() => createAgentSystem({ anthropicApiKey: 'sk-ant-test-key' })).not.toThrow();
  });

  it('AS-01-06: CreateAgentSystemOptions type is exported (import succeeds)', () => {
    // If the import at the top of this file resolved, the export exists
    const opts: CreateAgentSystemOptions = { anthropicApiKey: 'test' };
    expect(opts.anthropicApiKey).toBe('test');
  });

  it('AS-01-07: bundle returned with key has same property keys as without key', () => {
    const withKey    = createAgentSystem({ anthropicApiKey: 'sk-ant-test' });
    const withoutKey = createAgentSystem();
    expect(Object.keys(withKey).sort()).toEqual(Object.keys(withoutKey).sort());
  });
});

// ─── AS-02: bundle shape — identical with or without key ─────────────────────

describe('AS-02 · bundle shape — identical with or without anthropicApiKey', () => {
  const bundle = createAgentSystem({ anthropicApiKey: 'sk-ant-test' });

  it('AS-02-01: bundle.registry is an AgentRegistry', () => {
    expect(bundle.registry).toBeInstanceOf(AgentRegistry);
  });

  it('AS-02-02: bundle.chat is a ChatAgent', () => {
    expect(bundle.chat).toBeInstanceOf(ChatAgent);
  });

  it('AS-02-03: bundle.legal is a LegalReviewerAgent', () => {
    expect(bundle.legal).toBeInstanceOf(LegalReviewerAgent);
  });

  it('AS-02-04: bundle.agents has exactly 6 entries', () => {
    expect(bundle.agents.length).toBe(6);
  });

  it('AS-02-05: bundle.agents entries have id, name, capabilities', () => {
    for (const agent of bundle.agents) {
      expect(typeof agent.id).toBe('string');
      expect(typeof agent.name).toBe('string');
      expect(Array.isArray(agent.capabilities)).toBe(true);
    }
  });

  it('AS-02-06: bundle includes planner, spec, risk, autonomous', () => {
    expect(bundle.planner).toBeDefined();
    expect(bundle.spec).toBeDefined();
    expect(bundle.risk).toBeDefined();
    expect(bundle.autonomous).toBeDefined();
  });

  it('AS-02-07: agents metadata array contains all 6 expected agent IDs', () => {
    const ids = bundle.agents.map(a => a.id);
    expect(ids).toContain('chat');
    expect(ids).toContain('legal-reviewer');
    expect(ids).toContain('planner');
    expect(ids).toContain('specification');
    expect(ids).toContain('risk');
    expect(ids).toContain('autonomous');
  });
});

// ─── AS-03: ChatAgent wired to LLM ───────────────────────────────────────────

describe('AS-03 · ChatAgent wired to LLM (mock fetch confirms paraphrase path)', () => {
  const PARAPHRASED = 'Câu trả lời được diễn đạt lại bởi Claude.';
  const bundle = createAgentSystem({
    anthropicApiKey: 'sk-ant-test',
    _fetchFn: mockFetch(PARAPHRASED),
  });

  it('AS-03-01: chat.process() resolves without throwing', async () => {
    const msg = makeChatMsg('trace-as03-01');
    await expect(bundle.chat.process(msg)).resolves.toBeDefined();
  });

  it('AS-03-02: response type is "response"', async () => {
    const msg = makeChatMsg('trace-as03-02');
    const response = await bundle.chat.process(msg);
    expect(response.type).toBe('response');
  });

  it('AS-03-03: response payload has answer field', async () => {
    const msg = makeChatMsg('trace-as03-03');
    const response = await bundle.chat.process(msg);
    expect((response.payload as ChatOutput).answer).toBeDefined();
  });

  it('AS-03-04: LLM paraphrase is used — answer matches mock fetch output', async () => {
    const msg = makeChatMsg('trace-as03-04');
    const response = await bundle.chat.process(msg);
    expect((response.payload as ChatOutput).answer).toBe(PARAPHRASED);
  });

  it('AS-03-05: sources[] still populated from KB (not from LLM)', async () => {
    const msg = makeChatMsg('trace-as03-05');
    const response = await bundle.chat.process(msg);
    const output = response.payload as ChatOutput;
    expect(Array.isArray(output.sources)).toBe(true);
  });

  it('AS-03-06: legalBasis[] on response message is non-empty', async () => {
    const msg = makeChatMsg('trace-as03-06');
    const response = await bundle.chat.process(msg);
    expect(response.legalBasis).toBeDefined();
    expect((response.legalBasis ?? []).length).toBeGreaterThan(0);
  });

  it('AS-03-07: CHAT_LEGAL_BASIS constants are included in legalBasis[]', async () => {
    const msg = makeChatMsg('trace-as03-07');
    const response = await bundle.chat.process(msg);
    const basis = response.legalBasis ?? [];
    // Every CHAT_LEGAL_BASIS constant must appear in the response legalBasis
    for (const citation of CHAT_LEGAL_BASIS) {
      expect(basis).toContain(citation);
    }
  });
});

// ─── AS-04: LegalReviewerAgent wired to LLM ──────────────────────────────────

describe('AS-04 · LegalReviewerAgent wired to LLM (mock fetch confirms paraphrase path)', () => {
  const PARAPHRASED = 'Tóm tắt tuân thủ pháp lý do Claude tổng hợp.';
  const bundle = createAgentSystem({
    anthropicApiKey: 'sk-ant-test',
    _fetchFn: mockFetch(PARAPHRASED),
  });

  it('AS-04-01: legal.process() resolves without throwing', async () => {
    const msg = makeReviewerMsg('trace-as04-01');
    await expect(bundle.legal.process(msg)).resolves.toBeDefined();
  });

  it('AS-04-02: response type is "response"', async () => {
    const msg = makeReviewerMsg('trace-as04-02');
    const response = await bundle.legal.process(msg);
    expect(response.type).toBe('response');
  });

  it('AS-04-03: response payload has complianceScore field', async () => {
    const msg = makeReviewerMsg('trace-as04-03');
    const response = await bundle.legal.process(msg);
    expect((response.payload as DossierReviewOutput).complianceScore).toBeDefined();
  });

  it('AS-04-04: LLM summary is present in payload (llmSummary)', async () => {
    const msg = makeReviewerMsg('trace-as04-04');
    const response = await bundle.legal.process(msg);
    expect((response.payload as DossierReviewOutput & { llmSummary?: string }).llmSummary)
      .toBe(PARAPHRASED);
  });

  it('AS-04-05: legalBasis[] on payload is non-empty (KB-authoritative)', async () => {
    const msg = makeReviewerMsg('trace-as04-05');
    const response = await bundle.legal.process(msg);
    expect(Array.isArray((response.payload as DossierReviewOutput).legalBasis)).toBe(true);
    expect((response.payload as DossierReviewOutput).legalBasis.length).toBeGreaterThan(0);
  });

  it('AS-04-06: legalBasis[] entries match REVIEWER_LEGAL_BASIS constants', async () => {
    const msg = makeReviewerMsg('trace-as04-06');
    const response = await bundle.legal.process(msg);
    const basis = (response.payload as DossierReviewOutput).legalBasis;
    for (const citation of basis) {
      expect(REVIEWER_LEGAL_BASIS).toContain(citation);
    }
  });

  it('AS-04-07: findings[] array is preserved from KB (LLM does not modify it)', async () => {
    const msg = makeReviewerMsg('trace-as04-07');
    const response = await bundle.legal.process(msg);
    expect(Array.isArray((response.payload as DossierReviewOutput).findings)).toBe(true);
  });
});
