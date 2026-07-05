import { describe, it, expect } from 'vitest'
import { formatCitations } from '../reasoning/application/citationFormatter.ts'
import type { AppliedArticle } from '../reasoning/domain/reasoningTypes.ts'

function article(overrides: Partial<AppliedArticle>): AppliedArticle {
  return {
    itemId: 'item-1', documentSymbol: '79/2025/TT-BTC', documentType: 'CIRCULAR',
    article: 'Điều 15', clause: 'khoản 1', extractedText: 'x', role: 'PRIMARY_BASIS',
    applicabilityScore: 0.9, exceptions: [], crossReferences: [],
    ...overrides,
  }
}

describe('formatCitations', () => {
  it('formats full, short, and inline citation forms', () => {
    const [citation] = formatCitations([article({})])
    expect(citation!.full).toBe('Điều 15 khoản 1 Thông tư 79/2025/TT-BTC')
    expect(citation!.short).toBe('Đ15.1 TT 79/2025')
    expect(citation!.inline).toBe('(Điều 15 khoản 1 TT 79/2025/TT-BTC)')
  })

  it('marks only the first PRIMARY_BASIS citation as isPrimary', () => {
    const citations = formatCitations([
      article({ itemId: 'a', role: 'PRIMARY_BASIS' }),
      article({ itemId: 'b', role: 'PRIMARY_BASIS' }),
    ])
    expect(citations[0]!.isPrimary).toBe(true)
    expect(citations[1]!.isPrimary).toBe(false)
  })

  it('marks CROSS_REFERENCE and SUPERSEDED_CONTEXT roles as non-normative', () => {
    const citations = formatCitations([
      article({ itemId: 'a', role: 'CROSS_REFERENCE' }),
      article({ itemId: 'b', role: 'SUPERSEDED_CONTEXT' }),
      article({ itemId: 'c', role: 'SUPPORTING_BASIS' }),
    ])
    expect(citations[0]!.isNormative).toBe(false)
    expect(citations[1]!.isNormative).toBe(false)
    expect(citations[2]!.isNormative).toBe(true)
  })

  it('uses the document-type code (not full label) inside the inline form', () => {
    const [citation] = formatCitations([article({ documentType: 'LAW', documentSymbol: '22/2023/QH15', article: 'Điều 22', clause: undefined })])
    expect(citation!.inline).toBe('(Điều 22 Luật 22/2023/QH15)')
  })
})
