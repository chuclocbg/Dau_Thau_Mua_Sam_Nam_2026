import { readMetadataString } from './resolutionMetadataNormalizer.ts'
import type { KnowledgeItemRef, MissingEvidence, ThresholdKnowledgeItemRef, ThresholdMetadata } from '../domain/reasoningTypes.ts'

// ── Threshold Metadata Parser — Phase X.3.6 ────────────────────────────────────
// Implements ADR-022 Decision 5 for thresholds: metadata['thresholdDefinition'] is a single
// JSON-encoded string, parsed via JSON.parse inside a try/catch. A parse failure or a
// structurally invalid result produces a critical MissingEvidence entry and excludes the item —
// never throws, never silently defaults. An item with no thresholdDefinition key at all is not
// an error: it simply isn't a threshold item, and parseThresholdMetadata returns null.

export type ThresholdParseResult =
  | { readonly ok: true; readonly item: ThresholdKnowledgeItemRef }
  | { readonly ok: false; readonly missingEvidence: MissingEvidence }

const VALID_OPERATORS = new Set(['GT', 'GTE', 'LT', 'LTE', 'BETWEEN'])
const VALID_UNITS = new Set(['VND', 'PERCENT', 'DAYS'])

function isValidThresholdMetadata(value: unknown): value is ThresholdMetadata {
  if (typeof value !== 'object' || value === null) return false
  const threshold = value as Partial<ThresholdMetadata>
  return typeof threshold.thresholdCode === 'string'
    && typeof threshold.thresholdType === 'string'
    && typeof threshold.contextField === 'string'
    && typeof threshold.operator === 'string' && VALID_OPERATORS.has(threshold.operator)
    && typeof threshold.value === 'string'
    && typeof threshold.unit === 'string' && VALID_UNITS.has(threshold.unit)
}

function missingEvidenceFor(item: KnowledgeItemRef, reason: string): MissingEvidence {
  return {
    evidenceId: `threshold-parse-failure-${item.itemId}`,
    description: `Item ${item.itemId}'s thresholdDefinition ${reason}; excluded from thresholdItems`,
    isCritical: true,
    impact: 'The threshold this item defines cannot be evaluated deterministically.',
  }
}

export function parseThresholdMetadata(item: KnowledgeItemRef): ThresholdParseResult | null {
  const raw = readMetadataString(item.metadata, 'thresholdDefinition')
  if (raw === undefined) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, missingEvidence: missingEvidenceFor(item, 'is not valid JSON') }
  }

  if (!isValidThresholdMetadata(parsed)) {
    return { ok: false, missingEvidence: missingEvidenceFor(item, 'is missing required fields') }
  }

  return { ok: true, item: { ...item, threshold: parsed } }
}
