/**
 * 8-G: LLM Provider Bridge — 56 tests
 *
 * Groups:
 *   LB-01  (5)  Empty / absent API key — immediate fallback, no network call
 *   LB-02  (5)  Success path — LLM response used
 *   LB-03  (4)  Network / HTTP error fallbacks
 *   LB-04  (4)  LLM content issues — empty, whitespace, bad JSON
 *   LB-05  (5)  SYSTEM_PROMPT constant — safeguard language
 *   LB-06  (4)  API request shape — captured via fetchFn
 *   LB-07  (5)  Config resolution — model, maxTokens, temperature, apiKey
 *   LB-08  (4)  Never throws — all error scenarios resolve cleanly
 *   LB-09  (4)  Edge cases — empty input, diacritics, special characters
 *   LB-10  (4)  Exported constants — values and types
 *   LB-11  (5)  Strict identity on fallback — answer === kbAnswer
 *   LB-12  (7)  Integration with live KB results
 */

import { describe, it, expect } from 'vitest';

import {
  paraphraseAnswer,
  SYSTEM_PROMPT,
  LLM_BRIDGE_DEFAULT_MODEL,
  LLM_BRIDGE_DEFAULT_MAX_TOKENS,
  LLM_BRIDGE_TEMPERATURE,
  type LLMBridgeConfig,
} from '../ai/llmBridge';

