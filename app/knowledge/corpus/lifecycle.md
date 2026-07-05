# Corpus Lifecycle & Versioning

Part of: [corpus-foundation.md](../decisions/corpus-foundation.md)

---

## 1. Knowledge Lifecycle

Every `KnowledgeObject` moves through a defined set of lifecycle states. The platform only serves ACTIVE (and optionally SUPERSEDED for historical queries) objects to callers.

```
                    ┌──────────────────────────────────────────────────────────┐
                    │                                                          │
[IMPORT / CREATE]   │                                                          │
      ↓             │                                                          │
   [DRAFT] ──────── manually submit OR quality ≥ 0.6 ──────────────→ [REVIEW]
      ↑                                                                   │
      │                               reject(reason)                      │
      └───────────────── staff revises ─────────────────────── [REJECTED] │
                                                                          │
                            approve OR auto-approve                       │
                            (quality ≥ 0.85, no CRITICAL errors)          │
                                       ↓                                  │
                                   [ACTIVE] ◄─────────────────────────────┘
                                       │
                    newer version activated OR amendment imported
                                       │
                                [SUPERSEDED] ──── after N months ──→ [ARCHIVED]
                                       │
                                   manual
                                       │
                                 [ARCHIVED]
```

### State Definitions

| State | Served to Callers | Indexed | Description |
|-------|------------------|---------|-------------|
| `DRAFT` | No | No | Created by import; awaiting validation |
| `REVIEW` | No | No | Assigned to human reviewer |
| `ACTIVE` | Yes (default) | Yes (all 4 indexes) | Production-ready; fully indexed |
| `SUPERSEDED` | Historical only | Historical index only | Replaced by newer version; returned for `asOfDate` queries in past |
| `ARCHIVED` | No | No | Retained for audit; storage may compress |
| `REJECTED` | No | No | Failed validation or review; logged with reason |

### Transition Triggers

```
DRAFT → REVIEW:
  validationStatus = VALIDATED
  AND qualityScore.overall ≥ 0.6
  AND no UNRESOLVED CRITICAL errors

  OR: staff.submitForReview()

REVIEW → ACTIVE (auto):
  qualityScore.overall ≥ 0.85
  AND validationStatus = VALIDATED
  AND no errors with severity = 'CRITICAL'

REVIEW → ACTIVE (manual):
  reviewer.approve()

REVIEW → REJECTED:
  reviewer.reject(reason)
  reason stored in KnowledgeObject.rejectionReason

REJECTED → DRAFT:
  staff.revise() — triggers new extraction + re-validation

ACTIVE → SUPERSEDED:
  newer version of same document activated (same documentSymbol, newer effectiveFrom)
  OR amendment imported that replaces this object's content
  OR explicit supersession via admin.supersede(replacedById)
  effectiveTo set to the newer object's effectiveFrom

ACTIVE → ARCHIVED:
  admin.archive()
  OR retention policy expiry
  OR document symbol officially withdrawn (repealed, no successor)

SUPERSEDED → ARCHIVED:
  after retentionDays (default 3650 = 10 years; configurable per domain)
```

---

## 2. Knowledge Versioning

Versioning is immutable. Every content change creates a new `KnowledgeVersion` record. The `KnowledgeObject.currentVersionId` pointer is updated to the new version. Prior versions are never deleted.

### Why Immutable Versions

1. **Legal audit requirement:** "What did the platform know about this law on date X?" must be answerable for any date in the past.
2. **AI reproducibility:** AI recommendations made on date X must be replayable with the same knowledge context that existed at X.
3. **Amendment traceability:** When law Y amends article 15 of law X, the old text is preserved as a prior version, the new text is the new version. The amendment relationship is recorded in `KnowledgeCitation`.

### Version Types and Indexing Behavior

| versionType | Triggers Re-index? | Triggers Re-embed? | Notes |
|------------|-------------------|-------------------|-------|
| `INITIAL` | Yes | Yes | First import |
| `CORRECTION` | Yes (title/summary updated) | No | Typo fix; no semantic change |
| `ENRICHMENT` | Yes (tags/metadata updated) | No | No content change; better metadata |
| `LEGAL_AMENDMENT` | Yes | Yes | Legal content changed; may trigger SUPERSEDED on parent |
| `RE_EXTRACTION` | Yes | Yes | Better structured data from same source |
| `TRANSLATION` | Yes (new language field) | Yes | Adds English summary; does not affect Vietnamese content |
| `AI_REVISION` | Yes | Yes | AI-improved; human-approved before activation |

### Version Selection Logic

