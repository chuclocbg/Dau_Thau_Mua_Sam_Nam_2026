# Knowledge Quality Score & Validation Pipeline

Part of: [corpus-foundation.md](../decisions/corpus-foundation.md)

---

## 1. Knowledge Quality Score

Every `KnowledgeObject` carries a `KnowledgeQualityScore`. Scores are computed by the validation pipeline at import time and recomputed whenever a dependency changes. Scores are immutable snapshots on each `KnowledgeVersion`.

```typescript
interface KnowledgeQualityScore {
  // Six dimensions (each 0–1)
  completeness:    number    // are required metadata fields populated?
  accuracy:        number    // does content match its source?
  freshness:       number    // how recent is the content?
  citationQuality: number    // are citations resolved and classified?
  consistency:     number    // no conflicts with other active objects?
  coverage:        number    // does object cover its topic fully?

  // Aggregate
  overall:         number    // weighted mean × trustMultiplier (see formula below)

  // Quality signals
  errors:          QualityError[]
  warnings:        QualityWarning[]
  computedAt:      string    // ISO datetime of last computation
}

interface QualityError {
  errorCode:  string     // e.g. 'MISSING_TIER1_FIELD', 'UNRESOLVED_NORMATIVE_CITATION'
  severity:   'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  dimension:  string     // which quality dimension this affects
  field?:     string     // which field
  message:    string
  autoFix?:   string     // if the system can suggest a fix
}

interface QualityWarning {
  warningCode: string
  dimension:   string
  message:     string
}
```

---

## 2. Dimension Scoring Rules

### Formula

```
overall = (
  completeness    × 0.25 +
  accuracy        × 0.30 +
  citationQuality × 0.15 +
  freshness       × 0.15 +
  consistency     × 0.10 +
  coverage        × 0.05
) × trustMultiplier

trustMultiplier:
  source.trustLevel = 'OFFICIAL'    → 1.00
  source.trustLevel = 'VERIFIED'    → 0.92
  source.trustLevel = 'UNVERIFIED'  → 0.75
```

Any CRITICAL error: `overall` is capped at 0.30 regardless of dimension scores.

---

### Completeness (weight 0.25)

Measures whether required metadata is populated.

```
score = (Tier1_filled_ratio × 0.50)
      + (Tier2_filled_ratio × 0.30, if domain requires Tier 2; else 0.30)
      + (Tier3_filled_ratio × 0.20)

Tier1_filled_ratio = count(filled Tier1 fields) / count(total Tier1 fields)
Tier2_filled_ratio = count(filled Tier2 fields) / count(applicable Tier2 fields)
Tier3_filled_ratio = count(filled Tier3 fields) / count(total Tier3 fields)
```

Error table:

| Condition | Error Code | Severity | Effect |
|-----------|-----------|---------|--------|
| Any Tier1 field missing | `MISSING_TIER1_FIELD` | CRITICAL | Caps overall at 0.30 |
| Any required Tier2 field missing | `MISSING_TIER2_FIELD` | HIGH | −0.15 to completeness |
| title < 3 chars | `TITLE_TOO_SHORT` | HIGH | −0.10 |
| summary < 20 chars | `SUMMARY_TOO_SHORT` | HIGH | −0.10 |
| documentSymbol format invalid | `INVALID_DOCUMENT_SYMBOL` | HIGH | −0.10 |
| keywords count < 3 | `INSUFFICIENT_KEYWORDS` | LOW | warning only |

---

### Accuracy (weight 0.30)

Measures content reliability based on source and extraction quality.

**Base score by source type:**

| sourceType | trustLevel | Base Score |
|-----------|-----------|-----------|
| OFFICIAL_GAZETTE | OFFICIAL | 1.00 |
| LEGAL_DATABASE | VERIFIED | 0.90 |
| MINISTRY_PORTAL | VERIFIED | 0.85 |
| INTERNAL_UPLOAD (reviewed) | VERIFIED | 0.80 |
| AI_EXTRACTION (human-verified) | VERIFIED | 0.75 |
| AI_EXTRACTION (unverified) | UNVERIFIED | 0.55 |
| WEB_SCRAPE | UNVERIFIED | 0.60 |
| MANUAL_ENTRY (unverified) | UNVERIFIED | 0.50 |

