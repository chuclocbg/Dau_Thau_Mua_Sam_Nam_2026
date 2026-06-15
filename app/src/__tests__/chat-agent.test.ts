/**
 * P6-05D: ChatAgent test suite
 *
 * Coverage:
 *   Group 0 — Module constants and capabilities     (4 tests, MC-01..MC-04)
 *   Group 1 — searchKnowledge()                     (4 tests, SK-01..SK-04)
 *   Group 2 — extractPackageContext()               (4 tests, EC-01..EC-04)
 *   Group 3 — suggestFollowUps()                    (4 tests, SF-01..SF-04)
 *   Group 4 — buildAnswer()                         (6 tests, BA-01..BA-06)
 *   Group 5 — chat()                                (5 tests, CA-01..CA-05)
 *   Group 6 — ChatAgent.process()                   (10 tests, PA-01..PA-10)
 *   Group 7 — legalBasis collection                 (4 tests, LB-01..LB-04)
 *
 * No vi.fn() / vi.mock() on P5 functions.  All P5 modules used read-only.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { AgentRegistry } from '../agents/AgentRegistry';
import {
  searchKnowledge,
  extractPackageContext,
  suggestFollowUps,
  buildAnswer,
  chat,
  CHAT_LEGAL_BASIS,
  ChatAgent,
} from '../agents/ChatAgent';

import type {
  ChatInput,
  ChatOutput,
  ChatMessage,
  ChatStateEvent,
} from '../agents/ChatAgent';
import type { AgentMessage }   from '../agents/types';
import type { SearchResult }   from '../ai/legalKnowledgeBase';
import type { ProcurementPackage } from '../demoData';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * Returns a fully-populated ProcurementPackage.
 * items: quantity=2, unitPrice=50_000_000 → total = 100_000_000 (100 triệu).
 * Produces 0 P5-03 findings when specs contain no brand names.
 */
function makePkg(overrides: Partial<ProcurementPackage> = {}): ProcurementPackage {
  return {
    id:                      'test-pkg-1',
    packageName:             'Gói mua sắm vật tư tiêu hao',
    packageCode:             'TEST-VT-001',
    fundingSource:           'autonomy_fund',
    fundingSourceName:       'Quỹ phát triển hoạt động sự nghiệp',
    budgetYear:              2026,
    rectorName:              '[Tên Hiệu trưởng]',
    departmentName:          '[Tên đơn vị đề xuất]',
    departmentCode:          '[Mã phòng]',
    expertTeamLeader:        '[Tổ trưởng tổ chuyên gia]',
    expertTeamMember1:       '[Thành viên tổ chuyên gia]',
    expertTeamMember2:       '[Thành viên tổ chuyên gia]',
    appraisalLeader:         '[Tổ trưởng thẩm định độc lập]',
    appraisalMember:         '[Thành viên thẩm định độc lập]',
    supplier1Name:           '[Nhà cung cấp số 1]',
    supplier1Address:        '[Địa chỉ nhà cung cấp 1]',
    supplier1TaxCode:        '[Mã số thuế]',
    supplier1Representative: '[Người đại diện]',
    supplier1Position:       '[Chức vụ]',
    supplier2Name:           '[Nhà cung cấp số 2]',
    supplier2Address:        '[Địa chỉ nhà cung cấp 2]',
    supplier3Name:           '[Nhà cung cấp số 3]',
    supplier3Address:        '[Địa chỉ nhà cung cấp 3]',
    dateProposal:            '2026-01-05',
    dateSurvey:              '2026-01-07',
    dateQuotes:              '2026-01-07',
    dateCompare:             '2026-01-07',
    dateKhlcnt:              '2026-01-10',
    dateKhlcntApprove:       '2026-01-15',
    dateExpertEstablish:     '2026-01-20',
    dateDocIssue:            '2026-02-01',
    dateBidClose:            '2026-02-10',
    dateEvaluate:            '2026-02-15',
    dateAppraise:            '2026-02-20',
    dateResultProposal:      '2026-02-22',
    dateResultApprove:       '2026-02-25',
    dateContractSign:        '2026-03-01',
    dateDelivery:            '2026-03-15',
    dateAcceptance:          '2026-03-20',
    dateLiquidation:         '2026-04-01',
    dateAssetIncrease:       '',
    contractDurationDays:    30,
    contractType:            'lump_sum',
    warrantyMonths:          0,
    packageType:             'goods_consumable',
    items: [{
      id:             'item-1',
      name:           'Vật tư tiêu hao phục vụ đào tạo',
      unit:           'Bộ',
      quantity:       2,
      unitPrice:      50_000_000,
      specs:          'Đạt tiêu chuẩn chất lượng tối thiểu theo yêu cầu kỹ thuật.',
      supplier1Price: 50_000_000,
      supplier2Price: 0,
      supplier3Price: 0,
    }],
    ...overrides,
  };
}

