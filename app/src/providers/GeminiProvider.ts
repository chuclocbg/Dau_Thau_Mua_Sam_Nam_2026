/**
 * P6-10C / P6-10H: Google Gemini provider adapter.
 *
 * Wraps the Gemini generateContent API behind the same testable,
 * dependency-injected pattern used by OpenAIProvider (P6-10A) and
 * ClaudeProvider (P6-10B).
 *
 * Key Gemini-specific differences from the other adapters:
 *   - Auth:    API key in URL query string (?key=…), NO auth header
 *   - Endpoint: model is embedded in the path:
 *               /v1beta/models/{model}:generateContent?key={apiKey}
 *   - Request: messages are "contents", each with "parts":[{text}]
 *   - Roles:   external 'assistant' is mapped to Gemini's 'model' role
 *   - System:  "systemInstruction": { parts:[{text}] } (top-level field)
 *   - Response: candidates[0].content.parts[0].text
 *   - Usage:    usageMetadata.promptTokenCount / candidatesTokenCount / totalTokenCount
 *   - Temp:     0.0–2.0 (Gemini 2.0+ supports up to 2.0)
 *
 * Design rules (mirrors P6-10A / P6-10B):
 *   - fetchFn is injected via config — tests never touch the network.
 *   - chat() never throws — all errors are returned as { ok: false, error }.
 *   - validateConfig() is called at the start of every chat() call.
 *   - GeminiResult<T> is a discriminated union identical in shape to
 *     OpenAIResult<T> and ClaudeResult<T>.
 *   - ModelInfo is imported from OpenAIProvider — shared across all providers.
 */

import type { ModelInfo } from './OpenAIProvider';
import { type StreamChunk, readSseLines } from './StreamingTypes';

// ─── Config ───────────────────────────────────────────────────────────────────

export interface GeminiProviderConfig {
  /** API key.  When omitted the constructor falls back to process.env.GEMINI_API_KEY. */
  apiKey?:      string;
  model:        string;
  temperature?: number;   // 0.0–2.0, default 1.0
  maxTokens?:   number;   // default 1024
  baseUrl?:     string;   // default 'https://generativelanguage.googleapis.com/v1beta'
  /** Injectable fetch implementation — use a mock in tests. */
  fetchFn?:     (url: string, init: RequestInit) => Promise<Response>;
}

// ─── Request / Response ───────────────────────────────────────────────────────

/** A single conversation turn.  'assistant' is mapped to Gemini role 'model'. */
export interface GeminiChatMessage {
  role:    'user' | 'assistant';
  content: string;
}

export interface GeminiChatRequest {
  messages:     GeminiChatMessage[];
  /** Top-level system instruction, sent as Gemini's systemInstruction field. */
  system?:      string;
  /** Overrides config.model for this call only. */
  model?:       string;
  /** Overrides config.temperature for this call only. */
  temperature?: number;
  /** Overrides config.maxTokens for this call only. */
  maxTokens?:   number;
}

export interface GeminiChatResponse {
  content:      string;
  /** Gemini's modelVersion field — may be absent in some response shapes. */
  model?:       string;
  finishReason: string;   // candidates[0].finishReason, e.g. 'STOP', 'MAX_TOKENS'
  usage: {
    promptTokens:    number;   // usageMetadata.promptTokenCount
    candidateTokens: number;   // usageMetadata.candidatesTokenCount
    totalTokens:     number;   // usageMetadata.totalTokenCount
  };
}

// ─── Error types ──────────────────────────────────────────────────────────────

export type GeminiErrorCode =
  | 'INVALID_CONFIG'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'API_ERROR'
  | 'PARSE_ERROR';

export interface GeminiProviderError {
  code:    GeminiErrorCode;
  message: string;
  status?: number;
  cause?:  unknown;
}

// ─── Result discriminated union ───────────────────────────────────────────────

export type GeminiResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: GeminiProviderError };

// ─── Model info ───────────────────────────────────────────────────────────────

const KNOWN_MODELS: Readonly<Record<string, ModelInfo>> = {
  'gemini-2.5-pro': {
    modelId:          'gemini-2.5-pro',
    maxContextTokens: 2_000_000,
    supportsVision:   true,
    description:      'Gemini 2.5 Pro — 2M context, vision, most capable',
  },
  'gemini-2.5-flash': {
    modelId:          'gemini-2.5-flash',
    maxContextTokens: 1_000_000,
    supportsVision:   true,
    description:      'Gemini 2.5 Flash — 1M context, vision, fast',
  },
  'gemini-2.5-flash-lite': {
    modelId:          'gemini-2.5-flash-lite',
    maxContextTokens: 1_000_000,
    supportsVision:   true,
    description:      'Gemini 2.5 Flash-Lite — 1M context, vision, fastest/cheapest',
  },
  'gemini-1.5-pro': {
    modelId:          'gemini-1.5-pro',
    maxContextTokens: 2_000_000,
    supportsVision:   true,
    description:      'Gemini 1.5 Pro — 2M context, vision',
  },
  'gemini-1.5-flash': {
    modelId:          'gemini-1.5-flash',
    maxContextTokens: 1_000_000,
    supportsVision:   true,
    description:      'Gemini 1.5 Flash — 1M context, vision, fast',
  },
};

