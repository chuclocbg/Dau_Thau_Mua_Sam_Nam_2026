import { describe, it, expect } from 'vitest'
import { parseThresholdMetadata } from '../reasoning/application/thresholdMetadataParser.ts'
import type { KnowledgeItemRef, ThresholdMetadata } from '../reasoning/domain/reasoningTypes.ts'

function item(metadata: Readonly<Record<string, unknown>> = {}): KnowledgeItemRef {
  return {
    itemId: 'threshold-item-1', domain: 'legal', type: 'DECREE', title: 't', summary: 's', confidence: 0.9,
    layer: 1, legalBasis: [], metadata, effectiveFrom: '2025-01-01',
  }
}

const validThreshold: ThresholdMetadata = {
  thresholdCode: 'TC-1', thresholdType: 'PROCUREMENT_METHOD_CEILING',
  contextField: 'estimatedValue', operator: 'LTE', value: '500000000', unit: 'VND',
}

describe('parseThresholdMetadata', () => {
  it('returns null when the item has no thresholdDefinition metadata key at all', () => {
    expect(parseThresholdMetadata(item())).toBeNull()
  })

  it('parses a well-formed JSON thresholdDefinition into a ThresholdKnowledgeItemRef', () => {
    const result = parseThresholdMetadata(item({ thresholdDefinition: JSON.stringify(validThreshold) }))
    expect(result).not.toBeNull()
    expect(result!.ok).toBe(true)
    if (result!.ok) {
      expect(result!.item.threshold).toEqual(validThreshold)
      expect(result!.item.itemId).toBe('threshold-item-1')
    }
  })

  it('produces a critical MissingEvidence entry, never throws, on malformed JSON', () => {
    expect(() => parseThresholdMetadata(item({ thresholdDefinition: '{not valid json' }))).not.toThrow()
    const result = parseThresholdMetadata(item({ thresholdDefinition: '{not valid json' }))
    expect(result!.ok).toBe(false)
    if (!result!.ok) expect(result!.missingEvidence.isCritical).toBe(true)
  })

  it('produces a critical MissingEvidence entry, never throws, on an invalid operator/unit', () => {
    const bad = JSON.stringify({ ...validThreshold, operator: 'WEIRD', unit: 'BANANAS' })
    const result = parseThresholdMetadata(item({ thresholdDefinition: bad }))
    expect(result!.ok).toBe(false)
    if (!result!.ok) expect(result!.missingEvidence.description).toContain('threshold-item-1')
  })

  it('never coerces a non-string metadata value into a parse attempt', () => {
    expect(parseThresholdMetadata(item({ thresholdDefinition: 12345 }))).toBeNull()
  })
})
