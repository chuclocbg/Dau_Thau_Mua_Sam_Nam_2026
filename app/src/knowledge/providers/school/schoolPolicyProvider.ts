import type { KnowledgeContext } from '../../platform/knowledgeTypes.ts'
import { KNOWLEDGE_RELATION_TYPES } from '../../platform/knowledgeTypes.ts'
import type { KnowledgeRepositories } from '../../repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../../graph/knowledgeGraph.ts'
import { SearchEngine } from '../../search/searchEngine.ts'
import { BaseKnowledgeProvider } from '../baseProvider.ts'

// ── SchoolPolicyProvider — Layer 3 (institutionally binding, may be more
// restrictive than Layer 1) ────────────────────────────────────────────────
// Internal regulations of Industrial Technical College (CLAUDE.md's Legal
// Priority #13). Domain-specific graph behaviors: governing legal basis
// linkage (REFERENCES) and internal restrictions narrowing a broader rule
// via a NEW relation type ('RESTRICTS').

const RESTRICTS = 'RESTRICTS'

export class SchoolPolicyProvider extends BaseKnowledgeProvider {
  readonly domain = 'school'
  readonly layer = 3 as const
  readonly version = '1.0.0'

  constructor(
    repos: KnowledgeRepositories,
    private readonly graph: IKnowledgeGraph,
    searchEngine?: SearchEngine,
  ) {
    super(repos, searchEngine)
  }

  protected override suggestionReason(context: KnowledgeContext): string {
    return `Applicable school policy${context.department ? ` for ${context.department}` : ''}`
  }

  /** policyId is grounded in the legal document legalItemId. */
  async linkGoverningLegalBasis(policyId: string, legalItemId: string): Promise<void> {
    await this.graph.addEdge(policyId, legalItemId, KNOWLEDGE_RELATION_TYPES.REFERENCES)
  }

  async getGoverningLegalBasis(policyId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(policyId)
    return edges.filter(e => e.relationType === KNOWLEDGE_RELATION_TYPES.REFERENCES).map(e => e.toItemId)
  }

  /** policyId narrows/restricts the broader rule broaderRuleId (Layer 3 may exceed Layer 1). */
  async linkRestriction(policyId: string, broaderRuleId: string): Promise<void> {
    await this.graph.addEdge(policyId, broaderRuleId, RESTRICTS)
  }

  async getRestrictedRules(policyId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(policyId)
    return edges.filter(e => e.relationType === RESTRICTS).map(e => e.toItemId)
  }
}
