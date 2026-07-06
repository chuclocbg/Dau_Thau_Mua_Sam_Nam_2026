import { evaluateEffectivePeriod } from './effectivePeriodEvaluator.ts'
import { parseRuleMetadata } from './ruleMetadataParser.ts'
import { parseThresholdMetadata } from './thresholdMetadataParser.ts'
import { evaluateApplicability } from './knowledgeApplicabilityEvaluator.ts'
import { buildResolutionDiagnostics } from './resolutionDiagnostics.ts'
import type { ApplicabilityEvaluation, EffectivePeriodEvaluation, ResolutionDiagnostics } from '../domain/knowledgeEnrichmentTypes.ts'
import type {
  KnowledgeItemRef, MissingEvidence, ResolvedKnowledge, RuleKnowledgeItemRef, ThresholdKnowledgeItemRef,
} from '../domain/reasoningTypes.ts'

// ── KnowledgeEnrichmentPipeline — Phase X.3.6 ──────────────────────────────────
// Completes the deterministic knowledge-resolution capabilities deferred through X.3.1-X.3.5:
// ADR-022 Decision 5's rule/threshold metadata parsing (ruleItems/thresholdItems have been
// empty since X.3.3), plus an independent effectivePeriod/applicability diagnostic pass. A
// standalone, pure function taking a RankedKnowledge (X.3.5's output) and returning it enriched
// - it does not import, wrap, or modify KnowledgeResolutionPipeline/ResolutionCoordinator (X.3.5)
// or any earlier X.3 file; a later, not-yet-authorized milestone may compose this after X.3.5's
// resolve(), the same way X.3.5 later composed X.3.3+X.3.4 without touching either.
//
// Never ranks, scores, resolves conflicts, formats citations, or generates an answer -
// confirmed absent by architecture guard.

export interface EnrichmentResult {
  readonly knowledge: ResolvedKnowledge
  readonly diagnostics: ResolutionDiagnostics
}

function allEnrichableItems(knowledge: ResolvedKnowledge): readonly KnowledgeItemRef[] {
  return [...knowledge.legalItems, ...knowledge.procurementItems, ...knowledge.schoolPolicyItems]
}

export function enrichKnowledge(knowledge: ResolvedKnowledge): EnrichmentResult {
  const asOfDate = knowledge.asOfDate

  const effectivePeriodEvaluations: EffectivePeriodEvaluation[] = []
  const applicabilityEvaluations: ApplicabilityEvaluation[] = []
  const missingEvidence: MissingEvidence[] = []
  const ruleItems: RuleKnowledgeItemRef[] = []
  const thresholdItems: ThresholdKnowledgeItemRef[] = []

  for (const item of allEnrichableItems(knowledge)) {
    const effectivePeriod = evaluateEffectivePeriod(item, asOfDate)
    effectivePeriodEvaluations.push(effectivePeriod)

    const ruleResult = parseRuleMetadata(item)
    const thresholdResult = parseThresholdMetadata(item)
    let metadataParseFailed = false

    if (ruleResult !== null) {
      if (ruleResult.ok) ruleItems.push(ruleResult.item)
      else { missingEvidence.push(ruleResult.missingEvidence); metadataParseFailed = true }
    }
    if (thresholdResult !== null) {
      if (thresholdResult.ok) thresholdItems.push(thresholdResult.item)
      else { missingEvidence.push(thresholdResult.missingEvidence); metadataParseFailed = true }
    }

    applicabilityEvaluations.push(evaluateApplicability(item, effectivePeriod, metadataParseFailed))
  }

  return {
    knowledge: { ...knowledge, ruleItems, thresholdItems },
    diagnostics: buildResolutionDiagnostics(effectivePeriodEvaluations, applicabilityEvaluations, missingEvidence),
  }
}
