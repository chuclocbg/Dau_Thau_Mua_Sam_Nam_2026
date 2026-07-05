# Corpus Schema — KnowledgeObject · KnowledgeSource · Citation Model

Part of: [corpus-foundation.md](../decisions/corpus-foundation.md)

---

## 1. KnowledgeObject

The corpus-layer storage unit. More complete than the runtime `KnowledgeItem`. Every `KnowledgeItem` served by the platform is projected from a `KnowledgeObject` at query time. Callers never see `KnowledgeObject` directly.

```typescript
interface KnowledgeObject {
  // Identity
  objectId:          string           // UUID v4; permanent; never reassigned
  currentVersionId:  string           // FK → KnowledgeVersion.versionId
  itemId?:           string           // runtime KnowledgeItem.id; set when ACTIVE; null until then

  // Classification
  domain:            string           // open string; same as KnowledgeItem.domain
  provider:          string           // provider class that owns this object
  layer:             1 | 2 | 3 | 4   // knowledge layer
  objectType:        string           // domain-specific open string (see hierarchy.md)
  contentFormat:     ContentFormat

  // Source provenance
  sourceId:          string           // FK → KnowledgeSource.sourceId
  sourceUri?:        string           // URL or path within source
  externalRef?:      string           // ID in external system (VBPL ID, GLPI ticket, etc.)

  // Content
  rawContentRef?:    string           // IStorageAdapter key for original file (Phase K)
  extractedText?:    string           // plain text from extraction
  structuredData?:   Record<string, unknown>  // parsed document structure

  // Display
  title:             string           // required; 3–500 chars
  summary:           string           // required; 20–1000 chars
  language:          string           // 'vi' | 'en' | 'vi+en'
  wordCount?:        number
  pageCount?:        number
  sha256Hash?:       string           // SHA-256 of extractedText for change detection

  // Legal-domain fields (populated when domain = 'legal' | 'school' | 'ministry')
  documentSymbol?:   string           // '22/2023/QH15'; regex: \d+/\d+/[A-Z\-]+
  documentNumber?:   string           // '22'
  documentYear?:     number           // 2023
  documentType?:     string           // 'QH' | 'ND' | 'TT' | 'TTLT' | 'CV' | 'VBHN' | ...
  issuingBody?:      string           // standardized from authority registry
  signatoryName?:    string
  signatoryTitle?:   string
  gazetteNumber?:    string
  gazetteDate?:      string           // ISO date YYYY-MM-DD

  // Hierarchy (for sub-document objects: articles, clauses, points)
  parentObjectId?:   string           // FK → KnowledgeObject.objectId
  hierarchyPath?:    string           // 'law:22/2023/QH15/dieu:15/khoan:2'
  sortOrder?:        number           // position within parent

  // Effective period
  signedDate?:       string           // ISO date
  issuedDate?:       string           // ISO date
  effectiveFrom:     string           // ISO date; required
  effectiveTo?:      string           // ISO date; null = currently active
  repealedBy?:       string           // objectId of the repealing document
  consolidatedBy?:   string           // objectId of the VBHN consolidation

  // Quality and status
  qualityScore:      KnowledgeQualityScore
  lifecycleStatus:   LifecycleStatus
  validationStatus:  ValidationStatus

  // Audit trail
  importedBy?:       string           // userId (Phase J)
  importedAt:        string           // ISO datetime
  reviewedBy?:       string
  reviewedAt?:       string
  activatedBy?:      string
  activatedAt?:      string
  createdAt:         string
  updatedAt:         string
}

type ContentFormat =
  | 'TEXT'
  | 'HTML'
  | 'MARKDOWN'
  | 'PDF'
  | 'DOCX'
  | 'XLSX'
  | 'JSON'
  | 'XML'

type LifecycleStatus =
  | 'DRAFT'        // not served; visible to admin only
  | 'REVIEW'       // assigned to reviewer; not served
  | 'ACTIVE'       // served to all queries; fully indexed
  | 'SUPERSEDED'   // served only to historical queries (asOfDate in past)
  | 'ARCHIVED'     // not served; retained for audit
  | 'REJECTED'     // not served; logged with reason; staff must revise

type ValidationStatus =
  | 'UNVALIDATED'
  | 'IN_PROGRESS'
  | 'VALIDATED'
  | 'REJECTED'
  | 'PENDING_REVALIDATION'   // triggered by a related object change
```

---

## 2. KnowledgeVersion

Every content change creates an immutable new version. The object holds a pointer (`currentVersionId`) to the active version. Versions are never deleted.

