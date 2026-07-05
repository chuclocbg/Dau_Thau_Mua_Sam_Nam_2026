import type { KnowledgeContext } from '../../platform/knowledgeTypes.ts'
import { KNOWLEDGE_RELATION_TYPES } from '../../platform/knowledgeTypes.ts'
import type { KnowledgeRepositories } from '../../repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../../graph/knowledgeGraph.ts'
import { SearchEngine } from '../../search/searchEngine.ts'
import { BaseKnowledgeProvider } from '../baseProvider.ts'

// ── CaseProvider — Layer 4 (advisory only) ────────────────────────────────
// Past procurement cases/precedents. Domain-specific graph behaviors:
// similar-case linkage (SIMILAR_TO, reused) and the risk a case revealed
// via a NEW relation type ('REVEALED').

const REVEALED = 'REVEALED'

export class CaseProvider extends BaseKnowledgeProvider {
  readonly domain = 'cases'
  readonly layer = 4 as const
  readonly version = '1.0.0'

  constructor(
    repos: KnowledgeRepositories,
    private readonly graph: IKnowledgeGraph,
    searchEngine?: SearchEngine,
  ) {
    super(repos, searchEngine)
  }

  protected override suggestionReason(_context: KnowledgeContext): string {
    return 'Applicable precedent case'
  }

  /** caseId is similar in fact pattern to otherCaseId. */
  async linkSimilarCase(caseId: string, otherCaseId: string): Promise<void> {
    await this.graph.addEdge(caseId, otherCaseId, KNOWLEDGE_RELATION_TYPES.SIMILAR_TO)
  }

  async getSimilarCases(caseId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(caseId)
    return edges.filter(e => e.relationType === KNOWLEDGE_RELATION_TYPES.SIMILAR_TO).map(e => e.toItemId)
  }

  /** caseId revealed the risk pattern riskId. */
  async linkRevealedRisk(caseId: string, riskId: string): Promise<void> {
    await this.graph.addEdge(caseId, riskId, REVEALED)
  }

  async getRevealedRisks(caseId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(caseId)
    return edges.filter(e => e.relationType === REVEALED).map(e => e.toItemId)
  }
}
