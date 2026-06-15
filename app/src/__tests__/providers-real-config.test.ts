/**
 * P6-10F: Tests for environment-variable-based provider configuration.
 *
 * Uses vi.stubEnv() to control process.env without touching real keys.
 * vi.unstubAllEnvs() runs after each test to guarantee isolation.
 * No real network calls — fetchFn is always a no-op mock when a provider
 * instance is constructed to verify that chat() works end-to-end.
 *
 * Groups:
 *   RC1 — loadOpenAIConfigFromEnv()   ( 8 tests)
 *   RC2 — loadClaudeConfigFromEnv()   ( 8 tests)
 *   RC3 — loadGeminiConfigFromEnv()   ( 8 tests)
 *   RC4 — cross-provider + constructor fallback ( 8 tests)
 *
 * Total: 32 tests
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadOpenAIConfigFromEnv }  from '../providers/env';
import { loadClaudeConfigFromEnv }  from '../providers/env';
import { loadGeminiConfigFromEnv }  from '../providers/env';
import { OpenAIProvider }           from '../providers/OpenAIProvider';
import { ClaudeProvider }           from '../providers/ClaudeProvider';
import { GeminiProvider }           from '../providers/GeminiProvider';

// ─── Shared no-op fetch ───────────────────────────────────────────────────────

/** Minimal mock fetch for provider instantiation tests — never calls the network. */
const noopFetch = async (): Promise<Response> =>
  new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });

// ─── Setup / teardown ─────────────────────────────────────────────────────────

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── RC1: loadOpenAIConfigFromEnv ─────────────────────────────────────────────

describe('RC1: loadOpenAIConfigFromEnv()', () => {
  it('RC1-01: OPENAI_API_KEY set → returns ok:true', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-openai-test-abc');
    const r = loadOpenAIConfigFromEnv();
    expect(r.ok).toBe(true);
  });

  it('RC1-02: returned config.apiKey matches OPENAI_API_KEY', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-openai-check-123');
    const r = loadOpenAIConfigFromEnv();
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.apiKey).toBe('sk-openai-check-123');
  });

  it('RC1-03: OPENAI_API_KEY absent → INVALID_CONFIG', () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const r = loadOpenAIConfigFromEnv();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('RC1-04: OPENAI_API_KEY whitespace-only → INVALID_CONFIG', () => {
    vi.stubEnv('OPENAI_API_KEY', '   ');
    const r = loadOpenAIConfigFromEnv();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('RC1-05: default model is gpt-4o', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const r = loadOpenAIConfigFromEnv();
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.model).toBe('gpt-4o');
  });

  it('RC1-06: model override in options is respected', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const r = loadOpenAIConfigFromEnv({ model: 'gpt-4o-mini' });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.model).toBe('gpt-4o-mini');
  });

  it('RC1-07: fetchFn override preserved in returned config', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    const r = loadOpenAIConfigFromEnv({ fetchFn: noopFetch });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.fetchFn).toBe(noopFetch);
  });

  it('RC1-08: OpenAIProvider built from env config passes validateConfig()', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-valid-key');
    const r = loadOpenAIConfigFromEnv({ fetchFn: noopFetch });
    if (!r.ok) throw new Error('expected ok');
    const p = new OpenAIProvider(r.value);
    expect(p.validateConfig().ok).toBe(true);
  });
});

// ─── RC2: loadClaudeConfigFromEnv ────────────────────────────────────────────

describe('RC2: loadClaudeConfigFromEnv()', () => {
  it('RC2-01: ANTHROPIC_API_KEY set → returns ok:true', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test-xyz');
    const r = loadClaudeConfigFromEnv();
    expect(r.ok).toBe(true);
  });

  it('RC2-02: returned config.apiKey matches ANTHROPIC_API_KEY', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-match-456');
    const r = loadClaudeConfigFromEnv();
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.apiKey).toBe('sk-ant-match-456');
  });

  it('RC2-03: ANTHROPIC_API_KEY absent → INVALID_CONFIG', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const r = loadClaudeConfigFromEnv();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('RC2-04: ANTHROPIC_API_KEY whitespace-only → INVALID_CONFIG', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '  ');
    const r = loadClaudeConfigFromEnv();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('RC2-05: default model is claude-3-5-sonnet-latest', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    const r = loadClaudeConfigFromEnv();
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.model).toBe('claude-3-5-sonnet-latest');
  });

  it('RC2-06: model override in options is respected', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    const r = loadClaudeConfigFromEnv({ model: 'claude-opus-4-20250514' });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.model).toBe('claude-opus-4-20250514');
  });

  it('RC2-07: fetchFn override preserved in returned config', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');
    const r = loadClaudeConfigFromEnv({ fetchFn: noopFetch });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.fetchFn).toBe(noopFetch);
  });

  it('RC2-08: ClaudeProvider built from env config passes validateConfig()', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-valid-key');
    const r = loadClaudeConfigFromEnv({ fetchFn: noopFetch });
    if (!r.ok) throw new Error('expected ok');
    const p = new ClaudeProvider(r.value);
    expect(p.validateConfig().ok).toBe(true);
  });
});

// ─── RC3: loadGeminiConfigFromEnv ────────────────────────────────────────────