```typescript
interface KnowledgeVersion {
  versionId:          string
  objectId:           string           // FK → KnowledgeObject.objectId
  versionNumber:      number           // monotonically increasing, per-object; starts at 1
  versionLabel?:      string           // '2024-Amendment', 'v2.1' — auto or manual

  versionType:        KnowledgeVersionType

  // Content snapshot — immutable after creation
  title:              string
  summary:            string
  extractedText:      string
  structuredData:     Record<string, unknown>
  contentHash:        string           // SHA-256 of (extractedText + JSON.stringify(structuredData))

  // Change record
  changeReason:       string           // 'Legal amendment NĐ 50/2026 Điều 3', 'Typo fix', ...
  changeSummary?:     string           // human-readable diff summary
  changedBy?:         string           // userId

  // Legal amendment tracking
  amendedBySymbol?:   string           // document symbol of the amending instrument
  amendedAt?:         string           // effective date of the amendment (may differ from import date)

  // Quality snapshot at this version
  qualityScoreAtVersion:      KnowledgeQualityScore
  validationResultsAtVersion: ValidationResult[]

  createdAt:          string
}

type KnowledgeVersionType =
  | 'INITIAL'          // first version on import
  | 'CORRECTION'       // typo, formatting — no legal change; does not affect SUPERSEDED status
  | 'ENRICHMENT'       // tags, citations, metadata added — content unchanged
  | 'LEGAL_AMENDMENT'  // legal content changed by an official amendment; may trigger SUPERSEDED
  | 'RE_EXTRACTION'    // better parser produced improved structured output from same source
  | 'TRANSLATION'      // language version added (e.g., English summary of Vietnamese law)
  | 'AI_REVISION'      // AI-suggested improvement, human-approved
```

**Version lookup rules:**
- Default query: projects `currentVersionId` (the ACTIVE version)
- `asOfDate` query: returns the version where `effectiveFrom ≤ asOfDate < nextVersion.effectiveFrom`
- Pin to `versionId`: for reproducible AI outputs used in audit trails (required for Phase X)

---

## 3. KnowledgeSource

Tracks where content originates. Quality scoring uses `source.trustLevel` as a multiplier.

```typescript
interface KnowledgeSource {
  sourceId:              string
  sourceType:            KnowledgeSourceType
  name:                  string           // 'Cổng VBPL', 'MOF Portal', 'Staff Upload', ...
  baseUri?:              string           // root URL or storage prefix
  credentialRef?:        string           // reference to encrypted secret — never the secret itself
  trustLevel:            SourceTrustLevel

  // Automated polling
  pollingEnabled:        boolean
  pollingIntervalHours?: number
  lastPolledAt?:         string
  lastSuccessAt?:        string
  pollingStatus:         'IDLE' | 'RUNNING' | 'ERROR'
  lastError?:            string

  // Statistics
  totalObjectCount:      number
  activeObjectCount:     number
  lastImportAt?:         string

  isActive:              boolean
  createdAt:             string
  updatedAt:             string
}

type KnowledgeSourceType =
  | 'OFFICIAL_GAZETTE'    // Công báo điện tử — highest authority
  | 'LEGAL_DATABASE'      // VBPL, LuatVietnam, Lawdata — aggregated, verified
  | 'MINISTRY_PORTAL'     // mof.gov.vn, mpi.gov.vn, moc.gov.vn
  | 'INTERNAL_UPLOAD'     // staff file upload (PDF/DOCX)
  | 'API_FEED'            // structured API (future ĐTMUA / eBid integration)
  | 'WEB_SCRAPE'          // controlled scraping with permission
  | 'MANUAL_ENTRY'        // typed directly into platform admin
  | 'AI_EXTRACTION'       // extracted by AI from raw document (requires human review)
  | 'MIGRATION_IMPORT'    // one-time migration from legacy system

type SourceTrustLevel =
  | 'OFFICIAL'    // government gazette, official ministry portal — trust multiplier 1.00
  | 'VERIFIED'    // known reputable legal database — trust multiplier 0.92
  | 'UNVERIFIED'  // staff upload, scrape, manual — trust multiplier 0.75
```

**Registered sources at launch (minimum viable):**

