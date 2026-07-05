import type { KnowledgeItem } from '../platform/knowledgeTypes.ts'
import type { KnowledgeRepositories } from '../repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../graph/knowledgeGraph.ts'

export interface ResolvedItem {
  readonly item: KnowledgeItem
  readonly related: readonly KnowledgeItem[]
}

// ── Resolver — single-item lookup, optionally with graph-connected neighbors ──

export class Resolver {
  constructor(
    private readonly repos: KnowledgeRepositories,
    private readonly graph: IKnowledgeGraph,
  ) {}

  async resolve(itemId: string): Promise<KnowledgeItem | null> {
    return this.repos.items.findById(itemId)
  }

  /** Resolve an item plus every item it has an outgoing graph edge to. */
  async resolveWithRelated(itemId: string): Promise<ResolvedItem | null> {
    const item = await this.repos.items.findById(itemId)
    if (!item) return null

    const edges = await this.graph.getEdges(itemId)
    const related = (await Promise.all(edges.map(e => this.repos.items.findById(e.toItemId))))
      .filter((i): i is KnowledgeItem => i !== null)

    return { item, related }
  }
}
