import { describe, it, expect } from 'vitest'
import { renderPrompt } from '../ai/application/promptRenderer.ts'
import type { PromptSpec } from '../ai/domain/aiTypes.ts'

function spec(overrides: Partial<PromptSpec> = {}): PromptSpec {
  return {
    contextId: 'ctx-1',
    sections: [
      { kind: 'SYSTEM_INSTRUCTIONS', title: 'Hướng dẫn', content: 'system rules here' },
      { kind: 'QUESTION', title: 'Câu hỏi', content: 'Mức tạm ứng tối đa là bao nhiêu?' },
      { kind: 'LEGAL_BASIS', title: 'Căn cứ', content: 'Điều 15 TT 79/2025' },
    ],
    conversationMessages: [
      { role: 'USER', content: 'Q1', timestamp: '2026-07-05T00:00:00.000Z' },
      { role: 'ASSISTANT', content: 'A1', timestamp: '2026-07-05T00:00:01.000Z' },
      { role: 'SYSTEM', content: 'sys note', timestamp: '2026-07-05T00:00:02.000Z' },
    ],
    ...overrides,
  }
}

describe('renderPrompt', () => {
  it('puts the QUESTION section content into userMessage, not system', () => {
    const rendered = renderPrompt(spec())
    expect(rendered.userMessage).toBe('Mức tạm ứng tối đa là bao nhiêu?')
    expect(rendered.system).not.toContain('Mức tạm ứng tối đa là bao nhiêu?')
  })

  it('joins all non-QUESTION sections into the system string', () => {
    const rendered = renderPrompt(spec())
    expect(rendered.system).toContain('system rules here')
    expect(rendered.system).toContain('Điều 15 TT 79/2025')
  })

  it('maps USER/ASSISTANT conversation messages to lowercase user/assistant roles', () => {
    const rendered = renderPrompt(spec())
    expect(rendered.conversationMessages).toEqual([
      { role: 'user', content: 'Q1' },
      { role: 'assistant', content: 'A1' },
    ])
  })

  it('drops SYSTEM-role conversation messages (already folded into the system section)', () => {
    const rendered = renderPrompt(spec())
    expect(rendered.conversationMessages.some(m => (m as { role: string }).role === 'system')).toBe(false)
    expect(rendered.conversationMessages).toHaveLength(2)
  })

  it('is deterministic: identical input produces identical output', () => {
    const s = spec()
    expect(renderPrompt(s)).toEqual(renderPrompt(s))
  })
})
