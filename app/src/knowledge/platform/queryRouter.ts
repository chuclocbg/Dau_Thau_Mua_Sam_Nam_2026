import type { KnowledgeQuery, KnowledgeResult } from './knowledgeTypes.ts'
import type { IProviderRegistry } from './providerRegistry.ts'
import { ResultRanker } from '../search/resultRanker.ts'

// ── QueryRouter — Rule 3: pure Map lookup via the registry, no switch/if ──────
// Fans a query out to every relevant provider's search(), merges via ResultRanker.
// Undefined/empty query.domains means "search every registered domain."

export class QueryRouter {
  constructor(
    private readonly registry: IProviderRegistry,
    private readonly ranker: ResultRanker = new ResultRanker(),
  ) {}

  async route(query: KnowledgeQuery): Promise<readonly KnowledgeResult[]> {
    const domains = query.domains?.length ? query.domains : this.registry.listDomains()

    const perProvider = await Promise.all(
      domains.map(domain => this.registry.resolve(domain)?.search(query) ?? Promise.resolve([])),
    )

    return this.ranker.rank(perProvider.flat(), query.limit)
  }
}
