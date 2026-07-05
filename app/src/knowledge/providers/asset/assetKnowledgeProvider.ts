import type { KnowledgeContext } from '../../platform/knowledgeTypes.ts'
import { KNOWLEDGE_RELATION_TYPES } from '../../platform/knowledgeTypes.ts'
import type { KnowledgeRepositories } from '../../repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../../graph/knowledgeGraph.ts'
import { SearchEngine } from '../../search/searchEngine.ts'
import { BaseKnowledgeProvider } from '../baseProvider.ts'

// ── AssetKnowledgeProvider — Layer 2 (operationally binding) ──────────────────
// Asset categories, depreciation rules, maintenance schedules, asset lifecycle.
// Domain-specific graph behaviors: lifecycle stage ordering (DEPENDS_ON —
// reused from ChecklistProvider's phase-gate pattern, a legitimate second
// domain expressing the same "ordered stages" concept) and depreciation rule
// linkage (REFERENCES).

export class AssetKnowledgeProvider extends BaseKnowledgeProvider {
  readonly domain = 'asset'
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
    return 'Applicable asset management rule'
  }

  /** stageId's lifecycle stage must complete before nextStageId applies. */
  async linkNextLifecycleStage(stageId: string, nextStageId: string): Promise<void> {
    await this.graph.addEdge(nextStageId, stageId, KNOWLEDGE_RELATION_TYPES.DEPENDS_ON)
  }

  async getPreviousLifecycleStage(stageId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(stageId)
    return edges.filter(e => e.relationType === KNOWLEDGE_RELATION_TYPES.DEPENDS_ON).map(e => e.toItemId)
  }

  /** assetCategoryId is governed by the depreciation rule ruleId. */
  async linkDepreciationRule(assetCategoryId: string, ruleId: string): Promise<void> {
    await this.graph.addEdge(assetCategoryId, ruleId, KNOWLEDGE_RELATION_TYPES.REFERENCES)
  }

  async getDepreciationRules(assetCategoryId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(assetCategoryId)
    return edges.filter(e => e.relationType === KNOWLEDGE_RELATION_TYPES.REFERENCES).map(e => e.toItemId)
  }
}
