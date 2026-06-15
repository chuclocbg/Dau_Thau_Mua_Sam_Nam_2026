/**
 * P6-10G: ProviderManager — unified chat interface over ProviderRegistry.
 *
 * Wraps a ProviderRegistry and provides a single chat() entry point that:
 *   1. Resolves the target provider (per-request override or registry default).
 *   2. Validates the request.
 *   3. Dispatches to the correct concrete provider via instanceof narrowing.
 *   4. Normalizes the divergent response shapes into a single ProviderManagerResponse.
 *
 * Dispatch strategy:
 *   instanceof OpenAIProvider → system message prepended as role:'system' message
 *   instanceof ClaudeProvider → system passed as top-level system field
 *   instanceof GeminiProvider → system passed as systemInstruction field
 *   unknown ILLMProvider     → PROVIDER_ERROR (no chat() support)
 *
 * Usage normalization:
 *   OpenAI:  promptTokens/completionTokens → inputTokens/outputTokens
 *   Claude:  inputTokens/outputTokens pass through unchanged
 *   Gemini:  promptTokens/candidateTokens → inputTokens/outputTokens
 *
 * Never throws — all errors return as { ok: false, error: ProviderManagerError }.
 * All existing provider interfaces and registry behaviour are preserved.
 */

import { OpenAIProvider, type OpenAIChatMessage } from './OpenAIProvider';
import { ClaudeProvider }                         from './ClaudeProvider';
import { GeminiProvider }                         from './GeminiProvider';
import {
  ProviderRegistry,
  type ProviderEntry,
  type ProviderId,
} from './ProviderRegistry';

// ─── Config ───────────────────────────────────────────────────────────────────

export interface ProviderManagerConfig {
  registry: ProviderRegistry;
}

// ─── Normalized request ───────────────────────────────────────────────────────

export interface ProviderManagerMessage {
  role:    'user' | 'assistant';
  content: string;
}

export interface ProviderManagerRequest {
  messages:     ProviderManagerMessage[];
  /** Optional system prompt.  Dispatched per-provider (see module comment). */
  system?:      string;
  /** Override the provider for this call.  Falls back to registry default. */
  providerId?:  ProviderId;
  /** Per-call model override forwarded to the concrete provider. */
  model?:       string;
  temperature?: number;
  maxTokens?:   number;
}

// ─── Normalized response ──────────────────────────────────────────────────────

export interface ProviderManagerResponse {
  content:      string;
  /** The ProviderId of the provider that handled this request. */
  providerId:   ProviderId;
  /** The ProviderType (openai | anthropic | google). */
  providerType: string;
  /** Model as reported by the provider response (may be undefined for some). */
  model?:       string;
  usage: {
    inputTokens:  number;   // prompt tokens (all providers)
    outputTokens: number;   // completion / candidate tokens
    totalTokens:  number;
  };
  finishReason?: string;   // stop reason / finish reason (provider-specific value)
}

// ─── Error types ──────────────────────────────────────────────────────────────

export type ProviderManagerErrorCode =
  | 'NO_PROVIDER'          // explicit providerId not registered
  | 'NO_DEFAULT_PROVIDER'  // no default set and no providerId in request
  | 'PROVIDER_ERROR'       // underlying provider returned an error
  | 'INVALID_REQUEST';     // request validation failed

export interface ProviderManagerError {
  code:    ProviderManagerErrorCode;
  message: string;
  cause?:  unknown;
}

// ─── Result type ──────────────────────────────────────────────────────────────

export type ProviderManagerResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: ProviderManagerError };

// ─── ProviderManager ──────────────────────────────────────────────────────────

export class ProviderManager {
  private readonly registry: ProviderRegistry;

  constructor(config: ProviderManagerConfig) {
    this.registry = config.registry;
  }

  /**
   * Sends a chat request to the resolved provider.
   *
   * Provider resolution order:
   *   1. request.providerId (explicit)
   *   2. registry.getDefault()
   * Returns NO_PROVIDER / NO_DEFAULT_PROVIDER when resolution fails.
   * Returns INVALID_REQUEST when messages is empty.
   * Returns PROVIDER_ERROR when the underlying provider call fails.
   */
  async chat(
    request: ProviderManagerRequest,
  ): Promise<ProviderManagerResult<ProviderManagerResponse>> {
    // ── resolve provider ──────────────────────────────────────────────────────
    let entry: ProviderEntry;

    if (request.providerId !== undefined) {
      const r = this.registry.get(request.providerId);
      if (!r.ok) {
        return mgrErr(
          'NO_PROVIDER',
          `Provider '${request.providerId}' is not registered`,
        );
      }
      entry = r.value;
    } else {
      const r = this.registry.getDefault();
      if (!r.ok) {
        const code = r.error.code === 'NO_DEFAULT' ? 'NO_DEFAULT_PROVIDER' : 'NO_PROVIDER';
        return mgrErr(code, r.error.message);
      }
      entry = r.value;
    }

    // ── validate request ──────────────────────────────────────────────────────
    if (!Array.isArray(request.messages) || request.messages.length === 0) {
      return mgrErr('INVALID_REQUEST', 'messages must be a non-empty array');
    }

    // ── dispatch ──────────────────────────────────────────────────────────────
    return this.dispatchChat(entry, request);
  }

