# Knowledge Platform (Phase N) — FROZEN, 16 of 16 Providers Complete

**Status: PHASE N COMPLETE AND FROZEN.** Stage 1 (platform core) + Stage 2 (`LegalProvider`/
`ProcurementProvider`) proved every extension point. Batch 1 added `TemplateProvider`,
`ChecklistProvider`, `OntologyProvider`, `GlossaryProvider`. Batch 2 added
`VendorKnowledgeProvider`, `AssetKnowledgeProvider`, `BudgetKnowledgeProvider`,
`NotificationKnowledgeProvider`. Batch 3 added `SchoolPolicyProvider`, `CaseProvider`,
`RiskProvider`, `AuditProvider`. **Batch 4 (final) adds `BestPracticeProvider` and
`AIFeedbackProvider`** — all 16 of 16 providers from the frozen spec now implemented, registered,
and tested, with **zero changes to the platform core across the entire phase**. See
`.memory/knowledge-platform-frozen.md` and `knowledge/decisions/knowledge-platform-v2.md` for the
full frozen architecture this implements. Next phase: **Phase X (AI Advisory Layer)** — not yet
started, pending explicit approval.

**Naming note:** `src/knowledge/` already contained two unrelated files predating this phase —
`knowledgeBase.ts` and `knowledgeTypes.ts` (a "Phase 16 — Governance Knowledge Base" module from
an earlier, unrelated commit track: document templates, checklists, legal citations). They are
untouched and still tested by their own pre-existing `knowledge-base.test.ts`/`knowledge-types.test.ts`/
`knowledge-provider.test.ts` files. This phase's new files live in subdirectories
(`platform/`, `graph/`, `search/`, `repositories/`, `application/`) and its own barrel
`src/knowledge/index.ts` — no import collision exists (verified: nothing imports the old files via
the new `index.ts`), but a future session should not assume "the knowledge module" means only one
thing in this codebase.

---

## Architecture

```
                    ┌─────────────────────────────────────────┐
                    │      DefaultKnowledgePlatform            │  ← IKnowledgePlatform
                    │  (the ONLY interface the future AI       │     (Rule 4)
                    │   Advisory Layer may import)              │
                    └───────────────┬───────────────────────────┘
                                    │ composes
              ┌─────────────────────┼─────────────────────┬──────────────┐
              ▼                     ▼                     ▼              ▼
      ProviderRegistry        QueryRouter            Retriever       Resolver
      (Map<domain,            (fans a query out            │              │
       IKnowledgeProvider>,    to registered providers,     │              │
       Rule 3: pure lookup)    merges via ResultRanker)     │              │
                                                             ▼              ▼
                                                    KnowledgeRepositories  KnowledgeGraphService
                                                    (items, relations,     (BFS path/subgraph
                                                     applicability)         over relations repo)
```

**Every future provider** implements `IKnowledgeProvider` (`search`/`resolve`/`suggest`/`score`)
and calls `platform.registerProvider(provider)` — zero changes anywhere in the diagram above.

---

## Extension Points

| Extension point | How a new domain uses it |
|---|---|
| `IKnowledgeProvider` | Implement 4 methods; `domain` is any string, `layer` is 1–4 |
| `platform.registerProvider()` | The only way a domain becomes searchable — no config file, no switch statement |
| `SearchEngine.scoreKeyword()` | Optional shared utility a provider's `search()` can call instead of writing its own text matcher |
| `KnowledgeApplicabilityRule` | Any item from any domain can have zero, one, or many rules; `Retriever.resolveApplicableDocuments(domain, ...)` evaluates them identically regardless of domain |
| `KNOWLEDGE_RELATION_TYPES` | A documented set of well-known graph edge labels — `KnowledgeGraphService.addEdge()` accepts any string, known or not |
| `IEmbeddingAdapter` / `IVectorStoreAdapter` | Swappable in `SearchEngine`'s constructor — default `NoOp`/`Memory` implementations require no external service |

---

## Provider Contract

```typescript
interface IKnowledgeProvider {
  readonly domain: string        // open string — unique per provider
  readonly layer: 1 | 2 | 3 | 4
  readonly version: string

  search(query: KnowledgeQuery): Promise<readonly KnowledgeResult[]>
  resolve(itemId: string): Promise<KnowledgeItem | null>
  suggest(context: KnowledgeContext): Promise<readonly KnowledgeSuggestion[]>
  score(itemId: string, context: KnowledgeContext): Promise<number>
}
```