/**
 * Builds a synthetic SearchResult with controlled score and appliesTo.
 * All fields satisfy the LegalEntry shape; structural typing enforced
 * by the SearchResult return annotation.
 */
function makeSearchResult(appliesTo: string[], score = 8): SearchResult {
  return {
    entry: {
      id:       'test-kb-1',
      title:    'Tiêu đề thử nghiệm',
      source:   'Luật Đấu thầu 22/2023/QH15',
      keywords: ['thử nghiệm'],
      content:  'Nội dung thử nghiệm đơn vị kiểm thử chi tiết.',
      appliesTo,
    },
    score,
    highlights: ['Nội dung thử nghiệm đơn vị kiểm thử chi tiết.'],
  };
}

/** Builds a minimal ChatInput. */
function makeChatInput(
  message: string,
  overrides: Partial<ChatInput> = {},
): ChatInput {
  return { message, history: [], ...overrides };
}

/** Builds an AgentMessage request targeting the chat agent. */
function makeChatRequest(input: ChatInput, traceId: string): AgentMessage {
  return {
    traceId,
    from:      'user',
    to:        'chat',
    type:      'request',
    payload:   input,
    timestamp: Date.now(),
  };
}

function createTestRegistry(): AgentRegistry {
  return new AgentRegistry();
}

// ─── Group 0: Module constants and capabilities ───────────────────────────────

describe('ChatAgent — module constants and capabilities', () => {
  it('MC-01: CHAT_LEGAL_BASIS contains exactly 5 citations', () => {
    expect(CHAT_LEGAL_BASIS).toHaveLength(5);
  });

  it('MC-02: CHAT_LEGAL_BASIS includes Luật Đấu thầu 22/2023/QH15 references', () => {
    expect(CHAT_LEGAL_BASIS.some(b => b.includes('22/2023/QH15'))).toBe(true);
  });

  it('MC-03: getCapabilities() returns ≥ 5 capability strings', () => {
    const agent = new ChatAgent(createTestRegistry());
    expect(agent.getCapabilities().length).toBeGreaterThanOrEqual(5);
  });

  it('MC-04: agent.id === "chat"', () => {
    const agent = new ChatAgent(createTestRegistry());
    expect(agent.id).toBe('chat');
  });
});

// ─── Group 1: searchKnowledge() ──────────────────────────────────────────────

