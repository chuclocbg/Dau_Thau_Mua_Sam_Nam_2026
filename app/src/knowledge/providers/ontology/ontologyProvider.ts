import type { KnowledgeContext } from '../../platform/knowledgeTypes.ts'
import { KNOWLEDGE_RELATION_TYPES } from '../../platform/knowledgeTypes.ts'
import type { KnowledgeRepositories } from '../../repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../../graph/knowledgeGraph.ts'
import { SearchEngine } from '../../search/searchEngine.ts'
import { BaseKnowledgeProvider } from '../baseProvider.ts'

// ── OntologyProvider — Layer 2 (operationally binding) ────────────────────────
// Domain concepts, synonyms, Vietnamese procurement terminology graph.
// Domain-specific graph behaviors: synonym linkage (SIMILAR_TO) and broader/
// narrower concept hierarchy using a NEW relation type not in
// KNOWLEDGE_RELATION_TYPES ('BROADER_THAN') — demonstrating, with a genuine
// real usage (not just a test fixture), that the graph accepts any string
// with zero code changes (Rule 7).

const BROADER_THAN = 'BROADER_THAN'

export class OntologyProvider extends BaseKnowledgeProvider {
  readonly domain = 'ontology'
  readonly layer = 2 as const
  readonly version = '1.0.0'

  constructor(
    repos: KnowledgeRepositories,
    private readonly graph: IKnowledgeGraph,
    searchEngine?: SearchEngine,
  ) {
    super(repos, searchEngine)
  }

  protected override suggestionReason(_context: KnowledgeContext): string {
    return 'Related procurement terminology concept'
  }

  async linkSynonym(conceptId: string, synonymConceptId: string): Promise<void> {
    await this.graph.addEdge(conceptId, synonymConceptId, KNOWLEDGE_RELATION_TYPES.SIMILAR_TO)
  }

  async getSynonyms(conceptId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(conceptId)
    return edges.filter(e => e.relationType === KNOWLEDGE_RELATION_TYPES.SIMILAR_TO).map(e => e.toItemId)
  }

  /** narrowerConceptId is a more specific instance of broaderConceptId. */
  async linkBroaderConcept(narrowerConceptId: string, broaderConceptId: string): Promise<void> {
    await this.graph.addEdge(narrowerConceptId, broaderConceptId, BROADER_THAN)
  }

  async getBroaderConcepts(conceptId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(conceptId)
    return edges.filter(e => e.relationType === BROADER_THAN).map(e => e.toItemId)
  }

  async getNarrowerConcepts(conceptId: string): Promise<readonly string[]> {
    const incoming = await this.graph.getIncomingEdges(conceptId)
    return incoming.filter(e => e.relationType === BROADER_THAN).map(e => e.fromItemId)
  }
}