`suggest()` (proactive surfacing without an explicit query) and `score()` (cross-provider
relevance ranking) are required on every provider, per the frozen spec — Stage 1 does not enforce
this beyond the type system, since no real provider exists yet to violate it.

---

## Source Layout (Stage 1 — 13 core files + barrel)

```
src/knowledge/
  platform/
    knowledgeTypes.ts      — KnowledgeItem, KnowledgeContext, KnowledgeQuery/Result/Suggestion,
                              IKnowledgeProvider, KNOWLEDGE_RELATION_TYPES, KnowledgeError, AIKnowledgeContext
    providerRegistry.ts     — createProviderRegistry() — pure Map<domain, provider>
    queryRouter.ts           — QueryRouter — fans out + merges via ResultRanker
    knowledgePlatform.ts     — IKnowledgePlatform + DefaultKnowledgePlatform
  graph/
    knowledgeGraph.ts        — IKnowledgeGraph + KnowledgeGraphService (BFS path/subgraph)
  search/
    embeddingAdapter.ts       — IEmbeddingAdapter + NoOpEmbeddingAdapter (default)
    vectorStoreAdapter.ts      — IVectorStoreAdapter + MemoryVectorStoreAdapter (default, cosine similarity)
    searchEngine.ts             — SearchEngine (keyword + optional semantic scoring), scoreKeyword()
    resultRanker.ts              — ResultRanker (relevance desc, confidence tiebreak)
  repositories/
    knowledgeRepositories.ts      — IKnowledgeItemRepository, IKnowledgeRelationRepository, IApplicabilityRepository
    memoryKnowledgeRepositories.ts — memory implementations + buildMemoryKnowledgeRepositories()
  application/
    retriever.ts                   — Retriever.resolveApplicableDocuments() — the TD-02-fixing evaluator
    resolver.ts                     — Resolver.resolve() / resolveWithRelated()
  index.ts                           — barrel export
```

**Stage 2 additions:**
```
src/knowledge/providers/
  baseProvider.ts              — BaseKnowledgeProvider: shared search/resolve/suggest/score,
                                  extended by every concrete provider (justified reuse — all
                                  16 eventual providers need this exact CRUD/scoring shape)
  legal/legalProvider.ts        — LegalProvider (domain='legal', layer=1): citation graph
                                  (REFERENCES), amendment chain traversal (SUPERSEDES)
  procurement/procurementProvider.ts — ProcurementProvider (domain='procurement', layer=2):
                                  template linkage (USES_TEMPLATE), method dependency
                                  chains (DEPENDS_ON)
```

**Batch 1 additions (4 providers, all Layer 2, all extending `BaseKnowledgeProvider`):**
```
src/knowledge/providers/
  templates/templateProvider.ts    — TemplateProvider: prerequisite chains (DEPENDS_ON),
                                      generated-document links (GENERATES)
  checklists/checklistProvider.ts   — ChecklistProvider: phase-gate ordering (DEPENDS_ON,
                                      reversed direction from Template's usage), getRequiredBy()
                                      via incoming USES_CHECKLIST edges
  ontology/ontologyProvider.ts       — OntologyProvider: synonym linkage (SIMILAR_TO), broader/
                                      narrower concept hierarchy via a NEW relation type
                                      ('BROADER_THAN') not in KNOWLEDGE_RELATION_TYPES
  glossary/glossaryProvider.ts        — GlossaryProvider: abbreviation linkage ('ABBREVIATES')
                                      and term translation ('TRANSLATES_TO') — two more new
                                      relation types, both independent, real usages
```

Both `BROADER_THAN`/`ABBREVIATES`/`TRANSLATES_TO` are genuine production usages (not test-only
fixtures) proving Rule 7 a second and third time: the graph accepts any string relation type with
zero engine changes, whether it's one of the 10 documented constants or an entirely new one a
provider author invents on the spot.

