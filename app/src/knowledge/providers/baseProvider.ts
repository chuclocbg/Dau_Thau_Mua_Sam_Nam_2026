import type {
  IKnowledgeProvider, KnowledgeQuery, KnowledgeResult, KnowledgeItem,
  KnowledgeContext, KnowledgeSuggestion, KnowledgeLayer,
} from '../platform/knowledgeTypes.ts'
import type { KnowledgeRepositories } from '../repositories/knowledgeRepositories.ts'
import { SearchEngine } from '../search/searchEngine.ts'
import { Retriever } from '../application/retriever.ts'

// ── BaseKnowledgeProvider — shared search/resolve/suggest/score implementation ──
// Every one of the 16 eventual providers needs the same "search my own domain's
// active items, resolve only items I own, suggest via the universal applicability
// evaluator, score via the same evaluator" logic. Concrete providers extend this
// and add ONLY their own domain-specific graph relationships and vocabulary —
// justified reuse (16 known call sites), not speculative abstraction.

export abstract class BaseKnowledgeProvider implements IKnowledgeProvider {
  abstract readonly domain: string
  abstract readonly layer: KnowledgeLayer
  abstract readonly version: string

  protected readonly retriever: Retriever

  constructor(
    protected readonly repos: KnowledgeRepositories,
    protected readonly searchEngine: SearchEngine = new SearchEngine(),
  ) {
    this.retriever = new Retriever(repos)
  }

  async search(query: KnowledgeQuery): Promise<readonly KnowledgeResult[]> {
    const items = await this.repos.items.findActive(this.domain)
    const scored = await Promise.all(items.map(async item => ({
      item,
      relevance: await this.searchEngine.score(query.text, item),
      matchedDomain: this.domain,
    })))
    return scored.filter(r => r.relevance > 0)
  }

  async resolve(itemId: string): Promise<KnowledgeItem | null> {
    const item = await this.repos.items.findById(itemId)
    return item && item.domain === this.domain ? item : null
  }

  async suggest(context: KnowledgeContext): Promise<readonly KnowledgeSuggestion[]> {
    const asOfDate = context.asOfDate ?? new Date().toISOString().slice(0, 10)
    const applicable = await this.retriever.resolveApplicableDocuments(this.domain, asOfDate, context)
    return applicable.map(item => ({ item, reason: this.suggestionReason(context), confidence: item.confidence }))
  }

  async score(itemId: string, context: KnowledgeContext): Promise<number> {
    const item = await this.resolve(itemId)
    if (!item) return 0
    const asOfDate = context.asOfDate ?? new Date().toISOString().slice(0, 10)
    const applicable = await this.retriever.resolveApplicableDocuments(this.domain, asOfDate, context)
    return applicable.some(i => i.id === itemId) ? item.confidence : item.confidence * 0.3
  }

  /** Override for a domain-specific suggestion reason string. */
  protected suggestionReason(context: KnowledgeContext): string {
    return `Applicable ${this.domain} knowledge${context.packageType ? ` for ${context.packageType}` : ''}`
  }
}
