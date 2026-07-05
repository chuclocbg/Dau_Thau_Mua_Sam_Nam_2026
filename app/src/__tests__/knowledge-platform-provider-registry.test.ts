import { describe, it, expect, beforeEach } from 'vitest'
import { createProviderRegistry } from '../knowledge/platform/providerRegistry.ts'
import type { IProviderRegistry } from '../knowledge/platform/providerRegistry.ts'
import type { IKnowledgeProvider, KnowledgeQuery, KnowledgeResult, KnowledgeContext, KnowledgeSuggestion } from '../knowledge/platform/knowledgeTypes.ts'
import { KnowledgeError } from '../knowledge/platform/knowledgeTypes.ts'

// Minimal fake provider — exercises the registry without needing a real domain provider.
class FakeProvider implements IKnowledgeProvider {
  constructor(readonly domain: string, readonly layer: 1 | 2 | 3 | 4 = 2, readonly version = '1.0.0') {}
  async search(_query: KnowledgeQuery): Promise<readonly KnowledgeResult[]> { return [] }
  async resolve(_itemId: string) { return null }
  async suggest(_context: KnowledgeContext): Promise<readonly KnowledgeSuggestion[]> { return [] }
  async score(_itemId: string, _context: KnowledgeContext): Promise<number> { return 0 }
}

let registry: IProviderRegistry

beforeEach(() => {
  registry = createProviderRegistry()
})

describe('register / resolve', () => {
  it('resolves a registered provider by domain', () => {
    const provider = new FakeProvider('legal', 1)
    registry.register(provider)
    expect(registry.resolve('legal')).toBe(provider)
  })

  it('returns undefined for an unregistered domain', () => {
    expect(registry.resolve('nonexistent')).toBeUndefined()
  })

  it('throws PROVIDER_ALREADY_REGISTERED on duplicate domain registration', () => {
    registry.register(new FakeProvider('legal'))
    expect(() => registry.register(new FakeProvider('legal'))).toThrow(KnowledgeError)
  })
})

describe('listDomains / listProviders', () => {
  it('lists every registered domain', () => {
    registry.register(new FakeProvider('legal', 1))
    registry.register(new FakeProvider('risk', 4))
    expect(registry.listDomains().sort()).toEqual(['legal', 'risk'])
  })

  it('lists every registered provider object', () => {
    const legal = new FakeProvider('legal', 1)
    const risk = new FakeProvider('risk', 4)
    registry.register(legal)
    registry.register(risk)
    expect(registry.listProviders()).toContain(legal)
    expect(registry.listProviders()).toContain(risk)
  })

  it('returns empty arrays before any registration', () => {
    expect(registry.listDomains()).toEqual([])
    expect(registry.listProviders()).toEqual([])
  })
})

describe('a brand-new domain registers with zero registry code changes (Rule 2)', () => {
  it('registers an entirely novel domain key with no special-casing', () => {
    const novel = new FakeProvider('something-invented-tomorrow', 4)
    expect(() => registry.register(novel)).not.toThrow()
    expect(registry.resolve('something-invented-tomorrow')).toBe(novel)
  })
})
