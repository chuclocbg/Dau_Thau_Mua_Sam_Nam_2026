import { describe, it, expect } from 'vitest'
import { findModelById, findModelsByCapability, MODEL_REGISTRY } from '../ai/infrastructure/modelCapabilityRegistry.ts'

describe('ModelCapabilityRegistry', () => {
  it('every registered model has at least one capability', () => {
    for (const model of MODEL_REGISTRY) {
      expect(model.capabilities.length).toBeGreaterThan(0)
    }
  })

  it('findModelById finds a known model', () => {
    expect(findModelById('claude-haiku-3-5-latest')?.displayName).toBe('Claude Haiku 3.5')
  })

  it('findModelById returns undefined for an unknown model', () => {
    expect(findModelById('unknown-model')).toBeUndefined()
  })

  it('findModelsByCapability filters correctly', () => {
    const visionModels = findModelsByCapability('vision')
    expect(visionModels.length).toBeGreaterThan(0)
    expect(visionModels.every(m => m.capabilities.includes('vision'))).toBe(true)
  })
})
