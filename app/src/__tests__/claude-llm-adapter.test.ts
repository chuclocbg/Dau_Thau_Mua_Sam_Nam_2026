import { describe, it, expect } from 'vitest'
import { buildClaudeLLMAdapter } from '../ai/infrastructure/adapters/claudeLLMAdapter.ts'
import type { RenderedPrompt } from '../ai/domain/aiTypes.ts'

function rendered(overrides: Partial<RenderedPrompt> = {}): RenderedPrompt {
  return {
    system: 'system instructions', userMessage: 'Mức tạm ứng tối đa là bao nhiêu?',
    conversationMessages: [{ role: 'user', content: 'Q1' }, { role: 'assistant', content: 'A1' }],
    ...overrides,
  }
}

function fakeFetch(status: number, body: unknown): (url: string, init: RequestInit) => Promise<Response> {
  return async () => new Response(JSON.stringify(body), { status })
}

describe('ClaudeLLMAdapter (offline, injected fetch — no network call)', () => {
  it('has providerId "anthropic"', () => {
    const adapter = buildClaudeLLMAdapter({ apiKey: 'test-key', fetchFn: fakeFetch(200, {}) })
    expect(adapter.providerId).toBe('anthropic')
  })

  it('returns ok:true with content/model/usage on a successful response', async () => {
    const adapter = buildClaudeLLMAdapter({
      apiKey: 'test-key',
      fetchFn: fakeFetch(200, {
        id: 'msg_1', type: 'message', role: 'assistant',
        content: [{ type: 'text', text: 'Tối đa 20%.' }],
        model: 'claude-haiku-3-5-latest', stop_reason: 'end_turn', stop_sequence: null,
        usage: { input_tokens: 50, output_tokens: 10 },
      }),
    })
    const result = await adapter.complete({ rendered: rendered(), modelId: 'claude-haiku-3-5-latest' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.content).toBe('Tối đa 20%.')
      expect(result.model).toBe('claude-haiku-3-5-latest')
      expect(result.usage).toEqual({ inputTokens: 50, outputTokens: 10 })
    }
  })

  it('returns ok:false with errorCode UNAUTHORIZED on a 401 response', async () => {
    const adapter = buildClaudeLLMAdapter({ apiKey: 'test-key', fetchFn: fakeFetch(401, {}) })
    const result = await adapter.complete({ rendered: rendered(), modelId: 'claude-haiku-3-5-latest' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errorCode).toBe('UNAUTHORIZED')
  })

  it('sends the rendered system text and conversation history plus the user message, in order', async () => {
    let capturedBody: { system?: string; messages?: { role: string; content: string }[] } | undefined
    const captureFetch = async (_url: string, init: RequestInit): Promise<Response> => {
      capturedBody = JSON.parse(init.body as string)
      return new Response(JSON.stringify({
        id: 'm', type: 'message', role: 'assistant', content: [{ type: 'text', text: 'ok' }],
        model: 'claude-haiku-3-5-latest', stop_reason: 'end_turn', stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      }), { status: 200 })
    }
    const adapter = buildClaudeLLMAdapter({ apiKey: 'test-key', fetchFn: captureFetch })
    await adapter.complete({ rendered: rendered(), modelId: 'claude-haiku-3-5-latest' })

    expect(capturedBody?.system).toBe('system instructions')
    expect(capturedBody?.messages).toEqual([
      { role: 'user', content: 'Q1' },
      { role: 'assistant', content: 'A1' },
      { role: 'user', content: 'Mức tạm ứng tối đa là bao nhiêu?' },
    ])
  })
})