  /** Returns the registry entry for the given id, or NO_PROVIDER. */
  getProvider(id: ProviderId): ProviderManagerResult<ProviderEntry> {
    const r = this.registry.get(id);
    if (!r.ok) return mgrErr('NO_PROVIDER', r.error.message);
    return { ok: true, value: r.value };
  }

  /** Returns the current default provider entry, or NO_DEFAULT_PROVIDER. */
  getDefaultProvider(): ProviderManagerResult<ProviderEntry> {
    const r = this.registry.getDefault();
    if (!r.ok) {
      const code = r.error.code === 'NO_DEFAULT' ? 'NO_DEFAULT_PROVIDER' : 'NO_PROVIDER';
      return mgrErr(code, r.error.message);
    }
    return { ok: true, value: r.value };
  }

  /**
   * Sets the default provider by id.
   *
   * The id must be registered in the registry.
   * Returns NO_PROVIDER when the id is not found.
   */
  setDefaultProvider(id: ProviderId): ProviderManagerResult<ProviderId> {
    const r = this.registry.setDefault(id);
    if (!r.ok) return mgrErr('NO_PROVIDER', r.error.message);
    return { ok: true, value: r.value };
  }

  /** Returns all registered provider entries.  Never fails. */
  listProviders(): ProviderEntry[] {
    return this.registry.list();
  }

  // ─── private dispatch ───────────────────────────────────────────────────────

  private async dispatchChat(
    entry:   ProviderEntry,
    request: ProviderManagerRequest,
  ): Promise<ProviderManagerResult<ProviderManagerResponse>> {
    const { provider } = entry;

    // ── OpenAI ────────────────────────────────────────────────────────────────
    if (provider instanceof OpenAIProvider) {
      const messages: OpenAIChatMessage[] = [];
      if (request.system) {
        messages.push({ role: 'system', content: request.system });
      }
      messages.push(...request.messages);

      const r = await provider.chat({
        messages,
        model:       request.model,
        temperature: request.temperature,
        maxTokens:   request.maxTokens,
      });

      if (!r.ok) return mgrErr('PROVIDER_ERROR', r.error.message, r.error);

      return {
        ok:    true,
        value: {
          content:      r.value.content,
          providerId:   entry.id,
          providerType: entry.type,
          model:        r.value.model,
          usage: {
            inputTokens:  r.value.usage.promptTokens,
            outputTokens: r.value.usage.completionTokens,
            totalTokens:  r.value.usage.totalTokens,
          },
          finishReason: r.value.finishReason,
        },
      };
    }

    // ── Claude ────────────────────────────────────────────────────────────────
    if (provider instanceof ClaudeProvider) {
      const r = await provider.chat({
        messages:    request.messages,
        system:      request.system,
        model:       request.model,
        temperature: request.temperature,
        maxTokens:   request.maxTokens,
      });

      if (!r.ok) return mgrErr('PROVIDER_ERROR', r.error.message, r.error);

      return {
        ok:    true,
        value: {
          content:      r.value.content,
          providerId:   entry.id,
          providerType: entry.type,
          model:        r.value.model,
          usage: {
            inputTokens:  r.value.usage.inputTokens,
            outputTokens: r.value.usage.outputTokens,
            totalTokens:  r.value.usage.totalTokens,
          },
          finishReason: r.value.stopReason,
        },
      };
    }

    // ── Gemini ────────────────────────────────────────────────────────────────
    if (provider instanceof GeminiProvider) {
      const r = await provider.chat({
        messages:    request.messages,
        system:      request.system,
        model:       request.model,
        temperature: request.temperature,
        maxTokens:   request.maxTokens,
      });

      if (!r.ok) return mgrErr('PROVIDER_ERROR', r.error.message, r.error);

      return {
        ok:    true,
        value: {
          content:      r.value.content,
          providerId:   entry.id,
          providerType: entry.type,
          model:        r.value.model,
          usage: {
            inputTokens:  r.value.usage.promptTokens,
            outputTokens: r.value.usage.candidateTokens,
            totalTokens:  r.value.usage.totalTokens,
          },
          finishReason: r.value.finishReason,
        },
      };
    }

    // ── Unknown provider (custom ILLMProvider without chat()) ─────────────────
    return mgrErr(
      'PROVIDER_ERROR',
      `Provider '${entry.id}' (type '${entry.type}') does not support chat()`,
    );
  }
}

// ─── Internal helper ──────────────────────────────────────────────────────────

function mgrErr<T>(
  code:    ProviderManagerErrorCode,
  message: string,
  cause?:  unknown,
): ProviderManagerResult<T> {
  const error: ProviderManagerError = { code, message };
  if (cause !== undefined) error.cause = cause;
  return { ok: false, error };
}
