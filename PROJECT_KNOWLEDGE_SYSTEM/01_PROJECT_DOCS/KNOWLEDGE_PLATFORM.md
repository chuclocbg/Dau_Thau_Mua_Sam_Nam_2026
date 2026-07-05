# Knowledge Platform

**Purpose:** Explain what the Knowledge Platform is, how it works, and why it's the strongest
architectural result in the repository.

**Audience:** Anyone extending the Knowledge Platform, or building Phase X on top of it.

**Dependencies:** [Technical Architecture](TECHNICAL_ARCHITECTURE.md), [Domain Model](DOMAIN_MODEL.md).

**Status:** FROZEN, v1.0, complete at 16 of 16 providers.

**Related:** `app/docs/knowledge-platform.md` (full implementation detail, authoritative) ·
[AI Advisory Architecture](AI_ADVISORY_ARCHITECTURE.md) · [`../03_KNOWLEDGE_BASE/README.md`](../03_KNOWLEDGE_BASE/README.md)

## Table of Contents

1. [What It Is](#what-it-is)
2. [The 8 Immutable Rules](#the-8-immutable-rules)
3. [The 16 Providers](#the-16-providers)
4. [Extension Model](#extension-model)
5. [What It Is Not](#what-it-is-not)
6. [Known Limitations](#known-limitations)

---

## What It Is

A registration-based platform that stores and resolves the applicability of every kind of
institutional knowledge — legal text, procurement templates, checklists, vendor rules, budget
rules, risk patterns, past cases, best practices, and more — without ever hardcoding a rule
into application logic. It answers two kinds of question: *"what knowledge applies to this
context?"* (via `KnowledgeApplicabilityRule` evaluation) and *"what knowledge is related to
this item?"* (via a graph of typed relations).

## The 8 Immutable Rules

1. Domain is an open string, never an enum.
2. Registration (`platform.registerProvider()`) is the only extension mechanism.
3. No routing `switch`/`if` anywhere in the platform core — pure `Map` lookups.
4. The (future) AI layer speaks only `IKnowledgePlatform`, never a provider directly.
5. `suggest()` and `score()` are required on every provider.
6. `KnowledgeItem` is universal — no domain-specific entity types, ever.
7. Relation types are an open string set, not an enum.
8. Applicability rules are universal — the same evaluator works identically for every domain.

## The 16 Providers

| Domain | Layer | Batch |
|---|---|---|
| legal, procurement | 1, 2 | Stage 2 (proved the pattern) |
| templates, checklists, ontology, glossary | 2 | Batch 1 |
| vendor, asset, budget, notification | 2 | Batch 2 |
| school, cases, risk, audit | 3, 4 | Batch 3 |
| bestpractice, ai_feedback | 4 | Batch 4 (final) |

12 relation types were invented on the fly beyond the 10 originally documented constants
(`BROADER_THAN`, `ABBREVIATES`, `TRANSLATES_TO`, `BLACKLISTED_FOR`, `ROLLS_UP_TO`,
`ESCALATES_TO`, `RESTRICTS`, `REVEALED`, `MITIGATED_BY`, `REMEDIATED_BY`, `DERIVED_FROM`,
`CORRECTS`) — every one required zero graph-engine changes, the empirical proof that Rule 7
holds under real, varied use.

## Extension Model

Adding provider 17 requires exactly: implement `IKnowledgeProvider` (4 methods), extend
`BaseKnowledgeProvider` for the shared search/resolve/suggest/score implementation, call
`platform.registerProvider(new NewProvider(...))`. This was proven 16 times, across 4 batches,
with an integration test suite each time proving zero core drift. No other extension pattern
in this repository has this much empirical validation behind it.

## What It Is Not

It is **not** a reasoning engine, not a RAG system, not a search engine with real semantic
capability yet, and not connected to any LLM. It stores and resolves applicability — nothing
more. Phase X (not yet built) is the layer that turns platform output into a reasoned,
cited, natural-language answer. See [AI Advisory Architecture](AI_ADVISORY_ARCHITECTURE.md).

## Known Limitations

- Every repository (`findByDomain`, `findActive`, `findByType`, graph edge lookups) does a full
  in-memory linear scan with zero indexing — fine at current scale, a real constraint before
  10,000+ items or Postgres migration (see [Roadmap](ROADMAP.md), Phase N.5).
- `NoOpEmbeddingAdapter`/`MemoryVectorStoreAdapter` are real, clean interfaces with zero real
  implementation — "semantic search" does not functionally exist yet, only keyword search does.
- The pre-existing Phase X design docs (`app/knowledge/reasoning/pipeline.md`) assume a
  `resolveCases(question, context, limit)` signature that does not exist on the frozen
  interface — resolved via ADR-DRAFT-X01 (use the existing `searchKnowledge()` instead), not
  yet formally ratified. See [AI Advisory Architecture](AI_ADVISORY_ARCHITECTURE.md).
