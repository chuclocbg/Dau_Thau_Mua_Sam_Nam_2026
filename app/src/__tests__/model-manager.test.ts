/**
 * P6-10K: Tests for ModelManager.
 *
 * Groups:
 *   MM1 — registerModel / removeModel / getModel / listModels  (10 tests)
 *   MM2 — findByCapability / findByProvider                    (10 tests)
 *   MM3 — selectBestModel                                      (14 tests)
 *   MM4 — Edge cases                                           ( 8 tests)
 *
 * Total: 42 tests
 */

import { describe, it, expect } from 'vitest';
import { ModelManager }         from '../providers/ModelManager';
import type { ModelMetadata, ModelCapability } from '../providers/ModelManager';

// ─── Fixture models ───────────────────────────────────────────────────────────

const GPT4O: ModelMetadata = {
  providerId:   'openai',
  model:        'gpt-4o',
  displayName:  'GPT-4o',
  maxTokens:    128_000,
  capabilities: ['chat', 'streaming', 'vision', 'toolCalling', 'longContext'],
};

const GPT35: ModelMetadata = {
  providerId:   'openai',
  model:        'gpt-3.5-turbo',
  displayName:  'GPT-3.5 Turbo',
  maxTokens:    16_385,
  capabilities: ['chat', 'streaming', 'toolCalling'],
};

const GPT4O_MINI: ModelMetadata = {
  providerId:   'openai',
  model:        'gpt-4o-mini',
  displayName:  'GPT-4o Mini',
  maxTokens:    128_000,
  capabilities: ['chat', 'streaming'],
};

const CLAUDE_SONNET: ModelMetadata = {
  providerId:   'claude',
  model:        'claude-3-5-sonnet-latest',
  displayName:  'Claude 3.5 Sonnet',
  maxTokens:    200_000,
  capabilities: ['chat', 'streaming', 'vision', 'toolCalling', 'longContext'],
};

const CLAUDE_OPUS: ModelMetadata = {
  providerId:   'claude',
  model:        'claude-opus-4-20250514',
  displayName:  'Claude Opus 4',
  maxTokens:    200_000,
  capabilities: ['chat', 'streaming', 'vision', 'reasoning', 'toolCalling', 'longContext'],
};

const GEMINI_PRO: ModelMetadata = {
  providerId:   'gemini',
  model:        'gemini-2.5-pro',
  displayName:  'Gemini 2.5 Pro',
  maxTokens:    2_000_000,
  capabilities: ['chat', 'streaming', 'vision', 'reasoning', 'toolCalling', 'longContext'],
};

// ─────────────────────────────────────────────────────────────────────────────
// MM1: registerModel / removeModel / getModel / listModels
// ─────────────────────────────────────────────────────────────────────────────

describe('MM1: registerModel / removeModel / getModel / listModels', () => {
  it('MM1-01: registerModel increases listModels count', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);
    expect(m.listModels()).toHaveLength(1);
  });

  it('MM1-02: registering a duplicate model+provider replaces the previous entry', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);
    m.registerModel({ ...GPT4O, displayName: 'Updated GPT-4o', maxTokens: 256_000 });
    const models = m.listModels();
    expect(models).toHaveLength(1);
    expect(models[0]!.displayName).toBe('Updated GPT-4o');
    expect(models[0]!.maxTokens).toBe(256_000);
  });

  it('MM1-03: removeModel returns true when the model exists', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);
    expect(m.removeModel('openai', 'gpt-4o')).toBe(true);
  });

  it('MM1-04: removeModel returns false for an unknown model', () => {
    const m = new ModelManager();
    expect(m.removeModel('openai', 'no-such-model')).toBe(false);
  });

  it('MM1-05: getModel returns the registered metadata', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);
    const got = m.getModel('openai', 'gpt-4o');
    expect(got).toBeDefined();
    expect(got!.displayName).toBe('GPT-4o');
    expect(got!.maxTokens).toBe(128_000);
  });

  it('MM1-06: getModel returns undefined for an unregistered model', () => {
    const m = new ModelManager();
    expect(m.getModel('openai', 'gpt-4o')).toBeUndefined();
  });

  it('MM1-07: listModels returns all registered models', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);
    m.registerModel(CLAUDE_SONNET);
    m.registerModel(GEMINI_PRO);
    const ids = m.listModels().map(x => x.model);
    expect(ids).toContain('gpt-4o');
    expect(ids).toContain('claude-3-5-sonnet-latest');
    expect(ids).toContain('gemini-2.5-pro');
    expect(m.listModels()).toHaveLength(3);
  });

  it('MM1-08: listModels returns an empty array before any registration', () => {
    expect(new ModelManager().listModels()).toEqual([]);
  });

  it('MM1-09: removeModel removes only the target model, not others', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);
    m.registerModel(CLAUDE_SONNET);
    m.removeModel('openai', 'gpt-4o');
    const ids = m.listModels().map(x => x.model);
    expect(ids).not.toContain('gpt-4o');
    expect(ids).toContain('claude-3-5-sonnet-latest');
  });

  it('MM1-10: getModel returns undefined after the model has been removed', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);
    m.removeModel('openai', 'gpt-4o');
    expect(m.getModel('openai', 'gpt-4o')).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MM2: findByCapability / findByProvider