**Batch 2 additions (4 providers, all Layer 2, all extending `BaseKnowledgeProvider`):**
```
src/knowledge/providers/
  vendor/vendorKnowledgeProvider.ts        — VendorKnowledgeProvider: required-certification
                                              links (REQUIRES), blacklist reasoning via a NEW
                                              relation type ('BLACKLISTED_FOR')
  asset/assetKnowledgeProvider.ts           — AssetKnowledgeProvider: lifecycle-stage ordering
                                              (DEPENDS_ON, reused pattern from Checklist),
                                              depreciation rule linkage (REFERENCES)
  budget/budgetKnowledgeProvider.ts          — BudgetKnowledgeProvider: budget-code hierarchy via
                                              a NEW relation type ('ROLLS_UP_TO'), fund-source
                                              rule linkage (REFERENCES)
  notification/notificationKnowledgeProvider.ts — NotificationKnowledgeProvider: escalation
                                              chains via a NEW relation type ('ESCALATES_TO'),
                                              message-template linkage (USES_TEMPLATE). Distinct
                                              from `src/notification/` (Phase L delivery
                                              infrastructure) — this provider holds KNOWLEDGE
                                              about notification/escalation rules, not live
                                              delivery state.
```

`BLACKLISTED_FOR`/`ROLLS_UP_TO`/`ESCALATES_TO` are three more genuine new relation types (not
test-only fixtures), bringing the total proven-on-the-fly relation vocabulary to 6 beyond the 10
documented constants — further confirming Rule 7 holds at 10 providers deep with zero graph-engine
changes.

**Batch 3 additions (4 providers, spanning Layer 3 and Layer 4 for the first time since Stage 2's
`LegalProvider`, all extending `BaseKnowledgeProvider`):**
```
src/knowledge/providers/
  school/schoolPolicyProvider.ts   — SchoolPolicyProvider (Layer 3 — institutionally binding,
                                      may be MORE restrictive than Layer 1): governing legal
                                      basis linkage (REFERENCES), internal restriction of a
                                      broader rule via a NEW relation type ('RESTRICTS')
  cases/caseProvider.ts             — CaseProvider (Layer 4 — advisory only): similar-case
                                      linkage (SIMILAR_TO, reused), the risk a case revealed via
                                      a NEW relation type ('REVEALED')
  risk/riskProvider.ts               — RiskProvider (Layer 4 — advisory only): mitigating
                                      control linkage via a NEW relation type ('MITIGATED_BY'),
                                      related audit finding linkage (REFERENCES, reused)
  audit/auditProvider.ts              — AuditProvider (Layer 4 — advisory only): corrective
                                      action linkage via a NEW relation type ('REMEDIATED_BY'),
                                      affected risk pattern linkage (RELATED_TO, reused)
```

`RESTRICTS`/`REVEALED`/`MITIGATED_BY`/`REMEDIATED_BY` are four more genuine new relation types,
bringing the total proven-on-the-fly relation vocabulary to 10 beyond the 10 documented constants
— Rule 7 now confirmed at 14 providers deep, across all 4 layers, with zero graph-engine changes.
Batch 3 is also the first batch since Stage 2 to populate `buildAIContext()`'s `risks`/`cases`
fields with real (not just structurally-typed) data, since `RiskProvider`/`CaseProvider` are the
first providers registered for those two domains.

**Batch 4 — final 2 providers (both Layer 4, both extending `BaseKnowledgeProvider`, both
explicitly designed as future-facing bridges for Phase X — neither contains any AI reasoning or
LLM calls):**
```
src/knowledge/providers/
  bestpractice/bestPracticeProvider.ts — BestPracticeProvider: implementation patterns,
                                      recommended workflows, procurement best practices,
                                      architecture patterns, coding standards, operational
                                      guidance. Pattern-implementation linkage (IMPLEMENTS — the
                                      last of the 10 documented relation constants to see a real
                                      usage), derivation from a precedent case via a NEW
                                      relation type ('DERIVED_FROM')
  aifeedback/aiFeedbackProvider.ts      — AIFeedbackProvider: human review feedback, AI
                                      correction history, reviewer comments, model evaluation,
                                      prompt improvement, quality observations. Pure knowledge
                                      source only — no reasoning, no LLM invocation anywhere in
                                      this class. Correction linkage via a NEW relation type
                                      ('CORRECTS'), related-best-practice linkage (RELATED_TO,
                                      reused a third time)
```

