# ADR-009: AI Layer Consumes Only AIContext

**Status:** ACTIVE
**Date:** 2026-07-03
**Affects:** src/ai/, src/advisory/

---

## Problem

The AI Advisory Layer (Phase X) needs to generate Vietnamese legal advice in natural language.
Without a boundary, it would need to:
- Know how to query the Knowledge Platform
- Know how to parse ReasoningResult
- Know which model to use for which context
- Be rewritten every time the knowledge architecture changes

This creates coupling between the LLM layer and every upstream component.

## Decision

`AIContext` is the frozen read-only contract between the Reasoning Layer and the LLM.

The `AIContextBuilder` translates `ReasoningResult → AIContext`.
Once built, `AIContext` is immutable (`Object.freeze`).
The AI Advisory Layer (Phase X) only imports `IAIContextBuilder`, `ILLMAdapter`, and `AIContext`.

**8 Immutable Rules:**
1. AI never calls repositories
2. AI never searches knowledge  
3. AI never evaluates rules
4. AI never resolves applicable law
5. AI only generates natural language from AIContext
6. AIContext is read-only after construction
7. Every LLM response passes output validation before serving
8. No model-specific logic in PromptBuilder

## Reason

- Model swapping (Claude → GPT → Gemini) requires zero changes to Phase X
- A/B testing models requires zero changes to business logic
- Air-gapped deployment (LocalLLMAdapter) works without changing the advisory layer
- Hallucination detection (OutputValidator) is applied uniformly regardless of model
- AIContextBuilder can be independently tested without an LLM

## Consequences

- Phase X cannot access `ReasoningResult` directly — only `AIContext`
- Phase X cannot access `IKnowledgePlatform` at all
- `OutputValidator` redacts hallucinated citations to `[NGUỒN KHÔNG XÁC MINH]`
- `ValidationLog` provides 5-year audit trail of every AI response
- `LocalLLMAdapter` satisfies classified document / air-gapped government requirements
