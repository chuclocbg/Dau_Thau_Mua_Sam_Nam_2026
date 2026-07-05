import type { KnowledgeContext } from '../../platform/knowledgeTypes.ts'
import { KNOWLEDGE_RELATION_TYPES } from '../../platform/knowledgeTypes.ts'
import type { KnowledgeRepositories } from '../../repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../../graph/knowledgeGraph.ts'
import { SearchEngine } from '../../search/searchEngine.ts'
import { BaseKnowledgeProvider } from '../baseProvider.ts'

// ── ChecklistProvider — Layer 2 (operationally binding) ───────────────────────
// Compliance checklists, verification lists, per-phase quality gates.
// Domain-specific graph behaviors: phase-gate ordering (DEPENDS_ON — this
// checklist's phase must pass before the next phase's checklist applies) and
// "who requires me" lookup (incoming USES_CHECKLIST edges from e.g. a
// procurement method, mirroring ProcurementProvider.getRequiredTemplates()
// from the other direction).

export class ChecklistProvider extends BaseKnowledgeProvider {
  readonly domain = 'checklists'
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
    return `Applicable compliance checklist${context.packageType ? ` for ${context.packageType}` : ''}`
  }

  /** checklistId's phase gate must pass before nextPhaseChecklistId applies. */
  async linkNextPhase(checklistId: string, nextPhaseChecklistId: string): Promise<void> {
    await this.graph.addEdge(nextPhaseChecklistId, checklistId, KNOWLEDGE_RELATION_TYPES.DEPENDS_ON)
  }

  async getPreviousPhase(checklistId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(checklistId)
    return edges.filter(e => e.relationType === KNOWLEDGE_RELATION_TYPES.DEPENDS_ON).map(e => e.toItemId)
  }

  /** Items (e.g. procurement methods) that declared USES_CHECKLIST → checklistId. */
  async getRequiredBy(checklistId: string): Promise<readonly string[]> {
    const incoming = await this.graph.getIncomingEdges(checklistId)
    return incoming.filter(e => e.relationType === KNOWLEDGE_RELATION_TYPES.USES_CHECKLIST).map(e => e.fromItemId)
  }
}
