// ── ModelCapabilityRegistry — static model metadata ────────────────────────────
// Per this milestone's mandatory requirement 6: provider-agnostic. Pure data — no
// Anthropic SDK types, no HTTP, no request/response shapes. providerId is a plain
// string label (open-string convention, mirroring the Knowledge Platform's
// "domain is an open string" rule), not an Anthropic-specific type.
//
// NAMING NOTE: `ModelInfo` and `ModelCapability` already exist, unrelated, in
// src/providers/{OpenAIProvider,ModelManager}.ts (the pre-existing "P6" track) —
// prefixed `AI...` here per the same grep-first collision rule used throughout
// Phase X.2.

export type AIModelCapability = 'chat' | 'vision' | 'longContext' | 'legalReasoning'

export interface AIModelInfo {
  readonly modelId: string
  readonly providerId: string
  readonly displayName: string
  readonly maxContextTokens: number
  readonly capabilities: readonly AIModelCapability[]
}

export const MODEL_REGISTRY: readonly AIModelInfo[] = Object.freeze([
  {
    modelId: 'claude-haiku-3-5-latest', providerId: 'anthropic', displayName: 'Claude Haiku 3.5',
    maxContextTokens: 200_000, capabilities: Object.freeze(['chat', 'longContext']),
  },
  {
    modelId: 'claude-sonnet-4-20250514', providerId: 'anthropic', displayName: 'Claude Sonnet 4',
    maxContextTokens: 200_000, capabilities: Object.freeze(['chat', 'vision', 'longContext', 'legalReasoning']),
  },
  {
    modelId: 'claude-opus-4-20250514', providerId: 'anthropic', displayName: 'Claude Opus 4',
    maxContextTokens: 200_000, capabilities: Object.freeze(['chat', 'vision', 'longContext', 'legalReasoning']),
  },
] satisfies AIModelInfo[])

export function findModelById(
  modelId: string, registry: readonly AIModelInfo[] = MODEL_REGISTRY,
): AIModelInfo | undefined {
  return registry.find(m => m.modelId === modelId)
}

export function findModelsByCapability(
  capability: AIModelCapability, registry: readonly AIModelInfo[] = MODEL_REGISTRY,
): readonly AIModelInfo[] {
  return registry.filter(m => m.capabilities.includes(capability))
}
