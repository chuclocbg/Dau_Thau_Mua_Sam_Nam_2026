# Phase X.3 (Knowledge Resolution) — Readiness Review

**Purpose:** Evaluate whether Phase X.3 — wiring the already-proven X.2 reasoning pipeline to the
real, frozen Knowledge Platform, replacing `mockKnowledgeFixtures.ts` with a real
`knowledgeResolver.ts` — is ready to begin. Produced before any X.3 code is written, per
`PHASE_X_EXECUTION_PLAN.md`'s own X.3 section and this project's readiness-review discipline
(mirrors `PHASE_X_READINESS_REVIEW.md` before X.1 and the architecture gate review before Batch B).

**Status:** Review only. No X.3 code exists. Does not modify architecture, does not create an
ADR, does not ratify anything.

**Roadmap context:** Conversation Core, Reasoning Core, AI Context, Prompt Builder, Prompt
Renderer, LLM Adapter, and Output Validation are all frozen. Knowledge Resolution is next in
sequence — this review is the gate before it.

---

## 1. Repository Readiness

The repository is structurally ready but **content-empty** in one specific way worth stating
precisely. `src/knowledge/providers/legal/legalProvider.ts` (and, by inspection, the sibling
providers) contain zero hardcoded/seeded `KnowledgeItem` data — they are pure delegation classes
(search/resolve/suggest/score → repositories). This is not a defect: Knowledge Base population was
explicitly classified as an intentionally deferred, non-blocking future deliverable during the
Documentation Completion Sprint governance decision earlier in this project. It does mean X.3's
own exit criterion ("a real question resolves correctly against the actual (memory-backed)
Knowledge Platform") must be read as: **the real frozen code path — repositories, router,
resolver, provider contract — exercised against test-seeded `KnowledgeItem` fixtures**, not
against a populated corpus of actual Vietnamese procurement law. That population is separately
and intentionally out of scope here, same as it was for every prior milestone.

Full suite baseline at time of this review: 423 test files, 13,913 tests, 0 failures (tag
`phase-x.4-output-validation`).

## 2. Dependency Graph

Per `DEPENDENCY_RULES.md`'s "Future" rules, already stated before any of this was built:
- `src/reasoning/` may import `src/knowledge/` **only via `knowledgeResolver.ts`**.
- `src/ai/` may import `src/reasoning/` (`ReasoningResult`) but never `src/knowledge/` directly.
- Nothing outside `src/ai/` imports `src/reasoning/` or `src/knowledge/` directly.

X.3's addition is a single new edge: `src/reasoning/application/knowledgeResolver.ts` →
`src/knowledge/platform/knowledgePlatform.ts` (the `IKnowledgePlatform` interface only). Every
other file in `src/reasoning/` — `legalReasoningEngine.ts`, `ruleEngine.ts`, `evidenceCollector.ts`,
`citationFormatter.ts`, `answerComposer.ts` — continues to depend only on `ResolvedKnowledge`
(the plain data shape), never on the platform itself. This is already true today (Batch A's own
architecture guard proves zero `src/knowledge/` imports outside `testing/mockKnowledgeFixtures.ts`,
which X.3 retires). The graph does not change shape — one file's *source* of `ResolvedKnowledge`
changes from a static fixture to a live platform call.

## 3. Interfaces Required

`IKnowledgePlatform` (frozen, `src/knowledge/platform/knowledgePlatform.ts`) already has every
method the design corpus needs, confirmed by direct inspection — this is better than the original
design assumed:

- `searchKnowledge(text, domains?, context?, limit?)` — per **ADR-DRAFT-X01**, used wherever
  free-text, ranked, limited retrieval is needed (`resolveCases`/`resolveBestPractice`'s original
  aspirational signatures).
- `resolveLegalBasis`, `resolveSchoolPolicy`, `resolveChecklist`, `resolveCases`,
  `resolveBestPractice`, `resolveRisk`, `resolveContext(context, asOfDate)` (all-domains-at-once) —
  already match `(context, asOfDate)`, exactly what `pipeline.md`'s Stage 2 design already expected
  for the rule-based-applicability call sites.
- `buildAIContext(context, asOfDate)` — a convenience method bundling
  legalBasis+templates+checklists+bestPractices+risks+cases in one call. Not mentioned in any
  prior Phase X document; worth `knowledgeResolver.ts` considering for the "ALL intents — always
  resolve" baseline case instead of two separate calls.

**Three real shape mismatches found this review, none blocking, all requiring a small mapping
function inside `knowledgeResolver.ts` (never a platform change):**

1. **`KnowledgeItem.legalBasis` uses `LegalBasis.document`**, not `documentSymbol`
   (`src/shared/financial/financialFactory.ts`). Batch A's `LegalBasisRef.documentSymbol` needs a
   field-rename mapping, dropping `LegalBasis`'s extra optional fields
   (`documentNumber`/`appendix`/`effectiveDate`/`issuingAuthority`/`summary`/`url`) that Batch A's
   type doesn't carry.
2. **`KnowledgeItem.effectivePeriod` is optional**; Batch A's `KnowledgeItemRef.effectiveFrom` is
   required. `knowledgeResolver.ts` needs an explicit fallback decision for items with no
   `effectivePeriod` set (candidates: `item.createdAt`, `item.updatedAt`, or treat as always-
   effective from the epoch) — not designed yet, needs a decision during implementation.
3. **`KnowledgeItem.metadata` is `Record<string, string>`** (flat strings only) — but Batch A's
   `RuleKnowledgeItemRef.rule`/`ThresholdKnowledgeItemRef.threshold` expect fully-typed nested
   objects (`EvaluationRuleMetadata` with a `RuleCondition[]` array, `ThresholdMetadata`). This is
   the largest open design question: does the real corpus store a JSON-encoded string in one
   metadata field (`metadata['ruleDefinition']`, parsed with `JSON.parse` inside the resolver), or
   reconstruct the structured shape from several flat fields? Neither approach exists in any
   document yet — this is real design work for X.3 itself, not something this review can resolve
   in advance, and not something that should be improvised silently once implementation starts.

## 4. Frozen Modules

Untouched by X.3, verified by the same discipline used in every prior milestone:
`IKnowledgePlatform` and all 16 providers (Phase N) — **read-only consumption via
`searchKnowledge()`/`resolveX()` only, zero modification, zero new methods** (Constraint C-06,
the single highest-stakes boundary in the entire Phase X plan). `src/conversation/` (X.1),
`src/ai/{domain,application,infrastructure,validation}/` (X.2 Batch A/B, X.4) — none of these
need to change for X.3; `ResolvedKnowledge`'s *shape* is already fixed and consumed identically
whether it comes from a fixture or a live resolver.

## 5. Expected File Tree

Per `PHASE_X_EXECUTION_PLAN.md`'s X.3 section, unchanged by this review:

```
src/reasoning/application/knowledgeResolver.ts
src/reasoning/integration/reasoningIntegration.ts   (conditional — see §7)
```

`src/reasoning/testing/mockKnowledgeFixtures.ts` (Batch A) is retired once `knowledgeResolver.ts`
proves out — not deleted defensively, only after the replacement is proven equivalent.

## 6. Repository Impact

Additive only. One new file consuming a frozen interface; one retired test-only file. No
migration, no schema change (Knowledge Platform repositories remain memory-backed — the same
`buildMemoryKnowledgeRepositories()` pattern every Phase N integration test already uses; Prisma-
backed Knowledge Platform repositories do not exist and are not needed here).

## 7. Integration Points

- **`legalReasoningEngine.reason(question, resolvedKnowledge)`** — the exact seam Batch A was
  deliberately designed around (per `PHASE_X2_IMPLEMENTATION_STRATEGY.md` §3: "`legalReasoningEngine.ts`
  should depend on an evidence-shaped input, not directly on the fixture file's internals, so X.3
  can substitute a real resolver behind the same shape"). X.3 changes nothing on this side — it
  only changes what produces the `ResolvedKnowledge` passed in.
- **`src/reasoning/integration/reasoningIntegration.ts`** — the execution plan lists this as "the
  one bridge file allowed to import `src/legal/`, `src/procurement/`, etc. if any
  non-Knowledge-Platform context is needed." Given Batch A's `ReasoningContext` is already fully
  self-contained (`packageType`, `fundSource`, `estimatedValue`, etc. — no business-module data
  needed), this file is likely **not needed** for X.3's actual scope. Recommend deferring it
  until a concrete gap is found, rather than creating it speculatively.

## 8. Required Tests

Per the execution plan, unchanged: an integration test against a real (memory-backed)
`IKnowledgePlatform` instance — the exact `buildMemoryKnowledgeRepositories()` +
`DefaultKnowledgePlatform` + `registerProvider()` pattern already proven in
`knowledge-platform-phase-n-complete-integration.test.ts`. A regression test proving
`searchKnowledge()` is called with the correct domain filter (`['cases']` / `['bestpractice']`)
and limit for every intent type needing ranked retrieval (ADR-DRAFT-X01's stated consequence). An
architecture test enforcing "only `knowledgeResolver.ts` imports `src/knowledge/`" — a direct
extension of Batch A's existing `reasoning-architecture.test.ts` guard, not a new pattern.

## 9. Rollback Strategy

Unchanged from the established pattern: `knowledgeResolver.ts` is purely additive. If it proves
wrong, revert to the `phase-x.4-output-validation` tag — `mockKnowledgeFixtures.ts` is not
deleted until the replacement is proven, so there is no intermediate broken state possible.

## 10. Commit Strategy

Per the execution plan: one commit for `knowledgeResolver.ts` + its tests, one commit for the
architecture-enforcement test, one commit removing the retired mock fixtures (only after the
resolver is proven equivalent) — three commits, matching the discipline already used for every
prior milestone (one component per commit, full suite green before each).

## 11. Freeze Checkpoint

Per the execution plan: declared once `KnowledgeResolver` is the sole caller of
`IKnowledgePlatform` (structurally enforced, not just conventionally true) and the full
repository suite passes with zero regressions against this review's 423-file/13,913-test baseline.

## 12. Technical Risks

- **The three shape mismatches in §3** — none individually hard, but all three must be resolved
  coherently in one mapping layer, not improvised ad hoc across the resolver's call sites.
- **`ADR-DRAFT-X01` non-ratification** — see §15/verdict. The single blocking risk.
- **Metadata-parsing fragility (§3 point 3)** — whatever encoding scheme is chosen for
  `EvaluationRuleMetadata`/`ThresholdMetadata` inside `KnowledgeItem.metadata`, a malformed or
  missing field must fail safely (produce a `MissingEvidence`/`INCONCLUSIVE` result, per Batch A's
  existing "never fabricate" discipline), not throw or silently default to a wrong value.

## 13. Performance Risks

Low. Per `app/knowledge/reasoning/rules.md`: "rule sets are typically small (< 50 rules for a
given context)... fast even without caching" — and per the accepted design, `KnowledgeResolver`
performs no caching of its own (that's explicitly X.7's job, `knowledgeResolverCache.ts`, "sits
behind KnowledgeResolver, never beside it"). No performance work belongs in X.3 itself.

## 14. Knowledge Platform Integration Risks

The highest-stakes boundary in the whole Phase X plan (per `ARCHITECTURE_CONSTRAINTS.md` C-06):
accidental modification of `IKnowledgePlatform` or any of the 16 providers. Mitigated the same way
Batch A mitigated the equivalent risk for Batch B: an architecture guard test enforcing the
sole-caller rule, added in the same commit as `knowledgeResolver.ts` itself, not as an afterthought.
Given the frozen interface already covers every documented need (per §3), the actual risk surface
is narrow — the mapping functions, not the platform calls themselves.

## 15. Exit Criteria

Unchanged from `PHASE_X_EXECUTION_PLAN.md`: **(a)** ADR-DRAFT-X01 formally ratified into
`app/.memory/decision-index.md` — a prerequisite, not a deliverable, of this milestone. **(b)** A
real question resolves correctly against the actual (memory-backed) Knowledge Platform. **(c)**
The architecture test asserting "only `knowledgeResolver.ts` imports `src/knowledge/`" passes.

---

## Explicitly Identified

**Smallest coding task:** a single mapping function, `toKnowledgeItemRef(item: KnowledgeItem):
KnowledgeItemRef`, covering the `document`→`documentSymbol` rename and the `effectivePeriod`
fallback decision from §3 (points 1–2). Deliberately smaller than `knowledgeResolver.ts` itself —
it has no dependency on ADR-X01 (it's pure data mapping, not a platform-call strategy decision) and
can be written and unit-tested in isolation before the resolver's call-site logic is touched.

**First repository interface touched:** `IKnowledgePlatform.resolveLegalBasis(context, asOfDate)`
— the simplest, most direct rule-based call (no ADR-X01 text-query decision involved), and the
"ALL intents — always resolve" baseline per `pipeline.md`'s Stage 2 design.

**First integration test:** construct a memory-backed `IKnowledgePlatform` via
`buildMemoryKnowledgeRepositories()` + `new DefaultKnowledgePlatform(repos)` +
`registerProvider(new LegalProvider(repos, graph))` (the exact pattern already proven in
`knowledge-platform-phase-n-complete-integration.test.ts`), seed one `KnowledgeItem` via the
repository's `create()`, then assert `knowledgeResolver`'s output contains it correctly mapped —
proving the wiring before any reasoning-pipeline logic is involved.

**First end-to-end test:** the same seeded single-item platform, run through
`legalReasoningEngine.reason(question, resolvedKnowledge)` end-to-end, asserting the resulting
`ReasoningResult.citations`/`appliedArticles` trace back to the real (not fixture) `KnowledgeItem`
— the moment X.3 actually proves what Batch A could only simulate.

---

## Verdict

## NO-GO

**Exact blocker:** ADR-DRAFT-X01 (the `resolveCases`/`resolveBestPractice` retrieval-strategy
decision) is **not ratified** into `app/.memory/decision-index.md`. Verified directly this
review: `grep` for "X01"/"knowledge resolv" against `decision-index.md` found nothing; the ADR
index runs ADR-001 through ADR-021 with no entry for it; `NEXT_APPROVED_PHASE.md` explicitly lists
"Ratifying the ADR drafts into `app/.memory/`" under `NOT_approved`, stating it "requires explicit
human action" — a deliberate governance gate, not a mechanical step this review (or any
implementation session) should perform on its own. This is the same blocker `CURRENT_MILESTONE.md`
has named since Batch B froze; it has not been resolved in the interim.

This is a **single, narrow, already-identified blocker** — everything else in this review (§1–14)
came back clean or came back as small, well-scoped, non-blocking design work (§3's three mapping
gaps). Once ADR-DRAFT-X01 is ratified, the safest first coding task is exactly the one named
above: `toKnowledgeItemRef()`, a pure mapping function with no platform call and no dependency on
the ADR's own text-query-strategy decision, tested in isolation before `knowledgeResolver.ts`'s
call-site logic — the same "safest first task" discipline used to open every prior milestone in
this project (`conversationTypes.ts` for X.1, `reasoningTypes.ts` for X.2 Batch A).
