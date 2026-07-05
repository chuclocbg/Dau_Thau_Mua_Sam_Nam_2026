import type { KnowledgeContext } from '../../platform/knowledgeTypes.ts'
import { KNOWLEDGE_RELATION_TYPES } from '../../platform/knowledgeTypes.ts'
import type { KnowledgeRepositories } from '../../repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../../graph/knowledgeGraph.ts'
import { SearchEngine } from '../../search/searchEngine.ts'
import { BaseKnowledgeProvider } from '../baseProvider.ts'

// ── VendorKnowledgeProvider — Layer 2 (operationally binding) ─────────────────
// Supplier capabilities, blacklist criteria, performance benchmarks,
// certification requirements. Domain-specific graph behaviors: certification
// requirements per vendor category (reuses REQUIRES — a category REQUIRES a
// certification, same meaning the constant already documents) and blacklist
// reasoning (a NEW relation type, 'BLACKLISTED_FOR', linking a vendor to the
// specific risk/audit finding item that justifies its blacklist status).

const BLACKLISTED_FOR = 'BLACKLISTED_FOR'

export class VendorKnowledgeProvider extends BaseKnowledgeProvider {
  readonly domain = 'vendor'
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
    return `Vendor requirement${context.packageType ? ` for ${context.packageType}` : ''}`
  }

  /** categoryId (a vendor/supplier category) requires certificationId. */
  async linkRequiredCertification(categoryId: string, certificationId: string): Promise<void> {
    await this.graph.addEdge(categoryId, certificationId, KNOWLEDGE_RELATION_TYPES.REQUIRES)
  }

  async getRequiredCertifications(categoryId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(categoryId)
    return edges.filter(e => e.relationType === KNOWLEDGE_RELATION_TYPES.REQUIRES).map(e => e.toItemId)
  }

  /** vendorId is blacklisted for the reason described by reasonItemId (e.g. a risk/audit finding). */
  async linkBlacklistReason(vendorId: string, reasonItemId: string): Promise<void> {
    await this.graph.addEdge(vendorId, reasonItemId, BLACKLISTED_FOR)
  }

  async getBlacklistReasons(vendorId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(vendorId)
    return edges.filter(e => e.relationType === BLACKLISTED_FOR).map(e => e.toItemId)
  }
}
