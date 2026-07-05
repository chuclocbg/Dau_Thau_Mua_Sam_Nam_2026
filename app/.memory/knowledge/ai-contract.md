# AI Context Contract Memory

**Spec status:** FROZEN (2026-07-03)
**Full spec:** `knowledge/decisions/ai-context-contract.md` + `knowledge/ai-advisory/`

---

## AIContext (frozen, read-only contract)

```typescript
AIContext {
  // Core
  contextId: string
  builtAt: string
  asOfDate: string
  totalTokenEstimate: number
  language: string
  confidenceLabel: 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW'
  humanReviewRequired: boolean
  humanReviewReason?: string

  // User-specified fields (frozen)
  question: string
  intent: AIContextIntent
  decision: string | null
  confidence: number
  reasoningTrace: AIContextTraceStep[]      // max 10, summarized
  citations: AIContextCitation[]            // pre-formatted full/short/inline/chain
  legalBasis: AIContextLegalBasis[]         // PRIMARY items first
  evidence: AIContextEvidence[]             // PRIMARY items first
  warnings: AIContextWarning[]              // CRITICAL items first
  missingInformation: AIContextMissingInfo[]
  recommendedActions: AIContextAction[]
  attachments: AIContextAttachment[]
  conversationHistory: AIContextMessage[]
  systemInstructions: AIContextSystemInstructions
}
```

`Object.freeze(context)` is called on construction. AIContext is immutable at runtime.

---

## 4 LLM Adapters

| Adapter | Provider | Best For |
|---------|---------|---------|
| ClaudeLLMAdapter | ANTHROPIC | Production primary; Vietnamese compliance |
| OpenAILLMAdapter | OPENAI | Fallback; cost |
| GeminiLLMAdapter | GOOGLE | High volume; multimodal |
| LocalLLMAdapter | LOCAL (Ollama) | Air-gapped; no external data sent |

`LocalLLMAdapter` is required for classified procurement documents and air-gapped government networks.

---

## Token Budget (8-tier compression)

| Priority | What | Action under pressure |
|----------|------|----------------------|
| P1 (never drop) | decision, humanReviewRequired, question, legalBasis PRIMARY, systemInstructions | Truncate provision texts to 100 chars last resort |
| P2 | citations | Merge to inline-only format |
| P3 | CRITICAL+HIGH warnings, critical missingInfo | Drop LOW/MEDIUM only |
| P4 | REQUIRED+RECOMMENDED actions | Drop OPTIONAL |
| P5 | evidence | Strip detail → strip SUPPORTING → truncate PRIMARY |
| P6 | reasoningTrace | Reduce to 3 steps |
| P7 | conversationHistory | Drop oldest turns, keep last 2 |
| P8 (first dropped) | attachment textSummary | Drop entirely |

---

## 6 Output Validation Checks

1. **Citation integrity** — hallucinated citations → `[NGUỒN KHÔNG XÁC MINH]` (auto-redacted)
2. **Numeric consistency** — legal threshold numbers cross-referenced against context
3. **Decision contradiction** — LLM conclusion checked vs `AIContext.decision`
4. **Language compliance** — output language matches `systemInstructions.outputLanguage`
5. **Response completeness** — truncated responses detected and flagged
6. **Forbidden pattern detection** — 4 specific patterns (FP-01 through FP-04)

All validation runs are logged for 5-year audit retention.

---

## Source Layout (Phase N implementation)

```
src/ai/
  aiTypes.ts
  IAIContextBuilder.ts
  DefaultAIContextBuilder.ts
  ILLMAdapter.ts
  adapters/ (4: Claude, OpenAI, Gemini, Local)
  prompts/ (3: PromptBuilder, TokenBudgetManager, PromptRenderer)
  validation/ (2: IOutputValidator, DefaultOutputValidator)
  models/ (2: ModelCapabilityRegistry, ModelSelector)
  integration/aiIntegration.ts    ← only file importing from src/reasoning/
```

~14 source files | ~546 tests

---

## 8 Immutable AI Boundary Rules

1. AI never calls repositories
2. AI never searches knowledge
3. AI never evaluates rules
4. AI never resolves applicable law
5. AI only generates natural language from AIContext
6. AIContext is read-only after construction
7. Every LLM response passes output validation before serving
8. No model-specific logic in PromptBuilder (handled by PromptRenderer)
