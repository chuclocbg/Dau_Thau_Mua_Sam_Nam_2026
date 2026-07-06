import type {
  ApplicabilityEvaluation, EffectivePeriodEvaluation, ResolutionDiagnostics,
} from '../domain/knowledgeEnrichmentTypes.ts'
import type { MissingEvidence } from '../domain/reasoningTypes.ts'

// ── Resolution Diagnostics — Phase X.3.6 ───────────────────────────────────────
// Aggregates the per-item effectivePeriod/applicability evaluations and metadata-parse failures
// produced during enrichment into one summarized, auditable record — never re-derives or
// second-guesses any individual evaluation, only counts and carries them forward.

export function buildResolutionDiagnostics(
  effectivePeriodEvaluations: readonly EffectivePeriodEvaluation[],
  applicabilityEvaluations: readonly ApplicabilityEvaluation[],
  missingEvidence: readonly MissingEvidence[],
): ResolutionDiagnostics {
  return {
    effectivePeriodEvaluations,
    applicabilityEvaluations,
    missingEvidence,
    summary: {
      totalItemsEvaluated: effectivePeriodEvaluations.length,
      notYetEffectiveCount: applicabilityEvaluations.filter(e => e.status === 'NOT_YET_EFFECTIVE').length,
      expiredCount: applicabilityEvaluations.filter(e => e.status === 'EXPIRED').length,
      missingEvidenceCount: missingEvidence.length,
    },
  }
}