describe('RC3: loadGeminiConfigFromEnv()', () => {
  it('RC3-01: GEMINI_API_KEY set → returns ok:true', () => {
    vi.stubEnv('GEMINI_API_KEY', 'goog-test-abc');
    const r = loadGeminiConfigFromEnv();
    expect(r.ok).toBe(true);
  });

  it('RC3-02: returned config.apiKey matches GEMINI_API_KEY', () => {
    vi.stubEnv('GEMINI_API_KEY', 'goog-match-789');
    const r = loadGeminiConfigFromEnv();
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.apiKey).toBe('goog-match-789');
  });

  it('RC3-03: GEMINI_API_KEY absent → INVALID_CONFIG', () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const r = loadGeminiConfigFromEnv();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('RC3-04: GEMINI_API_KEY whitespace-only → INVALID_CONFIG', () => {
    vi.stubEnv('GEMINI_API_KEY', '   ');
    const r = loadGeminiConfigFromEnv();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('RC3-05: default model is gemini-2.5-flash', () => {
    vi.stubEnv('GEMINI_API_KEY', 'goog-test');
    const r = loadGeminiConfigFromEnv();
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.model).toBe('gemini-2.5-flash');
  });

  it('RC3-06: model override in options is respected', () => {
    vi.stubEnv('GEMINI_API_KEY', 'goog-test');
    const r = loadGeminiConfigFromEnv({ model: 'gemini-2.5-pro' });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.model).toBe('gemini-2.5-pro');
  });

  it('RC3-07: fetchFn override preserved in returned config', () => {
    vi.stubEnv('GEMINI_API_KEY', 'goog-test');
    const r = loadGeminiConfigFromEnv({ fetchFn: noopFetch });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.fetchFn).toBe(noopFetch);
  });

  it('RC3-08: GeminiProvider built from env config passes validateConfig()', () => {
    vi.stubEnv('GEMINI_API_KEY', 'goog-valid-key');
    const r = loadGeminiConfigFromEnv({ fetchFn: noopFetch });
    if (!r.ok) throw new Error('expected ok');
    const p = new GeminiProvider(r.value);
    expect(p.validateConfig().ok).toBe(true);
  });
});

// ─── RC4: cross-provider scenarios and constructor env fallback ───────────────

describe('RC4: cross-provider scenarios and constructor env fallback', () => {
  it('RC4-01: all three env vars set → all three load functions return ok:true', () => {
    vi.stubEnv('OPENAI_API_KEY',    'sk-oai');
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant');
    vi.stubEnv('GEMINI_API_KEY',    'goog-gem');
    expect(loadOpenAIConfigFromEnv().ok).toBe(true);
    expect(loadClaudeConfigFromEnv().ok).toBe(true);
    expect(loadGeminiConfigFromEnv().ok).toBe(true);
  });

  it('RC4-02: only OPENAI_API_KEY missing → only OpenAI fails', () => {
    vi.stubEnv('OPENAI_API_KEY',    '');
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant');
    vi.stubEnv('GEMINI_API_KEY',    'goog-gem');
    expect(loadOpenAIConfigFromEnv().ok).toBe(false);
    expect(loadClaudeConfigFromEnv().ok).toBe(true);
    expect(loadGeminiConfigFromEnv().ok).toBe(true);
  });

  it('RC4-03: only ANTHROPIC_API_KEY missing → only Claude fails', () => {
    vi.stubEnv('OPENAI_API_KEY',    'sk-oai');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY',    'goog-gem');
    expect(loadOpenAIConfigFromEnv().ok).toBe(true);
    expect(loadClaudeConfigFromEnv().ok).toBe(false);
    expect(loadGeminiConfigFromEnv().ok).toBe(true);
  });

  it('RC4-04: only GEMINI_API_KEY missing → only Gemini fails', () => {
    vi.stubEnv('OPENAI_API_KEY',    'sk-oai');
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant');
    vi.stubEnv('GEMINI_API_KEY',    '');
    expect(loadOpenAIConfigFromEnv().ok).toBe(true);
    expect(loadClaudeConfigFromEnv().ok).toBe(true);
    expect(loadGeminiConfigFromEnv().ok).toBe(false);
  });

  it('RC4-05: new OpenAIProvider without apiKey uses OPENAI_API_KEY from env', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-env-fallback');
    const p = new OpenAIProvider({ model: 'gpt-4o' });
    expect(p.validateConfig().ok).toBe(true);
  });

  it('RC4-06: new ClaudeProvider without apiKey uses ANTHROPIC_API_KEY from env', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-fallback');
    const p = new ClaudeProvider({ model: 'claude-3-5-sonnet-latest' });
    expect(p.validateConfig().ok).toBe(true);
  });

  it('RC4-07: new GeminiProvider without apiKey uses GEMINI_API_KEY from env', () => {
    vi.stubEnv('GEMINI_API_KEY', 'goog-fallback');
    const p = new GeminiProvider({ model: 'gemini-2.5-flash' });
    expect(p.validateConfig().ok).toBe(true);
  });

  it('RC4-08: none of the env vars set → all three load functions return INVALID_CONFIG', () => {
    vi.stubEnv('OPENAI_API_KEY',    '');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY',    '');
    const oai = loadOpenAIConfigFromEnv();
    const cla = loadClaudeConfigFromEnv();
    const gem = loadGeminiConfigFromEnv();
    expect(oai.ok).toBe(false);
    expect(cla.ok).toBe(false);
    expect(gem.ok).toBe(false);
    if (!oai.ok) expect(oai.error.code).toBe('INVALID_CONFIG');
    if (!cla.ok) expect(cla.error.code).toBe('INVALID_CONFIG');
    if (!gem.ok) expect(gem.error.code).toBe('INVALID_CONFIG');
  });
});