`IMPLEMENTS` finally gets a genuine production usage (the only one of the 10 documented constants
that had gone unused through Batches 1-3), and `DERIVED_FROM`/`CORRECTS` are two more new relation
types — bringing the total proven-on-the-fly relation vocabulary to 12 beyond the 10 documented
constants, and confirming all 10 documented constants now have at least one real usage. Rule 7 is
confirmed a final time at 16 providers deep, across all 4 layers, with zero graph-engine changes.

`AIFeedbackProvider` is deliberately **not** part of `AIKnowledgeContext` (`buildAIContext()`'s
fixed six-field shape is unchanged) — Phase X will decide, with explicit approval, whether and how
AI feedback data enters that bundle; this phase does not silently widen a frozen type to
anticipate it.

**Phase N is now complete: 16 of 16 providers built.** No providers remain deferred. Not yet
built (out of scope for Phase N by design): `integration/knowledgeIntegration.ts` (the only file
allowed to import `src/legal/`, needed once a provider ingests real `LegalDocument` rows) and
Prisma-backed repositories (every other module is memory-first, Prisma-later; Knowledge follows
the same order). Both remain valid future work, independent of Phase X.

---

## Stage 2 — What The Two Representative Providers Prove

`LegalProvider` and `ProcurementProvider` were deliberately chosen to be as different as two
Layer-1/Layer-2 providers can be, to stress-test every extension point before committing to the
pattern for the remaining 14:

| Extension point | Proven by |
|---|---|
| Different `layer` values | Legal=1, Procurement=2 |
| Different graph relation types | Legal uses `REFERENCES`/`SUPERSEDES`; Procurement uses `USES_TEMPLATE`/`DEPENDS_ON` — same `KnowledgeGraphService`, zero graph-engine changes |
| Domain isolation | `knowledge-platform-providers-integration.test.ts` proves a citation recorded via `LegalProvider` never leaks into `ProcurementProvider`'s template links, and vice versa |
| Shared base + per-provider specialization | Both extend `BaseKnowledgeProvider` and override only `suggestionReason()` plus add their own graph-relationship methods |
| Registry duplicate-domain rejection | Registering a second `LegalProvider` instance for `'legal'` throws, even though it's a different object |
| Platform composition with 2 simultaneous domains | `resolveContext()` and `buildAIContext()` both correctly aggregate across `legal` + `procurement` at once |
| Zero platform/router/registry changes | Neither `queryRouter.ts`, `providerRegistry.ts`, nor `knowledgePlatform.ts` were touched between Stage 1 and Stage 2 |

**Architecture verdict: FROZEN.** The pattern holds under two genuinely different real
implementations touching every documented extension point. Adding provider 3 through 16 is
expected to be pure repetition of this same shape — new file, extend `BaseKnowledgeProvider`,
register. No core changes anticipated, but each remaining provider is still built and reviewed
individually rather than assumed safe in bulk.

---

## Immutable Rules (verified by tests, not just asserted)

1. **Domain = open string.** `knowledge-platform-provider-registry.test.ts` and
   `knowledge-platform-query-router.test.ts` both register a domain key invented at test-write
   time (`'something-invented-tomorrow'`, `'a-domain-invented-just-now'`) and confirm it works
   with zero special-casing.
2. **Registration only.** `platform.registerProvider()` is the only way `searchKnowledge()`,
   `resolveContext()`, etc. become aware of a domain.
3. **No routing logic.** `QueryRouter.route()` and `ProviderRegistry` are pure `Map` operations —
   grep confirms no `switch`/domain-name `if` anywhere in `platform/` or the router.
4. **AI = platform only.** `IKnowledgePlatform` is the only exported interface intended for a
   future AI Advisory Layer; provider classes will live under `providers/` (Stage 2+), never
   imported by anything outside `src/knowledge/`.
5. **`suggest()`/`score()` required.** Enforced by the `IKnowledgeProvider` TypeScript interface.
6. **`KnowledgeItem` is universal.** No domain-specific entity type exists anywhere in Stage 1.
7. **Open-string relation types.** `KnowledgeRelationType = string`; `KNOWLEDGE_RELATION_TYPES` is
   a frozen object of well-known constants, not a TS union — verified by
   `knowledge-platform-graph.test.ts`'s "brand-new relation type" case.
