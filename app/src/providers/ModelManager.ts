/**
 * P6-10K: ModelManager — model metadata registry and best-model selection.
 *
 * Tracks ModelMetadata across all providers, supports querying by capability
 * or provider, and runs a deterministic best-model algorithm:
 *   1. Filter by requiredCapabilities (all must match).
 *   2. Filter by maxTokensNeeded (model.maxTokens >= needed).
 *   3. Prefer models from preferredProvider (fall back if none match).
 *   4. Among remaining candidates, pick the highest maxTokens.
 *
 * All public methods are synchronous.  Never throws.
 * Defensive copies: every read returns independent copies; registry state
 * cannot be mutated from outside.
 */

// ─── ModelCapability ──────────────────────────────────────────────────────────

export type ModelCapability =
  | 'chat'
  | 'streaming'
  | 'vision'
  | 'reasoning'
  | 'toolCalling'
  | 'longContext';

// ─── ModelMetadata ────────────────────────────────────────────────────────────

export interface ModelMetadata {
  /** The provider that hosts this model (e.g. 'openai', 'claude', 'gemini'). */
  providerId:   string;
  /** The model identifier used in API calls (e.g. 'gpt-4o'). */
  model:        string;
  /** Human-readable label. */
  displayName:  string;
  /** Maximum context window in tokens. */
  maxTokens:    number;
  /** Capabilities this model supports. */
  capabilities: ModelCapability[];
}

// ─── Selection options ────────────────────────────────────────────────────────

export interface ModelSelectionOptions {
  /** All listed capabilities must be present on the selected model. */
  requiredCapabilities?: ModelCapability[];
  /** Provider to prefer; falls back to best available if no match found. */
  preferredProvider?:    string;
  /** Minimum context window required; models with fewer tokens are excluded. */
  maxTokensNeeded?:      number;
}

// ─── Selection result ─────────────────────────────────────────────────────────

export type ModelSelectionResult =
  | {
      ok:         true;
      model:      ModelMetadata;
      providerId: string;
      /** Human-readable explanation of why this model was chosen. */
      reason:     string;
    }
  | {
      ok:    false;
      error: { code: string; message: string; };
    };

// ─── ModelManager ─────────────────────────────────────────────────────────────

export class ModelManager {
  private readonly registry: Map<string, ModelMetadata> = new Map();

  /**
   * Registers (or overwrites) a model.  Stores a defensive copy so callers
   * cannot mutate registry state through the original object.
   */
  registerModel(metadata: ModelMetadata): void {
    this.registry.set(
      key(metadata.providerId, metadata.model),
      clone(metadata),
    );
  }

  /**
   * Removes a model from the registry.
   * Returns true when a model was found and removed, false when not found.
   */
  removeModel(providerId: string, model: string): boolean {
    return this.registry.delete(key(providerId, model));
  }

  /**
   * Returns metadata for a specific model, or undefined when not registered.
   * Returns a defensive copy.
   */
  getModel(providerId: string, model: string): ModelMetadata | undefined {
    const m = this.registry.get(key(providerId, model));
    return m ? clone(m) : undefined;
  }

  /** Returns defensive copies of all registered models in insertion order. */
  listModels(): ModelMetadata[] {
    return Array.from(this.registry.values()).map(clone);
  }

  /** Returns all models that include the given capability. */
  findByCapability(capability: ModelCapability): ModelMetadata[] {
    return Array.from(this.registry.values())
      .filter(m => m.capabilities.includes(capability))
      .map(clone);
  }

  /** Returns all models registered under the given provider id. */
  findByProvider(providerId: string): ModelMetadata[] {
    return Array.from(this.registry.values())
      .filter(m => m.providerId === providerId)
      .map(clone);
  }

  /**
   * Selects the best available model according to the supplied options.
   *
   * Selection algorithm:
   *   1. Filter by requiredCapabilities (all must match).
   *   2. Filter by maxTokensNeeded (model.maxTokens >= needed).
   *   3. Prefer models whose providerId === preferredProvider; if none match,
   *      fall back to all remaining candidates.
   *   4. Among the final candidates, pick the one with the highest maxTokens.
   *
   * Returns ok:false (never throws) when no candidates survive filtering.
   */
  selectBestModel(options: ModelSelectionOptions = {}): ModelSelectionResult {
    let candidates = Array.from(this.registry.values());

    if (candidates.length === 0) {
      return {
        ok:    false,
        error: { code: 'NO_MODELS', message: 'No models registered' },
      };
    }

    const reasons: string[] = [];

    // ── 1. capability filter ─────────────────────────────────────────────────
    const reqCaps = options.requiredCapabilities;
    if (reqCaps && reqCaps.length > 0) {
      candidates = candidates.filter(m =>
        reqCaps.every(cap => m.capabilities.includes(cap)),
      );
      if (candidates.length === 0) {
        return {
          ok:    false,
          error: {
            code:    'NO_MATCHING_MODEL',
            message: `No model supports all required capabilities: ${reqCaps.join(', ')}`,
          },
        };
      }
      reasons.push(`required capabilities: ${reqCaps.join(', ')}`);
    }

    // ── 2. context size filter ───────────────────────────────────────────────
    if (options.maxTokensNeeded !== undefined) {
      const needed = options.maxTokensNeeded;
      candidates = candidates.filter(m => m.maxTokens >= needed);
      if (candidates.length === 0) {
        return {
          ok:    false,
          error: {
            code:    'NO_MATCHING_MODEL',
            message: `No model supports ${needed.toLocaleString()} tokens`,
          },
        };
      }
      reasons.push(`needs ≥${needed.toLocaleString()} tokens`);
    }

    // ── 3. preferred provider ────────────────────────────────────────────────
    let pool = candidates;

    if (options.preferredProvider) {
      const pref = candidates.filter(m => m.providerId === options.preferredProvider);
      if (pref.length > 0) {
        pool = pref;
        reasons.push(`preferred provider '${options.preferredProvider}'`);
      } else {
        reasons.push(
          `preferred provider '${options.preferredProvider}' had no matching models — using best available`,
        );
      }
    }

    // ── 4. pick highest maxTokens ────────────────────────────────────────────
    const selected = pool.reduce((best, m) => (m.maxTokens > best.maxTokens ? m : best));

    if (!options.preferredProvider && reasons.length === 0) {
      reasons.push('highest context window');
    } else if (!options.preferredProvider) {
      reasons.push('highest context window');
    }

    return {
      ok:         true,
      model:      clone(selected),
      providerId: selected.providerId,
      reason:     reasons.join('; '),
    };
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function key(providerId: string, model: string): string {
  return `${providerId}:${model}`;
}

function clone(m: ModelMetadata): ModelMetadata {
  return { ...m, capabilities: [...m.capabilities] };
}
