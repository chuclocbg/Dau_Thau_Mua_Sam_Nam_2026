import type { KnowledgeContext } from '../../platform/knowledgeTypes.ts'
import { KNOWLEDGE_RELATION_TYPES } from '../../platform/knowledgeTypes.ts'
import type { KnowledgeRepositories } from '../../repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../../graph/knowledgeGraph.ts'
import { SearchEngine } from '../../search/searchEngine.ts'
import { BaseKnowledgeProvider } from '../baseProvider.ts'

// ── BestPracticeProvider — Layer 4 (advisory only) ────────────────────────
// Implementation patterns, recommended workflows, procurement best
// practices, architecture patterns, coding standards, operational guidance.
// A future-facing bridge for Phase X (AI Advisory Layer) — this provider is
// ONLY a knowledge source; no AI reasoning or LLM calls live here.
// Domain-specific graph behaviors: pattern implementation linkage
// (IMPLEMENTS — the last of the 10 documented relation constants to see a
// real usage) and derivation from a precedent case via a NEW relation type
// ('DERIVED_FROM').

const DERIVED_FROM = 'DERIVED_FROM'

export class BestPracticeProvider extends BaseKnowledgeProvider {
  readonly domain = 'bestpractice'
  readonly layer = 4 as const
  readonly version = '1.0.0'

  constructor(
    repos: KnowledgeRepositories,
    private readonly graph: IKnowledgeGraph,
    searchEngine?: SearchEngine,
  ) {
    super(repos, searchEngine)
  }

  protected override suggestionReason(context: KnowledgeContext): string {
    return `Applicable best practice${context.procurementMethod ? ` for ${context.procurementMethod}` : ''}`
  }

  /** bestPracticeId implements the architecture/procurement pattern patternId. */
  async linkImplementsPattern(bestPracticeId: string, patternId: string): Promise<void> {
    await this.graph.addEdge(bestPracticeId, patternId, KNOWLEDGE_RELATION_TYPES.IMPLEMENTS)
  }

  async getImplementedPatterns(bestPracticeId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(bestPracticeId)
    return edges.filter(e => e.relationType === KNOWLEDGE_RELATION_TYPES.IMPLEMENTS).map(e => e.toItemId)
  }

  /** bestPracticeId was derived from the precedent case caseId. */
  async linkDerivedFromCase(bestPracticeId: string, caseId: string): Promise<void> {
    await this.graph.addEdge(bestPracticeId, caseId, DERIVED_FROM)
  }

  async getDerivedFromCases(bestPracticeId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(bestPracticeId)
    return edges.filter(e => e.relationType === DERIVED_FROM).map(e => e.toItemId)
  }
}