8. **Universal applicability.** `Retriever.resolveApplicableDocuments()` takes `domain` as a plain
   parameter; `knowledge-platform-retriever.test.ts` proves identical behavior for `'legal'` and
   `'risk'` domains using the same code path.

---

## Tests

120 tests across 10 files:

| File | Tests | Covers |
|---|---|---|
| `knowledge-platform-types.test.ts` | 8 | Constants, `KnowledgeError` |
| `knowledge-platform-provider-registry.test.ts` | 8 | Register/resolve/list, duplicate rejection, novel domain |
| `knowledge-platform-query-router.test.ts` | 8 | Single/all-domain routing, ranking, limit, missing domain |
| `knowledge-platform-search-engine.test.ts` | 15 | `scoreKeyword`, `SearchEngine` (NoOp + fake embedding), `MemoryVectorStoreAdapter`, `NoOpEmbeddingAdapter` |
| `knowledge-platform-result-ranker.test.ts` | 6 | Sort, tiebreak, limit, immutability, empty input |
| `knowledge-platform-graph.test.ts` | 15 | Add/get edges, BFS path (direct/multi-hop/shortest/cycle-safe), subgraph at depths 0/1/2 |
| `knowledge-platform-repositories.test.ts` | 15 | Item/relation/applicability memory repos, full CRUD |
| `knowledge-platform-retriever.test.ts` | 21 | `isEffectiveOn`, `matchesApplicability` (every filter dimension), `resolveApplicableDocuments` (the TD-02 mechanism) |
| `knowledge-platform-resolver.test.ts` | 8 | Resolve, resolve-with-related, dangling-edge safety |
| `knowledge-platform-core.test.ts` | 16 | End-to-end `DefaultKnowledgePlatform` with a fake test provider — every public method |
| `knowledge-platform-legal-provider.test.ts` | 21 | Full `IKnowledgeProvider` contract + citation graph + amendment chain (incl. cycle safety) |
| `knowledge-platform-procurement-provider.test.ts` | 14 | Full contract + template linkage + dependency chain, proving relation-type independence |
| `knowledge-platform-providers-integration.test.ts` | 7 | Both real providers registered with `DefaultKnowledgePlatform` simultaneously — search isolation, `resolveContext`, `buildAIContext`, duplicate-domain rejection, cross-provider graph independence |

**Stage 1 + 2 total: 155 tests across 13 files.**
Full repository suite after Stage 2: **377 test files, 13,540 tests, zero regressions.**

### Batch 1 (4 new providers)

| File | Tests | Covers |
|---|---|---|
| `knowledge-platform-template-provider.test.ts` | 10 | Full contract + prerequisite chain + generated-document graph, independence between the two |
| `knowledge-platform-checklist-provider.test.ts` | 8 | Full contract + phase-gate ordering + `getRequiredBy` (incoming `USES_CHECKLIST`) |
| `knowledge-platform-ontology-provider.test.ts` | 10 | Full contract + synonym linkage + broader/narrower hierarchy via the new `BROADER_THAN` type |
| `knowledge-platform-glossary-provider.test.ts` | 8 | Full contract + abbreviation linkage + term translation via two new relation types |
| `knowledge-platform-batch1-integration.test.ts` | 5 | All 6 providers built so far registered on one platform simultaneously — cross-domain search, `resolveContext`, named convenience methods, duplicate-domain rejection, graph independence across 3 providers sharing the same `DEPENDS_ON` string for different meanings |

**Batch 1 total: 40 tests across 5 files. Running total: 195 tests across 18 files** (verified via
`vitest run`, not computed by hand).
Full repository suite after Batch 1: **382 test files, 13,580 tests, zero regressions.**

### Batch 2 (4 new providers)

