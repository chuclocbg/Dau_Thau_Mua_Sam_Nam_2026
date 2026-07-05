# Corpus Pipelines — Import · Update · Indexing

Part of: [corpus-foundation.md](../decisions/corpus-foundation.md)

---

## 1. Corpus Import Pipeline

Two modes: **Bulk Import** for initial corpus population (thousands of documents at once); **Single Import** for real-time additions (one document at a time).

### 1a. Bulk Import Pipeline

Designed to import thousands of legal documents from a source in a single coordinated operation. Uses parallel processing within each domain batch.

```
[Phase 0 — Source Registration]
  ↓ Admin registers KnowledgeSource with type, baseUri, trustLevel
  ↓ System assigns sourceId
  ↓ Connection test (if API/OFFICIAL_GAZETTE): fetch one page to verify credentials
  ↓ Output: verified KnowledgeSource record

[Phase 1 — Source Crawl / Manifest Generation]
  ↓ Fetch complete file/document list from source:
       OFFICIAL_GAZETTE: API call → paginated list of documents
       MINISTRY_PORTAL:  scrape document index page (controlled, with permission)
       INTERNAL_UPLOAD:  directory listing of uploaded files
       MIGRATION:        manifest file provided by migration team
  ↓ For each document: create ImportBatchItem { uri, estimatedType, priority }
  ↓ Create ImportBatch { batchId, sourceId, fileCount }
  ↓ Output: ImportBatch record in PENDING status

[Phase 2 — Parallel Processing]
  Worker concurrency: configurable (default 4 workers)
  Each worker processes one file:

  ┌─────────────────────────────────────────────────────────────────┐
  │ WORKER LOOP (one file)                                          │
  │                                                                 │
  │ Step 1: Download / Read                                         │
  │   Fetch file from source URI                                    │
  │   Store raw bytes via IStorageAdapter → get rawContentRef       │
  │                                                                 │
  │ Step 2: Content Extraction                                      │
  │   PDF → pdfjs or pdfminer (Python sidecar for quality)          │
  │   DOCX → mammoth / libreoffice headless                         │
  │   HTML → cheerio (strip boilerplate, extract main content)      │
  │   JSON/XML → direct parse to structuredData                     │
  │   Output: extractedText (string) + structuredData (JSON)        │
  │                                                                 │
  │ Step 3: Pre-classification                                      │
  │   Parse documentSymbol from filename or extracted header        │
  │   Detect domain (legal / template / etc.) from source + content │
  │   Detect objectType from document structure                     │
  │   Create KnowledgeObject in DRAFT status                        │
  │                                                                 │
  │ Step 4: Run Validation Pipeline (Stages 1–8)                    │
  │   (see quality.md)                                              │
  │                                                                 │
  │ Step 5: Persist                                                 │
  │   Save KnowledgeObject + KnowledgeVersion(v1)                   │
  │   Save KnowledgeCitation records                                │
  │   Update ImportBatchItem status                                 │
  │                                                                 │
  │ Worker reports: SUCCESS / PARTIAL / FAILED                      │
  └─────────────────────────────────────────────────────────────────┘

[Phase 3 — Batch Completion (after all workers finish)]
  ↓ Run Stage 6 (relationship extraction) across ALL batch objects together
     — this enables cross-document IMPLEMENTS, AMENDS, REPLACES relations
       that couldn't be built when each document was processed alone
  ↓ Run Stage 7 (cross-domain consistency) across all batch objects
  ↓ Cascade lifecycle changes (SUPERSEDED targets) from this batch
  ↓ Update ImportBatch: status = COMPLETED, counts updated

[Phase 4 — Post-Batch Indexing]
  ↓ Trigger incremental index update for all new ACTIVE objects
  ↓ Full-text index: append new objects (no rebuild)
  ↓ Faceted index: upsert new rows (no rebuild)
  ↓ Graph index: insert new relation rows (no rebuild)
  ↓ Vector index: queue embedding jobs (async, processed by background worker)

[Phase 5 — Review Queue Population]
  ↓ Objects: quality 0.60–0.84 → assign to reviewer queue; notify reviewers
  ↓ Objects: quality ≥ 0.85, no CRITICAL errors → auto-ACTIVE; no action needed
  ↓ Objects: quality < 0.60 or CRITICAL errors → stay DRAFT; notify importer with error summary

ImportBatch record:
{
  batchId:        string
  sourceId:       string
  status:         'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL'
  fileCount:      number
  successCount:   number
  partialCount:   number   // imported but below quality threshold
  failedCount:    number   // could not import at all
  activatedCount: number   // auto-approved and ACTIVE
  reviewCount:    number   // in review queue
  draftCount:     number   // failed quality gate, stays DRAFT
  startedAt:      string
  completedAt?:   string
  errors:         ImportError[]
  initiatedBy?:   string
}
```

