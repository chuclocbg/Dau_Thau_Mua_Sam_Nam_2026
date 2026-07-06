import { planKnowledgeResolution } from './knowledgeResolutionPlanner.ts'
import { buildEffectivePeriodWarnings } from './resolveKnowledgeWarnings.ts'
import type { IKnowledgeRepository, KnowledgeRetrievalResult } from '../domain/knowledgeRepositoryTypes.ts'
import type { ResolutionStep } from '../domain/knowledgeResolutionTypes.ts'
import type { KnowledgeItemRef, ReasoningIntent, ResolvedKnowledge } from '../domain/reasoningTypes.ts'

// ── IntentResolutionPipeline — Phase X.3.3 ─────────────────────────────────────
// Connects the retrieval layer (X.3.2, IKnowledgeRepository) to the reasoning pipeline by
// producing a real ResolvedKnowledge from a ReasoningIntent. Depends ONLY on
// IKnowledgeRepository (the interface, dependency-injected) — never on
// knowledgePlatformRepository.ts or anything under src/knowledge/ directly, preserving
// Constraint C-06's sole-caller property transitively (verified by architecture guard).
//
// Does not rank, score, compute confidence, order evidence, format citations, resolve
// conflicts, or generate an answer — those remain legalReasoningEngine.ts's job (Batch A,
// frozen, unchanged). ruleItems/thresholdItems are intentionally left empty this milestone
// (ADR-022 Decision 5's rule/threshold metadata parsing is not yet implemented) — see the
// implementation report.

const DEFAULT_SEARCH_LIMIT = 5

type KnowledgeItemBucket = 'legalItems' | 'procurementItems' | 'schoolPolicyItems'

function bucketForDomain(domain: string): KnowledgeItemBucket | null {
  switch (domain) {
    case 'legal': return 'legalItems'
    case 'procurement': return 'procurementItems'
    case 'school': return 'schoolPolicyItems'
    default: return null
  }
}

// Extracted as a standalone function (rather than a private method) specifically so the
// RESOLVE-vs-SEARCH dispatch decision is directly unit-testable on its own, independent of
// whichever plan the planner happens to produce today.
export async function executeResolutionStep(
  step: ResolutionStep, intent: ReasoningIntent, repository: IKnowledgeRepository,
): Promise<KnowledgeRetrievalResult> {
  if (step.method === 'SEARCH') {
    return repository.searchKnowledge(
      intent.question, [step.domain], intent.context, step.limit ?? DEFAULT_SEARCH_LIMIT,
    )
  }
  return repository.resolveKnowledge(step.domain, intent.context, intent.context.asOfDate)
}

export class IntentResolutionPipeline {
  constructor(private readonly repository: IKnowledgeRepository) {}

  async resolve(intent: ReasoningIntent): Promise<ResolvedKnowledge> {
    const plan = planKnowledgeResolution(intent)

    const buckets: Record<KnowledgeItemBucket, KnowledgeItemRef[]> = {
      legalItems: [], procurementItems: [], schoolPolicyItems: [],
    }
    const effectivePeriodAssumedItemIds: string[] = []

    for (const step of plan.steps) {
      const result = await executeResolutionStep(step, intent, this.repository)
      effectivePeriodAssumedItemIds.push(...result.effectivePeriodAssumedItemIds)

      const bucket = bucketForDomain(step.domain)
      if (bucket) buckets[bucket].push(...result.items)
    }

    return {
      legalItems: buckets.legalItems,
      procurementItems: buckets.procurementItems,
      thresholdItems: [],
      ruleItems: [],
      schoolPolicyItems: buckets.schoolPolicyItems,
      asOfDate: intent.context.asOfDate,
      resolvedAt: new Date().toISOString(),
      platformCallCount: plan.steps.length,
      warnings: buildEffectivePeriodWarnings(effectivePeriodAssumedItemIds),
    }
  }
}

export function buildIntentResolutionPipeline(repository: IKnowledgeRepository): IntentResolutionPipeline {
  return new IntentResolutionPipeline(repository)
}