describe('searchKnowledge()', () => {
  it('SK-01: always returns an array (never throws)', () => {
    const results = searchKnowledge('ngưỡng phương thức lựa chọn nhà thầu');
    expect(Array.isArray(results)).toBe(true);
  });

  it('SK-02: relevant procurement query → at least 1 result with score ≥ 4', () => {
    const results = searchKnowledge('ngưỡng chỉ định thầu rút gọn phương thức');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThanOrEqual(4);
  });

  it('SK-03: irrelevant query (random tokens) → empty array', () => {
    const results = searchKnowledge('aaaabbbb1234 xyzxyz9k2 zzzmmmq77');
    expect(results).toHaveLength(0);
  });

  it('SK-04: topK=1 → at most 1 result', () => {
    const results = searchKnowledge('ngưỡng phương thức chỉ định thầu', 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });
});

// ─── Group 2: extractPackageContext() ────────────────────────────────────────

describe('extractPackageContext()', () => {
  it('EC-01: includes package name in output string', () => {
    const ctx = extractPackageContext(makePkg());
    expect(ctx).toContain('Gói mua sắm vật tư tiêu hao');
  });

  it('EC-02: goods_consumable packageType → "Hàng hóa vật tư tiêu hao"', () => {
    const ctx = extractPackageContext(makePkg({ packageType: 'goods_consumable' }));
    expect(ctx).toContain('Hàng hóa vật tư tiêu hao');
  });

  it('EC-03: lump_sum contractType → "trọn gói"', () => {
    const ctx = extractPackageContext(makePkg({ contractType: 'lump_sum' }));
    expect(ctx).toContain('trọn gói');
  });

  it('EC-04: total value = Σ(unitPrice × quantity) across items — 2 × 50M = 100M → "100"', () => {
    const ctx = extractPackageContext(makePkg());
    expect(ctx).toContain('100');
  });
});

// ─── Group 3: suggestFollowUps() ─────────────────────────────────────────────

describe('suggestFollowUps()', () => {
  it('SF-01: empty results → exactly 3 generic fallback questions ending with "?"', () => {
    const suggestions = suggestFollowUps([]);
    expect(suggestions).toHaveLength(3);
    expect(suggestions.every(s => s.endsWith('?'))).toBe(true);
  });

  it('SF-02: result with appliesTo=["khlcnt"] → KHLCNT follow-up question included', () => {
    const suggestions = suggestFollowUps([makeSearchResult(['khlcnt'])]);
    expect(suggestions.some(q => q.toUpperCase().includes('KHLCNT'))).toBe(true);
  });

  it('SF-03: many appliesTo contexts across results → at most 3 suggestions', () => {
    const results = [
      makeSearchResult(['khlcnt', 'contract', 'authority']),
      makeSearchResult(['spec-generator', 'asset-recording', 'timeline']),
      makeSearchResult(['expert-team', 'evaluation', 'package-generator']),
    ];
    expect(suggestFollowUps(results).length).toBeLessThanOrEqual(3);
  });

  it('SF-04: same question from two identical results → appears only once (no duplicate)', () => {
    const suggestions = suggestFollowUps([
      makeSearchResult(['khlcnt']),
      makeSearchResult(['khlcnt']),
    ]);
    const unique = new Set(suggestions);
    expect(unique.size).toBe(suggestions.length);
  });
});

// ─── Group 4: buildAnswer() ───────────────────────────────────────────────────

describe('buildAnswer()', () => {
  it('BA-01: empty results → confidence="low" and sources=[]', () => {
    const output = buildAnswer([], makeChatInput('Câu hỏi thử nghiệm'));
    expect(output.confidence).toBe('low');
    expect(output.sources).toHaveLength(0);
  });

  it('BA-02: top result score ≥ 8 → confidence="high"', () => {
    const output = buildAnswer(
      [makeSearchResult(['khlcnt'], 9)],
      makeChatInput('Câu hỏi thử nghiệm'),
    );
    expect(output.confidence).toBe('high');
  });

  it('BA-03: top result score 4–7 → confidence="medium"', () => {
    const output = buildAnswer(
      [makeSearchResult(['khlcnt'], 5)],
      makeChatInput('Câu hỏi thử nghiệm'),
    );
    expect(output.confidence).toBe('medium');
  });

  it('BA-04: answer string includes entry title and source citation', () => {
    const result = makeSearchResult(['khlcnt'], 8);
    const output = buildAnswer([result], makeChatInput('Câu hỏi thử nghiệm'));
    expect(output.answer).toContain(result.entry.title);
    expect(output.answer).toContain(result.entry.source);
  });

  it('BA-05: packageContext present → context line appended to answer', () => {
    const output = buildAnswer(
      [makeSearchResult(['khlcnt'], 8)],
      makeChatInput('Câu hỏi thử nghiệm', { packageContext: makePkg() }),
    );
    expect(output.answer).toContain('Ngữ cảnh gói thầu');
  });

  it('BA-06: sources[] contains the KB entry source citation', () => {
    const result = makeSearchResult(['khlcnt'], 8);
    const output = buildAnswer([result], makeChatInput('Câu hỏi thử nghiệm'));
    expect(output.sources).toContain('Luật Đấu thầu 22/2023/QH15');
  });
});

// ─── Group 5: chat() ─────────────────────────────────────────────────────────

describe('chat()', () => {
  it('CA-01: returns all required ChatOutput fields', () => {
    const output = chat(makeChatInput('ngưỡng phương thức lựa chọn nhà thầu'));
    expect(output).toHaveProperty('answer');
    expect(output).toHaveProperty('sources');
    expect(output).toHaveProperty('confidence');
    expect(output).toHaveProperty('followUpSuggestions');
    expect(output).toHaveProperty('relatedKBEntries');
  });

  it('CA-02: empty history is handled without exception', () => {
    expect(() =>
      chat(makeChatInput('ngưỡng thầu', { history: [] })),
    ).not.toThrow();
  });

  it('CA-03: populated history enriches the query — no exception, valid output', () => {
    const history: ChatMessage[] = [
      {
        id: 'm1', role: 'user',
        content:    'ngưỡng phương thức lựa chọn nhà thầu là bao nhiêu',
        sources:    [], confidence: 'medium', timestamp: Date.now(),
      },
      {
        id: 'm2', role: 'agent',
        content:    'Ngưỡng hiện hành theo Nghị định 214/2025...',
        sources:    ['Nghị định 214/2025/NĐ-CP'], confidence: 'medium', timestamp: Date.now(),
      },
    ];
    const output = chat(makeChatInput('Gói đó dùng loại hợp đồng gì?', { history }));
    expect(typeof output.answer).toBe('string');
    expect(output.answer.length).toBeGreaterThan(0);
  });

  it('CA-04: packageContext provided → valid ChatOutput, no exception', () => {
    const output = chat(
      makeChatInput('hợp đồng trọn gói điều kiện', { packageContext: makePkg() }),
    );
    expect(typeof output.answer).toBe('string');
    expect(output.answer.length).toBeGreaterThan(0);
  });

  it('CA-05: never throws even with empty message (pure function guarantee)', () => {
    expect(() => chat(makeChatInput(''))).not.toThrow();
  });
});

// ─── Group 6: ChatAgent.process() ────────────────────────────────────────────

describe('ChatAgent.process()', () => {
  let registry: AgentRegistry;
  let agent:    ChatAgent;

  beforeEach(() => {
    registry = createTestRegistry();
    agent    = new ChatAgent(registry);
  });

  it('PA-01: valid request → type="response" with preserved traceId', async () => {
    const msg      = makeChatRequest(makeChatInput('ngưỡng phương thức'), 'trace-PA01');
    const response = await agent.process(msg);
    expect(response.type).toBe('response');
    expect(response.traceId).toBe('trace-PA01');
  });

  it('PA-02: state machine traverses 3 transitions in correct order', async () => {
    const msg = makeChatRequest(makeChatInput('ngưỡng phương thức'), 'trace-PA02');
    await agent.process(msg);
    const trace = registry.getTrace('trace-PA02');
    const stateEvents = trace
      .filter(m => m.type === 'event' && m.to === 'chat')
      .map(m => (m.payload as ChatStateEvent).nextState);
    expect(stateEvents).toEqual([
      'analyzing-request',
      'invoking-agent',
      'composing-response',
    ]);
  });

  it('PA-03: trace contains ≥ 5 messages after successful process()', async () => {
    const msg = makeChatRequest(makeChatInput('ngưỡng phương thức'), 'trace-PA03');
    await agent.process(msg);
    expect(registry.getTrace('trace-PA03').length).toBeGreaterThanOrEqual(5);
  });

  it('PA-04: agent.state resets to "idle" after success', async () => {
    const msg = makeChatRequest(makeChatInput('ngưỡng phương thức'), 'trace-PA04');
    await agent.process(msg);
    expect((agent as unknown as { state: string }).state).toBe('idle');
  });

  it('PA-05: agent.state resets to "idle" after error (empty message)', async () => {
    const msg = makeChatRequest(makeChatInput(''), 'trace-PA05');
    await agent.process(msg);
    expect((agent as unknown as { state: string }).state).toBe('idle');
  });

  it('PA-06: empty message → error type with code CHAT_EMPTY_INPUT', async () => {
    const msg      = makeChatRequest(makeChatInput(''), 'trace-PA06');
    const response = await agent.process(msg);
    expect(response.type).toBe('error');
    expect((response.payload as { code: string }).code).toBe('CHAT_EMPTY_INPUT');
  });

  it('PA-07: null payload → error type with code CHAT_EMPTY_INPUT', async () => {
    const msg: AgentMessage = {
      traceId: 'trace-PA07', from: 'user', to: 'chat',
      type: 'request', payload: null, timestamp: Date.now(),
    };
    const response = await agent.process(msg);
    expect(response.type).toBe('error');
    expect((response.payload as { code: string }).code).toBe('CHAT_EMPTY_INPUT');
  });

  it('PA-08: error response preserves traceId from request', async () => {
    const msg      = makeChatRequest(makeChatInput(''), 'trace-PA08');
    const response = await agent.process(msg);
    expect(response.traceId).toBe('trace-PA08');
  });

  it('PA-09: response.from === "chat"', async () => {
    const msg      = makeChatRequest(makeChatInput('ngưỡng phương thức'), 'trace-PA09');
    const response = await agent.process(msg);
    expect(response.from).toBe('chat');
  });

  it('PA-10: response.legalBasis includes all 5 CHAT_LEGAL_BASIS entries', async () => {
    const msg      = makeChatRequest(makeChatInput('ngưỡng phương thức'), 'trace-PA10');
    const response = await agent.process(msg);
    for (const basis of CHAT_LEGAL_BASIS) {
      expect(response.legalBasis).toContain(basis);
    }
  });
});

// ─── Group 7: legalBasis collection and deduplication ─────────────────────────

describe('ChatAgent — legalBasis collection and deduplication', () => {
  let registry: AgentRegistry;
  let agent:    ChatAgent;

  beforeEach(() => {
    registry = createTestRegistry();
    agent    = new ChatAgent(registry);
  });

  it('LB-01: AgentMessage.legalBasis includes all 5 CHAT_LEGAL_BASIS entries', async () => {
    const msg      = makeChatRequest(makeChatInput('khóa thương hiệu xuất xứ'), 'trace-LB01');
    const response = await agent.process(msg);
    for (const basis of CHAT_LEGAL_BASIS) {
      expect(response.legalBasis).toContain(basis);
    }
  });

  it('LB-02: every source in ChatOutput.sources is merged into AgentMessage.legalBasis', async () => {
    const msg      = makeChatRequest(
      makeChatInput('ngưỡng chỉ định thầu rút gọn phương thức'),
      'trace-LB02',
    );
    const response = await agent.process(msg);
    const output   = response.payload as ChatOutput;
    for (const src of output.sources) {
      expect(response.legalBasis).toContain(src);
    }
  });

  it('LB-03: AgentMessage.legalBasis has no duplicate entries', async () => {
    // "thương hiệu" likely surfaces the Điều 44 khoản 7 source which is also
    // in CHAT_LEGAL_BASIS — Set dedup must fire and remove the duplicate
    const msg      = makeChatRequest(
      makeChatInput('khóa thương hiệu xuất xứ hàng hóa'),
      'trace-LB03',
    );
    const response = await agent.process(msg);
    const lb       = response.legalBasis ?? [];
    expect(new Set(lb).size).toBe(lb.length);
  });

  it('LB-04: legalBasis is on AgentMessage (not buried inside payload)', async () => {
    const msg      = makeChatRequest(makeChatInput('ngưỡng phương thức'), 'trace-LB04');
    const response = await agent.process(msg);
    expect(Array.isArray(response.legalBasis)).toBe(true);
    expect((response.legalBasis ?? []).length).toBeGreaterThan(0);
  });
});
