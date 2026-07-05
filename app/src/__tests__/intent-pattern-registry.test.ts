import { describe, it, expect } from 'vitest'
import { INTENT_PATTERN_REGISTRY } from '../reasoning/domain/intentPatternRegistry.ts'

describe('INTENT_PATTERN_REGISTRY', () => {
  it('every intent type except GENERAL has at least one trigger phrase', () => {
    for (const [intentType, triggers] of Object.entries(INTENT_PATTERN_REGISTRY)) {
      if (intentType === 'GENERAL') continue
      expect(triggers.length, `${intentType} should have triggers`).toBeGreaterThan(0)
    }
  })

  it('GENERAL has no triggers (fallback only)', () => {
    expect(INTENT_PATTERN_REGISTRY.GENERAL).toEqual([])
  })

  it('no trigger phrase is duplicated across two different intent types', () => {
    const seen = new Map<string, string>()
    for (const [intentType, triggers] of Object.entries(INTENT_PATTERN_REGISTRY)) {
      for (const trigger of triggers) {
        const owner = seen.get(trigger)
        expect(owner, `"${trigger}" claimed by both ${owner} and ${intentType}`).toBeUndefined()
        seen.set(trigger, intentType)
      }
    }
  })
})
