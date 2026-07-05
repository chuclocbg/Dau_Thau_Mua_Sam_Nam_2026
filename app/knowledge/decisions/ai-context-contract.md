# Phase N3 — AI Context Contract

Date: 2026-07-03
Status: SPECIFICATION — awaiting approval; becomes FROZEN on acceptance
Location: src/ai/
Depends on: src/reasoning/ (ILegalReasoningEngine + ReasoningResult only, via bridge)

---

## The 3-Layer Stack

```
╔══════════════════════════════════════════════════════════════════════╗
║  KNOWLEDGE PLATFORM (Phase N — FROZEN)                               ║
║  retrieves information                                               ║
╚══════════════════════════════════════════════════════════════════════╝
                       ↓ IKnowledgePlatform
╔══════════════════════════════════════════════════════════════════════╗
║  REASONING LAYER (Phase N2 — FROZEN)                                 ║
║  decides which knowledge applies → produces ReasoningResult           ║
╚══════════════════════════════════════════════════════════════════════╝
                       ↓ ReasoningResult
╔══════════════════════════════════════════════════════════════════════╗
║  AI CONTEXT BUILDER (Phase N3 — this spec)                           ║
║  transforms ReasoningResult → AIContext (read-only, frozen contract) ║
╚══════════════════════════════════════════════════════════════════════╝
                       ↓ AIContext
╔══════════════════════════════════════════════════════════════════════╗
║  LLM ADAPTER (Phase N3 — this spec)                                  ║
║  prompt construction → model call → output validation                ║
╚══════════════════════════════════════════════════════════════════════╝
                       ↓ LLMResponse
╔══════════════════════════════════════════════════════════════════════╗
║  AI ADVISORY LAYER (Phase X — future)                                 ║
║  orchestrates multi-turn conversation; routes user queries           ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## The AI Boundary Rules (Immutable)

1. **AI never calls repositories.** No `IRepository` import anywhere in `src/ai/`.
2. **AI never searches knowledge.** No `IKnowledgePlatform` import in `src/ai/`. The platform was already called by the Reasoning Layer.
3. **AI never evaluates rules.** No `IRuleEvaluator`, no threshold comparison in `src/ai/`.
4. **AI never resolves applicable law.** No `ILegalReasoningEngine` import inside `LLMAdapter` or `PromptBuilder`. The Reasoning Layer already did this.
5. **AI only generates natural language from AIContext.** The LLM receives `AIContext` and returns `LLMResponse`. Nothing else passes the boundary.
6. **AIContext is read-only.** Once built by `AIContextBuilder`, `AIContext` is frozen. No stage downstream may modify it.
7. **Every LLM response passes output validation.** `DefaultOutputValidator` runs before any response is served. Hallucinated citations are redacted. Contradictions are flagged.
8. **No model-specific logic in PromptBuilder.** `PromptBuilder` produces model-agnostic prompt sections. `PromptRenderer` formats for each model's API format.

---

## Sub-Specifications

| File | Contents |
|------|----------|
| [context.md](../ai-advisory/context.md) | AIContext schema · all supporting types · AIContextMessage · AIContextSystemInstructions |
| [builder.md](../ai-advisory/builder.md) | AIContextBuilder interface · build strategy · token budget management · compression priority |
| [adapter.md](../ai-advisory/adapter.md) | ILLMAdapter interface · 4 adapter implementations · ModelCapabilities · ModelSelector |
| [prompts.md](../ai-advisory/prompts.md) | Prompt lifecycle · PromptBuilder sections · PromptRenderer · token budget priorities |
| [validation.md](../ai-advisory/validation.md) | Output validation · citation integrity · factual consistency · hallucination redaction |

---

## Source Layout

```
src/ai/
├── aiTypes.ts                          ← ALL types in this file only
├── IAIContextBuilder.ts                ← builder interface
├── DefaultAIContextBuilder.ts          ← implementation
├── ILLMAdapter.ts                      ← top-level adapter interface
├── adapters/
│   ├── ClaudeLLMAdapter.ts             ← Anthropic claude-* models
│   ├── OpenAILLMAdapter.ts             ← GPT-4o and successors
│   ├── GeminiLLMAdapter.ts             ← Google Gemini
│   └── LocalLLMAdapter.ts              ← Ollama / vLLM (air-gapped deployment)
├── prompts/
│   ├── PromptBuilder.ts                ← assembles AIContext → prompt sections
│   ├── TokenBudgetManager.ts           ← compresses AIContext to model token limit
│   └── PromptRenderer.ts               ← formats sections per model API format
├── validation/
│   ├── IOutputValidator.ts
│   └── DefaultOutputValidator.ts       ← citation integrity + factual consistency
├── models/
│   ├── ModelCapabilityRegistry.ts      ← known model capability records
│   └── ModelSelector.ts                ← selects optimal model for a given context
└── integration/
    └── aiIntegration.ts                ← ONLY file importing from src/reasoning/ (bridge)
```

**~14 source files | ~546 tests (~14 × 39)**

---

## Downstream Constraint for Phase X

Phase X (AI Advisory Layer) may only import:
- `ILLMAdapter` from `src/ai/`
- `IAIContextBuilder` from `src/ai/`
- `AIContext`, `LLMResponse`, `AIContextBuildOptions` from `src/ai/aiTypes.ts`

Phase X may NOT import:
- Anything from `src/reasoning/` (access via `src/ai/integration/aiIntegration.ts` bridge only)
- Anything from `src/knowledge/` (already isolated by reasoning bridge)
- Any `*Provider.ts` file
- Any `*Repository.ts` file