### 1b. Single Import Flow (Real-Time)

```
Staff uploads file OR webhook/API event fires
  ↓
Create KnowledgeObject (DRAFT)
  ↓
Run Validation Pipeline Stages 1–8 (synchronous, < 2 seconds target)
  ↓
Dispatch: quality result
  if ≥ 0.85, no CRITICAL   → ACTIVE immediately
  if 0.60–0.84              → REVIEW; notify reviewer queue
  if < 0.60 or CRITICAL     → DRAFT; return errors to uploader
  ↓
Trigger incremental index update (NOT full rebuild)
```

**Extraction time targets by file size:**

| File Size | Max Extraction Time | Action if Exceeded |
|-----------|--------------------|--------------------|
| < 1 MB | 3 seconds | — |
| 1–10 MB | 15 seconds | warn |
| 10–50 MB | 60 seconds | warn; async processing |
| > 50 MB | reject | return error to uploader |

---

## 2. Corpus Update Pipeline

Incremental updates to the existing corpus without rebuilding. Every update operation touches only the changed objects and their direct dependents.

### 2a. Change Detection

Triggered by: scheduled source poll, webhook from source system, manual staff trigger.

```
[Source Poll]
  ↓ Fetch current document list from source (same crawl as Bulk Import Phase 1)
  ↓ Compare against existing corpus objects for this source:

  NEW_OBJECTS:      URI in source but no objectId in corpus → Bulk Import (single-document mode)
  CHANGED_OBJECTS:  URI exists; new sha256Hash ≠ existing contentHash → Update Pipeline
  DELETED_OBJECTS:  URI no longer in source → Archive Candidate (requires manual confirmation)
  UNCHANGED:        same hash → skip; update source.lastPolledAt
```

### 2b. Amendment Update (for CHANGED legal documents)

The most important update type. When a law is amended, only the changed articles are re-versioned.

```
[Receive changed document]
  ↓ Extract new full text
  ↓ Compare against existing article-level objects (by hierarchyPath)

  For each article/clause/point:
    if contentHash changed → CREATE new KnowledgeVersion for that object
      versionType = LEGAL_AMENDMENT
      amendedBySymbol = the amending document's symbol
      amendedAt = effective date of the amendment
    else → no change; skip

  Update parent chain:
    for each changed article → create new version for its parent chapter
    for each changed chapter → create new version for the document
    [chain propagates upward; only changed branches get new versions]

  ↓ Create KnowledgeCitation (AMENDS) from amending document → amended articles
  ↓ Set previous active versions:
       lifecycleStatus = SUPERSEDED
       effectiveTo = amendment's effectiveFrom
  ↓ Set new versions:
       lifecycleStatus = ACTIVE (or REVIEW if quality < 0.85)
       effectiveFrom = amendment's effectiveFrom
```

**Partial update guarantee:** A 500-article law where 3 articles are amended → only 3 + parent chain (max 3 chapters + 1 document = 7 objects) get new versions. 493 unchanged articles are untouched.

### 2c. Non-Legal Content Update

For templates, cases, glossary, risk patterns, etc.:

```
Detect content hash change
  ↓ Create new KnowledgeVersion for the whole object
  ↓ versionType = CORRECTION | ENRICHMENT | AI_REVISION (staff selects)
  ↓ Run Stages 3–8 of validation pipeline on new content
  ↓ If quality ≥ 0.85: auto-activate new version; old version stays as prior version
  ↓ If quality 0.6–0.84: enter REVIEW
```

### 2d. Cascade Impact Analysis

After any object is updated or newly activated:

