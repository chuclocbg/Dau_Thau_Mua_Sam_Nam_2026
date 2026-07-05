import { describe, it, expect, beforeEach } from 'vitest'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import { MemoryKnowledgeRelationRepository } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KNOWLEDGE_RELATION_TYPES } from '../knowledge/platform/knowledgeTypes.ts'

let graph: KnowledgeGraphService

beforeEach(() => {
  graph = new KnowledgeGraphService(new MemoryKnowledgeRelationRepository())
})

describe('addEdge / getEdges / getIncomingEdges', () => {
  it('adds an edge and retrieves it as outgoing from the source', async () => {
    await graph.addEdge('a', 'b', KNOWLEDGE_RELATION_TYPES.REFERENCES)
    const edges = await graph.getEdges('a')
    expect(edges).toHaveLength(1)
    expect(edges[0].toItemId).toBe('b')
  })

  it('retrieves the same edge as incoming on the target', async () => {
    await graph.addEdge('a', 'b', KNOWLEDGE_RELATION_TYPES.REFERENCES)
    const incoming = await graph.getIncomingEdges('b')
    expect(incoming).toHaveLength(1)
    expect(incoming[0].fromItemId).toBe('a')
  })

  it('a brand-new relation type works with zero graph code changes (Rule 7)', async () => {
    const edge = await graph.addEdge('a', 'b', 'A_RELATION_INVENTED_JUST_NOW')
    expect(edge.relationType).toBe('A_RELATION_INVENTED_JUST_NOW')
  })

  it('carries metadata through', async () => {
    const edge = await graph.addEdge('a', 'b', KNOWLEDGE_RELATION_TYPES.SUPERSEDES, { reason: 'amended' })
    expect(edge.metadata).toEqual({ reason: 'amended' })
  })

  it('returns empty array for a node with no edges', async () => {
    expect(await graph.getEdges('isolated')).toEqual([])
    expect(await graph.getIncomingEdges('isolated')).toEqual([])
  })
})

describe('findPath', () => {
  it('finds a direct path', async () => {
    await graph.addEdge('a', 'b', KNOWLEDGE_RELATION_TYPES.REFERENCES)
    expect(await graph.findPath('a', 'b')).toEqual(['a', 'b'])
  })

  it('finds a multi-hop path via BFS', async () => {
    await graph.addEdge('a', 'b', KNOWLEDGE_RELATION_TYPES.REFERENCES)
    await graph.addEdge('b', 'c', KNOWLEDGE_RELATION_TYPES.REFERENCES)
    await graph.addEdge('c', 'd', KNOWLEDGE_RELATION_TYPES.REFERENCES)
    expect(await graph.findPath('a', 'd')).toEqual(['a', 'b', 'c', 'd'])
  })

  it('finds the shortest of multiple paths', async () => {
    await graph.addEdge('a', 'b', KNOWLEDGE_RELATION_TYPES.REFERENCES)
    await graph.addEdge('b', 'd', KNOWLEDGE_RELATION_TYPES.REFERENCES)
    await graph.addEdge('a', 'c', KNOWLEDGE_RELATION_TYPES.REFERENCES)
    await graph.addEdge('c', 'e', KNOWLEDGE_RELATION_TYPES.REFERENCES)
    await graph.addEdge('e', 'd', KNOWLEDGE_RELATION_TYPES.REFERENCES)
    expect(await graph.findPath('a', 'd')).toEqual(['a', 'b', 'd'])
  })

  it('returns the trivial path when from equals to', async () => {
    expect(await graph.findPath('a', 'a')).toEqual(['a'])
  })

  it('returns null when no path exists', async () => {
    await graph.addEdge('a', 'b', KNOWLEDGE_RELATION_TYPES.REFERENCES)
    expect(await graph.findPath('a', 'unreachable')).toBeNull()
  })

  it('does not follow edges backwards', async () => {
    await graph.addEdge('a', 'b', KNOWLEDGE_RELATION_TYPES.REFERENCES)
    expect(await graph.findPath('b', 'a')).toBeNull()
  })
})

describe('getSubgraph', () => {
  it('depth 1 returns only direct neighbors', async () => {
    await graph.addEdge('a', 'b', KNOWLEDGE_RELATION_TYPES.REFERENCES)
    await graph.addEdge('b', 'c', KNOWLEDGE_RELATION_TYPES.REFERENCES)
    const sub = await graph.getSubgraph('a', 1)
    expect(sub.nodes.sort()).toEqual(['a', 'b'])
    expect(sub.edges).toHaveLength(1)
  })

  it('depth 2 reaches two hops out', async () => {
    await graph.addEdge('a', 'b', KNOWLEDGE_RELATION_TYPES.REFERENCES)
    await graph.addEdge('b', 'c', KNOWLEDGE_RELATION_TYPES.REFERENCES)
    const sub = await graph.getSubgraph('a', 2)
    expect(sub.nodes.sort()).toEqual(['a', 'b', 'c'])
    expect(sub.edges).toHaveLength(2)
  })

  it('depth 0 returns only the starting node', async () => {
    await graph.addEdge('a', 'b', KNOWLEDGE_RELATION_TYPES.REFERENCES)
    const sub = await graph.getSubgraph('a', 0)
    expect(sub.nodes).toEqual(['a'])
    expect(sub.edges).toEqual([])
  })

  it('handles a cycle without infinite looping', async () => {
    await graph.addEdge('a', 'b', KNOWLEDGE_RELATION_TYPES.REFERENCES)
    await graph.addEdge('b', 'a', KNOWLEDGE_RELATION_TYPES.REFERENCES)
    const sub = await graph.getSubgraph('a', 5)
    expect(sub.nodes.sort()).toEqual(['a', 'b'])
  })

  it('an isolated node has an empty subgraph beyond itself', async () => {
    const sub = await graph.getSubgraph('isolated', 3)
    expect(sub.nodes).toEqual(['isolated'])
    expect(sub.edges).toEqual([])
  })
})
