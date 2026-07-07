import { describe, it, expect } from 'vitest'
import { formatConversationResponse } from '../reasoning/application/outputFormatter.ts'
import type { ReasoningAnswerResult } from '../reasoning/domain/reasoningAnswerTypes.ts'
import type { FormattedCitation } from '../reasoning/domain/reasoningTypes.ts'

function citation(overrides: Partial<FormattedCitation> = {}): FormattedCitation {
  return {
    citationId: 'citation-1', itemId: 'item-1', documentSymbol: 'X/2025',
    full: 'Luật X/2025', short: 'X/2025', inline: '(Luật X/2025)',
    role: 'PRIMARY_BASIS', isNormative: true, isPrimary: true,
    ...overrides,
  }
}

function answer(overrides: Partial<ReasoningAnswerResult> = {}): ReasoningAnswerResult {
  return {
    decision: null,
    primaryCitations: [], supportingCitations: [], disputedCitations: [],
    confidenceSummary: { baseScore: 1, deductions: [], finalScore: 1, label: 'HIGH' },
    conflicts: [],
    composedAt: '2026-07-07T00:00:00.000Z',
    ...overrides,
  }
}

describe('formatConversationResponse — section structure', () => {
  it('always includes a decision section and a confidence section', () => {
    const response = formatConversationResponse(answer())
    expect(response.sections.map(s => s.heading)).toContain('Kết luận')
    expect(response.sections.map(s => s.heading)).toContain('Độ tin cậy')
  })

  it('includes a primary-citations section only when primaryCitations is non-empty', () => {
    const withPrimary = formatConversationResponse(answer({ primaryCitations: [citation()] }))
    const withoutPrimary = formatConversationResponse(answer())
    expect(withPrimary.sections.map(s => s.heading)).toContain('Căn cứ pháp lý chính')
    expect(withoutPrimary.sections.map(s => s.heading)).not.toContain('Căn cứ pháp lý chính')
  })

  it('includes a disputed-citations section only when disputedCitations is non-empty AND includeDisputedCitations is not false', () => {
    const disputed = [citation({ itemId: 'd-1', role: 'CONFLICT_SOURCE', isPrimary: false })]
    const included = formatConversationResponse(answer({ disputedCitations: disputed }))
    const excluded = formatConversationResponse(answer({ disputedCitations: disputed }), { includeDisputedCitations: false })
    expect(included.sections.map(s => s.heading)).toContain('Nội dung còn tranh chấp')
    expect(excluded.sections.map(s => s.heading)).not.toContain('Nội dung còn tranh chấp')
  })

  it('the confidence section body displays the label and a percentage, without recomputation', () => {
    const response = formatConversationResponse(answer({
      confidenceSummary: { baseScore: 1, deductions: [], finalScore: 0.85, label: 'HIGH' },
    }))
    const confidenceSection = response.sections.find(s => s.heading === 'Độ tin cậy')!
    expect(confidenceSection.body).toBe('**HIGH** (85%)')
  })
})

describe('formatConversationResponse — citation placement and ordering', () => {
  it('lists citations in their original order, never re-sorted', () => {
    const citations = [citation({ itemId: 'c' }), citation({ itemId: 'a' }), citation({ itemId: 'b' })]
    const response = formatConversationResponse(answer({ primaryCitations: citations }))
    const primarySection = response.sections.find(s => s.heading === 'Căn cứ pháp lý chính')!
    expect(primarySection.body.split('\n')).toEqual(citations.map(c => `- ${c.full}`))
  })

  it('truncates each section to maxCitationsPerSection when provided, preserving order', () => {
    const citations = Array.from({ length: 5 }, (_, i) => citation({ itemId: `item-${i}`, full: `Luật ${i}` }))
    const response = formatConversationResponse(answer({ primaryCitations: citations }), { maxCitationsPerSection: 2 })
    const primarySection = response.sections.find(s => s.heading === 'Căn cứ pháp lý chính')!
    expect(primarySection.body).toBe('- Luật 0\n- Luật 1')
  })

  it('citationCount reflects the total across all three buckets', () => {
    const response = formatConversationResponse(answer({
      primaryCitations: [citation({ itemId: 'p' })],
      supportingCitations: [citation({ itemId: 's', role: 'SUPPORTING_BASIS', isPrimary: false })],
      disputedCitations: [citation({ itemId: 'd', role: 'CONFLICT_SOURCE', isPrimary: false })],
    }))
    expect(response.citationCount).toBe(3)
  })
})

describe('formatConversationResponse — localization', () => {
  it('defaults to Vietnamese section headings', () => {
    const response = formatConversationResponse(answer())
    expect(response.language).toBe('vi')
    expect(response.sections[0]!.heading).toBe('Kết luận')
  })

  it('uses English section headings when language option is "en"', () => {
    const response = formatConversationResponse(answer(), { language: 'en' })
    expect(response.language).toBe('en')
    expect(response.sections[0]!.heading).toBe('Conclusion')
  })
})

describe('formatConversationResponse — markdown assembly', () => {
  it('joins every section as a level-2 markdown heading followed by its body', () => {
    const response = formatConversationResponse(answer())
    expect(response.markdown).toContain('## Kết luận')
    expect(response.markdown).toContain('## Độ tin cậy')
  })
})

describe('formatConversationResponse — immutability and determinism', () => {
  it('deep-freezes the result', () => {
    const response = formatConversationResponse(answer())
    expect(Object.isFrozen(response)).toBe(true)
    expect(Object.isFrozen(response.sections)).toBe(true)
    expect(() => { (response as { markdown: string }).markdown = 'x' }).toThrow()
  })

  it('never mutates its input', () => {
    const input = answer({ primaryCitations: [citation()] })
    formatConversationResponse(input)
    expect(input.primaryCitations[0]!.itemId).toBe('item-1')
  })

  it('is a pure function: identical input produces identical output (aside from formattedAt)', () => {
    const input = answer({ primaryCitations: [citation()], decision: 'x' })
    const first = formatConversationResponse(input)
    const second = formatConversationResponse(input)
    expect(first.markdown).toBe(second.markdown)
    expect(first.sections).toEqual(second.sections)
    expect(first.warnings).toEqual(second.warnings)
  })
})
