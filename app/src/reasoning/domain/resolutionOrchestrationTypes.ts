import type { ReasoningIntent, ResolvedKnowledge } from './reasoningTypes.ts'

// ── Resolution Orchestration Types — Phase X.3.5 ───────────────────────────────
// Types for composing the already-frozen X.3.3 (IntentResolutionPipeline) and X.3.4
// (KnowledgeRankingPipeline) into one deterministic call chain: Intent Resolution -> Retrieval
// -> Ranking -> RankedKnowledge. No new reasoning capability — RankedKnowledge is the same
// frozen ResolvedKnowledge shape, aliased only to name the post-ranking state.

export type RankedKnowledge = ResolvedKnowledge

export interface ResolutionExecutor<TInput, TOutput> {
  execute(input: TInput, intent: ReasoningIntent): Promise<TOutput>
}