| File | Tests | Covers |
|---|---|---|
| `knowledge-platform-vendor-provider.test.ts` | 14 | Full contract + required-certification links (`REQUIRES`) + blacklist reasoning via the new `BLACKLISTED_FOR` type, independence between the two |
| `knowledge-platform-asset-provider.test.ts` | 13 | Full contract + lifecycle-stage ordering (`DEPENDS_ON`) + depreciation rule linkage (`REFERENCES`), independence between the two |
| `knowledge-platform-budget-provider.test.ts` | 12 | Full contract + budget-code hierarchy via the new `ROLLS_UP_TO` type + fund-source rule linkage (`REFERENCES`), independence between the two |
| `knowledge-platform-notification-provider.test.ts` | 12 | Full contract + escalation chains via the new `ESCALATES_TO` type + message-template linkage (`USES_TEMPLATE`), independence between the two |
| `knowledge-platform-batch2-integration.test.ts` | 6 | All 10 providers built so far registered on one platform simultaneously — cross-domain search, `resolveContext`, named convenience methods (`resolveVendorKnowledge`/`resolveAssetKnowledge`/`resolveBudgetKnowledge`), duplicate-domain rejection, graph independence across `BLACKLISTED_FOR`/`ROLLS_UP_TO`/`ESCALATES_TO`, `buildAIContext` unaffected by the 4 new domains |

**Batch 2 total: 59 tests across 5 files. Running total: 254 tests across 23 files** (verified via
`vitest run`, not computed by hand).
Full repository suite after Batch 2: **387 test files, 13,639 tests, zero regressions.**

### Batch 3 (4 new providers)

| File | Tests | Covers |
|---|---|---|
| `knowledge-platform-school-provider.test.ts` | 11 | Full contract + governing legal basis linkage (`REFERENCES`) + internal restriction via the new `RESTRICTS` type, independence between the two |
| `knowledge-platform-case-provider.test.ts` | 10 | Full contract + similar-case linkage (`SIMILAR_TO`) + revealed-risk linkage via the new `REVEALED` type, independence between the two |
| `knowledge-platform-risk-provider.test.ts` | 10 | Full contract + mitigating-control linkage via the new `MITIGATED_BY` type + related-audit-finding linkage (`REFERENCES`), independence between the two |
| `knowledge-platform-audit-provider.test.ts` | 10 | Full contract + corrective-action linkage via the new `REMEDIATED_BY` type + affected-risk-pattern linkage (`RELATED_TO`), independence between the two |
| `knowledge-platform-batch3-integration.test.ts` | 6 | All 14 providers built so far registered on one platform simultaneously — cross-domain search, `resolveContext`, named convenience methods (`resolveSchoolPolicy`/`resolveCases`/`resolveRisk`/`resolveAuditFinding`), duplicate-domain rejection, graph independence across `RESTRICTS`/`REVEALED`/`MITIGATED_BY`/`REMEDIATED_BY`, `buildAIContext` now returning real risk/case data |

**Batch 3 total: 51 tests across 5 files. Running total: 305 tests across 28 files** (verified via
`vitest run`, not computed by hand).
Full repository suite after Batch 3: **392 test files, 13,690 tests, zero regressions.**

### Batch 4 — final 2 providers (Phase N complete)

| File | Tests | Covers |
|---|---|---|
| `knowledge-platform-bestpractice-provider.test.ts` | 11 | Full contract + pattern-implementation linkage (`IMPLEMENTS`, its first real usage) + case-derivation linkage via the new `DERIVED_FROM` type, independence between the two |
| `knowledge-platform-aifeedback-provider.test.ts` | 11 | Full contract + a structural check that no reasoning/LLM method exists on the class + correction linkage via the new `CORRECTS` type + related-best-practice linkage (`RELATED_TO`, reused a third time), independence between the two |
| `knowledge-platform-phase-n-complete-integration.test.ts` | 9 | All 16 providers registered on one platform simultaneously — cross-domain search, `resolveContext`, `resolveBestPractice`, `AIFeedbackProvider` reachability without a named convenience method, duplicate-domain rejection, graph independence across `IMPLEMENTS`/`DERIVED_FROM`/`CORRECTS`/`RELATED_TO`, and confirmation that `buildAIContext()`'s fixed six-field shape is unchanged (deliberately excludes `ai_feedback`) |

**Batch 4 total: 31 tests across 3 files. Phase N running total: 336 tests across 31 provider/
integration test files** (verified via `vitest run`, not computed by hand).
Full repository suite after Batch 4: **395 test files, 13,721 tests, zero regressions.**

**Phase N is FROZEN.** All 16 providers, the platform core, and every extension point are frozen.
Any future change to `src/knowledge/` is either (a) a new file adding a capability documented as
out of scope above (Prisma repositories, `knowledgeIntegration.ts`), or (b) Phase X consuming
`IKnowledgePlatform` — never a modification to anything listed as frozen in this document.