```typescript
// Default: returns current active version
getObject(objectId: string): KnowledgeObject
// → reads currentVersionId → project KnowledgeItem

// Historical: returns the version active at a specific date
getObjectAtDate(objectId: string, asOfDate: string): KnowledgeVersion | null
// → find version where:
//   version.createdAt ≤ asOfDate
//   AND (nextVersion.createdAt > asOfDate OR no next version)
//   AND versionType = 'LEGAL_AMENDMENT' (only legal changes affect historical resolution)

// Pinned: returns a specific version by ID (for AI audit trail)
getVersion(versionId: string): KnowledgeVersion

// Latest of type: returns latest version of a specific type
getLatestVersionOfType(objectId: string, type: KnowledgeVersionType): KnowledgeVersion | null
```

### Amendment Chain Example

**Scenario:** Article 15 of Luật 22/2023/QH15 is amended by NĐ 50/2026/NĐ-CP (effective 2026-09-01).

```
KnowledgeObject: law:22/2023/QH15/dieu:15
  objectId:          obj-001
  currentVersionId:  ver-002      ← updated to new version

KnowledgeVersion ver-001 (INITIAL — 2023-01-01):
  versionNumber:   1
  versionType:     INITIAL
  contentHash:     sha256('old text of Điều 15')
  effectiveFrom:   2023-01-01  (derived from law effective date)
  [immutable — never modified]

KnowledgeVersion ver-002 (LEGAL_AMENDMENT — 2026-09-01):
  versionNumber:   2
  versionType:     LEGAL_AMENDMENT
  contentHash:     sha256('new text of Điều 15 after NĐ 50/2026')
  amendedBySymbol: '50/2026/NĐ-CP'
  amendedAt:       '2026-09-01'
  changeReason:    'Sửa đổi bởi NĐ 50/2026/NĐ-CP khoản 3 Điều 2'
  [immutable once created]

KnowledgeCitation:
  fromObjectId:    obj-002 (the NĐ 50/2026 object)
  toObjectId:      obj-001 (Điều 15 of Luật 22/2023)
  citationType:    AMENDS
  formatted:       'Điều 2 khoản 3 NĐ 50/2026/NĐ-CP sửa đổi Điều 15 Luật 22/2023/QH15'
```

**Historical query for 2025-06-15:** Returns ver-001 (old text). The AI Advisory Layer sees the law as it was before the amendment.

**Current query (2026-09-01+):** Returns ver-002 (new text).

---

## 3. Retention Policy

Retention is defined per domain. After retention expires, ARCHIVED objects may be permanently deleted (with confirmation) or compressed to cold storage.

| Domain | SUPERSEDED → ARCHIVED (days) | ARCHIVED → Eligible for deletion (years) | Notes |
|--------|------------------------------|------------------------------------------|-------|
| `legal` | 3650 (10 years) | Never (permanent) | Legal audit requires permanent retention |
| `school` / `ministry` | 1825 (5 years) | 10 years | Institutional regulations |
| `templates` | 1095 (3 years) | 5 years | Old templates may still be referenced by old cases |
| `cases` | Never (permanent) | Never | Case records are permanent legal history |
| `audit` / `inspection` | 1825 (5 years) | 10 years | State audit findings retained per audit law |
| `bestpractice` / `risk` | 730 (2 years) | 5 years | Advisory content; lower retention |
| `glossary` / `ontology` | 365 (1 year) | 3 years | Terminology evolves; old versions less useful |
| `faq` / `decision_log` | 730 (2 years) | 5 years | |
| `procurement` | 1825 (5 years) | 7 years | Lifecycle rules change with law |

**Legal basis for retention:**
- Luật kiểm toán nhà nước 81/2015/QH13 requires 10-year audit documentation
- Luật lưu trữ requires permanent retention for legal foundation documents
- Retention policies stored as `KnowledgeApplicabilityRule` so they can be updated without code change

---

## 4. Lifecycle Event Log

Every lifecycle transition is recorded for audit.

```typescript
interface KnowledgeLifecycleEvent {
  eventId:          string
  objectId:         string
  fromStatus:       LifecycleStatus
  toStatus:         LifecycleStatus
  triggeredBy:      'SYSTEM' | 'STAFF' | 'REVIEWER' | 'AUTO_QUALITY' | 'POLICY' | 'AMENDMENT'
  userId?:          string           // for STAFF / REVIEWER triggers
  reason?:          string           // for REJECTED / ARCHIVED / SUPERSEDED
  versionId?:       string           // for transitions that create a new version
  occurredAt:       string
}
```

Lifecycle events are append-only. No event is ever deleted. This provides a complete history of every status change for every object — required for legal and audit compliance.