```
Find all dependent objects:
  1. KnowledgeCitation.fromObjectId WHERE toObjectId = changedObjectId
     → these objects cited this object; re-validate their citation resolution
  2. KnowledgeRelation WHERE toObjectId = changedObjectId
     → dependent objects; check if their DEPENDS_ON is still valid
  3. KnowledgeApplicabilityRule WHERE objectId = changedObjectId
     → rules on this object changed; providers re-evaluate applicability

Set validationStatus = PENDING_REVALIDATION on all found objects
Queue re-validation: run Stages 4, 7, 8 only (not Stages 1–3 — content unchanged)
Re-validate in priority order: by layer (Layer 1 first) then by quality score (lower first)
```

### 2e. Lifecycle Cascades

```
When new version of document D2 is ACTIVATED and D2 REPLACES D1:
  → D1.lifecycleStatus = SUPERSEDED
  → D1.effectiveTo = D2.effectiveFrom

When new version REPEALS D1:
  → D1.lifecycleStatus = SUPERSEDED
  → D1.repealedBy = D2.objectId
  → D1.effectiveTo = D2.effectiveFrom

When ARCHIVED retention trigger fires:
  → Object.lifecycleStatus = ARCHIVED
  → Remove from active indexes (but keep in historical index)
```

### 2f. Update Index Propagation

```
For each updated/activated object:
  1. Faceted index: upsert the object row (synchronous)
  2. Full-text index: delete old entry, insert new entry (synchronous on Postgres tsvector)
  3. Graph index: update relation rows (synchronous)
  4. Vector index: queue re-embedding job if content changed (async)

For each SUPERSEDED/ARCHIVED object:
  1. Remove from active query indexes
  2. Add/retain in historical index (for asOfDate queries)
  3. Vector index: deactivate vector entry (mark isActive=false; retain for historical similarity)
```

---

## 3. Corpus Indexing Strategy

Four independent indexes. Each optimized for a different query pattern. All maintained incrementally — no full rebuild required for content changes.

---

### Index 1 — Full-Text Search (Keyword / Inverted Index)

**Purpose:** keyword and phrase queries; documentSymbol lookup; Vietnamese legal term search.

**Indexed fields and weights:**

| Field | Weight | Notes |
|-------|--------|-------|
| `documentSymbol` | 4.0 | Highest; exact lookup ('22/2023/QH15') |
| `title` | 3.0 | Core identity |
| `keywords` | 2.5 | Curated search terms |
| `summary` | 2.0 | Concise description |
| `tags[].value` | 1.5 | Facet tags included in text search |
| `extractedText` | 1.0 | Full body; lowest weight |

**Query modes:**

| Mode | Strategy | Use Case |
|------|---------|---------|
| EXACT | documentSymbol match or phrase match in quotes | 'Luật 22/2023/QH15 Điều 15' |
| KEYWORD | BM25 term frequency scoring | 'quy định tạm ứng hợp đồng' |
| SYNONYM | Keyword + ontology synonym expansion | 'advance payment' → 'tạm ứng' |

**Vietnamese tokenization:**
- Word segmentation required (Vietnamese is space-delimited but multi-syllable words)
- Phase N default: simple whitespace tokenizer + bigrams (adequate for ≤ 100K objects)
- Production upgrade: VnCoreNLP word segmenter or underthesea library
- Stopwords: Vietnamese legal stopword list (prepositions, conjunctions, common particles)
- Synonym expansion sourced from `GlossaryProvider` + `OntologyProvider`

**Implementation phases:**

| Phase | Implementation | Max Corpus Size |
|-------|---------------|----------------|
| N (launch) | Postgres `tsvector` with `to_tsvector('simple', ...)` + GIN index | ~500K objects |
| Post-M | Enhanced Postgres `pg_trgm` for fuzzy matching + custom dictionary | ~1M objects |
| Scale | Elasticsearch 8.x or Typesense | Unlimited |

---

### Index 2 — Semantic Vector Index

**Purpose:** meaning-based search; matches documents by semantic similarity even without keyword overlap.

**Example:** query "điều kiện tạm ứng" (advance payment conditions) matches law articles about "bảo lãnh tạm ứng" (advance guarantee) even if the exact phrase doesn't appear.

**Embedding target:**
```
INPUT:  title + '\n' + summary   (max 512 tokens)
MODEL:  IEmbeddingAdapter.embed()   — swappable interface
DEFAULT (Phase N): NoOpEmbeddingAdapter → zero vector → semantic search disabled
PROD:   multilingual-e5-large OR Vietnamese BERT fine-tuned on legal text
```

**Vector dimensions:** 768 (multilingual-e5) or 1024 (large models)

**Similarity metric:** cosine similarity

