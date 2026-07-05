import type { PromptSpec, RenderedChatMessage, RenderedPrompt } from '../domain/aiTypes.ts'

// ── PromptRenderer — deterministic rendering only ──────────────────────────────
// Per this milestone's mandatory requirement 5: no provider logic. Produces a
// provider-agnostic { system, userMessage, conversationMessages } shape — a
// system/user/assistant three-part chat format is common to every major LLM API,
// not an Anthropic-specific concept. Only the ClaudeLLMAdapter (or a future
// OpenAI/Gemini adapter) knows how to translate this into its own wire format.

const NON_SYSTEM_ROLE_MAP: Readonly<Record<'USER' | 'ASSISTANT', RenderedChatMessage['role']>> = Object.freeze({
  USER: 'user', ASSISTANT: 'assistant',
})

export function renderPrompt(spec: PromptSpec): RenderedPrompt {
  const questionSection = spec.sections.find(s => s.kind === 'QUESTION')
  const systemText = spec.sections
    .filter(s => s.kind !== 'QUESTION')
    .map(s => `## ${s.title}\n${s.content}`)
    .join('\n\n')

  const conversationMessages: RenderedChatMessage[] = spec.conversationMessages
    .filter((m): m is typeof m & { role: 'USER' | 'ASSISTANT' } => m.role === 'USER' || m.role === 'ASSISTANT')
    .map(m => ({ role: NON_SYSTEM_ROLE_MAP[m.role], content: m.content }))

  return {
    system: systemText,
    userMessage: questionSection?.content ?? '',
    conversationMessages,
  }
}
