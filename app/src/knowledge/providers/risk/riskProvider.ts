import type { KnowledgeContext } from '../../platform/knowledgeTypes.ts'
import { KNOWLEDGE_RELATION_TYPES } from '../../platform/knowledgeTypes.ts'
import type { KnowledgeRepositories } from '../../repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../../graph/knowledgeGraph.ts'
import { SearchEngine } from '../../search/searchEngine.ts'
import { BaseKnowledgeProvider } from '../baseProvider.ts'

// ── RiskProvider — Layer 4 (advisory only) ────────────────────────────────
// Risk patterns / audit-risk indicators, informing CLAUDE.md's
// [CRITICAL]/[HIGH]/[MEDIUM]/[LOW] audit-risk flags. Domain-specific graph
// behaviors: mitigating control linkage via a NEW relation type
// ('MITIGATED_BY') and related audit finding linkage (REFERENCES, reused).

const MITIGATED_BY = 'MITIGATED_BY'

export class RiskProvider extends BaseKnowledgeProvider {
  readonly domain = 'risk'
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
    return 'Applicable risk pattern'
  }

  /** riskId is mitigated by the control controlId. */
  async linkMitigatingControl(riskId: string, controlId: string): Promise<void> {
    await this.graph.addEdge(riskId, controlId, MITIGATED_BY)
  }

  async getMitigatingControls(riskId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(riskId)
    return edges.filter(e => e.relationType === MITIGATED_BY).map(e => e.toItemId)
  }

  /** riskId is referenced by the audit finding findingId. */
  async linkRelatedAuditFinding(riskId: string, findingId: string): Promise<void> {
    await this.graph.addEdge(riskId, findingId, KNOWLEDGE_RELATION_TYPES.REFERENCES)
  }

  async getRelatedAuditFindings(riskId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(riskId)
    return edges.filter(e => e.relationType === KNOWLEDGE_RELATION_TYPES.REFERENCES).map(e => e.toItemId)
  }
}
