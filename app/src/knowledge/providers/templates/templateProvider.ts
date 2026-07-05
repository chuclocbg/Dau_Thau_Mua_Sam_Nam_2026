import type { KnowledgeContext } from '../../platform/knowledgeTypes.ts'
import { KNOWLEDGE_RELATION_TYPES } from '../../platform/knowledgeTypes.ts'
import type { KnowledgeRepositories } from '../../repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../../graph/knowledgeGraph.ts'
import { SearchEngine } from '../../search/searchEngine.ts'
import { BaseKnowledgeProvider } from '../baseProvider.ts'

// ── TemplateProvider — Layer 2 (operationally binding) ────────────────────────
// HSMT, HSYC, KHLCNT, contracts, acceptance reports, payment forms, audit forms.
// Domain-specific graph behaviors: template prerequisites (DEPENDS_ON) and
// template-generates-document relationships (GENERATES).

export class TemplateProvider extends BaseKnowledgeProvider {
  readonly domain = 'templates'
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
    return `Recommended template${context.packageType ? ` for ${context.packageType}` : ''}`
  }

  /** templateId requires prerequisiteTemplateId to already be completed/approved. */
  async linkPrerequisite(templateId: string, prerequisiteTemplateId: string): Promise<void> {
    await this.graph.addEdge(templateId, prerequisiteTemplateId, KNOWLEDGE_RELATION_TYPES.DEPENDS_ON)
  }

  async getPrerequisites(templateId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(templateId)
    return edges.filter(e => e.relationType === KNOWLEDGE_RELATION_TYPES.DEPENDS_ON).map(e => e.toItemId)
  }

  /** templateId generates a document of type documentItemId (e.g. HSMT generates a tender announcement). */
  async linkGeneratedDocument(templateId: string, documentItemId: string): Promise<void> {
    await this.graph.addEdge(templateId, documentItemId, KNOWLEDGE_RELATION_TYPES.GENERATES)
  }

  async getGeneratedDocuments(templateId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(templateId)
    return edges.filter(e => e.relationType === KNOWLEDGE_RELATION_TYPES.GENERATES).map(e => e.toItemId)
  }
}
