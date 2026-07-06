import { planRanking } from './rankingPlanner.ts'
import { selectCandidates } from './candidateSelector.ts'
import type { ReasoningIntent, ResolvedKnowledge } from '../domain/reasoningTypes.ts'
import type { RankingPlan } from '../domain/knowledgeRankingTypes.ts'

// ── KnowledgeRankingPipeline — Phase X.3.4 ─────────────────────────────────────
// Consumes ONLY the output of X.3.3 (a ResolvedKnowledge value) and Batch A's own frozen
// ReasoningIntent — never imports intentResolutionPipeline.ts, knowledgeResolutionPlanner.ts,
// IKnowledgeRepository, or anything under src/knowledge/ (verified by architecture guard).
// Produces a NEW ResolvedKnowledge (same frozen shape) with each bucket independently
// ranked and trimmed — ready to hand to legalReasoningEngine.reason() unchanged. Never
// resolves conflicts (no item is ever compared against another for contradiction), never
// formats a citation, never composes an answer.
//
// The planner is dependency-injected (constructor parameter, defaulting to the standard
// rankingPlanner.ts) so a caller/test can substitute a custom planning strategy without
// this pipeline needing any external I/O dependency of its own.

export type RankingPlanner = (intent: ReasoningIntent) => RankingPlan

export class KnowledgeRankingPipeline {
  constructor(private readonly planner: RankingPlanner = planRanking) {}

  rank(resolved: ResolvedKnowledge, intent: ReasoningIntent): ResolvedKnowledge {
    const plan = this.planner(intent)
    const { weights, maxCandidates } = plan
    const asOfDate = resolved.asOfDate

    return {
      ...resolved,
      legalItems: selectCandidates(resolved.legalItems, weights, asOfDate, maxCandidates),
      procurementItems: selectCandidates(resolved.procurementItems, weights, asOfDate, maxCandidates),
      schoolPolicyItems: selectCandidates(resolved.schoolPolicyItems, weights, asOfDate, maxCandidates),
      ruleItems: selectCandidates(resolved.ruleItems, weights, asOfDate, maxCandidates),
      thresholdItems: selectCandidates(resolved.thresholdItems, weights, asOfDate, maxCandidates),
    }
  }
}

export function buildKnowledgeRankingPipeline(planner?: RankingPlanner): KnowledgeRankingPipeline {
  return new KnowledgeRankingPipeline(planner)
}
