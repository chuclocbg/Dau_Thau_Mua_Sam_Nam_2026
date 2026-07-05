# Legal Knowledge Engine — Phase N Architecture

Designed: 2026-07-03

---

## Relationship to Existing Legal Module

`src/legal/` (FROZEN — Phases A1 + A2) is the **storage schema**:
- Entity types: LegalDocument, Article, Clause, Amendment, LegalCitation
- Repository interfaces + memory implementations
- Domain services: validation, search, keyword extraction (stateless pure functions)
- Prisma schema: 12 models covering the full document structure

`src/legalEngine/` (Phase N) is the **intelligence and reasoning layer**:
- Knowledge graph traversal (amendment chains, citation graphs, concept maps)
- Authority level registry (extensible, not an enum)
- Effective law resolution (which law governs context X on date Y?)
- Legal ontology (procurement concepts → law articles mapping)
- Semantic search interface (keyword + pluggable vector search)
- AI retrieval interfaces (RAG context builder for AI Advisory Layer)

The engine IMPORTS from `src/legal/` via `legalEngineIntegration.ts` (bridge). It never modifies frozen code.

---

## Module Structure

```
src/legalEngine/
├── legalEngineTypes.ts        — all new types: KnowledgeNode, ConceptEdge, AIQuery, RagContext, etc.
├── legalHierarchy.ts          — DocumentTypeRegistry: open registry of authority levels (not an enum)
├── citationGraph.ts           — graph traversal over LegalCitation edges; citation type enrichment
├── amendmentChain.ts          — superseded chain resolver; effective document finder
├── effectiveLawResolver.ts    — resolveApplicableDocuments(domain, asOfDate, context)
├── legalOntology.ts           — LegalConcept graph; procurement→law article mapping
├── semanticSearch.ts          — keyword search + IEmbeddingAdapter interface
├── aiRetrieval.ts             — buildRagContext(); getContextForQuery()
├── legalEngineRepository.ts   — IDocumentTypeRepo, ILegalConceptRepo, IKnowledgeGraphRepo
├── memoryLegalEngine.ts       — in-memory test implementations of all repos
└── legalEngineIntegration.ts  — ONLY file importing from src/legal/ (bridge)
```

---

## Core Types

```typescript
// Extensible document type registry — NOT an enum
interface DocumentTypeDefinition {
  code:             string       // open string — e.g. 'LAW', 'DECREE', 'JOINT_CIRCULAR'
  displayName:      string       // Vietnamese: "Thông tư liên tịch"
  authorityLevel:   number       // 1 = Constitution, 14 = internal regulation
  issuingBodies:    string[]     // which bodies can issue this type
  isLegallyBinding: boolean
  canAmend:         string[]     // type codes this type can amend
  mustImplement:    string[]     // type codes this type must implement
}

// Knowledge graph node — wraps a LegalDocument with engine metadata
interface KnowledgeNode {
  documentId:      string
  symbol:          string
  title:           string
  typeCode:        string        // references DocumentTypeDefinition.code
  authorityLevel:  number        // derived from type
  isLegallyBinding: boolean
  effectivePeriods: EffectivePeriod[]
  status:          LegalDocumentStatus
  domains:         string[]      // e.g. ['PROCUREMENT', 'FINANCE']
  concepts:        string[]      // conceptId[] from ontology
  embeddingId?:    string        // reference to stored embedding
}

// Citation with type (extends existing LegalCitation)
interface TypedCitation {
  citationId:       string
  citingDocumentId: string
  citedDocumentId:  string
  citingArticle?:   string
  citedArticle?:    string
  citationType:     CitationType   // REFERENCE | IMPLEMENTS | DELEGATES | DEFINES | RESTRICTS
  context?:         string         // excerpt showing the citation
}

type CitationType = 'REFERENCE' | 'IMPLEMENTS' | 'DELEGATES' | 'DEFINES' | 'RESTRICTS'

// Legal concept (ontology node)
interface LegalConcept {
  conceptId:       string
  name:            string         // English
  nameVn:          string         // Vietnamese: "Tạm ứng"
  domain:          string         // 'PROCUREMENT' | 'FINANCE' | 'CONTRACT' | etc.
  definition:      string
  relatedConcepts: ConceptRelation[]
  documentRefs:    ConceptDocRef[]
}

interface ConceptRelation {
  targetConceptId: string
  relationType:    'BROADER' | 'NARROWER' | 'RELATED' | 'SYNONYM'
}

interface ConceptDocRef {
  documentId: string
  article?:   string
  clause?:    string
  role:       'DEFINES' | 'USES' | 'RESTRICTS' | 'DELEGATES'
}

// AI query interface
interface AILegalQuery {
  question:           string     // natural language
  domain?:            string
  asOfDate?:          string
  maxDocuments?:      number
  includeAmendments?: boolean
  includeCitations?:  boolean
}

// RAG context for AI consumption
interface LegalRagContext {
  chunks:         DocumentChunk[]
  sources:        LegalSourceRef[]
  conceptMatches: LegalConcept[]
  totalDocuments: number
  asOfDate:       string
}

interface DocumentChunk {
  chunkId:    string
  documentId: string
  symbol:     string
  articleRef: string
  text:       string
  relevance:  number   // 0–1
}
```