**Deductions:**

| Condition | Deduction |
|-----------|----------|
| Encoding errors detected (garbled chars, mixed encodings) | −0.10 |
| Extraction anomaly (page count vs extracted page mismatch > 20%) | −0.10 |
| Character set anomaly (> 5% unrecognized chars) | −0.08 |
| PDF formatting artifacts in extracted text (> 3%) | −0.05 per occurrence, max −0.15 |
| Language detection mismatch (detected ≠ declared) | −0.15 |

Score floor: 0.10 (even the worst extraction has some value).

---

### Freshness (weight 0.15)

Measures how recent the content is relative to its `effectiveFrom` date.

```
daysActive = today - max(effectiveFrom, createdAt)

Base freshness:
  daysActive ≤ 180:     1.00
  daysActive ≤ 365:     0.90
  daysActive ≤ 730:     0.80
  daysActive ≤ 1825:    0.60
  daysActive ≤ 3650:    0.40
  daysActive > 3650:    0.20

Adjustments (additive, cap at 1.00):
  +0.10: has amendment chain check enabled (KnowledgeRelation.type = AMENDS actively monitored)
  +0.05: human-reviewed within last 90 days
  −0.20: effectiveTo is set and is in the past (expired but not yet ARCHIVED)
  −0.30: has known supersession (ACTIVE superseding object exists for same hierarchyPath)
```

Exception: objects in the `cases` domain use case date instead of legal effective date. `bestpractice`, `audit`, `inspection` use their `importedAt` date for freshness.

---

### CitationQuality (weight 0.15)

Measures the completeness and resolution of citations.

```
If no citations extracted: 0.70 (neutral; not 1.0 because absence may mean extraction missed them)

resolvedRatio = resolved_citations / total_citations

Base score = resolvedRatio

Bonuses:
  +0.10: all citations have isNormative correctly classified
  +0.05: all resolved citations link to an ACTIVE target object

Penalties:
  −0.30: any CRITICAL unresolved citation (isNormative=true, toObjectId=null)
  −0.10: any HIGH unresolved citation (isNormative=true, > 180 days old with no resolution)
  −0.05 per unresolved non-normative citation (isNormative=false), max −0.20

Floor: 0.10
```

---

### Consistency (weight 0.10)

Measures absence of conflicts with other active objects in the corpus.

```
Base: 1.00

Deductions:
  −0.50: DUPLICATE detected (same contentHash as another ACTIVE object with same domain)
  −0.20: CONFLICT detected (same hierarchyPath + overlapping effectivePeriod + different content)
  −0.10: NEAR_DUPLICATE detected (≥ 95% title similarity with another ACTIVE object)
  −0.05: STALE_SUPERSESSION (this object supersedes another but supersession not yet reflected)

If DUPLICATE: error code DUPLICATE_CONTENT; severity CRITICAL; object should be REJECTED
```

---

### Coverage (weight 0.05)

Measures how completely the object covers its declared topic. This is the hardest dimension to automate — scores are estimates.

```
LEGAL_DOCUMENT:
  All articles extracted (articleCount > 0): 1.0
  Some articles extracted (> 50%): 0.7
  Only document-level metadata, no article extraction: 0.3

ARTICLE / CLAUSE / POINT:
  Text fully extracted (wordCount > 20): 1.0
  Partial text: 0.6
  Title only: 0.2

TEMPLATE:
  All sections and fields modeled: 1.0
  Sections only, no fields: 0.6
  Document-level only: 0.3

CASE:
  All sections present (background, decision, outcome, lessons): 1.0
  Partial sections: 0.7
  Summary only: 0.4

Others (COLLECTION_ITEM, FAQ, GLOSSARY, RISK, AUDIT_FINDING):
  Default: 0.75 (single-unit objects are assumed complete if metadata is populated)
```

