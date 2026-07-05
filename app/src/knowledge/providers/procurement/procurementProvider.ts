import type { KnowledgeContext } from '../../platform/knowledgeTypes.ts'
import { KNOWLEDGE_RELATION_TYPES } from '../../platform/knowledgeTypes.ts'
import type { KnowledgeRepositories } from '../../repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../../graph/knowledgeGraph.ts'
import { SearchEngine } from '../../search/searchEngine.ts'
import { BaseKnowledgeProvider } from '../baseProvider.ts'

// ── ProcurementProvider — Layer 2 (operationally binding) ─────────────────────
// Domain-specific behaviors beyond the base contract: template linkage
// (a procurement method USES_TEMPLATE a document template) and method
// dependency chains (DEPENDS_ON) — deliberately different relation types than
// LegalProvider's SUPERSEDES/REFERENCES, exercising the graph's open-string
// relation vocabulary with two genuinely different real usages.

export class ProcurementProvider extends BaseKnowledgeProvider {
  readonly domain = 'procurement'
  readonly layer = 2 as const
  readonly version = '1.0.0'

  constructor(
    repos: KnowledgeRepositories,
    private readonly graph: IKnowledgeGraph,
    searchEngine?: SearchEngine,
  ) {
    super(repos, searchEngine)
  }

  protected override suggestionReason(context: KnowledgeContext): string {
    return `Recommended procurement approach${context.procurementMethod ? ` for ${context.procurementMethod}` : ''}`
  }

  /** methodItemId requires templateItemId (e.g. OPEN_TENDER method requires the HSMT template). */
  async linkTemplate(methodItemId: string, templateItemId: string): Promise<void> {
    await this.graph.addEdge(methodItemId, templateItemId, KNOWLEDGE_RELATION_TYPES.USES_TEMPLATE)
  }

  async getRequiredTemplates(methodItemId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(methodItemId)
    return edges.filter(e => e.relationType === KNOWLEDGE_RELATION_TYPES.USES_TEMPLATE).map(e => e.toItemId)
  }

  /** itemId depends on dependsOnItemId (e.g. contract-award step depends on evaluation-complete). */
  async linkDependency(itemId: string, dependsOnItemId: string): Promise<void> {
    await this.graph.addEdge(itemId, dependsOnItemId, KNOWLEDGE_RELATION_TYPES.DEPENDS_ON)
  }

  async getDependencies(itemId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(itemId)
    return edges.filter(e => e.relationType === KNOWLEDGE_RELATION_TYPES.DEPENDS_ON).map(e => e.toItemId)
  }
}