import { searchLegalKB } from '../ai/legalKnowledgeBase';
import { buildAnswer }   from '../agents/ChatAgent';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/** Well-formed Anthropic Messages API success response. */
function claudeOkResp(text: string, model = 'claude-haiku-3-5-latest'): Response {
  return new Response(
    JSON.stringify({
      id:            'msg_test',
      type:          'message',
      role:          'assistant',
      content:       [{ type: 'text', text }],
      model,
      stop_reason:   'end_turn',
      stop_sequence: null,
      usage:         { input_tokens: 50, output_tokens: 20 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

/** 4xx / 5xx HTTP error response. */
function httpErrResp(status: number): Response {
  return new Response(JSON.stringify({ error: 'error' }), { status });
}

/** Fetch that throws (simulates connection failure). */
function throwingFetch(): LLMBridgeConfig['fetchFn'] {
  return async () => { throw new Error('connection refused'); };
}

/** Fetch that returns invalid JSON. */
function badJsonFetch(): LLMBridgeConfig['fetchFn'] {
  return async () => new Response('}{not-json', { status: 200 });
}

/** Captures every call for request-shape assertions. */
interface Capture { url: string; body: Record<string, unknown>; headers: Record<string, string>; }
function capturingFetch(resp: Response): [LLMBridgeConfig['fetchFn'], Capture[]] {
  const calls: Capture[] = [];
  const fetchFn: LLMBridgeConfig['fetchFn'] = async (url, init) => {
    calls.push({
      url,
      body:    JSON.parse(init.body as string) as Record<string, unknown>,
      headers: init.headers as Record<string, string>,
    });
    return resp;
  };
  return [fetchFn, calls];
}

// ─── LB-01 · Empty / absent API key — immediate fallback ─────────────────────

describe('LB-01 · Empty / absent API key — immediate fallback', () => {
  it('LB-01-01: empty string apiKey → usedLLM: false', async () => {
    const result = await paraphraseAnswer('test answer', { apiKey: '' });
    expect(result.usedLLM).toBe(false);
  });

  it('LB-01-02: whitespace-only apiKey → usedLLM: false', async () => {
    const result = await paraphraseAnswer('test answer', { apiKey: '   ' });
    expect(result.usedLLM).toBe(false);
  });

  it('LB-01-03: usedLLM is exactly the boolean false (not falsy)', async () => {
    const result = await paraphraseAnswer('test', { apiKey: '' });
    expect(result.usedLLM).toBe(false);
    expect(typeof result.usedLLM).toBe('boolean');
  });

  it('LB-01-04: answer equals kbAnswer when key is empty', async () => {
    const kbAnswer = 'Căn cứ pháp lý: Điều 24 NĐ 214/2025/NĐ-CP.';
    const result   = await paraphraseAnswer(kbAnswer, { apiKey: '' });
    expect(result.answer).toBe(kbAnswer);
  });

  it('LB-01-05: fetchFn never called when key is empty', async () => {
    let called = false;
    const fetchFn: LLMBridgeConfig['fetchFn'] = async () => {
      called = true;
      return claudeOkResp('should not reach');
    };
    await paraphraseAnswer('test', { apiKey: '', fetchFn });
    expect(called).toBe(false);
  });
});

// ─── LB-02 · Success path — LLM response used ────────────────────────────────

describe('LB-02 · Success path — LLM response used', () => {
  const kbAnswer = 'Phương thức lựa chọn nhà thầu theo NĐ 214/2025.';

  it('LB-02-01: usedLLM: true when LLM responds successfully', async () => {
    const result = await paraphraseAnswer(kbAnswer, {
      apiKey:  'test-key',
      fetchFn: async () => claudeOkResp('Câu trả lời đã được diễn đạt lại.'),
    });
    expect(result.usedLLM).toBe(true);
  });

  it('LB-02-02: answer is LLM content, not kbAnswer', async () => {
    const llmContent = 'Câu trả lời đã được diễn đạt lại bởi AI.';
    const result = await paraphraseAnswer(kbAnswer, {
      apiKey:  'test-key',
      fetchFn: async () => claudeOkResp(llmContent),
    });
    expect(result.answer).toBe(llmContent);
    expect(result.answer).not.toBe(kbAnswer);
  });

  it('LB-02-03: model field populated from response', async () => {
    const result = await paraphraseAnswer(kbAnswer, {
      apiKey:  'test-key',
      fetchFn: async () => claudeOkResp('paraphrased', 'claude-haiku-3-5-latest'),
    });
    expect(result.model).toBe('claude-haiku-3-5-latest');
  });

  it('LB-02-04: answer is trimmed of leading and trailing whitespace', async () => {
    const result = await paraphraseAnswer(kbAnswer, {
      apiKey:  'test-key',
      fetchFn: async () => claudeOkResp('  có khoảng trắng  '),
    });
    expect(result.answer).toBe('có khoảng trắng');
  });

  it('LB-02-05: answer is a string', async () => {
    const result = await paraphraseAnswer(kbAnswer, {
      apiKey:  'test-key',
      fetchFn: async () => claudeOkResp('any content'),
    });
    expect(typeof result.answer).toBe('string');
  });
});

// ─── LB-03 · Network / HTTP error fallbacks ──────────────────────────────────

describe('LB-03 · Network / HTTP error fallbacks', () => {
  const KB = 'Original KB answer.';

  it('LB-03-01: fetchFn throws → usedLLM: false, answer=kbAnswer', async () => {
    const result = await paraphraseAnswer(KB, {
      apiKey:  'test-key',
      fetchFn: throwingFetch(),
    });
    expect(result.usedLLM).toBe(false);
    expect(result.answer).toBe(KB);
  });

  it('LB-03-02: HTTP 401 Unauthorized → usedLLM: false', async () => {
    const result = await paraphraseAnswer(KB, {
      apiKey:  'bad-key',
      fetchFn: async () => httpErrResp(401),
    });
    expect(result.usedLLM).toBe(false);
  });

  it('LB-03-03: HTTP 429 Rate Limited → usedLLM: false', async () => {
    const result = await paraphraseAnswer(KB, {
      apiKey:  'test-key',
      fetchFn: async () => httpErrResp(429),
    });
    expect(result.usedLLM).toBe(false);
  });

  it('LB-03-04: HTTP 500 Server Error → usedLLM: false', async () => {
    const result = await paraphraseAnswer(KB, {
      apiKey:  'test-key',
      fetchFn: async () => httpErrResp(500),
    });
    expect(result.usedLLM).toBe(false);
  });
});

// ─── LB-04 · LLM content issues ──────────────────────────────────────────────

describe('LB-04 · LLM content issues — empty, whitespace, bad JSON', () => {
  const KB = 'KB answer to preserve.';

  it('LB-04-01: empty LLM text content → usedLLM: false, answer=kbAnswer', async () => {
    const result = await paraphraseAnswer(KB, {
      apiKey:  'test-key',
      fetchFn: async () => claudeOkResp(''),
    });
    expect(result.usedLLM).toBe(false);
    expect(result.answer).toBe(KB);
  });

  it('LB-04-02: whitespace-only LLM content → usedLLM: false', async () => {
    const result = await paraphraseAnswer(KB, {
      apiKey:  'test-key',
      fetchFn: async () => claudeOkResp('   \n  \t  '),
    });
    expect(result.usedLLM).toBe(false);
  });

  it('LB-04-03: LLM content with surrounding whitespace → answer is trimmed', async () => {
    const result = await paraphraseAnswer(KB, {
      apiKey:  'test-key',
      fetchFn: async () => claudeOkResp('\n  nội dung   \n'),
    });
    expect(result.answer).toBe('nội dung');
    expect(result.usedLLM).toBe(true);
  });

  it('LB-04-04: invalid JSON response body → usedLLM: false, answer=kbAnswer', async () => {
    const result = await paraphraseAnswer(KB, {
      apiKey:  'test-key',
      fetchFn: badJsonFetch(),
    });
    expect(result.usedLLM).toBe(false);
    expect(result.answer).toBe(KB);
  });
});

// ─── LB-05 · SYSTEM_PROMPT constant — safeguard language ─────────────────────

describe('LB-05 · SYSTEM_PROMPT constant — safeguard language', () => {
  it('LB-05-01: SYSTEM_PROMPT is a non-empty string', () => {
    expect(typeof SYSTEM_PROMPT).toBe('string');
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });

  it('LB-05-02: SYSTEM_PROMPT contains prohibition keyword "TUYỆT ĐỐI KHÔNG"', () => {
    expect(SYSTEM_PROMPT).toContain('TUYỆT ĐỐI KHÔNG');
  });

  it('LB-05-03: SYSTEM_PROMPT contains paraphrase instruction "diễn đạt lại"', () => {
    expect(SYSTEM_PROMPT).toContain('diễn đạt lại');
  });

  it('LB-05-04: SYSTEM_PROMPT contains "căn cứ pháp lý" (legal citations)', () => {
    expect(SYSTEM_PROMPT).toContain('căn cứ pháp lý');
  });

  it('LB-05-05: SYSTEM_PROMPT contains "đấu thầu" (procurement domain)', () => {
    expect(SYSTEM_PROMPT).toContain('đấu thầu');
  });
});

// ─── LB-06 · API request shape — captured via fetchFn ────────────────────────

describe('LB-06 · API request shape — captured via fetchFn', () => {
  const kbAnswer = 'Answer from KB for shape test.';

  it('LB-06-01: POSTs to https://api.anthropic.com/v1/messages', async () => {
    const [fetchFn, calls] = capturingFetch(claudeOkResp('ok'));
    await paraphraseAnswer(kbAnswer, { apiKey: 'test-key', fetchFn });
    expect(calls[0]!.url).toBe('https://api.anthropic.com/v1/messages');
  });

  it('LB-06-02: request body system field equals SYSTEM_PROMPT', async () => {
    const [fetchFn, calls] = capturingFetch(claudeOkResp('ok'));
    await paraphraseAnswer(kbAnswer, { apiKey: 'test-key', fetchFn });
    expect(calls[0]!.body['system']).toBe(SYSTEM_PROMPT);
  });

  it('LB-06-03: messages[0].role is "user"', async () => {
    const [fetchFn, calls] = capturingFetch(claudeOkResp('ok'));
    await paraphraseAnswer(kbAnswer, { apiKey: 'test-key', fetchFn });
    const messages = calls[0]!.body['messages'] as Array<{ role: string; content: string }>;
    expect(messages[0]!.role).toBe('user');
  });

  it('LB-06-04: messages[0].content equals kbAnswer', async () => {
    const [fetchFn, calls] = capturingFetch(claudeOkResp('ok'));
    await paraphraseAnswer(kbAnswer, { apiKey: 'test-key', fetchFn });
    const messages = calls[0]!.body['messages'] as Array<{ role: string; content: string }>;
    expect(messages[0]!.content).toBe(kbAnswer);
  });
});

// ─── LB-07 · Config resolution ───────────────────────────────────────────────

describe('LB-07 · Config resolution — model, maxTokens, temperature, apiKey', () => {
  it('LB-07-01: explicit apiKey used (verified by successful LLM call)', async () => {
    let calledWithKey = '';
    const fetchFn: LLMBridgeConfig['fetchFn'] = async (_u, init) => {
      calledWithKey = (init.headers as Record<string, string>)['x-api-key'] ?? '';
      return claudeOkResp('ok');
    };
    await paraphraseAnswer('test', { apiKey: 'my-explicit-key', fetchFn });
    expect(calledWithKey).toBe('my-explicit-key');
  });

  it('LB-07-02: default model is LLM_BRIDGE_DEFAULT_MODEL', async () => {
    const [fetchFn, calls] = capturingFetch(claudeOkResp('ok'));
    await paraphraseAnswer('test', { apiKey: 'test-key', fetchFn });
    expect(calls[0]!.body['model']).toBe(LLM_BRIDGE_DEFAULT_MODEL);
  });

  it('LB-07-03: default max_tokens in request body is LLM_BRIDGE_DEFAULT_MAX_TOKENS', async () => {
    const [fetchFn, calls] = capturingFetch(claudeOkResp('ok'));
    await paraphraseAnswer('test', { apiKey: 'test-key', fetchFn });
    expect(calls[0]!.body['max_tokens']).toBe(LLM_BRIDGE_DEFAULT_MAX_TOKENS);
  });

  it('LB-07-04: custom model override applied in request body', async () => {
    const [fetchFn, calls] = capturingFetch(claudeOkResp('ok', 'claude-opus-4-20250514'));
    await paraphraseAnswer('test', { apiKey: 'test-key', model: 'claude-opus-4-20250514', fetchFn });
    expect(calls[0]!.body['model']).toBe('claude-opus-4-20250514');
  });

  it('LB-07-05: temperature in request body is LLM_BRIDGE_TEMPERATURE (0.3)', async () => {
    const [fetchFn, calls] = capturingFetch(claudeOkResp('ok'));
    await paraphraseAnswer('test', { apiKey: 'test-key', fetchFn });
    expect(calls[0]!.body['temperature']).toBe(LLM_BRIDGE_TEMPERATURE);
  });
});

// ─── LB-08 · Never throws ────────────────────────────────────────────────────

describe('LB-08 · Never throws — all error scenarios resolve cleanly', () => {
  it('LB-08-01: resolves (does not reject) when fetchFn throws', async () => {
    await expect(
      paraphraseAnswer('test', { apiKey: 'key', fetchFn: throwingFetch() }),
    ).resolves.toMatchObject({ usedLLM: false });
  });

  it('LB-08-02: resolves when HTTP 401', async () => {
    await expect(
      paraphraseAnswer('test', { apiKey: 'key', fetchFn: async () => httpErrResp(401) }),
    ).resolves.toMatchObject({ usedLLM: false });
  });

  it('LB-08-03: resolves when response is invalid JSON', async () => {
    await expect(
      paraphraseAnswer('test', { apiKey: 'key', fetchFn: badJsonFetch() }),
    ).resolves.toMatchObject({ usedLLM: false });
  });

  it('LB-08-04: resolves immediately when apiKey is blank', async () => {
    await expect(
      paraphraseAnswer('test', { apiKey: '' }),
    ).resolves.toMatchObject({ usedLLM: false });
  });
});

// ─── LB-09 · Edge cases ──────────────────────────────────────────────────────

describe('LB-09 · Edge cases — empty input, diacritics, special characters', () => {
  it('LB-09-01: empty string kbAnswer → usedLLM: false, fetchFn not called', async () => {
    let called = false;
    const fetchFn: LLMBridgeConfig['fetchFn'] = async () => {
      called = true;
      return claudeOkResp('should not reach');
    };
    const result = await paraphraseAnswer('', { apiKey: 'test-key', fetchFn });
    expect(result.usedLLM).toBe(false);
    expect(called).toBe(false);
  });

  it('LB-09-02: whitespace-only kbAnswer → usedLLM: false', async () => {
    const result = await paraphraseAnswer('   \n  ', { apiKey: 'test-key' });
    expect(result.usedLLM).toBe(false);
  });

  it('LB-09-03: kbAnswer with Vietnamese diacritics preserved in request body', async () => {
    const kbAnswer = 'Phương thức lựa chọn nhà thầu, ngưỡng giá trị, đấu thầu rộng rãi.';
    const [fetchFn, calls] = capturingFetch(claudeOkResp('ok'));
    await paraphraseAnswer(kbAnswer, { apiKey: 'test-key', fetchFn });
    const messages = calls[0]!.body['messages'] as Array<{ content: string }>;
    expect(messages[0]!.content).toBe(kbAnswer);
  });

  it('LB-09-04: kbAnswer with HTML special characters safely JSON-encoded', async () => {
    const kbAnswer = 'Giá trị < 50 triệu & "đặc biệt" > ít.';
    const [fetchFn, calls] = capturingFetch(claudeOkResp('ok'));
    await paraphraseAnswer(kbAnswer, { apiKey: 'test-key', fetchFn });
    const messages = calls[0]!.body['messages'] as Array<{ content: string }>;
    expect(messages[0]!.content).toBe(kbAnswer);
  });
});

// ─── LB-10 · Exported constants ──────────────────────────────────────────────

describe('LB-10 · Exported constants — values and types', () => {
  it('LB-10-01: LLM_BRIDGE_DEFAULT_MODEL is "claude-haiku-3-5-latest"', () => {
    expect(LLM_BRIDGE_DEFAULT_MODEL).toBe('claude-haiku-3-5-latest');
  });

  it('LB-10-02: LLM_BRIDGE_DEFAULT_MAX_TOKENS is 512', () => {
    expect(LLM_BRIDGE_DEFAULT_MAX_TOKENS).toBe(512);
  });

  it('LB-10-03: LLM_BRIDGE_TEMPERATURE is 0.3', () => {
    expect(LLM_BRIDGE_TEMPERATURE).toBe(0.3);
  });

  it('LB-10-04: all three constants are defined (not undefined)', () => {
    expect(LLM_BRIDGE_DEFAULT_MODEL).toBeDefined();
    expect(LLM_BRIDGE_DEFAULT_MAX_TOKENS).toBeDefined();
    expect(LLM_BRIDGE_TEMPERATURE).toBeDefined();
  });
});

// ─── LB-11 · Strict identity on fallback ─────────────────────────────────────

describe('LB-11 · Strict identity on fallback — answer === kbAnswer', () => {
  const KB = 'Căn cứ: Điều 24 NĐ 214/2025/NĐ-CP. Ngưỡng: ≤ 50 triệu VND.';

  it('LB-11-01: empty-key fallback → answer strictly equals kbAnswer', async () => {
    const result = await paraphraseAnswer(KB, { apiKey: '' });
    expect(result.answer).toBe(KB);
  });

  it('LB-11-02: network-error fallback → answer strictly equals kbAnswer', async () => {
    const result = await paraphraseAnswer(KB, { apiKey: 'key', fetchFn: throwingFetch() });
    expect(result.answer).toBe(KB);
  });

  it('LB-11-03: bad HTTP status fallback → answer strictly equals kbAnswer', async () => {
    const result = await paraphraseAnswer(KB, {
      apiKey: 'key', fetchFn: async () => httpErrResp(503),
    });
    expect(result.answer).toBe(KB);
  });

  it('LB-11-04: empty LLM content fallback → answer strictly equals kbAnswer', async () => {
    const result = await paraphraseAnswer(KB, {
      apiKey: 'key', fetchFn: async () => claudeOkResp(''),
    });
    expect(result.answer).toBe(KB);
  });

  it('LB-11-05: model is undefined when usedLLM is false', async () => {
    const result = await paraphraseAnswer(KB, { apiKey: '' });
    expect(result.model).toBeUndefined();
  });
});

// ─── LB-12 · Integration with live KB results ────────────────────────────────

describe('LB-12 · Integration with live KB results', () => {
  const QUERY = 'ngưỡng phương thức lựa chọn nhà thầu';

  it('LB-12-01: fallback pipeline — KB answer preserved with empty key', async () => {
    const kbResults = searchLegalKB(QUERY, 3);
    const { answer: kbAnswer } = buildAnswer(kbResults, { message: QUERY, history: [] });
    const result = await paraphraseAnswer(kbAnswer, { apiKey: '' });
    expect(result.usedLLM).toBe(false);
    expect(result.answer).toBe(kbAnswer);
  });

  it('LB-12-02: live KB answer is a non-empty string', () => {
    const kbResults = searchLegalKB(QUERY, 3);
    const { answer } = buildAnswer(kbResults, { message: QUERY, history: [] });
    expect(typeof answer).toBe('string');
    expect(answer.length).toBeGreaterThan(0);
  });

  it('LB-12-03: usedLLM is always a boolean (not undefined)', async () => {
    const kbResults = searchLegalKB(QUERY, 3);
    const { answer: kbAnswer } = buildAnswer(kbResults, { message: QUERY, history: [] });
    const result = await paraphraseAnswer(kbAnswer, { apiKey: '' });
    expect(typeof result.usedLLM).toBe('boolean');
  });

  it('LB-12-04: result always has "answer" property', async () => {
    const kbResults = searchLegalKB(QUERY, 3);
    const { answer: kbAnswer } = buildAnswer(kbResults, { message: QUERY, history: [] });
    const result = await paraphraseAnswer(kbAnswer, { apiKey: '' });
    expect(Object.prototype.hasOwnProperty.call(result, 'answer')).toBe(true);
  });

  it('LB-12-05: result always has "usedLLM" property', async () => {
    const kbResults = searchLegalKB(QUERY, 3);
    const { answer: kbAnswer } = buildAnswer(kbResults, { message: QUERY, history: [] });
    const result = await paraphraseAnswer(kbAnswer, { apiKey: '' });
    expect(Object.prototype.hasOwnProperty.call(result, 'usedLLM')).toBe(true);
  });

  it('LB-12-06: mock success with live KB answer → usedLLM: true', async () => {
    const kbResults = searchLegalKB(QUERY, 3);
    const { answer: kbAnswer } = buildAnswer(kbResults, { message: QUERY, history: [] });
    const paraphrased = 'Phương thức lựa chọn nhà thầu được quy định rõ trong NĐ 214/2025.';
    const result = await paraphraseAnswer(kbAnswer, {
      apiKey:  'test-key',
      fetchFn: async () => claudeOkResp(paraphrased),
    });
    expect(result.usedLLM).toBe(true);
    expect(result.answer).toBe(paraphrased);
  });

  it('LB-12-07: mock LLM returns different content than kbAnswer', async () => {
    const kbResults = searchLegalKB(QUERY, 3);
    const { answer: kbAnswer } = buildAnswer(kbResults, { message: QUERY, history: [] });
    const differentContent = 'Nội dung khác từ LLM.';
    const result = await paraphraseAnswer(kbAnswer, {
      apiKey:  'test-key',
      fetchFn: async () => claudeOkResp(differentContent),
    });
    expect(result.answer).not.toBe(kbAnswer);
    expect(result.answer).toBe(differentContent);
  });
});
