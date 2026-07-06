import type { IntentResolutionPipeline } from './intentResolutionPipeline.ts'
import type { KnowledgeRankingPipeline } from './knowledgeRankingPipeline.ts'
import type { RankedKnowledge, ResolutionExecutor } from '../domain/resolutionOrchestrationTypes.ts'
import type { ResolvedKnowledge } from '../domain/reasoningTypes.ts'

// ── Resolution Executors — Phase X.3.5 ─────────────────────────────────────────
// Thin adapters exposing X.3.3's IntentResolutionPipeline.resolve() and X.3.4's
// KnowledgeRankingPipeline.rank() through one common ResolutionExecutor interface, so
// ResolutionCoordinator can sequence them uniformly without knowing either pipeline's own
// method name. Zero new logic — each executor only forwards its call.

export function createIntentRetrievalExecutor(
  pipeline: IntentResolutionPipeline,
): ResolutionExecutor<void, ResolvedKnowledge> {
  return { execute: (_input, intent) => pipeline.resolve(intent) }
}

export function createRankingExecutor(
  pipeline: KnowledgeRankingPipeline,
): ResolutionExecutor<ResolvedKnowledge, RankedKnowledge> {
  return { execute: (input, intent) => Promise.resolve(pipeline.rank(input, intent)) }
}
