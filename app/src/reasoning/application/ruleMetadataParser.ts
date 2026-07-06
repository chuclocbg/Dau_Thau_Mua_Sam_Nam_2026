import { readMetadataString } from './resolutionMetadataNormalizer.ts'
import type { EvaluationRuleMetadata, KnowledgeItemRef, MissingEvidence, RuleKnowledgeItemRef } from '../domain/reasoningTypes.ts'

// ── Rule Metadata Parser — Phase X.3.6 ─────────────────────────────────────────
// Implements ADR-022 Decision 5 for rules: metadata['ruleDefinition'] is a single JSON-encoded
// string, parsed via JSON.parse inside a try/catch. A parse failure or a structurally invalid
// result produces a critical MissingEvidence entry and excludes the item — never throws, never
// silently defaults. An item with no ruleDefinition key at all is not an error: it simply isn't
// a rule item, and parseRuleMetadata returns null.

export type RuleParseResult =
  | { readonly ok: true; readonly item: RuleKnowledgeItemRef }
  | { readonly ok: false; readonly missingEvidence: MissingEvidence }

function isValidRuleMetadata(value: unknown): value is EvaluationRuleMetadata {
  if (typeof value !== 'object' || value === null) return false
  const rule = value as Partial<EvaluationRuleMetadata>
  return typeof rule.ruleCode === 'string'
    && typeof rule.ruleCategory === 'string'
    && Array.isArray(rule.conditions)
    && typeof rule.isCritical === 'boolean'
    && typeof rule.outcome === 'object' && rule.outcome !== null
    && typeof rule.outcome.pass === 'string'
    && typeof rule.outcome.fail === 'string'
}

function missingEvidenceFor(item: KnowledgeItemRef, reason: string): MissingEvidence {
  return {
    evidenceId: `rule-parse-failure-${item.itemId}`,
    description: `Item ${item.itemId}'s ruleDefinition ${reason}; excluded from ruleItems`,
    isCritical: true,
    impact: 'The rule this item defines cannot be evaluated deterministically.',
  }
}

export function parseRuleMetadata(item: KnowledgeItemRef): RuleParseResult | null {
  const raw = readMetadataString(item.metadata, 'ruleDefinition')
  if (raw === undefined) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, missingEvidence: missingEvidenceFor(item, 'is not valid JSON') }
  }

  if (!isValidRuleMetadata(parsed)) {
    return { ok: false, missingEvidence: missingEvidenceFor(item, 'is missing required fields') }
  }

  return { ok: true, item: { ...item, rule: parsed } }
}
