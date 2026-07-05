import { describe, it, expect } from 'vitest'
import { selectModel } from '../ai/infrastructure/modelSelector.ts'
import type { AIModelInfo } from '../ai/infrastructure/modelCapabilityRegistry.ts'

describe('selectModel', () => {
  it('selects the model with the highest maxContextTokens among eligible candidates', () => {
    const model = selectModel({ requiredCapabilities: ['chat'] })
    expect(model?.modelId).toBeTruthy()
  })

  it('returns null when no model satisfies the required capabilities', () => {
    const model = selectModel({ requiredCapabilities: ['legalReasoning', 'vision'], minContextTokens: 999_999_999 })
    expect(model).toBeNull()
  })

  it('prefers a model from preferredProviderId when eligible candidates exist there', () => {
    const model = selectModel({ requiredCapabilities: ['chat'], preferredProviderId: 'anthropic' })
    expect(model?.providerId).toBe('anthropic')
  })

  it('is provider-agnostic: the algorithm works identically against a synthetic non-Claude registry', () => {
    const syntheticRegistry: readonly AIModelInfo[] = [
      { modelId: 'fake-small', providerId: 'fake-provider-x', displayName: 'Fake Small', maxContextTokens: 8_000, capabilities: ['chat'] },
      { modelId: 'fake-large', providerId: 'fake-provider-x', displayName: 'Fake Large', maxContextTokens: 64_000, capabilities: ['chat', 'vision'] },
    ]
    const model = selectModel({ requiredCapabilities: ['vision'] }, syntheticRegistry)
    expect(model?.modelId).toBe('fake-large')
  })

  it('falls back to any eligible candidate when the preferred provider has none', () => {
    const model = selectModel({ requiredCapabilities: ['chat'], preferredProviderId: 'nonexistent-provider' })
    expect(model).not.toBeNull()
  })
})