---

## Key Services

### effectiveLawResolver.ts

```typescript
// Core function — replaces TD-02 procurementEngine.resolveLegalDocuments()
resolveApplicableDocuments(
  query: {
    domain: string           // 'PROCUREMENT' | 'FINANCE' etc.
    asOfDate: string         // YYYY-MM-DD
    context: LegalContext    // { packageType?, fundSource?, department?, ... }
  },
  nodes: KnowledgeNode[],
  registry: DocumentTypeDefinition[]
): KnowledgeNode[]

// Example usage (replaces hardcoded conditionals):
// procurementEngine calls:
//   legalEngineIntegration.resolveApplicableDocuments({ domain: 'PROCUREMENT', asOfDate, context: { packageType, fundSource } })
// Engine returns only applicable documents based on their applicability metadata
// No hardcoded symbol checks
```

Applicability rules for each document are stored as metadata on the `KnowledgeNode`
(or in a `DocumentApplicabilityRule` model in the DB), NOT as inline code conditionals.

### amendmentChain.ts

```typescript
// Follow supersession chain forward to current version
resolveCurrentDocument(symbol: string, asOfDate: string, nodes: KnowledgeNode[]): KnowledgeNode | null

// Get full chain from original to current
getSupersessionChain(documentId: string, nodes: KnowledgeNode[], amendments: Amendment[]): KnowledgeNode[]

// Check if document is still in force on a date
isEffectiveOn(node: KnowledgeNode, date: string): boolean
```

### semanticSearch.ts

```typescript
interface IEmbeddingAdapter {
  embed(text: string): Promise<number[]>
  embedBatch(texts: string[]): Promise<number[][]>
  similarity(a: number[], b: number[]): number
}
// Implementations:
//   NoOpEmbeddingAdapter    — returns [] (Phase N default; tests pass without AI)
//   OpenAIEmbeddingAdapter  — text-embedding-3-small
//   ClaudeEmbeddingAdapter  — Voyage AI or claude.ai embedding

interface IVectorStoreAdapter {
  upsert(id: string, vector: number[], meta: Record<string, string>): Promise<void>
  query(vector: number[], topK: number, filter?: Record<string, string>): Promise<VectorMatch[]>
}
// Implementations:
//   MemoryVectorStore       — brute-force cosine similarity (Phase N)
//   PgvectorStore           — PostgreSQL pgvector extension
//   PineconeStore           — Pinecone cloud vector DB stub
```

Two-phase search (keyword always available, vector requires embedding adapter):
1. Structural: document type, date range, domain tags, keyword match
2. Semantic: vector similarity on article chunks (requires embedded content)

---

## Schema Additions (Phase N, adds to Phase M Prisma)

```
DocumentTypeRegistryEntry   — replaces DocType enum; open string code + authority level
DocumentApplicabilityRule   — scope rules per document (packageType[], fundSource[], department[])
LegalConceptNode            — ontology concept node
LegalConceptRelation        — concept-to-concept edges (BROADER/NARROWER/RELATED/SYNONYM)
DocumentConceptMap          — document → concept mapping with role
TypedLegalCitation          — extends LegalCitation with citationType field
LegalEmbedding              — chunk text + vector embedding per article/section
```

---

## How Phase N Fixes Technical Debt

**TD-01 (acceptanceService.ts string[] legal basis):**
After Phase N, the `legalEngineIntegration` provides `getDefaultProcurementLegalBasis(asOfDate)` which returns `LegalBasis[]` objects resolved from the knowledge graph. Acceptance module's frozen `DEFAULT_LEGAL_BASIS = string[]` will be replaced in a future acceptance v2 module.

**TD-02 (procurementEngine.ts symbol conditionals):**
After Phase N, `procurementEngine.resolveLegalDocuments()` delegates to `legalEngineIntegration.resolveApplicableDocuments()`. The applicability rules (GOODS-only for TT-BCT, STATE-only for TT-BTC) are stored as `DocumentApplicabilityRule` records in the DB, not as code conditionals. Adding a new circular with its own applicability scope requires only a DB insert, zero code change.

---

## What Phase N is NOT

- NOT a replacement for `src/legal/` (frozen; stays as-is)
- NOT a PDF extractor (that is Module A1's domain)
- NOT a document importer (that is Module A1's domain)
- NOT an HTTP API (the API layer is a separate concern)
- NOT a notification system (that is Phase L)
