import { MODEL_REGISTRY } from './modelCapabilityRegistry.ts'
import type { AIModelCapability, AIModelInfo } from './modelCapabilityRegistry.ts'

// ── ModelSelector — deterministic, provider-agnostic model selection ──────────
// Per this milestone's mandatory requirement 6: must not know Anthropic-specific
// API details. Operates purely on AIModelInfo data (capabilities, token limits,
// provider label) — the fact that today's registry happens to hold only Claude
// entries is a registry-content fact, not something this selection algorithm
// depends on. The algorithm works identically against any provider's entries
// (verified in model-selector.test.ts against a synthetic non-Claude registry).

export interface ModelSelectionCriteria {
  readonly requiredCapabilities?: readonly AIModelCapability[]
  readonly minContextTokens?: number
  readonly preferredProviderId?: string
}

export function selectModel(
  criteria: ModelSelectionCriteria, registry: readonly AIModelInfo[] = MODEL_REGISTRY,
): AIModelInfo | null {
  const requiredCapabilities = criteria.requiredCapabilities ?? []
  const minContextTokens = criteria.minContextTokens ?? 0

  const eligible = registry.filter(model =>
    requiredCapabilities.every(cap => model.capabilities.includes(cap))
    && model.maxContextTokens >= minContextTokens,
  )
  if (eligible.length === 0) return null

  const preferred = criteria.preferredProviderId
    ? eligible.filter(m => m.providerId === criteria.preferredProviderId)
    : []
  const candidates = preferred.length > 0 ? preferred : eligible

  return candidates.reduce((best, model) =>
    model.maxContextTokens > best.maxContextTokens ? model : best,
  )
}
