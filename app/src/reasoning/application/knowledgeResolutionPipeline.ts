import { buildIntentResolutionPipeline } from './intentResolutionPipeline.ts'
import { buildKnowledgeRankingPipeline, type RankingPlanner } from './knowledgeRankingPipeline.ts'
import { createIntentRetrievalExecutor, createRankingExecutor } from './resolutionExecutor.ts'
import { ResolutionCoordinator } from './resolutionCoordinator.ts'
import type { IKnowledgeRepository } from '../domain/knowledgeRepositoryTypes.ts'
import type { RankedKnowledge } from '../domain/resolutionOrchestrationTypes.ts'
import type { ReasoningIntent } from '../domain/reasoningTypes.ts'

// ── KnowledgeResolutionPipeline — Phase X.3.5 ──────────────────────────────────
// The public composition root wiring X.3.3 (IntentResolutionPipeline) and X.3.4
// (KnowledgeRankingPipeline) into one deterministic pipeline: Intent Resolution -> Retrieval ->
// Ranking -> RankedKnowledge. No additional processing. Constructs both sub-pipelines via their
// existing build*() factory functions and calls only their existing public methods — zero
// modification to X.3.1-X.3.4, zero new reasoning logic. Repository (X.3.2) and ranking planner
// (X.3.4) are dependency-injected so callers/tests can substitute either without touching this
// file.

export class KnowledgeResolutionPipeline {
  private readonly coordinator: ResolutionCoordinator

  constructor(repository: IKnowledgeRepository, rankingPlanner?: RankingPlanner) {
    const intentResolutionPipeline = buildIntentResolutionPipeline(repository)
    const knowledgeRankingPipeline = buildKnowledgeRankingPipeline(rankingPlanner)
    this.coordinator = new ResolutionCoordinator(
      createIntentRetrievalExecutor(intentResolutionPipeline),
      createRankingExecutor(knowledgeRankingPipeline),
    )
  }

  async resolve(intent: ReasoningIntent): Promise<RankedKnowledge> {
    return this.coordinator.coordinate(intent)
  }
}

export function buildKnowledgeResolutionPipeline(
  repository: IKnowledgeRepository, rankingPlanner?: RankingPlanner,
): KnowledgeResolutionPipeline {
  return new KnowledgeResolutionPipeline(repository, rankingPlanner)
}
