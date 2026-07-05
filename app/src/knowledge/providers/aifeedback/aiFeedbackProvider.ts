import type { KnowledgeContext } from '../../platform/knowledgeTypes.ts'
import { KNOWLEDGE_RELATION_TYPES } from '../../platform/knowledgeTypes.ts'
import type { KnowledgeRepositories } from '../../repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../../graph/knowledgeGraph.ts'
import { SearchEngine } from '../../search/searchEngine.ts'
import { BaseKnowledgeProvider } from '../baseProvider.ts'

// ── AIFeedbackProvider — Layer 4 (advisory only) ──────────────────────────
// Human review feedback, AI correction history, reviewer comments, model
// evaluation, prompt improvement, quality observations. A future-facing
// bridge for Phase X (AI Advisory Layer) — this provider is ONLY a
// knowledge source; it contains NO AI reasoning and makes NO LLM calls.
// Domain-specific graph behaviors: correction linkage to the item a piece
// of feedback corrected via a NEW relation type ('CORRECTS'), and linkage
// to a best practice the feedback should inform (RELATED_TO, reused).

const CORRECTS = 'CORRECTS'

export class AIFeedbackProvider extends BaseKnowledgeProvider {
  readonly domain = 'ai_feedback'
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
    return 'Applicable AI feedback/quality observation'
  }

  /** feedbackId corrects the previously generated item correctedItemId. */
  async linkCorrection(feedbackId: string, correctedItemId: string): Promise<void> {
    await this.graph.addEdge(feedbackId, correctedItemId, CORRECTS)
  }

  async getCorrectedItems(feedbackId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(feedbackId)
    return edges.filter(e => e.relationType === CORRECTS).map(e => e.toItemId)
  }

  /** feedbackId is related to the best practice bestPracticeId it should inform. */
  async linkRelatedBestPractice(feedbackId: string, bestPracticeId: string): Promise<void> {
    await this.graph.addEdge(feedbackId, bestPracticeId, KNOWLEDGE_RELATION_TYPES.RELATED_TO)
  }

  async getRelatedBestPractices(feedbackId: string): Promise<readonly string[]> {
    const edges = await this.graph.getEdges(feedbackId)
    return edges.filter(e => e.relationType === KNOWLEDGE_RELATION_TYPES.RELATED_TO).map(e => e.toItemId)
  }
}