---

## 3. Quality Gates

| Score Range | Gate | Action |
|------------|------|--------|
| ≥ 0.85, no CRITICAL errors | AUTO_APPROVE | Lifecycle → ACTIVE without human review |
| 0.60–0.84, no CRITICAL errors | REVIEW_REQUIRED | Lifecycle → REVIEW; assigned to reviewer queue |
| < 0.60 OR any CRITICAL error | DRAFT_ONLY | Cannot enter REVIEW; staff must fix issues first |
| DUPLICATE detected | BLOCKED | Object stays DRAFT; duplicate resolved manually |

Auto-approval log: every auto-activation records `activatedBy = 'SYSTEM_AUTO_QUALITY'` with `qualityScore.overall` at time of activation.

---

## 4. Validation Pipeline

8 sequential stages. Each stage produces `ValidationResult[]`. The full pipeline is idempotent — safe to re-run at any stage. Re-running does not create new objects; it updates the validation results on the existing object.

```typescript
interface ValidationResult {
  stage:      number       // 1–8
  stageName:  string
  status:     'PASSED' | 'FAILED' | 'PARTIAL' | 'SKIPPED'
  errors:     QualityError[]
  warnings:   QualityWarning[]
  durationMs: number
  runAt:      string
}
```

---

### Stage 1 — Ingestion Validation

**Input:** raw file or structured input payload

**Checks:**
- MIME type in allowed list (PDF, DOCX, XLSX, ZIP, PNG, JPG, JSON, XML, TXT, MD)
- File size ≤ domain limit (legal: 50MB; templates: 20MB; others: 10MB)
- Encoding valid (UTF-8; BOM-stripped UTF-16 accepted)
- Source is ACTIVE and not suspended
- SHA-256 hash not already in corpus as ACTIVE or REVIEW object (dedup pre-check)

**Outcome:** PASS → Stage 2 | FAIL → reject ingest (object not created)

---

### Stage 2 — Extraction Validation

**Input:** extracted text + structured data (output of content parser)

**Checks:**
- Text extraction non-empty
- Word count ≥ domain minimum (legal: 50 words; others: 10 words)
- No encoding garbage sequences (% of unrecognized chars < 5%)
- Language auto-detection result logged (mismatch = warning, not block)
- Structure parsing result valid JSON (for structured domains)

**Outcome:** PASS → Stage 3 | PARTIAL → WARN + continue (quality penalty applied) | FAIL → DRAFT with CRITICAL error

---

### Stage 3 — Schema Validation

**Input:** KnowledgeObject (pre-save)

**Checks:**
- Tier 1 required fields present and correctly typed
- Tier 2 required fields present for applicable domain
- String length constraints on title, summary
- Date format YYYY-MM-DD on all date fields
- `effectiveFrom ≥ signedDate` and `signedDate ≤ issuedDate ≤ effectiveFrom`
- `documentSymbol` pattern for legal/school/ministry domains
- `objectType` in domain's registered type list
- `sourceId` FK resolvable to an active KnowledgeSource
- Domain-specific schema (`structuredData` against domain schema)

**Outcome:** all errors logged with severity; CRITICAL errors cap overall at 0.30

---

### Stage 4 — Citation Resolution

**Input:** `extractedText` (raw text with legal citations)

**Actions:**
1. Apply citation regex patterns to extract all citation occurrences
2. For each extracted citation, attempt to resolve to a `KnowledgeObject.objectId` via:
   - Exact `documentSymbol` match in corpus
   - Fuzzy match if exact not found (threshold: 0.90 similarity)
3. Classify each citation type (IMPLEMENTS, AMENDS, REFERENCES, etc.) from surrounding text
4. Set `isNormative` based on context ('phải', 'được quy định tại', 'căn cứ' = normative)
5. Create `KnowledgeCitation` records (resolved or unresolved)
6. Log CRITICAL error for any unresolved normative citation

