# Phase X ADR Draft 001 — Knowledge Retrieval Strategy for Text-Query Needs

**Purpose:** Formal capture of the ADR-DRAFT-X01 decision already reached during the Phase X
architecture review — persisted here because the audit found it existed only as a condensed
summary, not as retrievable Context/Decision/Alternatives/Consequences reasoning.

**Audience:** Whoever implements Phase X.2 (Reasoning Engine).

**Dependencies:** [AI Advisory Architecture](AI_ADVISORY_ARCHITECTURE.md), [Knowledge Platform](KNOWLEDGE_PLATFORM.md).

**Status:** DECIDED at the documentation-design level. **Not yet ratified** into
`app/.memory/decision-index.md` — ratification is a separate, explicit action outside this
system's scope (per `../02_AI_CONTEXT/NEXT_APPROVED_PHASE.md`). Numbered independently
(`X01`, not `ADR-00X`) specifically to avoid colliding with either of the two existing ADR
numbering sequences documented in [`../03_KNOWLEDGE_BASE/adr/README.md`](../03_KNOWLEDGE_BASE/adr/README.md).

**Related:** [`../02_AI_CONTEXT/NEXT_APPROVED_PHASE.md`](../02_AI_CONTEXT/NEXT_APPROVED_PHASE.md) · [`../04_PROJECT_MEMORY/DECISION_HISTORY.md`](../04_PROJECT_MEMORY/DECISION_HISTORY.md)

---

## Context

The pre-existing Phase X design corpus (`app/knowledge/reasoning/pipeline.md`) specifies that
`KnowledgeResolver` calls `platform.resolveCases(intent.question, context, 3)` and
`platform.resolveBestPractice(intent.question, context)` — signatures accepting a free-text
question and a result limit. The frozen `IKnowledgePlatform` interface (Phase N, frozen) has no
such methods. It has `resolveCases(context: KnowledgeContext, asOfDate: string)` and
`resolveBestPractice(context: KnowledgeContext, asOfDate: string)` — rule-based applicability
resolution only, no text query, no limit. Separately, the frozen interface already has
`searchKnowledge(text: string, domains?: string[], context?: KnowledgeContext, limit?: number)`
— a method whose signature exactly matches the shape the design docs assumed `resolveCases`
would have.

## Decision

`KnowledgeResolver` (Phase X.2, not yet built) will call
**`platform.searchKnowledge(intent.question, ['cases'], context, 3)`** wherever the design
called for text-similarity-ranked retrieval with a limit, and will continue using
`platform.resolveCases(context, asOfDate)` / `resolveBestPractice(context, asOfDate)` wherever
the actual need is pure rule-based applicability with no text query involved.

**Zero changes to the frozen `IKnowledgePlatform` interface are required or authorized by this
decision.**

`KnowledgeResolver`'s implementation must document, at each call site, which of the two
retrieval modes it is using and why — this ADR is the canonical reference for that choice.

## Alternatives Considered

**Alternative A — Add new methods to `IKnowledgePlatform`** (e.g., `searchCases(query,
context, limit)`). Rejected: once `searchKnowledge()` was confirmed to already cover this
exact need, adding a redundant method would itself violate the single-owner/no-duplicated-
abstraction principle this whole documentation system exists to enforce.

**Alternative B — Modify `resolveCases`/`resolveBestPractice`'s existing signatures in
place.** Rejected outright: this is the frozen Phase N platform contract. Changing an existing
method's signature breaks the freeze guarantee and invalidates the 4 integration test suites
that already gate the freeze (`knowledge-platform-batch1/2/3-integration.test.ts`,
`knowledge-platform-phase-n-complete-integration.test.ts`).

**Alternative C — Leave the pre-existing design docs as the source of truth and build
`KnowledgeResolver` against the aspirational signature, deferring the mismatch to
implementation time.** Rejected: this would silently propagate a known defect into actual code
instead of resolving it at the design layer where it was found — inconsistent with this
project's "never fabricate, never defer a known problem" discipline.

## Consequences

- `KnowledgeResolver`'s test suite must include a case proving `searchKnowledge()` is called
  with the correct domain filter (`['cases']` or `['bestpractice']`) and limit for every intent
  type that needs ranked text retrieval.
- `KnowledgeResult[]`'s shape (`{ item, relevance, matchedDomain }`) must be mapped into
  whatever internal shape `ReasoningEngine`/`EvidenceCollector` expect downstream — a small,
  additive mapping function inside the Reasoning Engine layer, never a platform change.
- This decision should be the first item ratified into `app/.memory/decision-index.md` once
  Phase X.2 implementation is explicitly authorized — it is the one blocking prerequisite named
  in `../02_AI_CONTEXT/NEXT_APPROVED_PHASE.md`.