**Implementation phases:**

| Phase | Implementation | Notes |
|-------|---------------|-------|
| N (launch) | NoOpEmbeddingAdapter; semantic search returns empty | Keyword search still works |
| M+ | pgvector extension; `IVFFlat` index (`lists=100`) | Efficient for ≤ 500K vectors |
| 1M+ vectors | Partition pgvector by domain; `HNSW` index | Better recall at scale |
| 5M+ vectors | Qdrant or Weaviate sidecar | Dedicated vector DB |

**Embedding update policy:**

| Version Type | Re-embed? | Reason |
|-------------|---------|--------|
| `INITIAL` | Yes | First embed |
| `CORRECTION` | No | Metadata-only; semantic unchanged |
| `ENRICHMENT` | No | Tags/metadata; semantic unchanged |
| `LEGAL_AMENDMENT` | Yes | Legal content changed |
| `RE_EXTRACTION` | Yes | Better extracted text |
| `TRANSLATION` | Yes | New language content |
| `AI_REVISION` | Yes | Content improved |

**Batch re-embedding:** required only when embedding model changes. Scheduled maintenance window; all ACTIVE objects queued. Estimate: ~50 objects/second → 500K objects ≈ 3 hours.

---

### Index 3 — Faceted / Structured Index

**Purpose:** filter-first queries with exact-match or range conditions. Used for admin corpus management, compliance queries, and pipeline triggering.

**Indexed facets:**

```
Exact match (stored as sortable column or GIN array):
  domain, layer, objectType, lifecycleStatus, validationStatus
  documentType, issuingBody, documentYear
  language, region, audience, fund_source
  sourceId, parentObjectId

Range (numeric or date):
  effectiveFrom (date range)
  effectiveTo (date range)
  qualityScore.overall (float range)
  wordCount (integer range)
  versionNumber (integer range)

Prefix match:
  hierarchyPath (enables 'all children of this node' queries)
  documentSymbol (enables 'all circulars from 2024' → '20%/2024/TT-%')

Multi-value (array):
  tags[] (facet:value pairs stored as JSONB with GIN index)
  keywords[]
  legalBasis[].documentSymbol
```

**Common query patterns:**

```sql
-- All active procurement-law circulars from MOF issued after 2024
WHERE domain = 'legal'
  AND documentType = 'TT-BTC'
  AND lifecycleStatus = 'ACTIVE'
  AND effectiveFrom >= '2024-01-01'
  AND tags @> '[{"facet":"legal_domain","value":"procurement_law"}]'

-- All objects needing re-validation
WHERE validationStatus = 'PENDING_REVALIDATION'
ORDER BY qualityScore.overall ASC  -- lowest quality first

-- All articles under a specific law
WHERE hierarchyPath LIKE 'law:22/2023/QH15/%'
  AND objectType = 'ARTICLE'

-- All DRAFT objects from unverified sources, quality < 0.6
WHERE lifecycleStatus = 'DRAFT'
  AND qualityScore.overall < 0.6
  AND source.trustLevel = 'UNVERIFIED'
```

**Implementation:** Postgres with GIN indexes on JSONB tags array and Btree indexes on all exact-match columns. No external dependency required.

---

### Index 4 — Graph Index (Relationship Traversal)

**Purpose:** traverse the knowledge graph — citation chains, amendment graphs, implementation trees, template-to-law chains, similar case clusters.

**Operations and complexity:**

| Operation | Strategy | Complexity |
|-----------|---------|-----------|
| Direct neighbors | `SELECT * FROM knowledge_relation WHERE from_id = ? AND type = ?` | O(1) with index |
| Path finding (depth ≤ 3) | Recursive CTE on Postgres | O(edges × depth) |
| Subgraph (depth 2) | 2-hop JOIN | O(n²) bounded by depth |
| Amendment chain | Traverse AMENDS/REPLACES backward to origin | O(chain length) |
| Implementation tree | Traverse IMPLEMENTS forward from Law | O(tree nodes) |
| SIMILAR_TO cluster | Pre-computed `weight` column + threshold filter | O(1) after pre-compute |

**Index strategy on `knowledge_relation` table:**

