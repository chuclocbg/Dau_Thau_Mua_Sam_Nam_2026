/**
 * P6-10B: Anthropic Claude provider adapter.
 *
 * Wraps the Anthropic Messages API (POST /v1/messages) behind the same
 * testable, dependency-injected pattern as OpenAIProvider (P6-10A).
 *
 * Key Anthropic-specific differences from the OpenAI adapter:
 *   - Auth:    x-api-key header (not Authorization: Bearer)
 *   - Version: anthropic-version header required (2023-06-01)
 *   - System:  top-level "system" field, NOT a message in the array
 *   - Content: response.content is an array of typed blocks; we extract
 *              the first { type: "text" } block's text
 *   - Usage:   input_tokens / output_tokens (not prompt_ / completion_)
 *   - Temp:    range 0.0–1.0 (OpenAI allows 0.0–2.0)
 *   - Roles:   messages array accepts only "user" | "assistant"; no "system"
 *
 * Design rules (mirrors P6-10A):
 *   - fetchFn is injected via config — tests never touch the network.
 *   - chat() never throws — all errors are returned as { ok: false, error }.
 *   - validateConfig() is called at the start of every chat() call.
 *   - ClaudeResult<T> is a discriminated union identical in shape to
 *     OpenAIResult<T> so callers can handle both uniformly.
 *   - ModelInfo is imported from OpenAIProvider — the shape is shared
 *     across all providers and re-exported from the barrel.
 */

import type { ModelInfo } from './OpenAIProvider';

// ─── Config ───────────────────────────────────────────────────────────────────

export interface ClaudeProviderConfig {
  /** API key.  When omitted the constructor falls back to process.env.ANTHROPIC_API_KEY. */
  apiKey?:           string;
  model:             string;
  temperature?:      number;   // 0.0–1.0, default 1.0
  maxTokens?:        number;   // default 1024
  baseUrl?:          string;   // default 'https://api.anthropic.com/v1'
  anthropicVersion?: string;   // default '2023-06-01'
  /** Injectable fetch implementation — use a mock in tests. */
  fetchFn?:          (url: string, init: RequestInit) => Promise<Response>;
}

// ─── Request / Response ───────────────────────────────────────────────────────

/** A single turn in the conversation (user or assistant only — no system). */
export interface ClaudeChatMessage {
  role:    'user' | 'assistant';
  content: string;
}

export interface ClaudeChatRequest {
  messages:     ClaudeChatMessage[];
  /** Top-level system prompt, sent as Anthropic's system field. */
  system?:      string;
  /** Overrides config.model for this call only. */
  model?:       string;
  /** Overrides config.temperature for this call only. */
  temperature?: number;
  /** Overrides config.maxTokens for this call only. */
  maxTokens?:   number;
}

export interface ClaudeChatResponse {
  content:     string;   // extracted from the first text content block
  model:       string;
  stopReason:  string;   // maps stop_reason from the API
  usage: {
    inputTokens:  number;  // maps input_tokens
    outputTokens: number;  // maps output_tokens
    totalTokens:  number;  // inputTokens + outputTokens (derived)
  };
}

// ─── Error types ──────────────────────────────────────────────────────────────

export type ClaudeErrorCode =
  | 'INVALID_CONFIG'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'API_ERROR'
  | 'PARSE_ERROR';

export interface ClaudeProviderError {
  code:    ClaudeErrorCode;
  message: string;
  status?: number;
  cause?:  unknown;
}

// ─── Result discriminated union ───────────────────────────────────────────────

export type ClaudeResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: ClaudeProviderError };

// ─── Model info ───────────────────────────────────────────────────────────────

const KNOWN_MODELS: Readonly<Record<string, ModelInfo>> = {
  'claude-3-5-sonnet-latest': {
    modelId:          'claude-3-5-sonnet-latest',
    maxContextTokens: 200_000,
    supportsVision:   true,
    description:      'Claude 3.5 Sonnet — latest alias, 200K context, vision',
  },
  'claude-3-7-sonnet-latest': {
    modelId:          'claude-3-7-sonnet-latest',
    maxContextTokens: 200_000,
    supportsVision:   true,
    description:      'Claude 3.7 Sonnet — latest alias, 200K context, extended thinking',
  },
  'claude-sonnet-4-20250514': {
    modelId:          'claude-sonnet-4-20250514',
    maxContextTokens: 200_000,
    supportsVision:   true,
    description:      'Claude Sonnet 4 (2025-05-14) — 200K context, vision',
  },
  'claude-opus-4-20250514': {
    modelId:          'claude-opus-4-20250514',
    maxContextTokens: 200_000,
    supportsVision:   true,
    description:      'Claude Opus 4 (2025-05-14) — 200K context, vision, most capable',
  },
  'claude-haiku-3-5-latest': {
    modelId:          'claude-haiku-3-5-latest',
    maxContextTokens: 200_000,
    supportsVision:   true,
    description:      'Claude Haiku 3.5 — latest alias, 200K context, fastest',
  },
};

// ─── Internal Anthropic API shapes ────────────────────────────────────────────

interface ApiContentBlock {
  type:  string;
  text?: string;
}

interface ApiRequestBody {
  model:       string;
  max_tokens:  number;
  messages:    ClaudeChatMessage[];
  temperature: number;
  system?:     string;
}

