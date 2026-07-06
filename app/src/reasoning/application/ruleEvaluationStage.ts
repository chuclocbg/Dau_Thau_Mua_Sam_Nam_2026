import { evaluateRule, evaluateThreshold } from './ruleEngine.ts'
import { evaluateEffectivePeriod } from './effectivePeriodEvaluator.ts'
import { evaluateApplicability } from './knowledgeApplicabilityEvaluator.ts'
import { legalHierarchyScore } from './rankingStrategy.ts'
import type { KnowledgeItemEvaluation, RuleEvaluationResult } from '../domain/ruleEvaluationTypes.ts'
import type { KnowledgeItemRef } from '../domain/reasoningTypes.ts'
import type { ReasoningExecutionContext } from '../domain/reasoningExecutionContextTypes.ts'

// ── Rule Evaluation Stage — Phase X.4.3 ────────────────────────────────────────
// Consumes a single ReasoningExecutionContext (X.4.2) — which already bundles the
// ReasoningIntent and the resolved-knowledge item buckets X.3 produced — and produces only
// intermediate RuleEvaluationResult objects. No conflict resolution, no ranking of competing
// conclusions, no explanation/citation/answer generation, no confidence scoring — all of that
// remains legalReasoningEngine.ts's job, untouched.
//
// Takes one parameter, not three (ReasoningIntent/ReasoningExecutionContext/ResolvedKnowledge as
// this milestone's goal names them), because ReasoningExecutionContext.intent already IS the
// ReasoningIntent, and ReasoningExecutionContext's five item buckets already carry forward
// everything from ResolvedKnowledge this stage needs — a second and third parameter would be
// redundant, not "no adapter code."
//
// Every sub-computation is reused directly from an already-frozen milestone rather than
// reimplemented, per this project's own no-duplicated-business-logic discipline:
//   - execute legal rules / evaluate threshold rules -> ruleEngine.ts's evaluateRule()/
//     evaluateThreshold() (Batch A, frozen, already exported). Exception detection is
//     deliberately out of scope here (not a named responsibility of this milestone) — every
//     rule is evaluated with an empty exceptions array; detectExceptions() itself needs an
//     AppliedArticle, constructed only by legalReasoningEngine.ts's own private
//     toAppliedArticle(), which this milestone does not reach into.
//   - evaluate temporal validity -> effectivePeriodEvaluator.ts's evaluateEffectivePeriod()
//     (X.3.6, frozen, already exported).
//   - evaluate applicability -> knowledgeApplicabilityEvaluator.ts's evaluateApplicability()
//     (X.3.6, frozen, already exported) — called with metadataParseFailed = false always: any
//     item that failed metadata parsing was already excluded upstream by X.3.6's own
//     enrichment, before it could ever reach ruleItems/thresholdItems here.
//   - evaluate legal hierarchy -> rankingStrategy.ts's legalHierarchyScore() (X.3.4, frozen,
//     already exported) — reused rather than re-deriving a second independent authority-level
//     table (unlike X.3.4 itself, which had no earlier exported table to reuse and so defined
//     its own, per its own documented rationale).
//
// preserve evidence references: LegalRuleResult.legalBasis/LegalThresholdResult.legalBasis
// already carry item.legalBasis forward unchanged (ruleEngine.ts's own existing contract) —
// this stage adds nothing and drops nothing.

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key])
    }
    Object.freeze(value)
  }
  return value
}

function evaluateItem(item: KnowledgeItemRef, asOfDate: string): KnowledgeItemEvaluation {
  const temporalValidity = evaluateEffectivePeriod(item, asOfDate)
  const applicability = evaluateApplicability(item, temporalValidity, false)
  return {
    itemId: item.itemId,
    temporalValidity: temporalValidity.status,
    applicability: applicability.status,
    hierarchyScore: legalHierarchyScore(item),
  }
}

function allItems(context: ReasoningExecutionContext): readonly KnowledgeItemRef[] {
  return [
    ...context.legalItems, ...context.procurementItems, ...context.schoolPolicyItems,
    ...context.ruleItems, ...context.thresholdItems,
  ]
}

export function evaluateRules(context: ReasoningExecutionContext): RuleEvaluationResult {
  const itemEvaluations = allItems(context).map(item => evaluateItem(item, context.asOfDate))
  const ruleResults = context.ruleItems.map(item => evaluateRule(item, context.intent.context, []))
  const thresholdResults = context.thresholdItems
    .map(item => evaluateThreshold(item, context.intent.context))
    .filter((result): result is NonNullable<typeof result> => result !== null)

  const result: RuleEvaluationResult = {
    asOfDate: context.asOfDate,
    itemEvaluations,
    ruleResults,
    thresholdResults,
    evaluatedAt: new Date().toISOString(),
  }
  return deepFreeze(result)
}
