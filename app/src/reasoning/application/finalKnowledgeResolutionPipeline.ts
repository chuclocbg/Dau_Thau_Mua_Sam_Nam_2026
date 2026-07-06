import { buildKnowledgeResolutionPipeline } from './knowledgeResolutionPipeline.ts'
import { enrichKnowledge } from './knowledgeEnrichmentPipeline.ts'
import type { KnowledgeResolutionPipeline } from './knowledgeResolutionPipeline.ts'
import type { RankingPlanner } from './knowledgeRankingPipeline.ts'
import type { EnrichmentResult } from './knowledgeEnrichmentPipeline.ts'
import type { IKnowledgeRepository } from '../domain/knowledgeRepositoryTypes.ts'
import type { ReasoningIntent } from '../domain/reasoningTypes.ts'

// ── FinalKnowledgeResolutionPipeline — Phase X.3.7 ─────────────────────────────
// The final composition of every completed X.3 sub-milestone into one deterministic pipeline:
// Intent Resolution -> Retrieval -> Ranking (X.3.5's KnowledgeResolutionPipeline, unchanged) ->
// Enrichment (X.3.6's enrichKnowledge(), unchanged) -> ResolvedKnowledge.
//
// This composes ONLY the existing public surface of X.3.5 and X.3.6 - buildKnowledgeResolutionPipeline()
// and enrichKnowledge() - and needs no adapter: KnowledgeResolutionPipeline.resolve() already
// returns exactly the ResolvedKnowledge shape enrichKnowledge() expects, so the two stages plug
// together with zero translation code. resolutionCoordinator.ts/resolutionExecutor.ts (X.3.5)
// are not imported, wrapped, or extended here - reaching for that generic 2-stage machinery to
// bolt on a single, unconditional third call would be strictly more code for the same result;
// KnowledgeResolutionPipeline's own public resolve() is already the correct composition unit.
//
// Returns EnrichmentResult (not bare ResolvedKnowledge) so the enrichment stage's
// ResolutionDiagnostics survive to the caller - EnrichmentResult.knowledge is the
// ResolvedKnowledge this milestone's pipeline order refers to as its final box.

export class FinalKnowledgeResolutionPipeline {
  constructor(private readonly resolutionPipeline: KnowledgeResolutionPipeline) {}

  async resolve(intent: ReasoningIntent): Promise<EnrichmentResult> {
    const ranked = await this.resolutionPipeline.resolve(intent)
    return enrichKnowledge(ranked)
  }
}

export function buildFinalKnowledgeResolutionPipeline(
  repository: IKnowledgeRepository, rankingPlanner?: RankingPlanner,
): FinalKnowledgeResolutionPipeline {
  return new FinalKnowledgeResolutionPipeline(buildKnowledgeResolutionPipeline(repository, rankingPlanner))
}
