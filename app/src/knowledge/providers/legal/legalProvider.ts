import type { KnowledgeContext } from '../../platform/knowledgeTypes.ts'
import { KNOWLEDGE_RELATION_TYPES } from '../../platform/knowledgeTypes.ts'
import type { KnowledgeRepositories } from '../../repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../../graph/knowledgeGraph.ts'
import { SearchEngine } from '../../search/searchEngine.ts'
import { BaseKnowledgeProvider } from '../baseProvider.ts'

// ── LegalProvider — Layer 1 (nationally binding) ──────────────────────────────
// Domain-specific behaviors beyond the base contract: citation graph, amendment
// chain traversal. Both ride on the shared KnowledgeGraphService — no bespoke
// storage, no change to the graph engine itself.

export class LegalProvider extends BaseKnowledgeProvider {
  readonly domain = 'legal'
  readonly layer = 1 as const
  readonly version = '1.0.0'

  constructor(
    repos: KnowledgeRepositories,
    private readonly graph: IKnowledgeGraph,
    searchEngine?: SearchEngine,
  ) {
    super(repos, searchEngine)
  }

  protected override suggestionReason(context: KnowledgeContext): string {
    return `Applicable legal basis${context.packageType ? ` for ${context.packageType}` : ''}`
  }

  /** citingItemId cites citedItemId (e.g. a decree citing its enabling law). */
  async recordCitation(citingItemId: string, citedItemId: string): Promise<void> {
    await this.graph.addEdge(citingItemId, citedItemId, KNOWLEDGE_RELATION_TYPES.REFERENCES)
  }

  async getCitations(itemId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(itemId)
    return edges.filter(e => e.relationType === KNOWLEDGE_RELATION_TYPES.REFERENCES).map(e => e.toItemId)
  }

  /** amendingItemId supersedes baseItemId. */
  async recordAmendment(amendingItemId: string, baseItemId: string): Promise<void> {
    await this.graph.addEdge(amendingItemId, baseItemId, KNOWLEDGE_RELATION_TYPES.SUPERSEDES)
  }

  /** Walks the amendment chain forward from `itemId`: [itemId, first amender, second amender, ...]. */
  async getAmendmentChain(itemId: string): Promise<readonly string[]> {
    const chain: string[] = [itemId]
    const visited = new Set([itemId])
    let current = itemId

    for (;;) {
      const incoming = await this.graph.getIncomingEdges(current)
      const supersededBy = incoming.find(e => e.relationType === KNOWLEDGE_RELATION_TYPES.SUPERSEDES)
      if (!supersededBy || visited.has(supersededBy.fromItemId)) break
      chain.push(supersededBy.fromItemId)
      visited.add(supersededBy.fromItemId)
      current = supersededBy.fromItemId
    }
    return chain
  }
}