// ─────────────────────────────────────────────────────────────────────────────

describe('MM2: findByCapability / findByProvider', () => {
  it('MM2-01: findByCapability("vision") returns only vision-capable models', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);       // has vision
    m.registerModel(GPT35);       // no vision
    m.registerModel(GPT4O_MINI);  // no vision
    const found = m.findByCapability('vision');
    expect(found).toHaveLength(1);
    expect(found[0]!.model).toBe('gpt-4o');
  });

  it('MM2-02: findByCapability("reasoning") returns only reasoning-capable models', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);       // no reasoning
    m.registerModel(CLAUDE_OPUS); // has reasoning
    m.registerModel(GEMINI_PRO);  // has reasoning
    const found = m.findByCapability('reasoning');
    const models = found.map(x => x.model);
    expect(models).toContain('claude-opus-4-20250514');
    expect(models).toContain('gemini-2.5-pro');
    expect(models).not.toContain('gpt-4o');
  });

  it('MM2-03: findByCapability returns empty array when no model has the capability', () => {
    const m = new ModelManager();
    m.registerModel(GPT35);       // no vision, no reasoning
    m.registerModel(GPT4O_MINI);  // no vision, no reasoning
    expect(m.findByCapability('reasoning')).toEqual([]);
  });

  it('MM2-04: findByProvider("openai") returns only OpenAI models', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);
    m.registerModel(GPT35);
    m.registerModel(CLAUDE_SONNET);
    const found = m.findByProvider('openai');
    expect(found).toHaveLength(2);
    expect(found.every(x => x.providerId === 'openai')).toBe(true);
  });

  it('MM2-05: findByProvider returns empty array for an unknown provider', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);
    expect(m.findByProvider('anthropic')).toEqual([]);
  });

  it('MM2-06: findByProvider does not include models from other providers', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);
    m.registerModel(CLAUDE_SONNET);
    const found = m.findByProvider('claude');
    expect(found.every(x => x.providerId === 'claude')).toBe(true);
  });

  it('MM2-07: a model with multiple capabilities is found by each capability', () => {
    const m = new ModelManager();
    m.registerModel(CLAUDE_OPUS);
    const caps: ModelCapability[] = ['chat', 'streaming', 'vision', 'reasoning', 'toolCalling', 'longContext'];
    for (const cap of caps) {
      expect(m.findByCapability(cap).some(x => x.model === 'claude-opus-4-20250514')).toBe(true);
    }
  });

  it('MM2-08: findByCapability("longContext") correctly filters', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);       // has longContext
    m.registerModel(GPT35);       // no longContext
    m.registerModel(CLAUDE_OPUS); // has longContext
    const found = m.findByCapability('longContext');
    const models = found.map(x => x.model);
    expect(models).toContain('gpt-4o');
    expect(models).toContain('claude-opus-4-20250514');
    expect(models).not.toContain('gpt-3.5-turbo');
  });

  it('MM2-09: findByProvider excludes models removed after registration', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);
    m.registerModel(GPT35);
    m.removeModel('openai', 'gpt-3.5-turbo');
    const found = m.findByProvider('openai');
    expect(found).toHaveLength(1);
    expect(found[0]!.model).toBe('gpt-4o');
  });

  it('MM2-10: findByCapability("toolCalling") returns models across providers', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);
    m.registerModel(CLAUDE_SONNET);
    m.registerModel(GEMINI_PRO);
    m.registerModel(GPT4O_MINI);  // no toolCalling
    const found = m.findByCapability('toolCalling');
    const providers = [...new Set(found.map(x => x.providerId))];
    expect(providers.length).toBeGreaterThan(1);
    expect(found.every(x => x.capabilities.includes('toolCalling'))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MM3: selectBestModel
// ─────────────────────────────────────────────────────────────────────────────

describe('MM3: selectBestModel', () => {
  it('MM3-01: selects the single registered model when no options given', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);
    const r = m.selectBestModel();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.model.model).toBe('gpt-4o');
  });

  it('MM3-02: requiredCapabilities filters correctly', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);
    m.registerModel(GPT35);       // no vision
    m.registerModel(GPT4O_MINI);  // no vision
    const r = m.selectBestModel({ requiredCapabilities: ['vision'] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.model.model).toBe('gpt-4o');
  });

  it('MM3-03: filters out models missing a required capability', () => {
    const m = new ModelManager();
    m.registerModel(GPT35);       // no reasoning
    m.registerModel(GPT4O_MINI);  // no reasoning
    const r = m.selectBestModel({ requiredCapabilities: ['reasoning'] });
    expect(r.ok).toBe(false);
  });

  it('MM3-04: maxTokensNeeded filters out models with insufficient context', () => {
    const m = new ModelManager();
    m.registerModel(GPT35);       // 16 385 tokens
    m.registerModel(GPT4O_MINI);  // 128 000 tokens
    const r = m.selectBestModel({ maxTokensNeeded: 50_000 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.model.model).toBe('gpt-4o-mini');
  });

  it('MM3-05: preferredProvider picks the model from that provider', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);
    m.registerModel(CLAUDE_SONNET);
    m.registerModel(GEMINI_PRO);
    const r = m.selectBestModel({ preferredProvider: 'claude' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.providerId).toBe('claude');
      expect(r.model.providerId).toBe('claude');
    }
  });

  it('MM3-06: preferredProvider falls back when that provider has no matching models', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);
    // 'gemini' is not registered
    const r = m.selectBestModel({ preferredProvider: 'gemini' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.providerId).toBe('openai');
      expect(r.reason).toContain('gemini');  // reason explains the fallback
    }
  });

  it('MM3-07: returns ok:false with code NO_MODELS when registry is empty', () => {
    const r = new ModelManager().selectBestModel();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NO_MODELS');
  });

  it('MM3-08: returns ok:false with NO_MATCHING_MODEL when no model meets capabilities', () => {
    const m = new ModelManager();
    m.registerModel(GPT35);   // no reasoning, no vision
    const r = m.selectBestModel({ requiredCapabilities: ['reasoning', 'vision'] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NO_MATCHING_MODEL');
  });

  it('MM3-09: returns ok:false when no model meets maxTokensNeeded', () => {
    const m = new ModelManager();
    m.registerModel(GPT35);       // 16 385 tokens
    m.registerModel(GPT4O_MINI);  // 128 000 tokens
    const r = m.selectBestModel({ maxTokensNeeded: 500_000 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NO_MATCHING_MODEL');
  });

  it('MM3-10: reason is a non-empty string on success', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);
    const r = m.selectBestModel();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(typeof r.reason).toBe('string');
      expect(r.reason.length).toBeGreaterThan(0);
    }
  });

  it('MM3-11: reason mentions preferredProvider when it matched', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);
    m.registerModel(CLAUDE_SONNET);
    const r = m.selectBestModel({ preferredProvider: 'claude' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reason).toContain('claude');
  });

  it('MM3-12: multiple requiredCapabilities: all must match', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);       // no reasoning
    m.registerModel(CLAUDE_OPUS); // has vision + reasoning
    m.registerModel(GPT35);       // no vision, no reasoning
    const r = m.selectBestModel({ requiredCapabilities: ['vision', 'reasoning'] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.model.capabilities).toEqual(expect.arrayContaining(['vision', 'reasoning']));
  });

  it('MM3-13: selects the model with the highest maxTokens among candidates', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);       // 128 000
    m.registerModel(CLAUDE_OPUS); // 200 000
    m.registerModel(GEMINI_PRO);  // 2 000 000
    const r = m.selectBestModel();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.model.model).toBe('gemini-2.5-pro');
  });

  it('MM3-14: reason explains fallback when preferredProvider has no candidates', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);
    // Require reasoning (only GPT4O is there, but it doesn't have reasoning)
    m.registerModel(CLAUDE_OPUS);
    const r = m.selectBestModel({
      preferredProvider: 'openai',
      requiredCapabilities: ['reasoning'],
    });
    // openai has no reasoning model, but claude does → fallback
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.reason).toContain('openai');
      expect(r.model.providerId).toBe('claude');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MM4: Edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('MM4: Edge cases', () => {
  it('MM4-01: registerModel accepts a model with empty capabilities', () => {
    const m = new ModelManager();
    const bare: ModelMetadata = {
      providerId: 'custom', model: 'custom-v1', displayName: 'Custom', maxTokens: 4096, capabilities: [],
    };
    m.registerModel(bare);
    expect(m.getModel('custom', 'custom-v1')).toBeDefined();
    expect(m.findByCapability('chat')).toHaveLength(0);
  });

  it('MM4-02: selectBestModel({}) with empty options selects from all registered models', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);
    m.registerModel(CLAUDE_SONNET);
    const r = m.selectBestModel({});
    expect(r.ok).toBe(true);
  });

  it('MM4-03: re-registering a model overwrites it with the new metadata', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);
    m.registerModel({ ...GPT4O, maxTokens: 999_999, displayName: 'Overwritten' });
    const got = m.getModel('openai', 'gpt-4o');
    expect(got!.maxTokens).toBe(999_999);
    expect(got!.displayName).toBe('Overwritten');
    expect(m.listModels()).toHaveLength(1);
  });

  it('MM4-04: getModel returns undefined after removeModel', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);
    m.removeModel('openai', 'gpt-4o');
    expect(m.getModel('openai', 'gpt-4o')).toBeUndefined();
  });

  it('MM4-05: mutating findByCapability result does not corrupt the registry', () => {
    const m = new ModelManager();
    m.registerModel(CLAUDE_OPUS);
    const results = m.findByCapability('reasoning');
    // mutate both the array and the capabilities array inside
    results[0]!.capabilities.push('chat' as ModelCapability);
    results[0]!.displayName = 'CORRUPTED';
    results.push({ ...CLAUDE_OPUS, model: 'injected' });
    // registry must be unaffected
    const fresh = m.findByCapability('reasoning');
    expect(fresh).toHaveLength(1);
    expect(fresh[0]!.displayName).toBe('Claude Opus 4');
    expect(fresh[0]!.capabilities.filter(c => c === 'chat')).toHaveLength(1);
  });

  it('MM4-06: mutating getModel result does not corrupt the registry', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);
    const got = m.getModel('openai', 'gpt-4o')!;
    got.maxTokens = 1;
    got.capabilities.length = 0;
    // registry unaffected
    const fresh = m.getModel('openai', 'gpt-4o')!;
    expect(fresh.maxTokens).toBe(128_000);
    expect(fresh.capabilities).toHaveLength(GPT4O.capabilities.length);
  });

  it('MM4-07: ModelManager never throws for any sequence of valid operations', () => {
    expect(() => {
      const m = new ModelManager();
      m.listModels();
      m.findByCapability('chat');
      m.findByProvider('none');
      m.getModel('none', 'none');
      m.removeModel('none', 'none');
      m.selectBestModel();
      m.selectBestModel({ requiredCapabilities: ['vision', 'reasoning'] });
      m.selectBestModel({ maxTokensNeeded: 9_999_999 });
      m.selectBestModel({ preferredProvider: 'nobody' });
      m.registerModel(GEMINI_PRO);
      m.registerModel(CLAUDE_OPUS);
      m.selectBestModel({ preferredProvider: 'openai', requiredCapabilities: ['reasoning'] });
    }).not.toThrow();
  });

  it('MM4-08: selectBestModel reason always contains useful text describing the decision', () => {
    const m = new ModelManager();
    m.registerModel(GPT4O);
    m.registerModel(CLAUDE_OPUS);

    const r1 = m.selectBestModel({ preferredProvider: 'openai' });
    expect(r1.ok && r1.reason.length > 0).toBe(true);

    const r2 = m.selectBestModel({ requiredCapabilities: ['vision'] });
    expect(r2.ok && r2.reason).toBeTruthy();
    if (r2.ok) expect(r2.reason).toContain('vision');

    const r3 = m.selectBestModel({ maxTokensNeeded: 100_000 });
    expect(r3.ok && r3.reason).toBeTruthy();
    if (r3.ok) expect(r3.reason).toContain('100');
  });
});
