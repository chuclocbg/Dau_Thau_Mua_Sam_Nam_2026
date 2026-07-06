import type { IntentType, ReasoningIntent } from '../domain/reasoningTypes.ts'
import type { IntentResolutionPlan, ResolutionStep } from '../domain/knowledgeResolutionTypes.ts'

// ── KnowledgeResolutionPlanner — Phase X.3.3 ────────────────────────────────────
// Decides WHICH domain(s)/retrieval method to query for a given intent — never ranks,
// scores, resolves conflicts, or generates an answer. Data-driven (Map lookup), per this
// project's established "no switch/if" convention (mirrors QueryRouter's own stated Rule 3).
//
// SCOPE NOTE: per app/knowledge/reasoning/pipeline.md's Stage 2 design, several intent types
// additionally need 'checklists', 'cases', 'bestpractice', and 'risk' domains. Those domains
// have NO destination field on the frozen ResolvedKnowledge (Batch A) — only legalItems,
// procurementItems, ruleItems, thresholdItems, and schoolPolicyItems exist. Since Reasoning
// Pipeline Core must remain untouched this milestone, this planner intentionally does not
// request those domains yet — requesting data with nowhere to go would either be silently
// discarded (misleading) or require inventing a destination, neither acceptable. Only
// AUTHORITY_CHECK and COMPLIANCE_CHECK's 'school' need is wired, since schoolPolicyItems
// already exists. See the implementation report for the full accounting.

const BASELINE_STEPS: readonly ResolutionStep[] = [
  { domain: 'legal', method: 'RESOLVE' },
  { domain: 'procurement', method: 'RESOLVE' },
]

const ADDITIONAL_STEPS_BY_INTENT: Readonly<Partial<Record<IntentType, readonly ResolutionStep[]>>> = Object.freeze({
  AUTHORITY_CHECK: [{ domain: 'school', method: 'RESOLVE' }],
  COMPLIANCE_CHECK: [{ domain: 'school', method: 'RESOLVE' }],
})

export function planKnowledgeResolution(intent: ReasoningIntent): IntentResolutionPlan {
  const additional = ADDITIONAL_STEPS_BY_INTENT[intent.intentType] ?? []
  return { steps: [...BASELINE_STEPS, ...additional] }
}
