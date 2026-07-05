# LLM Adapter · Model Abstraction

Part of: [ai-context-contract.md](../decisions/ai-context-contract.md)

---

## 1. ILLMAdapter — Top-Level Interface

```typescript
interface ILLMAdapter {
  readonly modelId:        string
  readonly provider:       LLMProvider
  readonly capabilities:   ModelCapabilities

  // Single-turn completion
  complete(context: AIContext): Promise<LLMResponse>

  // Streaming completion (token-by-token or sentence-by-sentence)
  stream(context: AIContext): AsyncIterable<LLMStreamChunk>

  // Output validation (called after complete() or after stream() finishes)
  validateOutput(output: LLMOutput, context: AIContext): OutputValidationResult

  // Token estimation for this adapter's tokenizer
  estimateTokens(text: string): number

  // Health check
  isAvailable(): Promise<boolean>
}

type LLMProvider = 'ANTHROPIC' | 'OPENAI' | 'GOOGLE' | 'LOCAL'
```

---

## 2. Response Types

```typescript
interface LLMResponse {
  responseId:       string          // UUID; correlates with contextId
  contextId:        string          // AIContext.contextId
  content:          string          // the full response text
  finishReason:     FinishReason
  tokensUsed: {
    input:          number
    output:         number
    total:          number
  }
  latencyMs:        number
  modelId:          string          // actual model used (may differ from requested if fallback)
  validation:       OutputValidationResult
  metadata:         Record<string, unknown>   // model-specific response metadata
}

type FinishReason =
  | 'COMPLETE'          // model finished normally
  | 'MAX_TOKENS'        // hit output token limit; response may be truncated
  | 'SAFETY_FILTER'     // model's own safety system filtered the response
  | 'ERROR'             // API error
  | 'TIMEOUT'           // request timeout

interface LLMStreamChunk {
  chunkId:    number
  delta:      string        // incremental text
  isLast:     boolean
  finishReason?: FinishReason
}

interface LLMOutput {
  content:    string
  modelId:    string
  contextId:  string
}
```

---

## 3. ModelCapabilities

Every adapter exposes its model's capabilities. `AIContextBuilder` and `TokenBudgetManager` use this to size the context appropriately.

```typescript
interface ModelCapabilities {
  modelId:               string
  displayName:           string           // 'Claude Sonnet 4.6', 'GPT-4o', etc.
  provider:              LLMProvider
  maxContextTokens:      number           // total context window
  maxOutputTokens:       number           // max response length
  supportsStreaming:      boolean
  supportsSystemPrompt:  boolean          // false for some older models
  supportsMultimodal:    boolean          // true = can process images / PDFs directly
  supportedLanguages:    string[]         // ['vi', 'en', ...] based on training
  preferredCitationStyle: AICitationStyle // which style the model follows best
  costPerInputToken:     number           // USD per 1M tokens
  costPerOutputToken:    number
  avgLatencyP50Ms:       number           // typical p50 latency
  avgLatencyP95Ms:       number
  isAvailable:           boolean
  supportsRetry:         boolean
  maxRetries:            number
}
```

### Known Model Capabilities (founding registry)

| Model ID | Provider | Context | Output | Stream | Multimodal |
|----------|---------|---------|--------|--------|-----------|
| `claude-sonnet-4-6` | ANTHROPIC | 200K | 8K | Yes | Yes |
| `claude-opus-4-8` | ANTHROPIC | 200K | 8K | Yes | Yes |
| `claude-haiku-4-5-20251001` | ANTHROPIC | 200K | 4K | Yes | No |
| `gpt-4o` | OPENAI | 128K | 4K | Yes | Yes |
| `gpt-4o-mini` | OPENAI | 128K | 4K | Yes | No |
| `gemini-2.0-flash` | GOOGLE | 1M | 8K | Yes | Yes |
| `gemini-2.0-pro` | GOOGLE | 2M | 8K | Yes | Yes |
| `ollama/llama3.3` | LOCAL | 128K | 4K | Yes | No |
| `ollama/qwen2.5` | LOCAL | 32K | 4K | Yes | No |

---

## 4. The 4 Adapter Implementations

### ClaudeLLMAdapter (Anthropic)

```
Model IDs: claude-sonnet-4-6, claude-opus-4-8, claude-haiku-4-5-20251001
API: Anthropic Messages API

Prompt mapping:
  AIContext.systemInstructions → system parameter (top-level)
  PromptRenderer output       → messages[{ role: 'user', content: [...] }]
  conversationHistory[]       → preceding messages in the messages[] array

Vietnamese support: excellent (multilingual training includes Vietnamese legal text)
Citation style preference: INLINE (follows inline citation in system prompt reliably)
Retry policy: exponential backoff; max 3 retries; 429/529 = retry; 4xx other = no retry

Cost tier: medium-high (Sonnet) / high (Opus) / low (Haiku)
Latency tier: medium (Sonnet, Haiku) / slow (Opus)

Recommended for: production primary, compliance-critical queries
```

### OpenAILLMAdapter (OpenAI)

```
Model IDs: gpt-4o, gpt-4o-mini
API: OpenAI Chat Completions API

Prompt mapping:
  AIContext.systemInstructions → messages[{ role: 'system', content: ... }]
  PromptRenderer output       → messages[{ role: 'user', content: ... }]
  conversationHistory[]       → interleaved messages (role: user/assistant)

Vietnamese support: good (weaker than Claude on Vietnamese legal terminology)
Citation style preference: FOOTNOTE (better at structured footnotes than inline)
Retry policy: exponential backoff; 429 = retry (respect Retry-After header); 5xx = retry

Cost tier: medium (4o-mini) / medium-high (4o)
Latency tier: fast (4o-mini) / medium (4o)

Recommended for: fallback, cost-sensitive queries, English-language outputs
```

