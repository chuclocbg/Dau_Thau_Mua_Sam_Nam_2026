/**
 * P6-10F: Environment-variable helpers for LLM provider configuration.
 *
 * Each helper reads a single required API-key env var, combines it with safe
 * defaults, and returns the provider's own typed Result<Config>.  Callers can
 * supply Partial<Config> overrides (model, temperature, maxTokens, fetchFn)
 * without overriding the env-sourced API key.
 *
 * Error handling:
 *   - Missing or blank env var → { ok: false, error: { code: 'INVALID_CONFIG' } }
 *   - No exceptions are thrown.
 *
 * Dependency injection:
 *   - fetchFn can be passed in overrides — tests inject a mock, production
 *     omits it so the global fetch is used (same as constructing providers directly).
 *
 * Env vars consumed:
 *   OPENAI_API_KEY    → OpenAIProvider  (Authorization: Bearer <key>)
 *   ANTHROPIC_API_KEY → ClaudeProvider  (x-api-key header)
 *   GEMINI_API_KEY    → GeminiProvider  (?key= query param)
 */

import type {
  OpenAIProviderConfig,
  OpenAIResult,
  OpenAIProviderError,
} from './OpenAIProvider';

import type {
  ClaudeProviderConfig,
  ClaudeResult,
  ClaudeProviderError,
} from './ClaudeProvider';

import type {
  GeminiProviderConfig,
  GeminiResult,
  GeminiProviderError,
} from './GeminiProvider';

// ─── Default models ───────────────────────────────────────────────────────────

const DEFAULT_OPENAI_MODEL  = 'gpt-4o';
const DEFAULT_CLAUDE_MODEL  = 'claude-3-5-sonnet-latest';
const DEFAULT_GEMINI_MODEL  = 'gemini-2.5-flash';

// ─── OpenAI ───────────────────────────────────────────────────────────────────

/**
 * Builds an OpenAIProviderConfig from the OPENAI_API_KEY environment variable.
 *
 * Returns INVALID_CONFIG when the variable is absent or blank.
 * Pass `overrides` to customise model, temperature, maxTokens, or fetchFn.
 * The env-sourced apiKey always takes precedence over any apiKey in overrides.
 */
export function loadOpenAIConfigFromEnv(
  overrides?: Partial<OpenAIProviderConfig>,
): OpenAIResult<OpenAIProviderConfig> {
  const apiKey = process.env['OPENAI_API_KEY']?.trim() ?? '';
  if (!apiKey) {
    return envErr<OpenAIProviderError>('OPENAI_API_KEY');
  }
  return {
    ok:    true,
    value: { model: DEFAULT_OPENAI_MODEL, ...overrides, apiKey },
  };
}

// ─── Claude ───────────────────────────────────────────────────────────────────

/**
 * Builds a ClaudeProviderConfig from the ANTHROPIC_API_KEY environment variable.
 *
 * Returns INVALID_CONFIG when the variable is absent or blank.
 * Pass `overrides` to customise model, temperature, maxTokens, fetchFn, or
 * anthropicVersion.
 * The env-sourced apiKey always takes precedence over any apiKey in overrides.
 */
export function loadClaudeConfigFromEnv(
  overrides?: Partial<ClaudeProviderConfig>,
): ClaudeResult<ClaudeProviderConfig> {
  const apiKey = process.env['ANTHROPIC_API_KEY']?.trim() ?? '';
  if (!apiKey) {
    return envErr<ClaudeProviderError>('ANTHROPIC_API_KEY');
  }
  return {
    ok:    true,
    value: { model: DEFAULT_CLAUDE_MODEL, ...overrides, apiKey },
  };
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

/**
 * Builds a GeminiProviderConfig from the GEMINI_API_KEY environment variable.
 *
 * Returns INVALID_CONFIG when the variable is absent or blank.
 * Pass `overrides` to customise model, temperature, maxTokens, or fetchFn.
 * The env-sourced apiKey always takes precedence over any apiKey in overrides.
 */
export function loadGeminiConfigFromEnv(
  overrides?: Partial<GeminiProviderConfig>,
): GeminiResult<GeminiProviderConfig> {
  const apiKey = process.env['GEMINI_API_KEY']?.trim() ?? '';
  if (!apiKey) {
    return envErr<GeminiProviderError>('GEMINI_API_KEY');
  }
  return {
    ok:    true,
    value: { model: DEFAULT_GEMINI_MODEL, ...overrides, apiKey },
  };
}

// ─── Internal helper ──────────────────────────────────────────────────────────

/** Shared error factory — all provider error interfaces share the same shape. */
interface BaseProviderError { code: string; message: string; }

function envErr<E extends BaseProviderError>(varName: string): { ok: false; error: E } {
  return {
    ok:    false,
    error: {
      code:    'INVALID_CONFIG',
      message: `Environment variable ${varName} is not set or empty`,
    } as unknown as E,
  };
}
