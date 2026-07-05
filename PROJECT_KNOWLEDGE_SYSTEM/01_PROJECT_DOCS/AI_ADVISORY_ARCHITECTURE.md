# AI Advisory Architecture (Phase X)

**Purpose:** Document the accepted, approved-but-not-yet-implemented architecture for Phase X
— the AI Advisory Layer that will sit on top of the frozen Knowledge Platform.

**Audience:** Anyone who will implement, review, or extend Phase X.

**Dependencies:** [Knowledge Platform](KNOWLEDGE_PLATFORM.md), [Constitution](CONSTITUTION.md).

**Status:** APPROVED architecture and design. **No Phase X code exists.** This document is a
condensed, canonical summary of a much longer design/review/blueprint cycle — see
`app/knowledge/ai-advisory/` and `app/knowledge/reasoning/` for the original pre-existing
detailed specs this design reconciles with.

**Related:** [`../02_AI_CONTEXT/ARCHITECTURE_CONSTRAINTS.md`](../02_AI_CONTEXT/ARCHITECTURE_CONSTRAINTS.md) ·
[`../02_AI_CONTEXT/NEXT_APPROVED_PHASE.md`](../02_AI_CONTEXT/NEXT_APPROVED_PHASE.md) · [Roadmap](ROADMAP.md) ·
[Phase X ADR Draft 001](PHASE_X_ADR_DRAFT_001.md) · [AIContext Schema](AI_CONTEXT_SCHEMA.md) ·
[Golden Question Methodology](GOLDEN_QUESTION_METHODOLOGY.md)

## Table of Contents

