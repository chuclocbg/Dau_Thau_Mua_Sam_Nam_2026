# Knowledge Platform — FROZEN ARCHITECTURE

Frozen: 2026-07-03
Location: src/knowledge/
Full decision: knowledge/decisions/knowledge-platform-v2.md

---

## 4 Layers

Layer 1 — Legal (nationally binding): LegalProvider
Layer 2 — Business (operationally binding): ProcurementProvider, TemplateProvider, ChecklistProvider, OntologyProvider, GlossaryProvider, VendorKnowledgeProvider, AssetKnowledgeProvider, BudgetKnowledgeProvider, NotificationKnowledgeProvider
Layer 3 — Organizational (institutionally binding, may be more restrictive): SchoolPolicyProvider
Layer 4 — Experience (advisory only): CaseProvider, RiskProvider, AuditProvider, BestPracticeProvider, AIFeedbackProvider

## 16 Providers

| Domain Key | Layer | Provider Class |
|-----------|-------|---------------|
| legal | 1 | LegalProvider |
| procurement | 2 | ProcurementProvider |
| templates | 2 | TemplateProvider |
| checklists | 2 | ChecklistProvider |
| ontology | 2 | OntologyProvider |
| glossary | 2 | GlossaryProvider |
| vendor | 2 | VendorKnowledgeProvider |
| asset | 2 | AssetKnowledgeProvider |
| budget | 2 | BudgetKnowledgeProvider |
| notification | 2 | NotificationKnowledgeProvider |
| school | 3 | SchoolPolicyProvider |
| cases | 4 | CaseProvider |
| risk | 4 | RiskProvider |
| audit | 4 | AuditProvider |
| bestpractice | 4 | BestPracticeProvider |
| ai_feedback | 4 | AIFeedbackProvider |

## IKnowledgeProvider (all 4 methods required)

```typescript
interface IKnowledgeProvider {
  readonly domain:  string       // open string
  readonly layer:   1 | 2 | 3 | 4
  readonly version: string
  search(query: KnowledgeQuery): Promise<KnowledgeResult[]>
  resolve(itemId: string): Promise<KnowledgeItem | null>
  suggest(context: KnowledgeContext): Promise<KnowledgeSuggestion[]>
  score(itemId: string, context: KnowledgeContext): Promise<number>
}
```

## KnowledgeItem (universal, all domains)

id · domain · provider · type · title · summary · keywords · legalBasis[] · relatedItems[] · metadata · effectivePeriod · confidence · attachments · layer · language · isActive · version

## KnowledgeGraph Relations (open string constants)

IMPLEMENTS · SUPERSEDES · REFERENCES · DEPENDS_ON · REQUIRES · GENERATES · USES_TEMPLATE · USES_CHECKLIST · SIMILAR_TO · RELATED_TO

## Platform API (14 methods)

searchKnowledge · resolveKnowledge · resolveLegalBasis · resolveTemplates · resolveChecklist · resolveBestPractice · resolveCases · resolveRisk · resolveAuditFinding · resolveSchoolPolicy · resolveVendorKnowledge · resolveAssetKnowledge · resolveBudgetKnowledge · resolveContext · buildAIContext

## Immutable Rules

1. Domain = open string. Never enum.
2. New domains = registerProvider() only. Zero code changes.
3. No routing logic = pure Map lookup, no switch/if.
4. AI = IKnowledgePlatform only. Never imports providers directly.
5. suggest() and score() required on every provider.
6. KnowledgeItem is universal — no domain-specific entity types.
7. KnowledgeRelationType = open string constant set, not enum.
8. Applicability rules universal across all domains.

## Source Layout

src/knowledge/
  platform/         — types, IKnowledgePlatform, DefaultKnowledgePlatform, registry, router
  search/           — IEmbeddingAdapter, IVectorStoreAdapter, SearchEngine, ResultRanker
  graph/            — IKnowledgeGraph, KnowledgeGraphService, path/subgraph queries
  repositories/     — IKnowledgeItemRepo, IKnowledgeRelationRepo, IApplicabilityRepo, memory+prisma impls
  providers/legal/  — LegalProvider + documentTypeRegistry, citationGraph, amendmentChain, effectiveLawResolver
  providers/*/      — one file per remaining 15 providers
  integration/      — knowledgeIntegration.ts (ONLY file importing from src/legal/)

~28 source files | ~1092 tests (~28 × 39)
