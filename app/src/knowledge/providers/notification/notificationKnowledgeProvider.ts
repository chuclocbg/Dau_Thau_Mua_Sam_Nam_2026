import type { KnowledgeContext } from '../../platform/knowledgeTypes.ts'
import { KNOWLEDGE_RELATION_TYPES } from '../../platform/knowledgeTypes.ts'
import type { KnowledgeRepositories } from '../../repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../../graph/knowledgeGraph.ts'
import { SearchEngine } from '../../search/searchEngine.ts'
import { BaseKnowledgeProvider } from '../baseProvider.ts'

// ── NotificationKnowledgeProvider — Layer 2 (operationally binding) ───────────
// Notification templates, escalation rules, routing rules, SLA definitions.
// Not to be confused with src/notification/ (Phase L — the actual delivery
// infrastructure). This provider holds KNOWLEDGE about notification rules
// (when/how to escalate, which template applies), not live notification state.
// Domain-specific graph behaviors: escalation chains (a NEW relation type,
// 'ESCALATES_TO') and template linkage (reuses USES_TEMPLATE — the same
// meaning ProcurementProvider already established: "this rule uses that
// template").

const ESCALATES_TO = 'ESCALATES_TO'

export class NotificationKnowledgeProvider extends BaseKnowledgeProvider {
  readonly domain = 'notification'
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
    return 'Applicable notification/escalation rule'
  }

  /** ruleId escalates to escalatedToRuleId when unresolved past its SLA. */
  async linkEscalation(ruleId: string, escalatedToRuleId: string): Promise<void> {
    await this.graph.addEdge(ruleId, escalatedToRuleId, ESCALATES_TO)
  }

  async getEscalationTarget(ruleId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(ruleId)
    return edges.filter(e => e.relationType === ESCALATES_TO).map(e => e.toItemId)
  }

  /** ruleId uses message templateItemId. */
  async linkTemplate(ruleId: string, templateItemId: string): Promise<void> {
    await this.graph.addEdge(ruleId, templateItemId, KNOWLEDGE_RELATION_TYPES.USES_TEMPLATE)
  }

  async getLinkedTemplates(ruleId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(ruleId)
    return edges.filter(e => e.relationType === KNOWLEDGE_RELATION_TYPES.USES_TEMPLATE).map(e => e.toItemId)
  }
}
