import { ClaudeProvider } from '../../../providers/ClaudeProvider.ts'
import type { ClaudeChatMessage } from '../../../providers/ClaudeProvider.ts'
import type { ILLMAdapter, LLMAdapterRequest, LLMAdapterResult } from '../../domain/aiTypes.ts'

// ── ClaudeLLMAdapter — the outer boundary ──────────────────────────────────────
// Per this milestone's mandatory requirement 7: all Anthropic SDK types
// (ClaudeChatMessage, ClaudeProviderConfig, ClaudeResult, etc.) stay inside this
// file's imports — only the provider-agnostic ILLMAdapter/LLMAdapterRequest/
// LLMAdapterResult shapes are exported. Per the architecture gate review's
// recommendation E: wraps the existing, tested src/providers/ClaudeProvider.ts
// (P6 track) rather than reimplementing raw Anthropic HTTP calls. No streaming
// (provider.chat() only), no retry, no caching — all explicitly out of scope
// for this milestone.

export interface ClaudeLLMAdapterConfig {
  readonly apiKey?: string
  readonly fetchFn?: (url: string, init: RequestInit) => Promise<Response>
}

export class ClaudeLLMAdapter implements ILLMAdapter {
  readonly providerId = 'anthropic'
  private readonly provider: ClaudeProvider

  constructor(config: ClaudeLLMAdapterConfig, defaultModel: string) {
    this.provider = new ClaudeProvider({
      apiKey: config.apiKey, model: defaultModel,
      ...(config.fetchFn !== undefined ? { fetchFn: config.fetchFn } : {}),
    })
  }

  async complete(request: LLMAdapterRequest): Promise<LLMAdapterResult> {
    const messages: ClaudeChatMessage[] = [
      ...request.rendered.conversationMessages.map((m): ClaudeChatMessage => ({ role: m.role, content: m.content })),
      { role: 'user', content: request.rendered.userMessage },
    ]

    const result = await this.provider.chat({
      system: request.rendered.system,
      messages,
      model: request.modelId,
      ...(request.maxOutputTokens !== undefined ? { maxTokens: request.maxOutputTokens } : {}),
    })

    if (!result.ok) {
      return { ok: false, errorCode: result.error.code, message: result.error.message }
    }

    return {
      ok: true, content: result.value.content, model: result.value.model,
      usage: { inputTokens: result.value.usage.inputTokens, outputTokens: result.value.usage.outputTokens },
    }
  }
}

export function buildClaudeLLMAdapter(
  config: ClaudeLLMAdapterConfig = {}, defaultModel = 'claude-haiku-3-5-latest',
): ClaudeLLMAdapter {
  return new ClaudeLLMAdapter(config, defaultModel)
}
