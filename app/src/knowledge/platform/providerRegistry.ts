import type { IKnowledgeProvider } from './knowledgeTypes.ts'
import { KnowledgeError } from './knowledgeTypes.ts'

// ── ProviderRegistry — Rule 3: pure Map lookup, no switch/if on domain names ──

export interface IProviderRegistry {
  register(provider: IKnowledgeProvider): void
  resolve(domain: string): IKnowledgeProvider | undefined
  listDomains(): readonly string[]
  listProviders(): readonly IKnowledgeProvider[]
}

export function createProviderRegistry(): IProviderRegistry {
  const byDomain = new Map<string, IKnowledgeProvider>()

  return {
    register(provider: IKnowledgeProvider): void {
      if (byDomain.has(provider.domain)) {
        throw new KnowledgeError(
          'PROVIDER_ALREADY_REGISTERED', 'domain',
          `A provider is already registered for domain: ${provider.domain}`,
        )
      }
      byDomain.set(provider.domain, provider)
    },
    resolve(domain: string): IKnowledgeProvider | undefined {
      return byDomain.get(domain)
    },
    listDomains(): readonly string[] {
      return Array.from(byDomain.keys())
    },
    listProviders(): readonly IKnowledgeProvider[] {
      return Array.from(byDomain.values())
    },
  }
}
