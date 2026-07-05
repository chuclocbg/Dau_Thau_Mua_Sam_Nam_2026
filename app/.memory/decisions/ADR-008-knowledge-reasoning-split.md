# ADR-008: Knowledge Platform Never Reasons; Reasoning Layer Never Stores

**Status:** ACTIVE
**Date:** 2026-07-03
**Affects:** src/knowledge/, src/reasoning/, src/ai/, src/advisory/

---

## Problem

Without a hard boundary, knowledge retrieval and legal reasoning get conflated.
A legal question like "what method applies to this package?" requires:
1. Retrieving relevant laws, rules, and thresholds (knowledge retrieval)
2. Determining which of those laws applies given the context (reasoning)
3. Resolving conflicts between applicable laws (conflict resolution)
4. Evaluating rules against specific values (rule evaluation)

If a single service does all four, changing any one rule requires code changes.
If reasoning happens inside knowledge providers, providers become coupled to procurement logic.

## Decision

Permanent architectural separation into two independent layers:

**Knowledge Platform** (`src/knowledge/`):
- Retrieves documents, rules, templates, cases, risk patterns
- Returns `KnowledgeItem[]` — raw data, no interpretation
- Never evaluates rules, never resolves conflicts, never determines applicable law
- `KnowledgeResolver` in the Reasoning Pipeline is the ONLY caller of `IKnowledgePlatform`

**Reasoning Layer** (`src/reasoning/`):
- Decides which knowledge applies and why
- Resolves conflicts via 4-tier cascade (ADR-015)
- Evaluates rules and thresholds from Knowledge Platform corpus
- Never stores documents, never has its own persistence
- Input: `ReasoningQuestion` | Output: `ReasoningResult` (frozen contract)

## Reason

Rules and thresholds stored as `KnowledgeItem` objects in the corpus mean:
- A new decree's threshold change = insert new KnowledgeItem with new `effectiveFrom`
- Zero code changes in either layer
- Both layers independently testable
- Knowledge Platform can be used for non-reasoning purposes (templates, glossary lookup)

## Consequences

- `ILegalReasoningEngine` has exactly 2 methods: `reason()` + `explain()`
- Stage 2 (KnowledgeResolver) is the ONLY place `IKnowledgePlatform` is called in the 8-stage pipeline
- `ReasoningResult` is the frozen output contract (see spec)
- All stages after Stage 2 work exclusively on `ResolvedKnowledge` passed through `PipelineState`
