# Legal Reasoning Architecture Memory

**Spec status:** FROZEN (2026-07-03)
**Full spec:** `knowledge/decisions/reasoning-architecture.md` + `knowledge/reasoning/`

---

## Interface

```typescript
interface ILegalReasoningEngine {
  reason(question: ReasoningQuestion): Promise<ReasoningResult>
  explain(result: ReasoningResult, format: ReasoningOutputFormat): Promise<ReasoningExplanation>
}
```

---

## The Frozen ReasoningResult Contract

```typescript
ReasoningResult {
  // User-specified frozen fields:
  decision: string | null
  confidence: number                 // 0.0–1.0
  appliedDocuments: AppliedDocument[]
  appliedArticles: AppliedArticle[]
  reasoningTrace: ReasoningStep[]
  citations: FormattedCitation[]
  missingEvidence: MissingEvidence[]
  warnings: ReasoningWarning[]
  humanReviewRequired: boolean        // ONE-WAY FLAG — never reversed by any stage
  // Extended fields:
  confidenceLabel: 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW'
  ruleResults: RuleResult[]
  thresholdResults: ThresholdResult[]
  detectedConflicts: DetectedConflict[]
  resolvedAt: string
  processingTimeMs: number
}
```

`humanReviewRequired` is a one-way flag. Once any stage sets it to `true`, no stage can set it back to `false`.

---

## 8-Stage Pipeline

```
Stage 1 — IntentDetector     → ReasoningIntent
Stage 2 — KnowledgeResolver  → ResolvedKnowledge  ← ONLY stage calling IKnowledgePlatform
Stage 3 — ReasoningEngine    → applies law, resolves hierarchy, handles supersession
Stage 4 — RuleEngine         → evaluates rules/thresholds from KnowledgeItem corpus
Stage 5 — EvidenceCollector  → consolidates, detects gaps
Stage 6 — CitationFormatter  → builds full/short/inline/chain citations
Stage 7 — AnswerComposer     → assembles ReasoningResult, computes confidence
```

All stages after Stage 2 receive `ResolvedKnowledge` — they never call the Knowledge Platform directly.

---

## 4-Tier Conflict Resolution (ADR-015, immutable order)

```
Tier 1 — HIERARCHY:        Lower authorityLevel number prevails (Layer 1 > Layer 3)
Tier 2 — MORE_RESTRICTIVE: Layer 3 school policy applies if more restrictive
Tier 3 — LEX_POSTERIOR:    Newer effectiveFrom prevails at same authority level
Tier 4 — LEX_SPECIALIS:    Narrower scope prevails at same level and date
→ UNRESOLVED:              humanReviewRequired = true; confidence −0.20
```

---

## Confidence Scoring

| Range | Label | Action |
|-------|-------|--------|
| ≥0.85 | HIGH | Auto-serve |
| 0.70–0.84 | MEDIUM | Serve with disclaimer |
| 0.50–0.69 | LOW | Flag for review |
| <0.50 | VERY_LOW | humanReviewRequired = true |

---

## Rules and Thresholds as Data

Rules are `KnowledgeItem` objects with `domain='procurement'`, `type='EVALUATION_RULE'`.
Thresholds are `KnowledgeItem` objects with `domain='procurement'`, `type='THRESHOLD'`.
The Rule Engine evaluates, never defines. Zero hardcoded legal values in stage code.

---

## 15 Intent Types

`THRESHOLD_CHECK` · `METHOD_SELECTION` · `DOCUMENT_REQUIRED` · `COMPLIANCE_CHECK` ·
`AUTHORITY_CHECK` · `ADVANCE_PAYMENT_RULE` · `GUARANTEE_RULE` · `TIMELINE_CHECK` ·
`EXCEPTION_INQUIRY` · `CONFLICT_RESOLUTION` · `DEFINITION_LOOKUP` · `PROCEDURE_GUIDE` ·
`BEST_PRACTICE` · `RISK_ASSESSMENT` · `GENERAL`
