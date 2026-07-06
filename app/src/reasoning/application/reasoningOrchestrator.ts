import { buildFinalKnowledgeResolutionPipeline } from './finalKnowledgeResolutionPipeline.ts'
import { buildLegalReasoningEngine } from './legalReasoningEngine.ts'
import type { FinalKnowledgeResolutionPipeline } from './finalKnowledgeResolutionPipeline.ts'
import type { RankingPlanner } from './knowledgeRankingPipeline.ts'
import type { IKnowledgeRepository } from '../domain/knowledgeRepositoryTypes.ts'
import type { ILegalReasoningEngine, ReasoningIntent, ReasoningResult } from '../domain/reasoningTypes.ts'

// ── ReasoningOrchestrator — Phase X.4.1 (Reasoning Engine Wiring — Batch A) ────
// Coordinates two already-completed, frozen components — X.3.7's
// FinalKnowledgeResolutionPipeline and Batch A's LegalReasoningEngine — into the one call chain
// Phase X.3's own original objective always intended: ReasoningIntent -> Knowledge Resolution ->
// ReasoningResult. Zero business logic of its own: no ranking, no retrieval, no answer
// generation, no citation formatting, no conflict resolution, no confidence scoring — all of
// that remains inside the components it calls, untouched.
//
// "Invoke KnowledgeResolutionPipeline" (this milestone's stated responsibility) means X.3.7's
// FinalKnowledgeResolutionPipeline specifically, not X.3.5's KnowledgeResolutionPipeline alone —
// Phase X.3 was declared complete specifically because X.3.7 composes X.3.1-X.3.6 (including
// X.3.6's enrichment) into one pipeline; calling X.3.5's narrower class directly would silently
// skip enrichment (ruleItems/thresholdItems would stay empty) and would not be "the completed
// X.3 pipeline" this milestone's goal refers to.
//
// Deliberately returns ReasoningResult only, not EnrichmentResult's diagnostics alongside it.
// PHASE_X3_FINAL_ARCHITECTURE_AUDIT.md's Finding F-2 (how ResolutionDiagnostics.missingEvidence
// should reconcile with ReasoningResult.missingEvidence) remains an open, undecided question —
// surfacing diagnostics here would mean answering it unilaterally in a "zero additional
// responsibilities" milestone. Deferred, not dropped: EnrichmentResult itself is unchanged and
// still available to any caller who resolves knowledge directly instead of through this
// orchestrator.

export class ReasoningOrchestrator {
  private readonly pipeline: FinalKnowledgeResolutionPipeline

  constructor(
    repository: IKnowledgeRepository,
    private readonly engine: ILegalReasoningEngine = buildLegalReasoningEngine(),
    rankingPlanner?: RankingPlanner,
  ) {
    this.pipeline = buildFinalKnowledgeResolutionPipeline(repository, rankingPlanner)
  }

  async answer(intent: ReasoningIntent): Promise<ReasoningResult> {
    const { knowledge } = await this.pipeline.resolve(intent)
    return this.engine.reason(intent, knowledge)
  }
}

export function buildReasoningOrchestrator(
  repository: IKnowledgeRepository, engine?: ILegalReasoningEngine, rankingPlanner?: RankingPlanner,
): ReasoningOrchestrator {
  return new ReasoningOrchestrator(repository, engine, rankingPlanner)
}
