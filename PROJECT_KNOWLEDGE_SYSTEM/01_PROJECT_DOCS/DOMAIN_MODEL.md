# Domain Model

**Purpose:** The core entities, value objects, aggregates, and bounded contexts that make up
this system's domain — the shape of the business, independent of any framework.

**Audience:** Anyone modeling new domain logic.

**Dependencies:** [Technical Architecture](TECHNICAL_ARCHITECTURE.md).

**Related:** [`../02_AI_CONTEXT/DDD_RULES.md`](../02_AI_CONTEXT/DDD_RULES.md) · [Module Catalog](MODULE_CATALOG.md) · [Knowledge Platform](KNOWLEDGE_PLATFORM.md)

## Table of Contents

1. [Shared Value Objects](#shared-value-objects)
2. [Bounded Contexts](#bounded-contexts)
3. [Aggregate Roots](#aggregate-roots)
4. [Knowledge Platform's Universal Entity](#knowledge-platforms-universal-entity)
5. [Known Domain Modeling Debt](#known-domain-modeling-debt)

---

## Shared Value Objects

Two value objects are deliberately shared across every bounded context, living in
`src/shared/financial/`:

- **`Money`** — `{ amount: bigint, currency: CurrencyCode }`. Never a `number` or `float`,
  anywhere, for any monetary value in any module built from Phase H.5 onward.
- **`LegalBasis`** — a structured legal citation (document symbol, article, clause, effective
  date), never a bare string. Enforced across every module that cites law.

## Bounded Contexts

Legal Foundation · Master Data · Workflow Engine · Procurement (Package, Planning, Rules) ·
Approval · Contract · Acceptance · Payment · Auth · Storage · Notification · Knowledge Platform
(itself further divided into 16 provider-owned sub-domains). Each is a genuinely separate
ubiquitous language — a "Package" in Procurement is not the same concept as a "Package" (if it
existed) anywhere else, and no entity crosses a bounded-context boundary except through the
two shared value objects above.

## Aggregate Roots

- **`ProcurementPackage`** — the aggregate root for the procurement package lifecycle (see
  `docs/adr/ADR-004-procurement-package-aggregate-root.md`).
- **`WorkflowInstance`** — owns its own state transitions; no other module mutates workflow
  state directly (`docs/adr/ADR-003-workflow-owns-state.md`).
- **`ProcurementPlan`** — the annual planning aggregate.

**Deliberate non-aggregate:** `ProcurementNeed` is embedded directly inside
`ProcurementRequest`, not modeled as its own repository-backed aggregate — a considered
decision, not an oversight (see [`../04_PROJECT_MEMORY/DECISION_HISTORY.md`](../04_PROJECT_MEMORY/DECISION_HISTORY.md)).

## Knowledge Platform's Universal Entity

The Knowledge Platform deliberately does **not** model 16 separate domain entities. Every
knowledge artifact — a law, a template, a past case, a risk pattern, a vendor blacklist reason
— is the same universal `KnowledgeItem` type, differentiated only by its `domain` (an open
string, never an enum) and `type` field. This is the single most important domain-modeling
decision in the whole repository: it trades entity-level type safety for extensibility, and
that trade paid off — adding a 16th domain required zero changes to the entity model itself.
Full detail: [Knowledge Platform](KNOWLEDGE_PLATFORM.md).

## Known Domain Modeling Debt

- `AIKnowledgeContext`'s six hardcoded fields (`legalBasis, templates, checklists,
  bestPractices, risks, cases`) encode a specific, opinionated view of "AI context" directly
  into the otherwise domain-agnostic Knowledge Platform — a mild violation of its own
  domain-agnostic principle, flagged during the Phase X architecture review, not yet resolved.
- `procurementEngine.ts` mixes domain rule logic with application orchestration (hardcoded
  law-symbol conditionals) — TD-02, tracked, module frozen.
