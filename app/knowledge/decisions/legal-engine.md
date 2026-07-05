# Design Decision: Legal Knowledge Engine (Phase N)

Date: 2026-07-03
Status: APPROVED — inserted after infrastructure, before Supplier Registry

---

## Decision

Insert a Legal Knowledge Engine (Phase N) between the Production Prisma Layer (Phase M) and the Supplier Registry (old Phase N, now Phase O).

The engine is a new module `src/legalEngine/` that sits above `src/legal/` (frozen) and provides:
- Authority-level-aware document registry (extensible, not enum-based)
- Amendment chain traversal and effective law resolution
- Citation graph and concept ontology
- Semantic search and AI retrieval interfaces

---

## Rationale

### 1. The platform's core value proposition is AI-assisted procurement

An AI that cannot reason over laws is just an automation tool. The platform is intended to be an advisory system. Every AI-generated recommendation must be legally grounded and traceable to specific articles. This requires a structured knowledge graph, not a flat document store.

### 2. The existing src/legal/ is a storage schema — not a reasoning engine

`src/legal/legalSchema.ts` provides entity types: LegalDocument, Article, Clause, Amendment, LegalCitation. The Prisma schema stores these entities. But there is no:
- Authority level hierarchy (which document overrides which)
- Effective law resolver (which law governs context X on date Y)
- Amendment chain traversal (what supersedes what, in what order)
- Ontology (concept "advance payment" → article 15 of TT-BTC)
- Semantic search over article content
- RAG context builder for AI prompting

Phase N adds all of these as a knowledge intelligence layer, without touching the frozen storage schema.

### 3. Every future business module needs applicable law resolution

Supplier eligibility checks reference specific law articles (Điều 5-6 of 22/2023/QH15).
Tender announcement rules reference specific method articles.
Bid evaluation criteria reference weighted scoring rules in decrees.

Without a Legal Knowledge Engine, each of these modules would either:
(a) Hardcode law references (violates the no-hardcode principle — same error as TD-01/TD-02)
(b) Make ad-hoc queries to the legal DB (no consistency, no amendment awareness)

Phase N provides a single, amendment-aware, date-context-aware applicable law resolver that all modules call. This is the canonical solution to TD-01 and TD-02.

### 4. The DocType enum in Prisma is insufficient

The current `DocType` enum has 7 values: LAW, DECREE, CIRCULAR, DECISION, RESOLUTION, GUIDELINE, UNKNOWN. It is missing: Ordinances, PM Decisions, Joint Circulars, Official Letters, Consolidated Documents, Internal Regulations, Provincial Regulations.

Extending an enum in a frozen Prisma schema requires a migration and a schema change. The Legal Knowledge Engine introduces a `DocumentTypeRegistry` — an open string-keyed registry table, not an enum. New document types are registered at runtime without code changes.

### 5. Timing: after infrastructure, before business expansion

The engine depends on:
- Prisma (Phase M) — for knowledge graph DB storage
- Storage (Phase K) — for document file attachments
- Auth (Phase J) — for document registration attribution

It must come before Supplier (Phase O) because:
- Supplier eligibility rules reference specific legal articles
- The engine provides `resolveApplicableDocuments()` which replaces hardcoded conditionals

---

## What Phase N is NOT Doing

- NOT replacing `src/legal/` (frozen — stays as-is)
- NOT implementing PDF parsing (that is Module A1's domain)
- NOT implementing the HTTP API layer
- NOT generating documents (that is Phase V Document Generator)
- NOT implementing real vector embeddings (Phase X AI Advisory wires real embedding adapters)

Phase N provides the INTERFACE and IN-MEMORY implementation for semantic search. Real embeddings are plugged in later without changing any Phase N code.

---

## Impact on Technical Debt

TD-02 (`procurementEngine.ts` symbol conditionals): Phase N's `effectiveLawResolver.ts` provides `resolveApplicableDocuments(domain, asOfDate, context)`. After Phase N, `procurementEngine.resolveLegalDocuments()` can be refactored to delegate to the engine, eliminating the `d.symbol === '13/2026/TT-BCT'` conditionals. (Requires unfreezing procurementEngine.ts for this targeted fix, or replacing the engine method via a subclass/override.)

TD-01 (`acceptanceService.ts` string[] legal basis): Phase N provides `getDefaultProcurementLegalBasis(asOfDate)` returning `LegalBasis[]`. Future acceptance v2 module uses this. The frozen module continues with string[] until it is superseded by a v2 acceptance module.
