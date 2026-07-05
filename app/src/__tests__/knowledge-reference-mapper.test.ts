import { describe, it, expect } from 'vitest'
import { toKnowledgeItemRef, toLegalBasisRef } from '../reasoning/application/knowledgeReferenceMapper.ts'
import type { KnowledgeReference, KnowledgeReferenceLegalBasis } from '../reasoning/domain/knowledgeReferenceTypes.ts'

function legalBasis(overrides: Partial<KnowledgeReferenceLegalBasis> = {}): KnowledgeReferenceLegalBasis {
  return { document: '79/2025/TT-BTC', article: 'Điều 15', clause: 'khoản 1', ...overrides }
}

function reference(overrides: Partial<KnowledgeReference> = {}): KnowledgeReference {
  return {
    id: 'item-1', domain: 'legal', type: 'CIRCULAR', title: 'Thông tư 79/2025/TT-BTC',
    summary: 'Mức tạm ứng tối đa 30%.', legalBasis: [legalBasis()], metadata: { concept: 'ADVANCE_PAYMENT' },
    confidence: 0.9, layer: 1, createdAt: '2026-01-10T00:00:00.000Z', updatedAt: '2026-01-10T00:00:00.000Z',
    ...overrides,
  }
}

describe('toLegalBasisRef', () => {
  it('renames document to documentSymbol', () => {
    const ref = toLegalBasisRef(legalBasis({ document: '22/2023/QH15' }))
    expect(ref.documentSymbol).toBe('22/2023/QH15')
  })

  it('preserves article/clause/point', () => {
    const ref = toLegalBasisRef(legalBasis({ article: 'Điều 22', clause: 'khoản 2', point: 'điểm a' }))
    expect(ref).toEqual({ documentSymbol: '79/2025/TT-BTC', article: 'Điều 22', clause: 'khoản 2', point: 'điểm a' })
  })

  it('drops LegalBasis-only fields with no destination in LegalBasisRef', () => {
    const ref = toLegalBasisRef(legalBasis({
      documentNumber: '79-X', appendix: 'Phụ lục I', effectiveDate: '2025-03-15',
      issuingAuthority: 'Bộ Tài chính', summary: 'note', url: 'https://example.test',
    }))
    expect(ref).not.toHaveProperty('documentNumber')
    expect(ref).not.toHaveProperty('appendix')
    expect(ref).not.toHaveProperty('effectiveDate')
    expect(ref).not.toHaveProperty('issuingAuthority')
    expect(ref).not.toHaveProperty('summary')
    expect(ref).not.toHaveProperty('url')
  })

  it('leaves article/clause/point undefined when absent, never invents a value', () => {
    const ref = toLegalBasisRef({ document: 'X/2025' })
    expect(ref.article).toBeUndefined()
    expect(ref.clause).toBeUndefined()
    expect(ref.point).toBeUndefined()
  })
})

describe('toKnowledgeItemRef', () => {
  it('maps basic fields verbatim', () => {
    const { item } = toKnowledgeItemRef(reference())
    expect(item.itemId).toBe('item-1')
    expect(item.domain).toBe('legal')
    expect(item.type).toBe('CIRCULAR')
    expect(item.title).toBe('Thông tư 79/2025/TT-BTC')
    expect(item.summary).toBe('Mức tạm ứng tối đa 30%.')
    expect(item.confidence).toBe(0.9)
    expect(item.layer).toBe(1)
  })

  it('maps every legalBasis entry via toLegalBasisRef', () => {
    const { item } = toKnowledgeItemRef(reference({
      legalBasis: [legalBasis({ document: 'A/2025' }), legalBasis({ document: 'B/2025' })],
    }))
    expect(item.legalBasis).toHaveLength(2)
    expect(item.legalBasis[0]!.documentSymbol).toBe('A/2025')
    expect(item.legalBasis[1]!.documentSymbol).toBe('B/2025')
  })

  it('maps an empty legalBasis array to an empty array, not undefined', () => {
    const { item } = toKnowledgeItemRef(reference({ legalBasis: [] }))
    expect(item.legalBasis).toEqual([])
  })

  it('passes metadata through unchanged', () => {
    const { item } = toKnowledgeItemRef(reference({ metadata: { conflictDimension: 'X', conflictValue: '0.3' } }))
    expect(item.metadata).toEqual({ conflictDimension: 'X', conflictValue: '0.3' })
  })

  it('uses effectivePeriod.startDate/endDate when present, with no fallback assumption', () => {
    const { item, effectivePeriodAssumedFromCreation } = toKnowledgeItemRef(reference({
      effectivePeriod: { startDate: '2025-03-15', endDate: '2026-12-31' },
    }))
    expect(item.effectiveFrom).toBe('2025-03-15')
    expect(item.effectiveTo).toBe('2026-12-31')
    expect(effectivePeriodAssumedFromCreation).toBe(false)
  })

  it('falls back to createdAt (date portion) when effectivePeriod is absent, and flags the assumption', () => {
    const { item, effectivePeriodAssumedFromCreation } = toKnowledgeItemRef(reference({
      effectivePeriod: undefined, createdAt: '2026-02-20T08:30:00.000Z',
    }))
    expect(item.effectiveFrom).toBe('2026-02-20')
    expect(item.effectiveTo).toBeUndefined()
    expect(effectivePeriodAssumedFromCreation).toBe(true)
  })

  it('never fabricates an effectiveTo when effectivePeriod is open-ended (no endDate)', () => {
    const { item } = toKnowledgeItemRef(reference({ effectivePeriod: { startDate: '2025-01-01' } }))
    expect(item.effectiveTo).toBeUndefined()
  })
})
