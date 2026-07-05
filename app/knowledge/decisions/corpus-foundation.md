# Phase N1 — Knowledge Corpus Foundation

Date: 2026-07-03
Status: SPECIFICATION — implementation follows Phase M (Prisma Layer)
Scope: Corpus model for the Knowledge Platform — all 15 domains
Scale target: thousands of legal documents; millions of knowledge objects

---

## Decision

The Knowledge Platform (Phase N) requires a production-ready corpus model before ingesting real legal data. This specification defines the complete corpus architecture. It sits one layer below the runtime `KnowledgeItem` API: the corpus layer is where content is stored, versioned, validated, and indexed. The runtime layer projects `KnowledgeItem` instances from corpus records.

The corpus layer is NOT the runtime API. Providers read from the corpus. Callers never see corpus types directly.

---

## Two-Layer Model

```
RUNTIME LAYER (frozen — Phase N architecture)
  IKnowledgePlatform → IKnowledgeProvider → KnowledgeItem

  ↑ projection at query time

CORPUS LAYER (Phase N1 — this spec)
  KnowledgeObject → KnowledgeVersion → KnowledgeCitation → KnowledgeTag
  KnowledgeSource → ImportBatch → ValidationResult
  KnowledgeRelation (corpus-level, superset of runtime KnowledgeGraph)
  KnowledgeQualityScore → ValidationPipeline
  3 search indexes + 1 graph index
```

A `KnowledgeItem` returned by a provider is always a projection of one or more `KnowledgeObject` records from the corpus. The corpus holds the raw, versioned, sourced, validated truth. The item is the clean runtime interface.

---

## Sub-Specifications

| File | Contents |
|------|----------|
| [schema.md](../corpus/schema.md) | KnowledgeObject schema · KnowledgeSource schema · Citation model |
| [hierarchy.md](../corpus/hierarchy.md) | Document hierarchy (14 domain-specific levels) · Legal hierarchy (14 authority levels) |
| [lifecycle.md](../corpus/lifecycle.md) | Knowledge lifecycle (5 states) · Knowledge versioning (immutable versions + pointer) |
| [metadata.md](../corpus/metadata.md) | Metadata standard (4 tiers) · Tagging strategy (16 facets) · Ontology relationships (20 types) |
| [quality.md](../corpus/quality.md) | Quality score model (6 dimensions) · Validation pipeline (8 stages) |
| [pipelines.md](../corpus/pipelines.md) | Corpus import pipeline · Corpus update pipeline · Indexing strategy (4 indexes) |

---

## Supported Domains

| Domain Key | Primary ObjectTypes |
|-----------|-------------------|
| `legal` | LEGAL_DOCUMENT, ARTICLE, CLAUSE, POINT, SUBPOINT, APPENDIX |
| `procurement` | PROCESS_PHASE, PROCESS_STAGE, PROCESS_TASK, PROCESS_CHECK |
| `templates` | TEMPLATE_SET, TEMPLATE, TEMPLATE_SECTION, TEMPLATE_FIELD |
| `forms` | FORM, FORM_FIELD, FORM_INSTRUCTION |
| `audit` | COLLECTION, COLLECTION_ITEM (audit findings, inspection items) |
| `inspection` | COLLECTION, COLLECTION_ITEM (inspection checklists, reports) |
| `cases` | CASE, CASE_SECTION |
| `bestpractice` | COLLECTION, COLLECTION_ITEM |
| `school` | LEGAL_DOCUMENT (institutional-level), ARTICLE |
| `ministry` | LEGAL_DOCUMENT (ministerial internal), ARTICLE |
| `masterdata` | COLLECTION_ITEM (reference value sets) |
| `glossary` | COLLECTION, COLLECTION_ITEM |
| `ontology` | COLLECTION, COLLECTION_ITEM (concepts, synonyms, relations) |
| `faq` | COLLECTION, COLLECTION_ITEM |
| `decision_log` | COLLECTION, COLLECTION_ITEM |

---

## Scale Targets

```
Legal documents:          ~5,000 active (from 1986 onward for procurement-relevant laws)
Legal structural units:   ~500,000 (articles, clauses, points from all documents)
Templates + Forms:        ~200 active templates; ~50 form types
Cases:                    ~10,000 (historical + growing)
Risk patterns:            ~500
Audit findings:           ~1,000
Best practices:           ~500
Glossary + Ontology:      ~2,000 terms
FAQ:                      ~500
Decision logs:            ~1,000

TOTAL:                    ~520,000 objects at launch
Growth rate:              ~10,000 objects/month (new cases, new legal amendments)
5-year horizon:           ~1,000,000 objects
```

---

## Key Design Decisions

**1. Content is immutable.** Every edit creates a new `KnowledgeVersion`. The object holds a pointer to the current version. Historical versions are permanently retained for audit. This satisfies the legal requirement that "the law as understood on date X" must be reproducible.

**2. Corpus updates are incremental.** Amending one article in a 500-article law updates: that article's version, its parent chain version pointers, and re-validates all objects citing that article. The other 499 articles are untouched. Full corpus rebuild is never required for content updates.

**3. Legal structure is granular.** The corpus indexes down to the `POINT` (điểm) level. AI Advisory Layer can resolve applicable provisions at the article/clause/point level — not just at the document level. This is required for `resolveLegalBasis()` to return precise citations.

**4. Three independent search indexes.** Full-text (keyword), semantic (vector), and faceted (structured) indexes operate independently. A failure in the vector index does not affect keyword search. Each index is updated incrementally via upsert — no index rebuild on content change.

**5. Quality gates are automatic.** Objects reaching quality ≥ 0.85 with no CRITICAL errors are auto-activated. Objects scoring 0.6–0.85 enter a human review queue. Below 0.6 stays DRAFT. Quality is recomputed when any dependent object changes.

**6. Citations are first-class.** Every legal citation extracted from a document becomes a `KnowledgeCitation` record. Citations are resolved against the corpus (linked to objectId). Unresolved citations on normative references lower quality scores. This builds the complete citation graph automatically.

---

## Dependency on Infrastructure

```
Phase K (Storage)      — rawContentRef: raw files stored via IStorageAdapter
Phase J (Auth)         — importedBy, reviewedBy, activatedBy: userId from AuthContext
Phase M (Prisma)       — corpus persisted in Postgres; pgvector for semantic index
Phase L (Notification) — notify staff when quality threshold met; notify subscribers of changes
```

The corpus model is designed but not implemented until Phase N (after Phase M). Phase N1 is a specification phase only.

---

## What Phase N1 Enables

After this specification:
1. Phase N implementation has a complete data model — no design decisions deferred to coding
2. Corpus import pipeline can begin ingesting real Vietnamese legal documents immediately after Phase N ships
3. All 16 providers know exactly what schema they read from
4. AI Advisory Layer (Phase X) knows exactly what quality signals are available on each item
5. The validation pipeline is deterministic — quality scores are reproducible and auditable
