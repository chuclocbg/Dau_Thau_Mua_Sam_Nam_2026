/**
 * P6-10A / P6-10H: OpenAI provider adapter.
 *
 * Wraps the OpenAI chat/completions API behind a typed, testable interface.
 *
 * Design rules:
 *   - fetch is injected via config so tests never touch the network.
 *   - chat() never throws — all errors surface as { ok: false, error }.
 *   - Config is validated before every chat() call; invalid config short-circuits.
 *   - Result<T> discriminated union keeps callers honest: they must check ok
 *     before accessing value.
 *   - Per-request overrides (model, temperature, maxTokens) layer on top of
 *     constructor-level defaults, enabling one provider instance per session
 *     while still letting individual calls fine-tune parameters.
 *   - No imports from the agent layer — this is infrastructure, not domain.
 */

import { type StreamChunk, readSseLines } from './StreamingTypes';

// ─── Config ───────────────────────────────────────────────────────────────────

export interface OpenAIProviderConfig {
  /** API key.  When omitted the constructor falls back to process.env.OPENAI_API_KEY. */
  apiKey?:      string;
  model:        string;
  temperature?: number;    // 0.0–2.0, default 0.7
  maxTokens?:   number;    // default 1024
  baseUrl?:     string;    // default 'https://api.openai.com/v1'
  /** Injectable fetch implementation — use a mock in tests. */
  fetchFn?:     (url: string, init: RequestInit) => Promise<Response>;
}

// ─── Request / Response ───────────────────────────────────────────────────────

export interface OpenAIChatMessage {
  role:    'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIChatRequest {
  messages:     OpenAIChatMessage[];
  /** Overrides config.model for this call only. */
  model?:       string;
  /** Overrides config.temperature for this call only. */
  temperature?: number;
  /** Overrides config.maxTokens for this call only. */
  maxTokens?:   number;
}

export interface OpenAIChatResponse {
  content:      string;
  model:        string;
  usage: {
    promptTokens:     number;
    completionTokens: number;
    totalTokens:      number;
  };
  finishReason: string;
}

// ─── Error types ──────────────────────────────────────────────────────────────

export type OpenAIErrorCode =
  | 'INVALID_CONFIG'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'API_ERROR'
  | 'PARSE_ERROR';

export interface OpenAIProviderError {
  code:     OpenAIErrorCode;
  message:  string;
  status?:  number;
  cause?:   unknown;
}

// ─── Result discriminated union ───────────────────────────────────────────────

export type OpenAIResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: OpenAIProviderError };

// ─── Model info ───────────────────────────────────────────────────────────────

export interface ModelInfo {
  modelId:          string;
  maxContextTokens: number;
  supportsVision:   boolean;
  description:      string;
}

const KNOWN_MODELS: Readonly<Record<string, ModelInfo>> = {
  'gpt-4o': {
    modelId:          'gpt-4o',
    maxContextTokens: 128_000,
    supportsVision:   true,
    description:      'GPT-4o — multimodal flagship, 128K context',
  },
  'gpt-4o-mini': {
    modelId:          'gpt-4o-mini',
    maxContextTokens: 128_000,
    supportsVision:   true,
    description:      'GPT-4o mini — lightweight multimodal, 128K context',
  },
  'gpt-4-turbo': {
    modelId:          'gpt-4-turbo',
    maxContextTokens: 128_000,
    supportsVision:   true,
    description:      'GPT-4 Turbo — vision capable, 128K context',
  },
  'gpt-4': {
    modelId:          'gpt-4',
    maxContextTokens: 8_192,
    supportsVision:   false,
    description:      'GPT-4 — 8K context',
  },
  'gpt-3.5-turbo': {
    modelId:          'gpt-3.5-turbo',
    maxContextTokens: 16_385,
    supportsVision:   false,
    description:      'GPT-3.5 Turbo — fast, 16K context',
  },
};

// ─── Internal OpenAI API shapes ───────────────────────────────────────────────

interface OaiSseDelta  { content?: string; }
interface OaiSseChoice { index: number; delta: OaiSseDelta; finish_reason: string | null; }
interface OaiSseUsage  { prompt_tokens: number; completion_tokens: number; total_tokens: number; }
interface OaiSseChunk  { model?: string; choices?: OaiSseChoice[]; usage?: OaiSseUsage; }

