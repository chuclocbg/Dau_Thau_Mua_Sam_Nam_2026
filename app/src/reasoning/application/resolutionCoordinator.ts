import type { RankedKnowledge, ResolutionExecutor } from '../domain/resolutionOrchestrationTypes.ts'
import type { ReasoningIntent, ResolvedKnowledge } from '../domain/reasoningTypes.ts'

// ── ResolutionCoordinator — Phase X.3.5 ────────────────────────────────────────
// Sequences exactly two stages, in order: Intent Resolution + Retrieval (X.3.3), then Ranking
// (X.3.4). No branching, no additional steps, no reasoning logic of its own — orchestration
// only, per this milestone's explicit scope.

export class ResolutionCoordinator {
  constructor(
    private readonly intentRetrievalExecutor: ResolutionExecutor<void, ResolvedKnowledge>,
    private readonly rankingExecutor: ResolutionExecutor<ResolvedKnowledge, RankedKnowledge>,
  ) {}

  async coordinate(intent: ReasoningIntent): Promise<RankedKnowledge> {
    const resolved = await this.intentRetrievalExecutor.execute(undefined, intent)
    return this.rankingExecutor.execute(resolved, intent)
  }
}
