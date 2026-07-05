# Module: Knowledge Platform

**Status:** ARCHITECTURE FROZEN (2026-07-03) — Implementation after Phase M
**Location:** `src/knowledge/` (to be created)
**Tests:** ~1,092 planned (~28 files × 39 tests)

---

## Purpose

The central intelligence layer. Provides knowledge retrieval for legal documents, procurement
rules, templates, risk patterns, cases, and all other knowledge domains.
RETRIEVES knowledge. NEVER reasons. NEVER evaluates rules.

---

## Frozen Architecture (IMMUTABLE)

See `.memory/knowledge/platform.md` for complete spec.

### IKnowledgePlatform (14 methods)

```typescript
searchKnowledge(query): Promise<KnowledgeResult[]>
resolveKnowledge(itemId): Promise<KnowledgeItem | null>
resolveLegalBasis(context): Promise<LegalBasis[]>
resolveTemplates(context): Promise<KnowledgeItem[]>
resolveChecklist(context): Promise<KnowledgeItem[]>
resolveBestPractice(context): Promise<KnowledgeItem[]>
resolveCases(context): Promise<KnowledgeItem[]>
resolveRisk(context): Promise<KnowledgeItem[]>
resolveAuditFinding(context): Promise<KnowledgeItem[]>
resolveSchoolPolicy(context): Promise<KnowledgeItem[]>
resolveVendorKnowledge(context): Promise<KnowledgeItem[]>
resolveAssetKnowledge(context): Promise<KnowledgeItem[]>
resolveBudgetKnowledge(context): Promise<KnowledgeItem[]>
resolveContext(params): Promise<ResolvedContext>
// note: buildAIContext is deprecated — use Reasoning Layer + AIContextBuilder instead
```

### 16 Providers across 4 Layers

| Layer | Domain Key | Provider |
|-------|-----------|---------|
| 1 (Legal) | legal | LegalProvider |
| 2 (Business) | procurement | ProcurementProvider |
| 2 | templates | TemplateProvider |
| 2 | checklists | ChecklistProvider |
| 2 | ontology | OntologyProvider |
| 2 | glossary | GlossaryProvider |
| 2 | vendor | VendorKnowledgeProvider |
| 2 | asset | AssetKnowledgeProvider |
| 2 | budget | BudgetKnowledgeProvider |
| 2 | notification | NotificationKnowledgeProvider |
| 3 (Org) | school | SchoolPolicyProvider |
| 4 (Experience) | cases | CaseProvider |
| 4 | risk | RiskProvider |
| 4 | audit | AuditProvider |
| 4 | bestpractice | BestPracticeProvider |
| 4 | ai_feedback | AIFeedbackProvider |

---

## Immutable Rules

1. `domain` is open string — NEVER enum
2. New domain → `registerProvider()` only — zero code changes
3. Router = pure `Map` lookup — no `switch` or `if`
4. AI = `IKnowledgePlatform` only — never imports providers directly
5. `suggest()` + `score()` required on every provider
6. `KnowledgeItem` is universal — no domain-specific entity types

---

## KnowledgeItem (universal type)

```typescript
KnowledgeItem {
  id, domain, provider, type, title, summary,
  keywords: string[],
  legalBasis: LegalBasis[],
  relatedItems: string[],
  metadata: Record<string, unknown>,
  effectivePeriod: { from: string, to?: string },
  confidence: number,
  attachments: string[],         // attachment IDs (Storage)
  layer: 1 | 2 | 3 | 4,
  language: string,
  isActive: boolean,
  version: string
}
```

---

## Source Layout

```
src/knowledge/
  platform/         — types, IKnowledgePlatform, DefaultKnowledgePlatform, registry, router
  search/           — IEmbeddingAdapter, IVectorStoreAdapter, SearchEngine, ResultRanker
  graph/            — IKnowledgeGraph, KnowledgeGraphService
  repositories/     — IKnowledgeItemRepo, memory+prisma impls
  providers/legal/  — LegalProvider + 5 support files
  providers/*/      — one file per remaining 15 providers
  integration/      — knowledgeIntegration.ts (only file importing from src/legal/)
```

---

## Dependencies (planned)

- `src/legal/` (via `knowledgeIntegration.ts` only)
- `src/shared/financial/financialTypes.ts`
- Prisma (Phase M) for corpus persistence
- PostgreSQL tsvector (full-text), pgvector (semantic), GIN (faceted)

---

## Related Specs

- Corpus Layer: `.memory/knowledge/corpus.md`
- Reasoning Layer: `.memory/knowledge/reasoning.md`
- AI Contract: `.memory/knowledge/ai-contract.md`
