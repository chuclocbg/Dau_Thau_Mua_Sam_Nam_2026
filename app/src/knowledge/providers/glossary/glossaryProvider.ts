import type { KnowledgeContext } from '../../platform/knowledgeTypes.ts'
import type { KnowledgeRepositories } from '../../repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../../graph/knowledgeGraph.ts'
import { SearchEngine } from '../../search/searchEngine.ts'
import { BaseKnowledgeProvider } from '../baseProvider.ts'

// ── GlossaryProvider — Layer 2 (operationally binding) ────────────────────────
// Legal/procurement term definitions, abbreviations, term translations.
// Domain-specific graph behaviors: abbreviation linkage and term translation,
// both using NEW relation types not in KNOWLEDGE_RELATION_TYPES — a second,
// independent real proof (alongside OntologyProvider's 'BROADER_THAN') that
// the open-string relation vocabulary needs zero graph-engine changes per use.

const ABBREVIATES = 'ABBREVIATES'
const TRANSLATES_TO = 'TRANSLATES_TO'

export class GlossaryProvider extends BaseKnowledgeProvider {
  readonly domain = 'glossary'
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
    return 'Relevant glossary term'
  }

  /** abbreviationId is a shorthand for fullTermId (e.g. "HSMT" abbreviates "Hồ sơ mời thầu"). */
  async linkAbbreviation(abbreviationId: string, fullTermId: string): Promise<void> {
    await this.graph.addEdge(abbreviationId, fullTermId, ABBREVIATES)
  }

  async getFullTerm(abbreviationId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(abbreviationId)
    return edges.filter(e => e.relationType === ABBREVIATES).map(e => e.toItemId)
  }

  async getAbbreviations(fullTermId: string): Promise<readonly string[]> {
    const incoming = await this.graph.getIncomingEdges(fullTermId)
    return incoming.filter(e => e.relationType === ABBREVIATES).map(e => e.fromItemId)
  }

  /** termId translates to translatedTermId (e.g. a Vietnamese term to its English equivalent). */
  async linkTranslation(termId: string, translatedTermId: string): Promise<void> {
    await this.graph.addEdge(termId, translatedTermId, TRANSLATES_TO)
  }

  async getTranslations(termId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(termId)
    return edges.filter(e => e.relationType === TRANSLATES_TO).map(e => e.toItemId)
  }
}
