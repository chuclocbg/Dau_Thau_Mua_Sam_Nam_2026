import type { KnowledgeContext } from '../../platform/knowledgeTypes.ts'
import { KNOWLEDGE_RELATION_TYPES } from '../../platform/knowledgeTypes.ts'
import type { KnowledgeRepositories } from '../../repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../../graph/knowledgeGraph.ts'
import { SearchEngine } from '../../search/searchEngine.ts'
import { BaseKnowledgeProvider } from '../baseProvider.ts'

// ── AuditProvider — Layer 4 (advisory only) ───────────────────────────────
// State Audit Office / Ministry of Finance Inspectorate / Ministry of
// Industry and Trade Inspectorate findings (CLAUDE.md's Audit-First
// Principle). Domain-specific graph behaviors: corrective action linkage
// via a NEW relation type ('REMEDIATED_BY') and related risk pattern
// linkage (RELATED_TO, reused).

const REMEDIATED_BY = 'REMEDIATED_BY'

export class AuditProvider extends BaseKnowledgeProvider {
  readonly domain = 'audit'
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
    return 'Applicable audit finding'
  }

  /** findingId is remediated by the corrective action actionId. */
  async linkCorrectiveAction(findingId: string, actionId: string): Promise<void> {
    await this.graph.addEdge(findingId, actionId, REMEDIATED_BY)
  }

  async getCorrectiveActions(findingId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(findingId)
    return edges.filter(e => e.relationType === REMEDIATED_BY).map(e => e.toItemId)
  }

  /** findingId is related to the risk pattern riskId. */
  async linkAffectedRiskPattern(findingId: string, riskId: string): Promise<void> {
    await this.graph.addEdge(findingId, riskId, KNOWLEDGE_RELATION_TYPES.RELATED_TO)
  }

  async getAffectedRiskPatterns(findingId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(findingId)
    return edges.filter(e => e.relationType === KNOWLEDGE_RELATION_TYPES.RELATED_TO).map(e => e.toItemId)
  }
}