```sql
-- Forward traversal (get all objects this item points to)
CREATE INDEX idx_relation_from ON knowledge_relation (from_object_id, relation_type);

-- Backward traversal (get all objects pointing to this item)
CREATE INDEX idx_relation_to ON knowledge_relation (to_object_id, relation_type);

-- Weighted ranked results (for SIMILAR_TO, RELATED_TO)
CREATE INDEX idx_relation_weight ON knowledge_relation (relation_type, weight DESC);

-- Verification status filter (exclude unverified AI-inferred relations)
CREATE INDEX idx_relation_verified ON knowledge_relation (is_verified, source);
```

**Scale thresholds:**

| Corpus Size | Relations Estimate | Approach |
|-------------|------------------|---------|
| ≤ 500K objects | ~2.5M relations | Postgres recursive CTE (adequate) |
| 500K–2M objects | ~10M relations | Postgres with careful index tuning + depth cap at 5 |
| > 2M objects | > 50M relations | Apache AGE (Postgres graph extension) or Neo4j |

**Path finding at depth > 5:** algorithmically expensive on any relational DB. Cap depth at 5 for production queries. Deep traversal (full citation graph discovery) runs as offline batch job, not real-time.

---

## 4. Index Consistency Guarantees

```
UPDATE ORDER on object activation:
  1. KnowledgeObject persisted in Postgres (source of truth)
  2. Faceted index updated (synchronous — same Postgres transaction)
  3. Full-text index updated (synchronous — tsvector column updated in same transaction)
  4. Graph index updated (synchronous — relation rows committed)
  5. Vector index updated (async — embedding computed by background worker)

All steps 1–4 are in the same Postgres transaction: atomic.
Step 5 failure: object is already searchable via keyword and faceted. Semantic search
                returns empty for this object until embedding completes. Acceptable degradation.
Step 5 retry: background worker polls for objects where vectorized=false AND lifecycleStatus=ACTIVE.

Historical index consistency:
  When object → SUPERSEDED:
    Active query indexes: remove (this object no longer appears in default queries)
    Historical index: add isActive=false flag (object appears only in asOfDate queries)
    Relations: preserved (historical traversal still works)

Reindex on model change:
  Full-text: trigger tsvector recomputation for changed domain config
  Vector: queue all ACTIVE objects for re-embedding (scheduled maintenance)
  Faceted/Graph: always in sync (synchronous writes); no bulk reindex needed
```

---

## 5. Initial Corpus Bootstrap Order

For the initial ingestion of real Vietnamese legal data, this is the recommended order to maximize citation resolution rates:

```
Round 1 — Foundation Laws (highest citation density, must exist first)
  1. Hiến pháp 2013
  2. Bộ luật dân sự 91/2015/QH13
  3. Bộ luật hình sự 100/2015/QH13
  4. Luật đấu thầu 22/2023/QH15 (+ predecessors 43/2013 for historical)
  5. Luật ngân sách nhà nước 83/2015/QH13
  6. Luật đầu tư công 39/2019/QH14
  7. Luật xây dựng 50/2014/QH13 (+ amendments)
  8. Luật quản lý tài sản công 15/2017/QH14
  9. Luật phòng chống tham nhũng 36/2018/QH14
  10. Luật thanh tra 11/2022/QH15, Luật kiểm toán 81/2015/QH13

Round 2 — Implementing Decrees (cite Round 1 laws)
  11. NĐ 24/2024/NĐ-CP (đấu thầu)
  12. NĐ 23/2024/NĐ-CP (mua sắm tập trung)
  13. All NĐ implementing Round 1 laws (procurement-relevant)

Round 3 — Ministerial Circulars (cite Rounds 1+2)
  14. TT 79/2025/TT-BTC (thanh toán)
  15. TT 09/2023/TT-BKHĐT (hồ sơ mời thầu)
  16. TT 06/2024/TT-BXD (xây dựng)
  17. All TT relevant to procurement

Round 4 — Official Letters, Internal Regulations
  18. CV from MPI, MOF, MOC on procurement
  19. School/Ministry internal regulations

Round 5 — Experience Layer
  20. Templates, Forms
  21. Cases, Audit findings, Risk patterns, Best practices
  22. Glossary, Ontology, FAQ, Decision logs

Rationale: citation resolution rates by order:
  Round 1 imported alone: ~40% resolution (many self-citations within laws)
  After Round 2: ~70% (decrees cite laws, now resolvable)
  After Round 3: ~85% (circulars cite decrees, now resolvable)
  After Round 4: ~92%
  After Round 5: ~95%+ (experience layer cites everything above)
```