interface ApiRequestBody {
  model:       string;
  messages:    OpenAIChatMessage[];
  temperature: number;
  max_tokens:  number;
}

interface ApiResponseBody {
  model:   string;
  choices: Array<{
    message:       { role: string; content: string };
    finish_reason: string;
    index:         number;
  }>;
  usage: {
    prompt_tokens:     number;
    completion_tokens: number;
    total_tokens:      number;
  };
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS  = 1024;
const DEFAULT_BASE_URL    = 'https://api.openai.com/v1';

// ─── Provider ─────────────────────────────────────────────────────────────────

export class OpenAIProvider {
  private readonly apiKey:      string;
  private readonly model:       string;
  private readonly temperature: number;
  private readonly maxTokens:   number;
  private readonly baseUrl:     string;
  private readonly fetchFn:     (url: string, init: RequestInit) => Promise<Response>;

  constructor(config: OpenAIProviderConfig) {
    this.apiKey      = config.apiKey ?? process.env['OPENAI_API_KEY'] ?? '';
    this.model       = config.model;
    this.temperature = config.temperature ?? DEFAULT_TEMPERATURE;
    this.maxTokens   = config.maxTokens   ?? DEFAULT_MAX_TOKENS;
    this.baseUrl     = config.baseUrl     ?? DEFAULT_BASE_URL;
    this.fetchFn     = config.fetchFn     ?? ((url, init) => fetch(url, init));
  }

  /**
   * Validates the provider configuration.
   * Returns ok:true if all fields are in range, ok:false with INVALID_CONFIG otherwise.
   */
  validateConfig(): OpenAIResult<true> {
    if (!this.apiKey.trim()) {
      return err('INVALID_CONFIG', 'apiKey is required and must not be empty');
    }
    if (!this.model.trim()) {
      return err('INVALID_CONFIG', 'model is required and must not be empty');
    }
    if (this.temperature < 0 || this.temperature > 2) {
      return err('INVALID_CONFIG',
        `temperature must be between 0.0 and 2.0, got ${this.temperature}`);
    }
    if (!Number.isInteger(this.maxTokens) || this.maxTokens < 1) {
      return err('INVALID_CONFIG',
        `maxTokens must be a positive integer, got ${this.maxTokens}`);
    }
    return { ok: true, value: true };
  }

  /**
   * Returns metadata for a model.  Falls back to a generic entry for unknown IDs.
   * @param model  - Override the config model for this lookup only.
   */
  getModelInfo(model?: string): ModelInfo {
    const id = (model ?? this.model).trim();
    return KNOWN_MODELS[id] ?? {
      modelId:          id,
      maxContextTokens: 4_096,
      supportsVision:   false,
      description:      `Unknown model: ${id}`,
    };
  }

  /**
   * Sends a chat/completions request.
   *
   * Never throws — all failures are returned as { ok: false, error }.
   * Config is validated before the network call; invalid config short-circuits.
   *
   * Per-request overrides in `request` (model, temperature, maxTokens) take
   * precedence over constructor-level defaults for this call only.
   */
  async chat(request: OpenAIChatRequest): Promise<OpenAIResult<OpenAIChatResponse>> {
    const configCheck = this.validateConfig();
    if (!configCheck.ok) return configCheck;

    const model       = request.model?.trim()   || this.model;
    const temperature = request.temperature      ?? this.temperature;
    const maxTokens   = request.maxTokens        ?? this.maxTokens;

    const body: ApiRequestBody = {
      model,
      messages:    request.messages,
      temperature,
      max_tokens:  maxTokens,
    };

    let response: Response;
    try {
      response = await this.fetchFn(
        `${this.baseUrl}/chat/completions`,
        {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
        },
      );
    } catch (cause) {
      return err('NETWORK_ERROR', 'Network request failed', undefined, cause);
    }

    if (response.status === 401) {
      return err('UNAUTHORIZED', 'Unauthorized — check your API key', 401);
    }
    if (response.status === 429) {
      return err('RATE_LIMITED', 'Rate limit exceeded — retry after a delay', 429);
    }
    if (!response.ok) {
      return err('API_ERROR', `OpenAI API error: HTTP ${response.status}`, response.status);
    }

    let data: ApiResponseBody;
    try {
      data = await response.json() as ApiResponseBody;
    } catch (cause) {
      return err('PARSE_ERROR', 'Failed to parse API response as JSON', undefined, cause);
    }

    const choice = data.choices?.[0];
    if (!choice) {
      return err('PARSE_ERROR', 'API response contained no choices');
    }

    return {
      ok:    true,
      value: {
        content:      choice.message.content,
        model:        data.model,
        usage: {
          promptTokens:     data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens:      data.usage.total_tokens,
        },
        finishReason: choice.finish_reason,
      },
    };
  }

