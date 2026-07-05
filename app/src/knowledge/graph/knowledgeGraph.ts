import type { KnowledgeRelationType } from '../platform/knowledgeTypes.ts'
import type { IKnowledgeRelationRepository } from '../repositories/knowledgeRepositories.ts'

// ── KnowledgeGraphEdge ─────────────────────────────────────────────────────────

export interface KnowledgeGraphEdge {
  readonly id: string
  readonly fromItemId: string
  readonly toItemId: string
  readonly relationType: KnowledgeRelationType   // open string (Rule 7)
  readonly metadata: Readonly<Record<string, string>>
  readonly createdAt: string
}

export interface Subgraph {
  readonly nodes: readonly string[]
  readonly edges: readonly KnowledgeGraphEdge[]
}

// ── IKnowledgeGraph ────────────────────────────────────────────────────────────

export interface IKnowledgeGraph {
  addEdge(fromItemId: string, toItemId: string, relationType: KnowledgeRelationType, metadata?: Readonly<Record<string, string>>): Promise<KnowledgeGraphEdge>
  getEdges(itemId: string): Promise<readonly KnowledgeGraphEdge[]>            // outgoing (item is "from")
  getIncomingEdges(itemId: string): Promise<readonly KnowledgeGraphEdge[]>    // incoming (item is "to")
  findPath(fromItemId: string, toItemId: string): Promise<readonly string[] | null>
  getSubgraph(itemId: string, depth: number): Promise<Subgraph>
}

// ── KnowledgeGraphService — BFS path/subgraph queries over a relation repository ──
// The repository owns persistence (memory now, Prisma later); this service owns
// only the traversal algorithms, so swapping the repo never touches BFS logic.

export class KnowledgeGraphService implements IKnowledgeGraph {
  constructor(private readonly relations: IKnowledgeRelationRepository) {}

  async addEdge(
    fromItemId: string,
    toItemId: string,
    relationType: KnowledgeRelationType,
    metadata: Readonly<Record<string, string>> = {},
  ): Promise<KnowledgeGraphEdge> {
    return this.relations.create(fromItemId, toItemId, relationType, metadata)
  }

  async getEdges(itemId: string): Promise<readonly KnowledgeGraphEdge[]> {
    return this.relations.findByFromItem(itemId)
  }

  async getIncomingEdges(itemId: string): Promise<readonly KnowledgeGraphEdge[]> {
    return this.relations.findByToItem(itemId)
  }

  /** Breadth-first shortest path, following outgoing edges only. */
  async findPath(fromItemId: string, toItemId: string): Promise<readonly string[] | null> {
    if (fromItemId === toItemId) return [fromItemId]

    const visited = new Set<string>([fromItemId])
    const queue: string[][] = [[fromItemId]]

    while (queue.length > 0) {
      const path = queue.shift()!
      const current = path[path.length - 1]
      const outEdges = await this.getEdges(current)

      for (const edge of outEdges) {
        if (edge.toItemId === toItemId) return [...path, toItemId]
        if (!visited.has(edge.toItemId)) {
          visited.add(edge.toItemId)
          queue.push([...path, edge.toItemId])
        }
      }
    }
    return null
  }

  /** All nodes/edges reachable within `depth` hops (outgoing direction), via BFS. */
  async getSubgraph(itemId: string, depth: number): Promise<Subgraph> {
    const nodes = new Set<string>([itemId])
    const edgeById = new Map<string, KnowledgeGraphEdge>()
    let frontier = [itemId]

    for (let hop = 0; hop < depth && frontier.length > 0; hop++) {
      const next: string[] = []
      for (const node of frontier) {
        const outEdges = await this.getEdges(node)
        for (const edge of outEdges) {
          edgeById.set(edge.id, edge)
          if (!nodes.has(edge.toItemId)) {
            nodes.add(edge.toItemId)
            next.push(edge.toItemId)
          }
        }
      }
      frontier = next
    }

    return { nodes: Array.from(nodes), edges: Array.from(edgeById.values()) }
  }
}
