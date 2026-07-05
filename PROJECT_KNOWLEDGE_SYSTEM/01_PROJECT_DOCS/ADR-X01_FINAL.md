# ADR-X01 (FINAL): Knowledge Retrieval Strategy for Phase X.3 (Knowledge Resolution)

**Status:** **RATIFIED**, 2026-07-05, as **ADR-022** in `app/.memory/decision-index.md`. Full
ratified text: [`../../app/.memory/decisions/ADR-022-knowledge-resolution-strategy.md`](../../app/.memory/decisions/ADR-022-knowledge-resolution-strategy.md).
This file is retained here as the original FINAL-draft record per `03_KNOWLEDGE_BASE/adr/README.md`'s
convention; the copy in `app/.memory/decisions/` is the canonical ratified text going forward.
Ratification is a governance/documentation action only — it does not itself authorize starting
Phase X.3 implementation, which remains a separate, explicit approval per this project's
approval-gated milestone discipline.

**Supersedes:** `PHASE_X_ADR_DRAFT_001.md` ("Phase X ADR Draft 001 — Knowledge Retrieval Strategy
for Text-Query Needs"). The original decision is preserved and ratified here, not reversed — but
this FINAL version closes three gaps the draft left open, found during the Phase X.3 readiness
review and a fresh, direct inspection of the frozen `IKnowledgePlatform` implementation performed
for this document.

**Audience:** Whoever implements `knowledgeResolver.ts` (Phase X.3).

**Dependencies:** `AI_ADVISORY_ARCHITECTURE.md`, `PHASE_X_EXECUTION_PLAN.md`,
`PHASE_X3_READINESS_REVIEW.md`, `ARCHITECTURE_CONSTRAINTS.md` (C-06), `DEPENDENCY_RULES.md`.

---

## 1. Context

Phase X.2 Batch A built a complete, frozen, deterministic reasoning pipeline
(`legalReasoningEngine.ts` and its stages) that consumes a `ResolvedKnowledge` value —
originally supplied by hand-built fixtures (`mockKnowledgeFixtures.ts`), by design, so the
pipeline logic could be proven before ever touching the real, frozen Knowledge Platform. Phase
X.3's job is to build `knowledgeResolver.ts`: the one file authorized to call
`IKnowledgePlatform` (Constraint C-06) and produce a real `ResolvedKnowledge` from it.

The pre-existing design corpus (`app/knowledge/reasoning/pipeline.md`) was written before the
frozen `IKnowledgePlatform` (Phase N) existed in its final form, and assumed method signatures
that turned out not to match. The original ADR-DRAFT-X01 found and resolved one such mismatch.
This FINAL version was produced by re-verifying that resolution directly against the actual
frozen code (not re-asserting it from memory) and by checking three further integration
questions the original draft did not address, surfaced during the Phase X.3 readiness review.

## 2. Problem Statement

Four distinct integration gaps exist between the pre-existing reasoning design and the real,
frozen `IKnowledgePlatform`/`KnowledgeItem` shapes:

**2.1 — The original problem (resolved by the draft, reconfirmed here).** `pipeline.md` assumes
`platform.resolveCases(intent.question, context, 3)` and
`platform.resolveBestPractice(intent.question, context)` — a free-text question plus a result
limit. The frozen interface's actual `resolveCases(context, asOfDate)` /
`resolveBestPractice(context, asOfDate)` take no text query and no limit — they are pure
rule-based applicability resolution. Separately, `searchKnowledge(text, domains?, context?,
limit?)` already exists and matches the assumed shape exactly.

**2.2 — A gap the original draft did not surface: `searchKnowledge()` does not apply temporal
filtering.** Direct inspection this session: `BaseKnowledgeProvider.search()` (which every
provider's `searchKnowledge()` call ultimately reaches) calls
`this.repos.items.findActive(this.domain)` — filtering only on the `isActive` flag — and never
calls `isEffectiveOn(item, asOfDate)`. Compare `BaseKnowledgeProvider.suggest()`/`score()` on the
*same class*, which correctly route through
`retriever.resolveApplicableDocuments(domain, asOfDate, context)` (which *does* apply
`isEffectiveOn`). This means: substituting `searchKnowledge()` for the original
`resolveCases`/`resolveBestPractice` design, as the draft ADR already decided, silently drops
temporal correctness that the rule-based retrieval path actually has. An expired or
not-yet-effective case or best-practice item can be returned by `searchKnowledge()`, ranked
purely by text relevance, with nothing to catch it.

**2.3 — `KnowledgeItem`'s field shapes do not match `ResolvedKnowledge`'s `KnowledgeItemRef`
family (Batch A, frozen) one-to-one.** Three concrete mismatches, found during the readiness
review:
- `KnowledgeItem.legalBasis` is `readonly LegalBasis[]` (`src/shared/financial/financialFactory.ts`),
  whose document-symbol field is named `document`, not `documentSymbol` — Batch A's
  `LegalBasisRef.documentSymbol` needs a renamed mapping, and `LegalBasis`'s other optional
  fields (`documentNumber`, `appendix`, `effectiveDate`, `issuingAuthority`, `summary`, `url`)
  have no destination in `LegalBasisRef` at all.
- `KnowledgeItem.effectivePeriod` is *optional* (`readonly effectivePeriod?: EffectivePeriod`);
  Batch A's `KnowledgeItemRef.effectiveFrom` is *required*. Nothing in any prior document says
  what to do when a real item has no `effectivePeriod` set.
- `KnowledgeItem.metadata` is `Readonly<Record<string, string>>` — flat strings only. Batch A's
  `RuleKnowledgeItemRef.rule: EvaluationRuleMetadata` and
  `ThresholdKnowledgeItemRef.threshold: ThresholdMetadata` are fully-typed nested objects
  (`EvaluationRuleMetadata.conditions: RuleCondition[]`, etc.). Nothing in any prior document
  says how a structured rule/threshold definition is supposed to be encoded inside a flat
  string-keyed bag.

None of these four gaps requires changing the frozen `IKnowledgePlatform`. All four require an
explicit decision made now, at the design layer — the same standard the original ADR already
held itself to (see §4, Alternative C, both original and newly added instances below).

## 3. Decision

**3.1 (unchanged from the draft, reconfirmed).** `KnowledgeResolver` calls
`platform.searchKnowledge(intent.question, [domain], context, limit)` wherever free-text ranked
retrieval with a limit is needed (the `cases`/`bestpractice` domains specifically), and continues
calling `platform.resolveX(context, asOfDate)` wherever the need is pure rule-based applicability
with no text query. **Zero changes to `IKnowledgePlatform` are required or authorized.**

**3.2 (new — closes gap 2.2).** Because `searchKnowledge()` does not apply `isEffectiveOn`
filtering, `KnowledgeResolver` treats every `searchKnowledge()`-sourced item as **illustrative,
never load-bearing**: such items are mapped into `ResolvedKnowledge.caseItems` (already
documented as "similar historical cases" — historical is the correct word for content that may
predate `asOfDate`) and are **never eligible for `AppliedRole = 'PRIMARY_BASIS'`** in
`legalReasoningEngine.ts`'s output — they may only ever back `SUPPORTING_BASIS`-role citations,
consistent with the pipeline's existing role-assignment logic (§7 of this ADR, Compatibility).
This is a policy decision inside `KnowledgeResolver`/the reasoning pipeline, not a platform
change — `searchKnowledge()` itself is not modified or asked to filter anything.

**3.3 (new — closes gap 2.3, field 1).** `KnowledgeResolver` maps `LegalBasis.document` →
`LegalBasisRef.documentSymbol` via a pure rename; `LegalBasis`'s other optional fields are
dropped in the mapping (no current consumer needs them; adding them to `LegalBasisRef` later is
an additive, non-breaking change if a need appears).

**3.4 (new — closes gap 2.3, field 2).** When `KnowledgeItem.effectivePeriod` is `undefined`,
`KnowledgeResolver` falls back to `item.createdAt.slice(0, 10)` as `effectiveFrom` — a real,
already-recorded fact about the item, never a fabricated or arbitrary date — and attaches a
`LOW`-severity entry to `ResolvedKnowledge.warnings` naming the affected item, so the assumption
stays visible and auditable rather than silent.

**3.5 (new — closes gap 2.3, field 3).** Structured rule/threshold definitions are stored as a
**single JSON-encoded string** in one metadata key per shape:
`metadata['ruleDefinition']` holds `JSON.stringify(EvaluationRuleMetadata)` for `type =
'EVALUATION_RULE'` items; `metadata['thresholdDefinition']` holds
`JSON.stringify(ThresholdMetadata)` for `type = 'THRESHOLD'` items. `KnowledgeResolver` parses
each with `JSON.parse` inside a `try/catch`; a parse failure or missing key produces a
`MissingEvidence` entry (`isCritical: true`) and excludes the item from `ruleItems`/
`thresholdItems` rather than throwing or silently defaulting — consistent with Batch A's
existing "never fabricate" discipline for missing context fields.

## 4. Alternatives Considered

**For §3.1 (unchanged from the original draft):**
- *Add new methods to `IKnowledgePlatform`* (e.g. `searchCases(query, context, limit)`).
  Rejected: `searchKnowledge()` already covers this exact need; a redundant method would violate
  the single-owner/no-duplicated-abstraction principle this documentation system exists to
  enforce.
- *Modify `resolveCases`/`resolveBestPractice`'s existing signatures in place.* Rejected
  outright: this is the frozen Phase N contract; changing it breaks the freeze guarantee and
  invalidates four existing integration test suites.
- *Defer the mismatch to implementation time.* Rejected: propagates a known defect into code
  instead of resolving it at the design layer.

**For §3.2 (new):**
- *Add temporal filtering to `BaseKnowledgeProvider.search()` itself.* Rejected for this ADR:
  this would modify the frozen Knowledge Platform (Constraint C-06's exact boundary) to fix a
  Reasoning-layer concern. If a future need genuinely requires temporally-aware search *ranking*
  (not just role-restriction), that is its own future ADR against the Knowledge Platform, not
  something this document authorizes.
- *Reject any `searchKnowledge()` result whose item is not currently effective.* Considered and
  rejected: this would silently narrow "similar historical cases" into "similar *current* cases
  only," contradicting the field's own documented purpose and discarding legitimately useful
  precedent.
- *Ignore the gap.* Rejected: this is the "silently propagate a known defect" mistake the
  original ADR explicitly rejected once already; applying a double standard to a gap found later
  would be inconsistent.

**For §3.3–3.5 (new):**
- *Leave `LegalBasis`/`KnowledgeItemRef` field-shape reconciliation to whoever implements
  `knowledgeResolver.ts`, ad hoc.* Rejected: exactly the deferred-defect pattern this project's
  own discipline rejects.
- *For the metadata encoding (§3.5): flatten each structured field into its own separate
  metadata key* (`metadata['ruleCode']`, `metadata['conditions']` as a separately-JSON-encoded
  array, `metadata['isCritical'] = 'true'`, etc.). Rejected in favor of one JSON blob per shape:
  partial corruption across many independent keys is harder to detect and validate atomically
  than one whole-object parse that either succeeds or fails as a unit.
- *For the `effectiveFrom` fallback (§3.4): use a fixed epoch sentinel* (e.g. `'0001-01-01'`).
  Rejected in favor of `item.createdAt`: an arbitrary sentinel is indistinguishable from a
  fabricated date, while `createdAt` is a genuine, already-recorded fact — consistent with
  CLAUDE.md's never-fabricate principle.

## 5. Trade-offs

- **§3.2** trades away search-ranking awareness of currency for simplicity and platform
  immutability — a currently-superseded case can rank highly by text relevance and still appear
  in `caseItems`, just never as a primary basis. Acceptable because "similar historical cases" is
  the field's actual documented purpose.
- **§3.5**'s single-JSON-blob approach trades partial-field flexibility (a corpus editor cannot
  update just one condition without rewriting the whole blob) for atomic validity — acceptable
  given rule/threshold definitions are small (`< 50 rules for a given context`, per
  `rules.md`) and edited as whole units in practice.
- **§3.4**'s `createdAt` fallback trades precision (the item's *true* legal effective date is
  unknown) for honesty (no invented date) — the accompanying `LOW` warning is the mechanism that
  keeps this trade-off visible rather than silent.

## 6. Consequences

- `KnowledgeResolver`'s test suite must include a case proving `searchKnowledge()` is called
  with the correct domain filter (`['cases']` or `['bestpractice']`) and limit for every intent
  type needing ranked text retrieval (unchanged from the original ADR).
- A new test must prove `searchKnowledge()`-sourced items are structurally prevented from
  reaching `AppliedRole = 'PRIMARY_BASIS'` in `legalReasoningEngine.ts`'s output — a genuinely
  new architecture-guard-style assertion, not present anywhere yet.
- A new test must prove the `effectiveFrom`-fallback warning is emitted for any item lacking
  `effectivePeriod`.
- A new test must prove a malformed `ruleDefinition`/`thresholdDefinition` JSON string produces
  a critical `MissingEvidence` entry, never a thrown exception and never a silently-defaulted
  rule.
- `KnowledgeResult[]`'s shape (`{ item, relevance, matchedDomain }`) must be mapped into
  `ResolvedKnowledge`'s shape — a small, additive mapping function inside the Reasoning Engine
  layer (unchanged from the original ADR).

## 7. Compatibility with Existing Architecture

Fully compatible, verified by direct inspection, not assumption:
- **Constraint C-06** ("Only `KnowledgeResolver` may call `IKnowledgePlatform`"): unaffected —
  this ADR's decisions all live inside `knowledgeResolver.ts`'s own mapping logic, never inside
  the platform.
- **`DEPENDENCY_RULES.md`**'s "Future: `src/reasoning/` may import `src/knowledge/` ONLY via
  `knowledgeResolver.ts`": unaffected.
- **`AppliedRole` (Batch A, frozen, `reasoningTypes.ts`)**: already has `SUPPORTING_BASIS` as a
  valid, non-primary role — §3.2's restriction needs no new role value, no type change, purely
  an assignment-logic decision inside the (not-yet-built) resolver/engine wiring.
- **AI_CONTEXT_SCHEMA.md**: unaffected — `AIContext.legalBasis`/`.evidence` are populated from
  `ReasoningResult`, which is populated from `ResolvedKnowledge`; none of this ADR's decisions
  change any field on `AIContext` itself.

## 8. Migration Strategy

`mockKnowledgeFixtures.ts` (Batch A) is retired **only after** `knowledgeResolver.ts` is proven
equivalent — i.e., the same fixture-driven test scenarios that passed against
`mockKnowledgeFixtures.ts` in Batch A's own test suite (`legal-reasoning-engine.test.ts`) must
also pass when the equivalent `KnowledgeItem` records are seeded into a real, memory-backed
`IKnowledgePlatform` instance and resolved through `knowledgeResolver.ts` instead. This is a
parity check, not a rewrite of Batch A's own tests. Until that parity is demonstrated, both files
coexist; deleting the mock fixtures is its own final commit (per the execution plan's stated
three-commit strategy), not bundled with `knowledgeResolver.ts`'s introduction.

## 9. Risks

- **Metadata-encoding fragility (§3.5).** If the corpus population process (a separately deferred
  milestone) ever writes a malformed `ruleDefinition`/`thresholdDefinition` string, every
  dependent rule/threshold silently drops out of resolution rather than surfacing loudly at
  write time. Mitigated by the `MissingEvidence`/critical-severity handling in §3.5 and §6, but a
  corpus-side validation step (out of scope here) would close this more completely.
- **§3.2's role-restriction is enforced by discipline in application code, not by a type-system
  guarantee** — nothing stops a future edit from accidentally assigning `PRIMARY_BASIS` to a
  `searchKnowledge()`-sourced item. Mitigated by the dedicated test required in §6, which must be
  added in the same commit as the resolver, not deferred.
- **`createdAt` fallback (§3.4) could be badly wrong** for an item whose real effective date
  long predates its record-creation date (e.g. a law from 2023 entered into the corpus in 2026).
  The `LOW`-severity warning makes this visible for human review; it does not prevent the
  temporary inaccuracy.

## 10. Future Evolution

- A future ADR *against the Knowledge Platform itself* (not this one) could add temporal
  filtering directly to `BaseKnowledgeProvider.search()`, closing gap 2.2 at the source instead
  of via role-restriction. Not proposed or authorized here — Constraint C-06 and the platform
  freeze make that a deliberately separate, higher-bar decision.
- X.7 (Performance & Production Hardening)'s `knowledgeResolverCache.ts` sits behind
  `KnowledgeResolver`, per the execution plan — none of this ADR's decisions need to anticipate
  caching; correctness first, per this project's stated software engineering principles.
- If corpus population (separately deferred) later adopts a schema-validated format for rule/
  threshold definitions, §3.5's `JSON.parse`-based decoding can be swapped for a validated parser
  without changing `KnowledgeResolver`'s external behavior — an additive implementation detail,
  not a contract change.

## 11. Explicit Acceptance Criteria

1. `knowledgeResolver.ts` exists and is the *only* file (outside test files) importing anything
   under `src/knowledge/`, verified by an architecture guard test extending Batch A's existing
   pattern.
2. A real `KnowledgeItem`, seeded into a memory-backed `IKnowledgePlatform`
   (`buildMemoryKnowledgeRepositories()` + `DefaultKnowledgePlatform` + `registerProvider()`),
   resolves correctly end-to-end through `legalReasoningEngine.reason()`, producing citations
   traceable to that real item (not a fixture).
3. `searchKnowledge()`-sourced items never appear with `AppliedRole = 'PRIMARY_BASIS'` in any
   `ReasoningResult`, proven by a dedicated test.
4. A malformed `ruleDefinition`/`thresholdDefinition` produces a critical `MissingEvidence`
   entry, never a thrown exception, proven by a dedicated test.
5. An item with no `effectivePeriod` set produces a `LOW`-severity warning and resolves using
   `createdAt` as `effectiveFrom`, proven by a dedicated test.
6. Full repository suite passes with zero regressions against the `phase-x.4-output-validation`
   baseline (423 files, 13,913 tests).

## 12. Ratification Checklist

- [x] This document reviewed by the accountable human decision-maker (not an AI session) —
      ratification explicitly requested and authorized this session.
- [x] Decisions §3.1–3.5 confirmed as still matching the *current* `IKnowledgePlatform`
      implementation at ratification time (re-verified 2026-07-05 by direct inspection of
      `knowledgePlatform.ts`, `queryRouter.ts`, `baseProvider.ts`, `memoryKnowledgeRepositories.ts` —
      no Knowledge Platform commit has landed since the readiness review; findings unchanged).
- [x] Copied into `app/.memory/decisions/ADR-022-knowledge-resolution-strategy.md` (next
      available slot in the existing `ADR-001`–`ADR-021` sequence — this document's `X01` numbering
      was only ever meant to avoid a *drafting-time* collision, not to be the permanent ID).
- [x] `app/.memory/decision-index.md` updated with the new `ADR-022` row, status `ACTIVE`.
- [x] `NEXT_APPROVED_PHASE.md`'s `blocking_prerequisite` and `NOT_approved` entries updated to
      reflect ratification having occurred.
- [x] `CURRENT_MILESTONE.md`'s `next_milestone_blocker` field updated once the above is done.

## 13. Go / No-Go Statement

**GO — recommend ratification of this FINAL version.**

The original draft's core decision (§3.1) is sound and is reconfirmed here by direct inspection
of the actual frozen interface, not by re-asserting the prior summary. It should not be
reopened. However, the draft alone was **incomplete**: ratifying it as originally written would
have left three real integration gaps (§2.2–2.3) to be improvised silently during
implementation — exactly the failure mode the draft's own Alternative C already rejected once.
This FINAL version closes all four gaps with explicit, testable decisions (§3.1–3.5,
acceptance criteria §11) and changes nothing about the frozen `IKnowledgePlatform`. Ratify this
document, not the original draft, and use the checklist in §12 to complete ratification as a
distinct human action.
