import { describe, it, expect } from 'vitest'
import { parseRuleMetadata } from '../reasoning/application/ruleMetadataParser.ts'
import type { EvaluationRuleMetadata, KnowledgeItemRef } from '../reasoning/domain/reasoningTypes.ts'

function item(metadata: Readonly<Record<string, unknown>> = {}): KnowledgeItemRef {
  return {
    itemId: 'rule-item-1', domain: 'legal', type: 'LAW', title: 't', summary: 's', confidence: 0.9,
    layer: 1, legalBasis: [], metadata, effectiveFrom: '2025-01-01',
  }
}

const validRule: EvaluationRuleMetadata = {
  ruleCode: 'RC-1', ruleCategory: 'PROCUREMENT_METHOD',
  conditions: [{ field: 'estimatedValue', operator: 'GTE', value: '100000000', unit: 'VND' }],
  outcome: { pass: 'Method A applies', fail: 'Method A does not apply' },
  isCritical: true,
}

describe('parseRuleMetadata', () => {
  it('returns null when the item has no ruleDefinition metadata key at all', () => {
    expect(parseRuleMetadata(item())).toBeNull()
  })

  it('parses a well-formed JSON ruleDefinition into a RuleKnowledgeItemRef', () => {
    const result = parseRuleMetadata(item({ ruleDefinition: JSON.stringify(validRule) }))
    expect(result).not.toBeNull()
    expect(result!.ok).toBe(true)
    if (result!.ok) {
      expect(result!.item.rule).toEqual(validRule)
      expect(result!.item.itemId).toBe('rule-item-1')
    }
  })

  it('produces a critical MissingEvidence entry, never throws, on malformed JSON', () => {
    expect(() => parseRuleMetadata(item({ ruleDefinition: '{not valid json' }))).not.toThrow()
    const result = parseRuleMetadata(item({ ruleDefinition: '{not valid json' }))
    expect(result!.ok).toBe(false)
    if (!result!.ok) {
      expect(result!.missingEvidence.isCritical).toBe(true)
      expect(result!.missingEvidence.description).toContain('rule-item-1')
    }
  })

  it('produces a critical MissingEvidence entry, never throws, on valid JSON missing required fields', () => {
    const incomplete = JSON.stringify({ ruleCode: 'RC-2' })
    expect(() => parseRuleMetadata(item({ ruleDefinition: incomplete }))).not.toThrow()
    const result = parseRuleMetadata(item({ ruleDefinition: incomplete }))
    expect(result!.ok).toBe(false)
    if (!result!.ok) expect(result!.missingEvidence.isCritical).toBe(true)
  })

  it('never coerces a non-string metadata value into a parse attempt', () => {
    expect(parseRuleMetadata(item({ ruleDefinition: { already: 'an object' } }))).toBeNull()
  })
})