interface ApiResponseBody {
  id:            string;
  type:          string;
  role:          string;
  content:       ApiContentBlock[];
  model:         string;
  stop_reason:   string;
  stop_sequence: string | null;
  usage: {
    input_tokens:  number;
    output_tokens: number;
  };
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_TEMPERATURE       = 1.0;
const DEFAULT_MAX_TOKENS        = 1024;
const DEFAULT_BASE_URL          = 'https://api.anthropic.com/v1';
const DEFAULT_ANTHROPIC_VERSION = '2023-06-01';

// ─── Provider ─────────────────────────────────────────────────────────────────

export class ClaudeProvider {
  private readonly apiKey:            string;
  private readonly model:             string;
  private readonly temperature:       number;
  private readonly maxTokens:         number;
  private readonly baseUrl:           string;
  private readonly anthropicVersion:  string;
  private readonly fetchFn:           (url: string, init: RequestInit) => Promise<Response>;

  constructor(config: ClaudeProviderConfig) {
    this.apiKey           = config.apiKey ?? process.env['ANTHROPIC_API_KEY'] ?? '';
    this.model            = config.model;
    this.temperature      = config.temperature      ?? DEFAULT_TEMPERATURE;
    this.maxTokens        = config.maxTokens        ?? DEFAULT_MAX_TOKENS;
    this.baseUrl          = config.baseUrl          ?? DEFAULT_BASE_URL;
    this.anthropicVersion = config.anthropicVersion ?? DEFAULT_ANTHROPIC_VERSION;
    this.fetchFn          = config.fetchFn          ?? ((url, init) => fetch(url, init));
  }

  /**
   * Validates the provider configuration.
   * Anthropic temperature range is 0.0–1.0 (narrower than OpenAI's 0.0–2.0).
   */
  validateConfig(): ClaudeResult<true> {
    if (!this.apiKey.trim()) {
      return err('INVALID_CONFIG', 'apiKey is required and must not be empty');
    }
    if (!this.model.trim()) {
      return err('INVALID_CONFIG', 'model is required and must not be empty');
    }
    if (this.temperature < 0 || this.temperature > 1) {
      return err('INVALID_CONFIG',
        `temperature must be between 0.0 and 1.0 for Anthropic, got ${this.temperature}`);
    }
    if (!Number.isInteger(this.maxTokens) || this.maxTokens < 1) {
      return err('INVALID_CONFIG',
        `maxTokens must be a positive integer, got ${this.maxTokens}`);
    }
    return { ok: true, value: true };
  }

  /**
   * Returns metadata for a model.  Falls back to a generic entry for unknown IDs.
   * @param model - Override the config model for this lookup only.
   */
  getModelInfo(model?: string): ModelInfo {
    const id = (model ?? this.model).trim();
    return KNOWN_MODELS[id] ?? {
      modelId:          id,
      maxContextTokens: 200_000,
      supportsVision:   false,
      description:      `Unknown Claude model: ${id}`,
    };
  }

  /**
   * Sends a message to the Anthropic Messages API.
   *
   * Never throws — all failures are returned as { ok: false, error }.
   * Config is validated before the network call; invalid config short-circuits.
   */
  async chat(request: ClaudeChatRequest): Promise<ClaudeResult<ClaudeChatResponse>> {
    const configCheck = this.validateConfig();
    if (!configCheck.ok) return configCheck;

    const model       = request.model?.trim() || this.model;
    const temperature = request.temperature   ?? this.temperature;
    const maxTokens   = request.maxTokens     ?? this.maxTokens;

    const body: ApiRequestBody = {
      model,
      max_tokens:  maxTokens,
      messages:    request.messages,
      temperature,
    };
    if (request.system !== undefined) {
      body.system = request.system;
    }

    let response: Response;
    try {
      response = await this.fetchFn(
        `${this.baseUrl}/messages`,
        {
          method:  'POST',
          headers: {
            'Content-Type':      'application/json',
            'x-api-key':         this.apiKey,
            'anthropic-version': this.anthropicVersion,
          },
          body: JSON.stringify(body),
        },
      );
    } catch (cause) {
      return err('NETWORK_ERROR', 'Network request failed', undefined, cause);
    }

    if (response.status === 401) {
      return err('UNAUTHORIZED', 'Unauthorized — check your Anthropic API key', 401);
    }
    if (response.status === 429) {
      return err('RATE_LIMITED', 'Rate limit exceeded — retry after a delay', 429);
    }
    if (!response.ok) {
      return err('API_ERROR', `Anthropic API error: HTTP ${response.status}`, response.status);
    }

    let data: ApiResponseBody;
    try {
      data = await response.json() as ApiResponseBody;
    } catch (cause) {
      return err('PARSE_ERROR', 'Failed to parse Anthropic API response as JSON', undefined, cause);
    }

    const textBlock = data.content?.find(b => b.type === 'text');
    if (!textBlock || textBlock.text === undefined) {
      return err('PARSE_ERROR', 'Anthropic API response contained no text content block');
    }

    const inputTokens  = data.usage.input_tokens;
    const outputTokens = data.usage.output_tokens;

    return {
      ok:    true,
      value: {
        content:    textBlock.text,
        model:      data.model,
        stopReason: data.stop_reason,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
      },
    };
  }
}

// ─── Internal helper ──────────────────────────────────────────────────────────

function err(
  code:    ClaudeErrorCode,
  message: string,
  status?: number,
  cause?:  unknown,
): ClaudeResult<never> {
  const error: ClaudeProviderError = { code, message };
  if (status !== undefined) error.status = status;
  if (cause  !== undefined) error.cause  = cause;
  return { ok: false, error };
}