1. [Why Phase X Exists](#why-phase-x-exists)
2. [Layered Architecture](#layered-architecture)
3. [The Core Design Decision: Advisors Are Data, Not Services](#the-core-design-decision-advisors-are-data-not-services)
4. [The Reasoning Pipeline](#the-reasoning-pipeline)
5. [The Frozen AIContext Contract](#the-frozen-aicontext-contract)
6. [Outstanding Design Issue (Must Resolve First)](#outstanding-design-issue-must-resolve-first)
7. [MCP and Multi-Agent — Gated, Not Built](#mcp-and-multi-agent--gated-not-built)
8. [Phase Breakdown](#phase-breakdown)
9. [AI Safety](#ai-safety)

---

## Why Phase X Exists

The Knowledge Platform answers "what applies." It cannot detect intent, resolve a conflict
between two applicable-but-contradictory rules into one answer, explain reasoning in natural
language, or know when a human must review a conclusion. Phase X owns that translation layer —
and only that layer. It is not RAG (retrieval here is applicability-rule-driven, not
similarity-driven), not "ChatGPT with documents" (the LLM is the *last* of 10-11 pipeline
stages, constrained to a frozen context it cannot deviate from), and not simple semantic search
(it synthesizes a cited, confidence-scored, actionable decision, not a ranked document list).

## Layered Architecture

```
Presentation → Conversation Layer → Advisor Layer (profiles, not services) → Reasoning Engine
  → Planning Layer (agentic, gated behind X.9/X.10) → Knowledge Platform (frozen)
  → Repositories → Prisma → PostgreSQL

Side-channel (parallel to Reasoning Engine, not below it):
  AI Context Layer → Prompt Layer → LLM Adapter Layer → Output Validator
```

Full dependency rules: [`../02_AI_CONTEXT/DEPENDENCY_RULES.md`](../02_AI_CONTEXT/DEPENDENCY_RULES.md).

## The Core Design Decision: Advisors Are Data, Not Services

15 advisors (Legal, Procurement, Planning, Workflow, Approval, Contract, Acceptance, Asset,
Supplier, Budget, Audit, Notification, Risk, School Policy, Executive) are **`AdvisorProfile`
data records** consumed by **one** Reasoning Engine — never 15 separate service classes. This
mirrors the Knowledge Platform's own proven 16-provider registration pattern exactly. Adding
advisor #16 means adding one data record, zero core changes — the same Open/Closed guarantee
already validated 16 times over in Phase N.

**Executive Advisor** is the one exception worth naming: it is a *composition* of the other 14
advisors' domains (calls `resolveContext()` across all of them, synthesizes one answer), never
a 16th independent knowledge domain of its own.

## The Reasoning Pipeline

Ten stages, seven of which are already fully specified in the pre-existing design corpus, three
newly added by this review cycle (Question Classification, promoted Contradiction Detection,
Self-Critique):

```
Intent Detection → Question Classification → Knowledge Routing (multi-provider) →
Reasoning Chain → Rule Evaluation → Evidence Ranking → Contradiction Detection →
Citation Formatting → Answer Synthesis → Self-Critique
  → [AIContext → Prompt → LLM] → Final Validation
```

Confidence is computed deterministically (an 11-deduction scoring table, not an LLM
self-report) **before** the LLM is ever called. Human-review thresholds are per-advisor
(`STRICT`/`STANDARD`/`PERMISSIVE`) and also computed pre-LLM — the LLM cannot influence whether
its own output gets reviewed.

## The Frozen AIContext Contract

`AIContext` is the single, `Object.freeze()`-enforced boundary between the Reasoning Engine and
everything downstream (Prompt Layer, LLM Adapter, Output Validator). No advisor, no LLM
adapter, bypasses it. New fields must be optional and additive only — this contract, once
implemented, is frozen the same way Knowledge Platform's core is frozen. Full field-by-field
schema and the field-ownership registry (which pipeline stage populates which field):
[`AI_CONTEXT_SCHEMA.md`](AI_CONTEXT_SCHEMA.md).

## Outstanding Design Issue (Must Resolve First)

The pre-existing design docs assume `platform.resolveCases(question, context, limit)` — a
signature that doesn't exist on the frozen `IKnowledgePlatform`. **Resolution (formalized in
[Phase X ADR Draft 001](PHASE_X_ADR_DRAFT_001.md), decided but not yet ratified into
`app/.memory/decision-index.md`):** use the platform's existing `searchKnowledge(text, domains,
context, limit)` method instead — it already covers this exact need. **Zero changes to the
frozen platform are required.** This must be ratified before Phase X.2 (Reasoning Engine)
begins. Full Context/Decision/Alternatives/Consequences: [`PHASE_X_ADR_DRAFT_001.md`](PHASE_X_ADR_DRAFT_001.md).

## MCP and Multi-Agent — Gated, Not Built

Both have a complete design (registration-only tool registry mirroring `ProviderRegistry`;
Coordinator/Planner/Retriever/Researcher/Reviewer/Critic orchestration with exactly **one** LLM
call regardless of how many sub-questions are decomposed). Both are explicitly **gated behind
proven production need** — building them ahead of real usage data was reviewed and rejected as
premature, the same judgment already applied once in this project's history to avoid service
sprawl.

## Phase Breakdown

| Milestone | Scope | Blocked by |
|---|---|---|
| X.1 Conversation Core | Session state, no LLM | Nothing — can start now |
| X.2 Reasoning Engine | Full pipeline, no LLM | ADR-DRAFT-X01 ratification |
| X.3 Context Builder | AIContext + token budgeting | X.2 |
| X.4 Prompt Engine | Model-agnostic + per-model rendering | X.3 |
| X.5 LLM Adapters | Claude first, then OpenAI/Gemini/Local | X.4 + API keys |
| X.6 Validation | 6-check OutputValidator | X.5 |
| X.7 Output Formatting | One real advisor, end-to-end | X.6 |
| X.8 Evaluation | All 15 advisors + Golden Question harness | X.7 |
| X.9 MCP | Gated behind proven need | X.8 + explicit approval |
| X.10 Multi-Agent | Gated behind proven need | X.9 + explicit approval |

## AI Safety

Hallucination prevention (structural, via frozen `AIContext` + non-removable forbidden-behavior
clause) · citation enforcement (auto-redaction of any citation not traceable to context) ·
pre-LLM confidence/human-review computation · prompt injection protection (retrieved content is
always inert data, delimited, never treated as instructions) · session isolation (fresh
`contextId` per turn, no cross-session leakage). The reasoning behind each of these choices,
and the alternatives rejected, is in [`../04_PROJECT_MEMORY/DECISION_HISTORY.md`](../04_PROJECT_MEMORY/DECISION_HISTORY.md)
and [`../04_PROJECT_MEMORY/REJECTED_DESIGNS.md`](../04_PROJECT_MEMORY/REJECTED_DESIGNS.md).
**Note:** a full itemized risk register (the "top 30 risks" produced during the original Phase X
review cycle) was not persisted into this system as a standalone artifact — this is a known,
tracked gap, not a claim that one exists here. Treat the safety mechanisms listed above as the
current complete set of *decided* safeguards, not as an index into a longer risk list.
