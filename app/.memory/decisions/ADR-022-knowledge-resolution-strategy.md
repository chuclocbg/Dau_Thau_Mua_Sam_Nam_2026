# ADR-022: Knowledge Retrieval Strategy for Phase X.3 (Knowledge Resolution)

**Status:** ACTIVE
**Date:** 2026-07-05
**Affects:** src/reasoning/application/knowledgeResolver.ts (Phase X.3, not yet built)

**Ratified from:** `PROJECT_KNOWLEDGE_SYSTEM/01_PROJECT_DOCS/ADR-X01_FINAL.md` (the final-draft
record, retained there for history). Supersedes
`PROJECT_KNOWLEDGE_SYSTEM/01_PROJECT_DOCS/PHASE_X_ADR_DRAFT_001.md` (marked SUPERSEDED, retained
for history) — this decision's core (§Decision 1 below) is unchanged from that draft; this
ratified version closes three integration-shape gaps the draft left open.

---

## Context

Phase X.2 Batch A built a complete, frozen, deterministic reasoning pipeline
(`legalReasoningEngine.ts` and its stages) that consumes a `ResolvedKnowledge` value —
originally supplied by hand-built fixtures (`mockKnowledgeFixtures.ts`), by design, so the
pipeline logic could be proven before ever touching the real, frozen Knowledge Platform. Phase
X.3's job is to build `knowledgeResolver.ts`: the one file authorized to call
`IKnowledgePlatform` (this repo's Constraint C-06) and produce a real `ResolvedKnowledge` from it.

The pre-existing design corpus (`app/knowledge/reasoning/pipeline.md`) was written before the
frozen `IKnowledgePlatform` (Phase N) existed in its final form, and assumed method signatures
that turned out not to match. The original draft found and resolved one such mismatch. This
ratified version was produced by re-verifying that resolution directly against the actual frozen
code and by checking three further integration questions the original draft did not address.

## Problem Statement

Four distinct integration gaps exist between the pre-existing reasoning design and the real,
frozen `IKnowledgePlatform`/`KnowledgeItem` shapes:

1. **The original problem (resolved by the draft, reconfirmed here).** `pipeline.md` assumes
   `platform.resolveCases(intent.question, context, 3)` and
   `platform.resolveBestPractice(intent.question, context)` — a free-text question plus a result
   limit. The frozen interface's actual `resolveCases(context, asOfDate)` /
   `resolveBestPractice(context, asOfDate)` take no text query and no limit — pure rule-based
   applicability resolution. Separately, `searchKnowledge(text, domains?, context?, limit?)`
   already exists and matches the assumed shape exactly.

2. **A gap the original draft did not surface: `searchKnowledge()` does not apply temporal
   filtering.** Direct inspection: `BaseKnowledgeProvider.search()` (which every provider's
   `searchKnowledge()` call ultimately reaches) calls `this.repos.items.findActive(this.domain)`
   — filtering only on the `isActive` flag — and never calls `isEffectiveOn(item, asOfDate)`.
   `BaseKnowledgeProvider.suggest()`/`score()` on the *same class* correctly route through
   `retriever.resolveApplicableDocuments(domain, asOfDate, context)` (which *does* apply
   `isEffectiveOn`). Substituting `searchKnowledge()` for `resolveCases`/`resolveBestPractice`
   silently drops temporal correctness the rule-based path actually has.

3. **`KnowledgeItem`'s field shapes do not match `ResolvedKnowledge`'s `KnowledgeItemRef` family
   (Phase X.2 Batch A, frozen) one-to-one.** Three concrete mismatches:
   - `KnowledgeItem.legalBasis` uses `LegalBasis.document` (`src/shared/financial/financialFactory.ts`),
     not `documentSymbol` — needs a renamed mapping; `LegalBasis`'s other optional fields have no
     destination in `LegalBasisRef`.
   - `KnowledgeItem.effectivePeriod` is optional; `KnowledgeItemRef.effectiveFrom` is required —
     no prior document says what to do when unset.
   - `KnowledgeItem.metadata` is `Record<string, string>` (flat strings only); Batch A's
     `RuleKnowledgeItemRef.rule`/`ThresholdKnowledgeItemRef.threshold` expect fully-typed nested
     objects — no prior document says how these are encoded inside a flat string-keyed bag.

None of these four gaps requires changing the frozen `IKnowledgePlatform`.

## Decision

1. **(Unchanged from the draft, reconfirmed.)** `KnowledgeResolver` calls
   `platform.searchKnowledge(intent.question, [domain], context, limit)` wherever free-text
   ranked retrieval with a limit is needed (`cases`/`bestpractice` domains specifically), and
   continues calling `platform.resolveX(context, asOfDate)` wherever the need is pure rule-based
   applicability with no text query. **Zero changes to `IKnowledgePlatform` are required or
   authorized.**

2. **(Closes gap 2.)** Because `searchKnowledge()` does not apply `isEffectiveOn` filtering,
   `KnowledgeResolver` treats every `searchKnowledge()`-sourced item as **illustrative, never
   load-bearing**: mapped into `ResolvedKnowledge.caseItems` ("similar historical cases" — a
   deliberate word choice covering content that may predate `asOfDate`) and **never eligible for
   `AppliedRole = 'PRIMARY_BASIS'`** in `legalReasoningEngine.ts`'s output — only ever
   `SUPPORTING_BASIS`. A policy decision inside `KnowledgeResolver`/the reasoning pipeline, not a
   platform change.

3. **(Closes gap 3, field 1.)** `KnowledgeResolver` maps `LegalBasis.document` →
   `LegalBasisRef.documentSymbol` via a pure rename; `LegalBasis`'s other optional fields are
   dropped (additive to add later if a need appears).

4. **(Closes gap 3, field 2.)** When `KnowledgeItem.effectivePeriod` is `undefined`,
   `KnowledgeResolver` falls back to `item.createdAt.slice(0, 10)` as `effectiveFrom` — a real,
   already-recorded fact, never a fabricated date — and attaches a `LOW`-severity warning naming
   the affected item.

5. **(Closes gap 3, field 3.)** Structured rule/threshold definitions are stored as a single
   JSON-encoded string per shape: `metadata['ruleDefinition']` /
   `metadata['thresholdDefinition']`, parsed via `JSON.parse` inside a `try/catch`. A parse
   failure or missing key produces a critical `MissingEvidence` entry and excludes the item —
   never throws, never silently defaults.

## Alternatives Considered

**For decision 1:** Adding new platform methods (rejected — `searchKnowledge()` already covers
the need; a redundant method violates the single-owner principle); modifying the frozen
`resolveCases`/`resolveBestPractice` signatures in place (rejected — breaks the freeze guarantee,
invalidates four existing integration test suites); deferring the mismatch to implementation time
(rejected — propagates a known defect instead of resolving it at the design layer).

**For decision 2:** Adding temporal filtering to `BaseKnowledgeProvider.search()` itself
(rejected for this ADR — would modify the frozen platform to fix a Reasoning-layer concern; left
as a possible future ADR *against the platform*, not authorized here); rejecting any
non-currently-effective `searchKnowledge()` result outright (rejected — contradicts "similar
historical cases"'s own documented purpose); ignoring the gap (rejected — the same
deferred-defect mistake decision 1 already rejected once).

**For decisions 3–5:** Leaving the shape reconciliation to whoever implements
`knowledgeResolver.ts`, ad hoc (rejected — same deferred-defect pattern); flattening the
metadata encoding into many separate string keys instead of one JSON blob per shape (rejected —
harder to validate atomically than one whole-object parse); a fixed epoch sentinel instead of
`createdAt` for the effective-date fallback (rejected — indistinguishable from a fabricated date).

## Trade-offs

Decision 2 trades search-ranking awareness of currency for platform immutability — acceptable
since "similar historical cases" is the field's actual purpose. Decision 5's single-JSON-blob
approach trades partial-field editability for atomic validity — acceptable given rule/threshold
sets are small and edited as whole units. Decision 4's `createdAt` fallback trades precision (the
item's true legal effective date is unknown) for honesty (no invented date); the accompanying
warning keeps this visible rather than silent.

## Consequences

- `KnowledgeResolver`'s test suite must prove `searchKnowledge()` is called with the correct
  domain filter and limit for every intent type needing ranked text retrieval.
- A new test must prove `searchKnowledge()`-sourced items never reach `AppliedRole =
  'PRIMARY_BASIS'`.
- A new test must prove the `effectiveFrom`-fallback warning fires for any item lacking
  `effectivePeriod`.
- A new test must prove a malformed rule/threshold definition produces a critical
  `MissingEvidence` entry, never a thrown exception.
- `KnowledgeResult[]`'s shape (`{ item, relevance, matchedDomain }`) must be mapped into
  `ResolvedKnowledge`'s shape via a small, additive mapping function inside the Reasoning layer.

## Compatibility with Existing Architecture

Fully compatible, verified by direct inspection: Constraint C-06 (only `KnowledgeResolver` may
call `IKnowledgePlatform`) is unaffected — every decision here lives inside the resolver's own
mapping logic. `DEPENDENCY_RULES.md`'s "`src/reasoning/` may import `src/knowledge/` ONLY via
`knowledgeResolver.ts`" is unaffected. `AppliedRole` (Phase X.2 Batch A, frozen) already has
`SUPPORTING_BASIS` — decision 2 needs no new type. `AIContext`'s schema is unaffected — none of
these decisions change any `AIContext` field.

## Migration Strategy

`mockKnowledgeFixtures.ts` (Phase X.2 Batch A) is retired only after `knowledgeResolver.ts` is
proven equivalent — the same fixture-driven scenarios that passed against
`mockKnowledgeFixtures.ts` must also pass when equivalent `KnowledgeItem` records are seeded into
a real, memory-backed `IKnowledgePlatform` and resolved through `knowledgeResolver.ts`. Deleting
the mock fixtures is its own final commit, never bundled with the resolver's introduction.

## Risks

Metadata-encoding fragility (a malformed corpus-side `ruleDefinition`/`thresholdDefinition`
string silently drops that rule from resolution, mitigated by the critical `MissingEvidence`
handling but not eliminated). Decision 2's role-restriction is enforced by application-code
discipline, not the type system — mitigated by a dedicated test added in the same commit as the
resolver. The `createdAt` fallback (decision 4) can be materially wrong for an item whose true
effective date long predates its record-creation date — mitigated by visibility (the warning),
not prevented.

## Future Evolution

A future ADR *against the Knowledge Platform itself* could add temporal filtering directly to
`BaseKnowledgeProvider.search()`, closing gap 2 at the source — not proposed or authorized here.
X.7's `knowledgeResolverCache.ts` sits behind `KnowledgeResolver`; none of these decisions
anticipate caching. If corpus population later adopts a schema-validated format for rule/
threshold definitions, decision 5's `JSON.parse`-based decoding can be swapped for a validated
parser without changing `KnowledgeResolver`'s external behavior.

## Explicit Acceptance Criteria

1. `knowledgeResolver.ts` exists and is the only file (outside test files) importing anything
   under `src/knowledge/`, verified by an architecture guard test.
2. A real `KnowledgeItem`, seeded into a memory-backed `IKnowledgePlatform`, resolves correctly
   end-to-end through `legalReasoningEngine.reason()`, producing citations traceable to that real
   item.
3. `searchKnowledge()`-sourced items never appear with `AppliedRole = 'PRIMARY_BASIS'` in any
   `ReasoningResult`.
4. A malformed rule/threshold definition produces a critical `MissingEvidence` entry, never a
   thrown exception.
5. An item with no `effectivePeriod` produces a `LOW`-severity warning and resolves using
   `createdAt` as `effectiveFrom`.
6. Full repository suite passes with zero regressions against the pre-X.3 baseline (423 files,
   13,913 tests, tag `phase-x.4-output-validation`).

## Ratification

Ratified 2026-07-05. Full context, alternatives analysis, and the readiness review that surfaced
gaps 2–3 are preserved in
`PROJECT_KNOWLEDGE_SYSTEM/01_PROJECT_DOCS/{ADR-X01_FINAL.md,PHASE_X3_READINESS_REVIEW.md}`.
Ratification is a governance action only — it does not itself authorize starting Phase X.3
implementation, which remains a separate, explicit approval.