  /**
   * Streams a chat/completions response as an async sequence of StreamChunk events.
   *
   * Sends the request with `stream: true` and `stream_options.include_usage: true`
   * so that the final SSE chunk carries token-usage counts.
   *
   * Event sequence:
   *   token* → message → done   (success)
   *   error  → done             (any failure — never throws)
   */
  async *stream(request: OpenAIChatRequest): AsyncGenerator<StreamChunk> {
    const configCheck = this.validateConfig();
    if (!configCheck.ok) {
      yield sErr(configCheck.error.code, configCheck.error.message);
      yield { event: 'done' };
      return;
    }

    const model       = request.model?.trim() || this.model;
    const temperature = request.temperature   ?? this.temperature;
    const maxTokens   = request.maxTokens     ?? this.maxTokens;

    let response: Response;
    try {
      response = await this.fetchFn(
        `${this.baseUrl}/chat/completions`,
        {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages:       request.messages,
            temperature,
            max_tokens:     maxTokens,
            stream:         true,
            stream_options: { include_usage: true },
          }),
        },
      );
    } catch (cause) {
      yield sErr('NETWORK_ERROR', 'Network request failed', cause);
      yield { event: 'done' };
      return;
    }

    if (response.status === 401) {
      yield sErr('UNAUTHORIZED', 'Unauthorized — check your API key');
      yield { event: 'done' };
      return;
    }
    if (response.status === 429) {
      yield sErr('RATE_LIMITED', 'Rate limit exceeded — retry after a delay');
      yield { event: 'done' };
      return;
    }
    if (!response.ok) {
      yield sErr('API_ERROR', `OpenAI API error: HTTP ${response.status}`);
      yield { event: 'done' };
      return;
    }

    let content      = '';
    let resModel     = model;
    let finishReason = '';
    let inputTokens  = 0;
    let outputTokens = 0;
    let totalTokens  = 0;

    try {
      for await (const line of readSseLines(response)) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') break;
        let chunk: OaiSseChunk;
        try { chunk = JSON.parse(raw) as OaiSseChunk; } catch { continue; }
        if (chunk.model) resModel = chunk.model;
        if (chunk.usage) {
          inputTokens  = chunk.usage.prompt_tokens;
          outputTokens = chunk.usage.completion_tokens;
          totalTokens  = chunk.usage.total_tokens;
        }
        const choice = chunk.choices?.[0];
        if (choice?.finish_reason) finishReason = choice.finish_reason;
        const tokenText = choice?.delta?.content;
        if (tokenText) {
          content += tokenText;
          yield { event: 'token', token: tokenText };
        }
      }
    } catch (cause) {
      yield sErr('PARSE_ERROR', 'Stream read error', cause);
      yield { event: 'done' };
      return;
    }

    yield { event: 'message', content, model: resModel, finishReason, usage: { inputTokens, outputTokens, totalTokens } };
    yield { event: 'done' };
  }
}

// ─── Internal helper ──────────────────────────────────────────────────────────

function err(
  code:    OpenAIErrorCode,
  message: string,
  status?: number,
  cause?:  unknown,
): OpenAIResult<never> {
  const error: OpenAIProviderError = { code, message };
  if (status !== undefined) error.status = status;
  if (cause  !== undefined) error.cause  = cause;
  return { ok: false, error };
}

function sErr(code: string, message: string, cause?: unknown): StreamChunk {
  const e: { code: string; message: string; cause?: unknown } = { code, message };
  if (cause !== undefined) e.cause = cause;
  return { event: 'error', error: e };
}