// ─── Internal Gemini API shapes ───────────────────────────────────────────────

interface ApiPart    { text: string; }
interface ApiContent { role: string; parts: ApiPart[]; }

interface ApiRequestBody {
  contents:           ApiContent[];
  generationConfig:   { temperature: number; maxOutputTokens: number; };
  systemInstruction?: { parts: ApiPart[]; };
}

interface ApiCandidate {
  content:      { parts: ApiPart[]; role: string; };
  finishReason: string;
  index:        number;
}

interface ApiResponseBody {
  candidates:     ApiCandidate[];
  usageMetadata?: {
    promptTokenCount:     number;
    candidatesTokenCount: number;
    totalTokenCount:      number;
  };
  modelVersion?: string;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_TEMPERATURE = 1.0;
const DEFAULT_MAX_TOKENS  = 1024;
const DEFAULT_BASE_URL    = 'https://generativelanguage.googleapis.com/v1beta';

// ─── Role mapping ─────────────────────────────────────────────────────────────

function toGeminiRole(role: GeminiChatMessage['role']): string {
  return role === 'assistant' ? 'model' : 'user';
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class GeminiProvider {
  private readonly apiKey:      string;
  private readonly model:       string;
  private readonly temperature: number;
  private readonly maxTokens:   number;
  private readonly baseUrl:     string;
  private readonly fetchFn:     (url: string, init: RequestInit) => Promise<Response>;

  constructor(config: GeminiProviderConfig) {
    this.apiKey      = config.apiKey ?? process.env['GEMINI_API_KEY'] ?? '';
    this.model       = config.model;
    this.temperature = config.temperature ?? DEFAULT_TEMPERATURE;
    this.maxTokens   = config.maxTokens   ?? DEFAULT_MAX_TOKENS;
    this.baseUrl     = config.baseUrl     ?? DEFAULT_BASE_URL;
    this.fetchFn     = config.fetchFn     ?? ((url, init) => fetch(url, init));
  }

  /**
   * Validates the provider configuration.
   * Gemini temperature range is 0.0–2.0.
   */
  validateConfig(): GeminiResult<true> {
    if (!this.apiKey.trim()) {
      return err('INVALID_CONFIG', 'apiKey is required and must not be empty');
    }
    if (!this.model.trim()) {
      return err('INVALID_CONFIG', 'model is required and must not be empty');
    }
    if (this.temperature < 0 || this.temperature > 2) {
      return err('INVALID_CONFIG',
        `temperature must be between 0.0 and 2.0 for Gemini, got ${this.temperature}`);
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
      maxContextTokens: 1_000_000,
      supportsVision:   false,
      description:      `Unknown Gemini model: ${id}`,
    };
  }

  /**
   * Sends a request to the Gemini generateContent API.
   *
   * Never throws — all failures are returned as { ok: false, error }.
   * Config is validated before the network call; invalid config short-circuits.
   *
   * The API key is embedded in the URL query string (Gemini authentication
   * does not use an Authorization header).
   */
  async chat(request: GeminiChatRequest): Promise<GeminiResult<GeminiChatResponse>> {
    const configCheck = this.validateConfig();
    if (!configCheck.ok) return configCheck;

    const model       = request.model?.trim() || this.model;
    const temperature = request.temperature   ?? this.temperature;
    const maxTokens   = request.maxTokens     ?? this.maxTokens;

    const contents: ApiContent[] = request.messages.map(msg => ({
      role:  toGeminiRole(msg.role),
      parts: [{ text: msg.content }],
    }));

    const body: ApiRequestBody = {
      contents,
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    };
    if (request.system !== undefined) {
      body.systemInstruction = { parts: [{ text: request.system }] };
    }

    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
    } catch (cause) {
      return err('NETWORK_ERROR', 'Network request failed', undefined, cause);
    }

    if (response.status === 401 || response.status === 403) {
      return err('UNAUTHORIZED',
        `Unauthorized — check your Gemini API key (HTTP ${response.status})`,
        response.status);
    }
    if (response.status === 429) {
      return err('RATE_LIMITED', 'Rate limit exceeded — retry after a delay', 429);
    }
    if (!response.ok) {
      return err('API_ERROR', `Gemini API error: HTTP ${response.status}`, response.status);
    }

    let data: ApiResponseBody;
    try {
      data = await response.json() as ApiResponseBody;
    } catch (cause) {
      return err('PARSE_ERROR', 'Failed to parse Gemini API response as JSON', undefined, cause);
    }

    const candidate = data.candidates?.[0];
    if (!candidate) {
      return err('PARSE_ERROR', 'Gemini API response contained no candidates');
    }

    const part = candidate.content?.parts?.[0];
    if (!part || part.text === undefined) {
      return err('PARSE_ERROR', 'Gemini API candidate contained no text part');
    }

    const meta = data.usageMetadata;

    return {
      ok:    true,
      value: {
        content:      part.text,
        model:        data.modelVersion,
        finishReason: candidate.finishReason,
        usage: {
          promptTokens:    meta?.promptTokenCount     ?? 0,
          candidateTokens: meta?.candidatesTokenCount ?? 0,
          totalTokens:     meta?.totalTokenCount      ?? 0,
        },
      },
    };
  }

  /**
   * Streams a streamGenerateContent response as an async sequence of StreamChunk events.
   *
   * Uses the `?alt=sse` endpoint so each data line is an incremental
   * ApiResponseBody.  Text parts are yielded as 'token' chunks; usage
   * metadata from the final chunk populates the closing 'message' chunk.
   *
   * Event sequence:
   *   token* → message → done   (success)
   *   error  → done             (any failure — never throws)
   */
  async *stream(request: GeminiChatRequest): AsyncGenerator<StreamChunk> {
    const configCheck = this.validateConfig();
    if (!configCheck.ok) {
      yield sErr(configCheck.error.code, configCheck.error.message);
      yield { event: 'done' };
      return;
    }

    const model       = request.model?.trim() || this.model;
    const temperature = request.temperature   ?? this.temperature;
    const maxTokens   = request.maxTokens     ?? this.maxTokens;

    const contents: ApiContent[] = request.messages.map(msg => ({
      role:  toGeminiRole(msg.role),
      parts: [{ text: msg.content }],
    }));

    const body: ApiRequestBody = {
      contents,
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    };
    if (request.system !== undefined) {
      body.systemInstruction = { parts: [{ text: request.system }] };
    }

    const url = `${this.baseUrl}/models/${model}:streamGenerateContent?key=${this.apiKey}&alt=sse`;

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
    } catch (cause) {
      yield sErr('NETWORK_ERROR', 'Network request failed', cause);
      yield { event: 'done' };
      return;
    }

    if (response.status === 401 || response.status === 403) {
      yield sErr('UNAUTHORIZED', `Unauthorized — check your Gemini API key (HTTP ${response.status})`);
      yield { event: 'done' };
      return;
    }
    if (response.status === 429) {
      yield sErr('RATE_LIMITED', 'Rate limit exceeded — retry after a delay');
      yield { event: 'done' };
      return;
    }
    if (!response.ok) {
      yield sErr('API_ERROR', `Gemini API error: HTTP ${response.status}`);
      yield { event: 'done' };
      return;
    }

    let content      = '';
    let resModel:    string | undefined;
    let finishReason = '';
    let inputTokens  = 0;
    let outputTokens = 0;
    let totalTokens  = 0;

    try {
      for await (const line of readSseLines(response)) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        let chunk: ApiResponseBody;
        try { chunk = JSON.parse(raw) as ApiResponseBody; } catch { continue; }
        if (chunk.modelVersion) resModel = chunk.modelVersion;
        if (chunk.usageMetadata) {
          inputTokens  = chunk.usageMetadata.promptTokenCount;
          outputTokens = chunk.usageMetadata.candidatesTokenCount;
          totalTokens  = chunk.usageMetadata.totalTokenCount;
        }
        const candidate = chunk.candidates?.[0];
        if (candidate?.finishReason) finishReason = candidate.finishReason;
        const text = candidate?.content?.parts?.[0]?.text ?? '';
        if (text) { content += text; yield { event: 'token', token: text }; }
      }
    } catch (cause) {
      yield sErr('PARSE_ERROR', 'Stream read error', cause);
      yield { event: 'done' };
      return;
    }

    yield {
      event:        'message',
      content,
      model:        resModel,
      finishReason,
      usage: { inputTokens, outputTokens, totalTokens },
    };
    yield { event: 'done' };
  }
}

// ─── Internal helper ──────────────────────────────────────────────────────────

function err(
  code:    GeminiErrorCode,
  message: string,
  status?: number,
  cause?:  unknown,
): GeminiResult<never> {
  const error: GeminiProviderError = { code, message };
  if (status !== undefined) error.status = status;
  if (cause  !== undefined) error.cause  = cause;
  return { ok: false, error };
}

function sErr(code: string, message: string, cause?: unknown): StreamChunk {
  const e: { code: string; message: string; cause?: unknown } = { code, message };
  if (cause !== undefined) e.cause = cause;
  return { event: 'error', error: e };
}
