// ── Phase X.4 (Output Validation) — domain types ──────────────────────────────
// Per app/knowledge/ai-advisory/validation.md (pre-existing design corpus, reconciled
// here) and PHASE_X_EXECUTION_PLAN.md's X.4 scope. Pure types — no logic.
//
// NAMING NOTE: `ValidationResult` already collides with FOUR unrelated, pre-existing
// types (src/framework/capabilityTypes.ts, src/orchestrator/dryRunAdapter.ts,
// src/shared/financial/financialValidation.ts, src/procurement/workflow/
// workflowValidator.ts) — a very generic, widely-reused name in this repo. Renamed
// to `AIValidationResult`, matching the already-established `AIContext*` prefix
// family, per the grep-first, not defensive, naming rule used throughout Phase X.
//
// SCOPE NOTE: This milestone's 13 issue types are a superset of validation.md's
// original 8 (HALLUCINATED_CITATION, NUMERIC_INCONSISTENCY, DECISION_CONTRADICTION,
// LANGUAGE_MISMATCH, TRUNCATED_RESPONSE, FORBIDDEN_PATTERN, MISSING_REQUIRED_SECTION,
// UNSUPPORTED_CLAIM) plus 5 new ones this round's "10 validation responsibilities"
// require (MALFORMED_OUTPUT, INVALID_CITATION_STRUCTURE, CONFIDENCE_INCONSISTENCY,
// MISSING_LEGAL_BASIS, FORMATTING_VIOLATION) — additive only, nothing dropped from
// the pre-approved design.

export type ValidationSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export type ValidationIssueType =
  | 'MALFORMED_OUTPUT'
  | 'MISSING_REQUIRED_SECTION'
  | 'INVALID_CITATION_STRUCTURE'
  | 'HALLUCINATED_CITATION'
  | 'CONFIDENCE_INCONSISTENCY'
  | 'UNSUPPORTED_CLAIM'
  | 'MISSING_LEGAL_BASIS'
  | 'FORMATTING_VIOLATION'
  | 'NUMERIC_INCONSISTENCY'
  | 'DECISION_CONTRADICTION'
  | 'LANGUAGE_MISMATCH'
  | 'TRUNCATED_RESPONSE'
  | 'FORBIDDEN_PATTERN'

export interface ValidationIssue {
  readonly issueId: string
  readonly issueType: ValidationIssueType
  readonly severity: ValidationSeverity
  readonly description: string
  readonly evidence?: string
  readonly correction?: string
  readonly autoFixed: boolean
}

// ── The LLM output being validated (the "LLMResponse" this milestone's
// architecture rules refer to — provider-agnostic, matches LLMAdapterResult's
// success shape without importing any provider-specific type). ─────────────────

export interface LLMOutput {
  readonly content: string
  readonly model: string
  readonly finishReason?: string
}

export interface AIValidationResult {
  readonly passed: boolean
  readonly issues: readonly ValidationIssue[]
  readonly redactedContent?: string
  readonly wasRedacted: boolean
  readonly validationConfidence: number
  readonly validatedAt: string
}

// ── Human-readable summary of an AIValidationResult (responsibility 10) ────────

export interface ValidationReportSection {
  readonly severity: ValidationSeverity
  readonly count: number
  readonly summaries: readonly string[]
}

export interface ValidationReport {
  readonly contextId: string
  readonly passed: boolean
  readonly totalIssues: number
  readonly bySeverity: readonly ValidationReportSection[]
  readonly wasRedacted: boolean
  readonly humanReviewRecommended: boolean
  readonly generatedAt: string
}

// ── Final answer produced after formatting/remediation ─────────────────────────

export interface FinalAnswer {
  readonly content: string
  readonly wasModified: boolean
  readonly humanReviewRequired: boolean
  readonly humanReviewReason?: string
}