### GeminiLLMAdapter (Google)

```
Model IDs: gemini-2.0-flash, gemini-2.0-pro
API: Google Generative Language API (Gemini API)

Prompt mapping:
  AIContext.systemInstructions → system_instruction parameter
  PromptRenderer output       → contents[{ role: 'user', parts: [...] }]
  conversationHistory[]       → interleaved contents[]
  Multimodal: PDFs/images → inline_data in parts[]

Vietnamese support: good (strong on Southeast Asian languages)
Citation style preference: ENDNOTE
Retry policy: exponential backoff; 429 = retry; 503 = retry; 4xx = no retry

Cost tier: very low (Flash) / medium (Pro)
Latency tier: very fast (Flash) / medium (Pro)

Recommended for: high-volume queries, multimodal (PDF attachment) analysis, cost optimization
```

### LocalLLMAdapter (Ollama / vLLM — air-gapped deployment)

```
Model IDs: ollama/llama3.3, ollama/qwen2.5, vllm/*
API: OpenAI-compatible local API (http://localhost:11434/v1)

Prompt mapping: same as OpenAILLMAdapter (OpenAI-compatible format)

Vietnamese support: varies by model (qwen2.5 best for Vietnamese)
Citation style preference: INLINE (simpler models follow inline better)
Retry policy: 3 retries with linear backoff (local server rarely has rate limits)

Cost tier: zero (local compute)
Latency tier: depends on hardware (GPU: fast; CPU: slow)

Recommended for: air-gapped deployments (government networks); development/testing;
                 sensitive data that must not leave the institution's network

Important: LocalLLMAdapter does NOT send any data to external APIs.
           All computation happens on the institution's own infrastructure.
           Required for classified procurement documents.
```

---

## 5. ModelCapabilityRegistry

```typescript
class ModelCapabilityRegistry {
  private readonly registry = new Map<string, ModelCapabilities>()

  register(capabilities: ModelCapabilities): void
  get(modelId: string): ModelCapabilities | null
  list(): ModelCapabilities[]
  listByProvider(provider: LLMProvider): ModelCapabilities[]
  listAvailable(): ModelCapabilities[]    // only models where isAvailable=true
}
```

Registry is populated at startup. Capabilities are static definitions. Runtime availability is checked via `ILLMAdapter.isAvailable()` which makes a lightweight API health check.

---

## 6. ModelSelector

Selects the optimal model for a given `AIContext` and requirements.

```typescript
interface ModelSelectionCriteria {
  requiredContextTokens: number         // from AIContext.totalTokenEstimate
  requiresStreaming?:    boolean
  requiresMultimodal?:  boolean         // if attachments with images/PDFs
  languagePreference?:  string          // 'vi' | 'en'
  maxCostPerCall?:      number          // USD ceiling
  maxLatencyMs?:        number          // latency ceiling
  preferredProvider?:   LLMProvider     // use this provider if capable
  requireLocalOnly?:    boolean         // air-gapped: must be LOCAL provider
  fallbackEnabled?:     boolean         // if primary fails, try next best
}

class ModelSelector {
  select(
    criteria: ModelSelectionCriteria,
    registry: ModelCapabilityRegistry
  ): ModelCapabilities

  selectWithFallback(
    criteria: ModelSelectionCriteria,
    registry: ModelCapabilityRegistry
  ): ModelCapabilities[]   // ordered: primary first, fallbacks after
}
```

**Selection algorithm:**

```
1. Filter: maxContextTokens > requiredContextTokens
2. Filter: supportsStreaming = true (if requiresStreaming)
3. Filter: supportsMultimodal = true (if requiresMultimodal)
4. Filter: provider = LOCAL (if requireLocalOnly)
5. Filter: costPerInputToken × requiredContextTokens < maxCostPerCall (if set)
6. Filter: avgLatencyP95Ms < maxLatencyMs (if set)
7. Sort remaining candidates:
     primary sort: preferredProvider match (true first)
     secondary sort: for Vietnamese: supportsVietnamese weight
     tertiary sort: avgLatencyP50Ms ASC
8. Return first (best) candidate
9. If no candidate: throw NoSuitableModelError
```

---

## 7. Retry Policy

Each adapter implements its own retry policy. The interface contract for retry:

```typescript
interface RetryPolicy {
  maxRetries:           number    // 0 = no retry; 3 = max recommended
  initialDelayMs:       number    // first retry delay
  backoffMultiplier:    number    // 2.0 = exponential doubling
  maxDelayMs:           number    // cap per retry (e.g. 30000 = 30s)
  retryableStatusCodes: number[]  // HTTP codes that trigger retry
  retryableErrors:      string[]  // error message substrings that trigger retry
  honorRetryAfter:      boolean   // respect Retry-After header from 429 responses
}

// Default policy:
const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries:           3,
  initialDelayMs:       1000,
  backoffMultiplier:    2.0,
  maxDelayMs:           30000,
  retryableStatusCodes: [429, 500, 502, 503, 504],
  retryableErrors:      ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'],
  honorRetryAfter:      true
}
```

After `maxRetries` exhausted: throw `LLMUnavailableError`. Caller (Phase X AI Advisory Layer) handles fallback to alternative model via `ModelSelector.selectWithFallback()`.