**Outcome:** citation records created; unresolved normative citations → CRITICAL error

---

### Stage 5 — Deduplication Check

**Input:** `sha256Hash` + `documentSymbol` (if available) + `title`

**Checks:**
- Exact hash match with any ACTIVE or REVIEW object → DUPLICATE (CRITICAL)
- Same `documentSymbol` + overlapping `effectivePeriod` with different hash → CONFLICT (HIGH)
- Title cosine similarity ≥ 0.95 with any ACTIVE same-domain object → SIMILAR (MEDIUM; human decision)

**Outcome:** UNIQUE → Stage 6 | DUPLICATE → BLOCKED (staff resolves manually) | SIMILAR → flag for REVIEW

---

### Stage 6 — Relationship Extraction

**Input:** `structuredData` + `KnowledgeCitation` records from Stage 4

**Actions:**
1. From citation type AMENDS/REPLACES/REPEALS: create `KnowledgeRelation` records
2. From `parentObjectId` chain: create `CONTAINS` relations
3. From process guide `structuredData`: extract `REQUIRES`, `GENERATES`, `USES_TEMPLATE`
4. From case `structuredData.caseOutcome`: extract `EXEMPLIFIED_BY` if legal articles referenced
5. For cases/risks: flag for SIMILAR_TO computation (run asynchronously; not blocking)

**Relation creation rule:** auto-extracted relations set `isVerified = false` and `source = 'AUTO_EXTRACTED'`. `CONTAINS` and `PRECEDES` structural relations set `isVerified = true` (no ambiguity).

**Outcome:** relation records created or updated (idempotent); graph index entries queued

---

### Stage 7 — Cross-Domain Consistency

**Input:** newly created/updated `KnowledgeObject` + existing ACTIVE corpus

**Checks:**
- No other ACTIVE object with same `hierarchyPath` + overlapping `effectiveFrom`/`effectiveTo`
- If this object SUPERSEDES another: target object exists and is currently ACTIVE
- If this object REPEALS another: target object exists and will be set to SUPERSEDED
- Effective date chain consistent with parent document (article `effectiveFrom` ≤ document `effectiveFrom`)
- If `LEGAL_AMENDMENT` version type: verify the amended object exists and is ACTIVE

**Outcome:** conflicts → CRITICAL errors; cascade lifecycle changes queued (set targets to SUPERSEDED)

---

### Stage 8 — Quality Scoring

**Input:** all validation results from Stages 1–7

**Actions:**
1. Compute all 6 dimension scores using rules in Section 2
2. Compute `overall` using weighted formula
3. Set `lifecycleStatus` based on quality gates:
   - ≥ 0.85 + no CRITICAL: ACTIVE (auto-approved)
   - 0.60–0.84: REVIEW
   - < 0.60 or CRITICAL present: DRAFT
4. Set `validationStatus = VALIDATED`
5. Persist `KnowledgeQualityScore` on `KnowledgeObject`
6. Snapshot quality score on `KnowledgeVersion`

**Outcome:** `KnowledgeObject` persisted with final quality score and lifecycle status

---

## 5. Re-validation Triggers

The pipeline is not run only at import. It re-runs automatically on these triggers:

| Trigger | Stages Re-run | Scope |
|---------|--------------|-------|
| Dependent object activated (new law activated) | 4 (citation re-resolution), 8 (quality rescore) | Objects with unresolved citations pointing to new object |
| SUPERSEDED object created (law amended) | 7 (consistency), 8 (rescore) | Objects citing the now-superseded provisions |
| Tag update via MANUAL or ONTOLOGY_INFERRED | 8 only (no content change) | The tagged object only |
| Scheduled freshness recalculation | 8 only | All ACTIVE objects; run weekly |
| Staff requests manual re-validation | 1–8 (full) | That object only |
| Source trust level change | 8 only (accuracy rescore) | All objects from that source |