| Source | Type | Trust | URL |
|--------|------|-------|-----|
| Cổng VBPL (vbpl.vn) | LEGAL_DATABASE | VERIFIED | vbpl.vn |
| Công báo (congbao.chinhphu.vn) | OFFICIAL_GAZETTE | OFFICIAL | congbao.chinhphu.vn |
| MOF Portal (mof.gov.vn) | MINISTRY_PORTAL | VERIFIED | mof.gov.vn |
| MPI Portal (mpi.gov.vn) | MINISTRY_PORTAL | VERIFIED | mpi.gov.vn |
| MOC Portal (moc.gov.vn) | MINISTRY_PORTAL | VERIFIED | moc.gov.vn |
| Internal Upload | INTERNAL_UPLOAD | UNVERIFIED | — |
| Manual Entry | MANUAL_ENTRY | UNVERIFIED | — |

---

## 4. Citation Model

Every legal citation extracted from a document becomes a `KnowledgeCitation` record. Citations are resolved against the corpus (linked to an `objectId`). This builds the complete citation graph automatically during the validation pipeline.

```typescript
interface KnowledgeCitation {
  citationId:           string
  fromObjectId:         string           // the object that contains this citation
  toObjectId?:          string           // resolved target object in corpus (null if unresolved)
  toExternalRef?:       string           // raw citation text if target not in corpus

  // Parsed citation components (Vietnamese legal citation structure)
  documentSymbol?:      string           // '22/2023/QH15'
  article?:             string           // 'Điều 15'
  clause?:              string           // 'khoản 2'
  point?:               string           // 'điểm a'
  subpoint?:            string           // 'tiết 1'
  appendix?:            string           // 'Phụ lục I'

  // Display
  formatted:            string           // 'Điều 15 khoản 2 điểm a Luật 22/2023/QH15'
  formattedShort:       string           // 'Đ15.2.a L22/2023'
  rawText:              string           // original text as it appeared in the source
  citationContext?:     string           // surrounding sentence where citation appears

  // Classification
  citationType:         CitationType
  isNormative:          boolean          // true = legally required; false = informational

  // Resolution
  resolvedAt?:          string
  resolvedBy:           'AUTOMATIC' | 'MANUAL' | 'AI_ASSISTED' | 'UNRESOLVED'
  resolutionConfidence: number           // 0–1

  createdAt:            string
}

type CitationType =
  | 'IMPLEMENTS'      // this document implements the cited document (Decree → Law)
  | 'AMENDS'          // this document amends specific provisions in cited document
  | 'REPEALS'         // this document repeals the cited document (fully)
  | 'REPLACES'        // this document replaces cited document (cited is superseded)
  | 'SUPPLEMENTS'     // this document adds provisions without changing cited document
  | 'CONSOLIDATES'    // this document is a VBHN consolidating cited documents
  | 'INTERPRETS'      // official ministry interpretation of cited document
  | 'DELEGATES'       // authority delegated from cited document to this document
  | 'REFERENCES'      // general normative reference (not one of the structural types above)
  | 'INFORMS'         // informational; non-normative reference
```

**Vietnamese citation regex patterns (for extraction):**

```
Document symbol:  \b\d{1,3}\/\d{4}\/[A-ZĐẰẮÂÊÔƠƯÁÀẢÃẠÉÈẺẼẸÍÌỈĨỊÓÒỎÕỌÚÙỦŨỤỐỒỔỖỘẮẶẲẴẰẤẦẨẪẬẾỀỂỄỆ\-]+\b
Article:          Điều\s+\d+
Clause:           khoản\s+\d+
Point:            điểm\s+[a-z]
Subpoint:         tiết\s+\d+
Appendix:         [Pp]hụ lục\s+[IVXa-z\d]+

Full citation:    Điều (\d+)(?:\s+khoản\s+(\d+))?(?:\s+điểm\s+([a-z]))?(?:\s+tiết\s+(\d+))?\s+(?:của\s+)?(.+?symbol.+?)
```

---

## 5. ImportBatch

Tracks bulk import operations for auditability.

```typescript
interface ImportBatch {
  batchId:        string
  sourceId:       string
  batchType:      'BULK' | 'INCREMENTAL' | 'SINGLE'
  status:         'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL'

  // Counts
  fileCount:      number
  successCount:   number
  partialCount:   number
  failedCount:    number
  activatedCount: number
  reviewCount:    number

  // Timing
  startedAt:      string
  completedAt?:   string

  // Error summary
  errors:         ImportError[]

  initiatedBy?:   string    // userId for manual batches; null for automated polling
  notes?:         string
}

interface ImportError {
  fileRef:    string    // filename or URI
  stage:      string    // which pipeline stage failed
  severity:   'CRITICAL' | 'HIGH' | 'LOW'
  message:    string
  objectId?:  string    // if object was partially created
}
```
