import { describe, it, expect } from 'vitest'
import { buildEffectivePeriodWarnings } from '../reasoning/application/resolveKnowledgeWarnings.ts'

describe('buildEffectivePeriodWarnings', () => {
  it('returns an empty array for no assumed items', () => {
    expect(buildEffectivePeriodWarnings([])).toEqual([])
  })

  it('produces one plain-string warning per item id', () => {
    const warnings = buildEffectivePeriodWarnings(['item-1', 'item-2'])
    expect(warnings).toHaveLength(2)
    expect(warnings[0]).toContain('item-1')
    expect(warnings[1]).toContain('item-2')
  })

  it('every warning is a plain string (matching ResolvedKnowledge.warnings: readonly string[])', () => {
    const warnings = buildEffectivePeriodWarnings(['item-1'])
    expect(typeof warnings[0]).toBe('string')
  })
})
