/**
 * P6-10G / P6-10H / P6-10I: ProviderManager — unified chat and streaming interface over ProviderRegistry.
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
import { type StreamChunk, type StreamResponse } from './StreamingTypes';
import { ConversationMemory }                    from './ConversationMemory';
import { RetryPolicy, type RetryOptions, type FallbackOptions, type RetryResult } from './RetryPolicy';

// ─── Config ───────────────────────────────────────────────────────────────────

export interface ProviderManagerConfig {
  registry: ProviderRegistry;
  /**
   * Optional conversation memory.  When provided:
   *   - chat() prepends stored history before each provider call and appends
   *     the new user message(s) plus the assistant reply on success.
   *   - stream() does the same; memory is updated after the generator exhausts.
   * Omit (or pass undefined) to preserve the stateless behaviour from P6-10G.
   */
  memory?: ConversationMemory;
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
  private readonly memory?:  ConversationMemory;

  constructor(config: ProviderManagerConfig) {
    this.registry = config.registry;
    this.memory   = config.memory;
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

    // ── prepend conversation memory ───────────────────────────────────────────
    const dispatchRequest: ProviderManagerRequest = this.memory
      ? { ...request, messages: [...this.memory.getMessages(), ...request.messages] }
      : request;

    // ── dispatch ──────────────────────────────────────────────────────────────
    const result = await this.dispatchChat(entry, dispatchRequest);

    // ── append to memory on success ───────────────────────────────────────────
    if (result.ok && this.memory) {
      for (const msg of request.messages) this.memory.add(msg);
      this.memory.addAssistant(result.value.content);
    }

    return result;
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

  /**
   * Streams a response from the resolved provider as an AsyncIterable<StreamChunk>.
   *
   * Provider resolution order and error semantics mirror chat().
   * Error events are yielded as StreamChunk; 'done' is always the last chunk.
   * When memory is configured, history is prepended and the assistant reply is
   * appended to memory once the generator exhausts (after 'done').
   * Never throws — use `for await (const chunk of manager.stream(request))`.
   */
  stream(request: ProviderManagerRequest): StreamResponse {
    return this.memory ? this.streamWithMemory(request) : this.streamGen(request);
  }

  // ─── private stream helpers ─────────────────────────────────────────────────

  private async *streamWithMemory(
    request: ProviderManagerRequest,
  ): AsyncGenerator<StreamChunk> {
    // Validate original request before augmenting (mirror chat() behaviour).
    if (!Array.isArray(request.messages) || request.messages.length === 0) {
      yield smgrErr('INVALID_REQUEST', 'messages must be a non-empty array');
      yield { event: 'done' };
      return;
    }

    // Prepend memory history.
    const augmented: ProviderManagerRequest = {
      ...request,
      messages: [...this.memory!.getMessages(), ...request.messages],
    };

    // Delegate to stateless streamGen, tracking outcome.
    let hadError         = false;
    let assistantContent = '';

    for await (const chunk of this.streamGen(augmented)) {
      if (chunk.event === 'error')   hadError         = true;
      if (chunk.event === 'message') assistantContent = chunk.content;
      yield chunk;
    }

    // Append to memory after the inner generator exhausts (after 'done').
    if (!hadError) {
      for (const msg of request.messages) this.memory!.add(msg);
      this.memory!.addAssistant(assistantContent);
    }
  }

  private async *streamGen(
    request: ProviderManagerRequest,
  ): AsyncGenerator<StreamChunk> {
    // ── resolve provider ──────────────────────────────────────────────────────
    let entry: ProviderEntry;

    if (request.providerId !== undefined) {
      const r = this.registry.get(request.providerId);
      if (!r.ok) {
        yield smgrErr('NO_PROVIDER', `Provider '${request.providerId}' is not registered`);
        yield { event: 'done' };
        return;
      }
      entry = r.value;
    } else {
      const r = this.registry.getDefault();
      if (!r.ok) {
        const code = r.error.code === 'NO_DEFAULT' ? 'NO_DEFAULT_PROVIDER' : 'NO_PROVIDER';
        yield smgrErr(code, r.error.message);
        yield { event: 'done' };
        return;
      }
      entry = r.value;
    }

    // ── validate request ──────────────────────────────────────────────────────
    if (!Array.isArray(request.messages) || request.messages.length === 0) {
      yield smgrErr('INVALID_REQUEST', 'messages must be a non-empty array');
      yield { event: 'done' };
      return;
    }

    // ── dispatch ──────────────────────────────────────────────────────────────
    yield* this.dispatchStream(entry, request);
  }

  private async *dispatchStream(
    entry:   ProviderEntry,
    request: ProviderManagerRequest,
  ): AsyncGenerator<StreamChunk> {
    const { provider } = entry;

    // ── OpenAI ────────────────────────────────────────────────────────────────
    if (provider instanceof OpenAIProvider) {
      const messages: OpenAIChatMessage[] = [];
      if (request.system) messages.push({ role: 'system', content: request.system });
      messages.push(...request.messages);
      yield* provider.stream({
        messages,
        model:       request.model,
        temperature: request.temperature,
        maxTokens:   request.maxTokens,
      });
      return;
    }

    // ── Claude ────────────────────────────────────────────────────────────────
    if (provider instanceof ClaudeProvider) {
      yield* provider.stream({
        messages:    request.messages,
        system:      request.system,
        model:       request.model,
        temperature: request.temperature,
        maxTokens:   request.maxTokens,
      });
      return;
    }

    // ── Gemini ────────────────────────────────────────────────────────────────
    if (provider instanceof GeminiProvider) {
      yield* provider.stream({
        messages:    request.messages,
        system:      request.system,
        model:       request.model,
        temperature: request.temperature,
        maxTokens:   request.maxTokens,
      });
      return;
    }

    // ── Unknown provider ──────────────────────────────────────────────────────
    yield smgrErr(
      'PROVIDER_ERROR',
      `Provider '${entry.id}' (type '${entry.type}') does not support stream()`,
    );
    yield { event: 'done' };
  }

  // ─── retry / fallback public API ───────────────────────────────────────────

  /**
   * Attempts the request against each provider in the fallback chain, retrying
   * transient errors up to RetryOptions.maxAttempts times per provider.
   *
   * Provider chain resolution (highest priority first):
   *   1. fallbackOptions.providerOrder (explicit)
   *   2. request.providerId first, then all other registered providers
   *   3. default provider first, then all other registered providers
   *
   * Returns a RetryResult with providerUsed, attempts, fallbackCount metadata.
   * Never throws.
   */
  async chatWithFallback(
    request:          ProviderManagerRequest,
    retryOptions?:    RetryOptions,
    fallbackOptions?: FallbackOptions,
  ): Promise<RetryResult<ProviderManagerResponse>> {
    if (!Array.isArray(request.messages) || request.messages.length === 0) {
      return {
        ok: false,
        error:         { code: 'INVALID_REQUEST', message: 'messages must be a non-empty array' },
        providerUsed:  '',
        attempts:      0,
        fallbackCount: 0,
      };
    }

    const policy      = new RetryPolicy(retryOptions);
    const providerIds = this.resolveProviderChain(request.providerId, fallbackOptions);

    if (providerIds.length === 0) {
      return {
        ok: false,
        error:         { code: 'NO_DEFAULT_PROVIDER', message: 'No providers registered' },
        providerUsed:  '',
        attempts:      0,
        fallbackCount: 0,
      };
    }

    // Prepend memory once; shared across all attempts and providers.
    const dispatchReq: ProviderManagerRequest = this.memory
      ? { ...request, messages: [...this.memory.getMessages(), ...request.messages] }
      : request;

    let totalAttempts  = 0;
    let fallbackCount  = 0;
    let lastProviderId = providerIds[0]!;
    let lastError: { code: string; message: string; cause?: unknown } = {
      code: 'PROVIDER_ERROR', message: 'All providers failed',
    };

    for (let pi = 0; pi < providerIds.length; pi++) {
      const pid = providerIds[pi]!;
      lastProviderId = pid;

      const entryResult = this.registry.get(pid);
      if (!entryResult.ok) {
        totalAttempts++;
        lastError = { code: 'NO_PROVIDER', message: entryResult.error.message };
        if (pi < providerIds.length - 1) fallbackCount++;
        continue;
      }
      const entry = entryResult.value;

      let providerSucceeded = false;

      for (let attempt = 0; attempt < policy.maxAttempts; attempt++) {
        totalAttempts++;
        const result = await this.dispatchChat(entry, dispatchReq);

        if (result.ok) {
          if (this.memory) {
            for (const msg of request.messages) this.memory.add(msg);
            this.memory.addAssistant(result.value.content);
          }
          providerSucceeded = true;
          return {
            ok:            true,
            value:         result.value,
            providerUsed:  pid,
            attempts:      totalAttempts,
            fallbackCount,
          };
        }

        lastError = result.error;
        // dispatchChat normalizes provider errors to PROVIDER_ERROR; the original
        // provider error code (RATE_LIMITED, NETWORK_ERROR, …) is preserved in cause.
        const code = (result.error.cause as { code?: string } | undefined)?.code
          ?? result.error.code;

        if (policy.isNonRetryable(code)) break;

        if (policy.isTransient(code) && attempt < policy.maxAttempts - 1) {
          await policy.sleep(attempt);
          continue;
        }

        break;
      }

      if (!providerSucceeded && pi < providerIds.length - 1) fallbackCount++;
    }

    return {
      ok: false,
      error:         lastError,
      providerUsed:  lastProviderId,
      attempts:      totalAttempts,
      fallbackCount,
    };
  }

  /**
   * Streams the response through the fallback chain with the same retry semantics
   * as chatWithFallback().
   *
   * Buffers each provider's stream attempt, then replays the successful stream.
   * Emits a 'meta' StreamChunk just before the final 'done' chunk.
   *
   * Event sequence (success):         token* → message → meta → done
   * Event sequence (all fail):        error  → meta → done
   * Event sequence (INVALID_REQUEST): error  → done  (no meta; no provider tried)
   *
   * Never throws.
   */
  async *streamWithFallback(
    request:          ProviderManagerRequest,
    retryOptions?:    RetryOptions,
    fallbackOptions?: FallbackOptions,
  ): AsyncGenerator<StreamChunk> {
    if (!Array.isArray(request.messages) || request.messages.length === 0) {
      yield { event: 'error', error: { code: 'INVALID_REQUEST', message: 'messages must be a non-empty array' } };
      yield { event: 'done' };
      return;
    }

    const policy      = new RetryPolicy(retryOptions);
    const providerIds = this.resolveProviderChain(request.providerId, fallbackOptions);

    if (providerIds.length === 0) {
      yield smgrErr('NO_DEFAULT_PROVIDER', 'No providers registered');
      yield { event: 'done' };
      return;
    }

    const augmented: ProviderManagerRequest = this.memory
      ? { ...request, messages: [...this.memory.getMessages(), ...request.messages] }
      : request;

    let totalAttempts  = 0;
    let fallbackCount  = 0;
    let lastProviderId = providerIds[0]!;
    let lastBuffered:  StreamChunk[] = [
      { event: 'error', error: { code: 'PROVIDER_ERROR', message: 'All providers failed' } },
      { event: 'done' },
    ];

    for (let pi = 0; pi < providerIds.length; pi++) {
      const pid = providerIds[pi]!;
      lastProviderId = pid;

      const entryResult = this.registry.get(pid);
      if (!entryResult.ok) {
        totalAttempts++;
        lastBuffered = [
          { event: 'error', error: { code: 'NO_PROVIDER', message: entryResult.error.message } },
          { event: 'done' },
        ];
        if (pi < providerIds.length - 1) fallbackCount++;
        continue;
      }
      const entry = entryResult.value;

      let succeeded = false;

      for (let attempt = 0; attempt < policy.maxAttempts; attempt++) {
        totalAttempts++;

        const buffered: StreamChunk[] = [];
        let   errorCode               = '';

        for await (const chunk of this.dispatchStream(entry, augmented)) {
          buffered.push(chunk);
          if (chunk.event === 'error') errorCode = chunk.error.code;
        }
        lastBuffered = buffered;

        if (!errorCode) {
          if (this.memory) {
            const msgChunk = buffered.find(c => c.event === 'message') as
              Extract<StreamChunk, { event: 'message' }> | undefined;
            for (const msg of request.messages) this.memory.add(msg);
            this.memory.addAssistant(msgChunk?.content ?? '');
          }
          succeeded = true;

          for (const chunk of buffered) {
            if (chunk.event === 'done') {
              yield { event: 'meta', providerUsed: pid, attempts: totalAttempts, fallbackCount };
            }
            yield chunk;
          }
          return;
        }

        if (policy.isNonRetryable(errorCode)) break;

        if (policy.isTransient(errorCode) && attempt < policy.maxAttempts - 1) {
          await policy.sleep(attempt);
          continue;
        }

        break;
      }

      if (!succeeded && pi < providerIds.length - 1) fallbackCount++;
    }

    // All providers failed — replay last buffered result with meta before done.
    for (const chunk of lastBuffered) {
      if (chunk.event === 'done') {
        yield { event: 'meta', providerUsed: lastProviderId, attempts: totalAttempts, fallbackCount };
      }
      yield chunk;
    }
  }

  // ─── private provider chain resolution ─────────────────────────────────────

  private resolveProviderChain(
    requestProviderId: ProviderId | undefined,
    fallbackOptions:   FallbackOptions | undefined,
  ): ProviderId[] {
    if (fallbackOptions?.providerOrder && fallbackOptions.providerOrder.length > 0) {
      return fallbackOptions.providerOrder;
    }

    const all = this.registry.list().map(e => e.id);

    if (requestProviderId !== undefined) {
      return [requestProviderId, ...all.filter(id => id !== requestProviderId)];
    }

    const defResult = this.registry.getDefault();
    if (!defResult.ok) return all;
    const defId = defResult.value.id;
    return [defId, ...all.filter(id => id !== defId)];
  }

  // ─── private chat dispatch ──────────────────────────────────────────────────

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

function smgrErr(code: string, message: string): StreamChunk {
  return { event: 'error', error: { code, message } };
}
