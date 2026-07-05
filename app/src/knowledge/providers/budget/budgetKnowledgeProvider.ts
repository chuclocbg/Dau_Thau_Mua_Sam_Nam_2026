import type { KnowledgeContext } from '../../platform/knowledgeTypes.ts'
import { KNOWLEDGE_RELATION_TYPES } from '../../platform/knowledgeTypes.ts'
import type { KnowledgeRepositories } from '../../repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../../graph/knowledgeGraph.ts'
import { SearchEngine } from '../../search/searchEngine.ts'
import { BaseKnowledgeProvider } from '../baseProvider.ts'

// ── BudgetKnowledgeProvider — Layer 2 (operationally binding) ─────────────────
// Budget codes, spending limits, fund source rules, fiscal year constraints.
// Domain-specific graph behaviors: budget code hierarchy (a NEW relation type,
// 'ROLLS_UP_TO', for chart-of-accounts-style parent/child rollups) and fund
// source rule linkage (REFERENCES).

const ROLLS_UP_TO = 'ROLLS_UP_TO'

export class BudgetKnowledgeProvider extends BaseKnowledgeProvider {
  readonly domain = 'budget'
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
    return `Applicable budget rule${context.fundSource ? ` for ${context.fundSource}` : ''}`
  }

  /** childCodeId rolls up into parentCodeId (chart-of-accounts hierarchy). */
  async linkParentBudgetCode(childCodeId: string, parentCodeId: string): Promise<void> {
    await this.graph.addEdge(childCodeId, parentCodeId, ROLLS_UP_TO)
  }

  async getParentBudgetCode(childCodeId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(childCodeId)
    return edges.filter(e => e.relationType === ROLLS_UP_TO).map(e => e.toItemId)
  }

  async getChildBudgetCodes(parentCodeId: string): Promise<readonly string[]> {
    const incoming = await this.graph.getIncomingEdges(parentCodeId)
    return incoming.filter(e => e.relationType === ROLLS_UP_TO).map(e => e.fromItemId)
  }

  /** budgetCodeId is governed by the fund source rule ruleId. */
  async linkFundSourceRule(budgetCodeId: string, ruleId: string): Promise<void> {
    await this.graph.addEdge(budgetCodeId, ruleId, KNOWLEDGE_RELATION_TYPES.REFERENCES)
  }

  async getFundSourceRules(budgetCodeId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(budgetCodeId)
    return edges.filter(e => e.relationType === KNOWLEDGE_RELATION_TYPES.REFERENCES).map(e => e.toItemId)
  }
}
