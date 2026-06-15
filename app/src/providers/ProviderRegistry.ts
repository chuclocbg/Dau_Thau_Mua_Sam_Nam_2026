/**
 * P6-10D: ProviderRegistry and common LLM provider abstraction.
 *
 * Introduces a typed registry that manages OpenAIProvider, ClaudeProvider,
 * and GeminiProvider instances under stable well-known identifiers.
 *
 * Design principles:
 *   - ILLMProvider is a minimal structural interface; the three concrete
 *     providers satisfy it without code changes (TypeScript covariant return
 *     subtyping lets their specific Result<T> types satisfy { ok: boolean }).
 *   - ProviderEntry is the unit stored in the registry; it carries the
 *     provider instance together with stable metadata (id, type, name).
 *   - Every registry mutation returns a RegistryResult<T> — never throws.
 *   - Duplicate IDs are rejected unless overwrite:true is passed.
 *   - Unregistering the current default clears it; getDefault() subsequently
 *     returns NO_DEFAULT rather than a stale reference.
 *   - list() is always safe — it returns an empty array on an empty registry.
 *   - has() / list() never fail; all other operations return RegistryResult.
 */

import type { ModelInfo } from './OpenAIProvider';

// ─── Provider identity ────────────────────────────────────────────────────────

/** Stable well-known identifier for a registered LLM provider. */
export type ProviderId = 'openai' | 'claude' | 'gemini';

/** The underlying API vendor/family. */
export type ProviderType = 'openai' | 'anthropic' | 'google';

// ─── Common provider interface ────────────────────────────────────────────────

/**
 * Minimal structural interface that all provider adapters satisfy.
 *
 * The concrete return types (OpenAIResult<true>, ClaudeResult<true>,
 * GeminiResult<true>) are all structurally assignable to { ok: boolean }
 * — no changes to the concrete providers are required.
 */
export interface ILLMProvider {
  validateConfig(): { ok: boolean };
  getModelInfo(model?: string): ModelInfo;
}

// ─── Registry entry ───────────────────────────────────────────────────────────

/** A provider instance stored in the registry together with its metadata. */
export interface ProviderEntry {
  readonly id:       ProviderId;
  readonly type:     ProviderType;
  readonly name:     string;
  readonly provider: ILLMProvider;
}

// ─── Register options ─────────────────────────────────────────────────────────

export interface RegisterOptions {
  /** When true, an existing entry with the same id is silently replaced. */
  overwrite?: boolean;
}

// ─── Registry errors ──────────────────────────────────────────────────────────

export type RegistryErrorCode =
  | 'NOT_FOUND'     // requested id is not registered
  | 'DUPLICATE_ID'  // id already registered and overwrite not requested
  | 'NO_DEFAULT';   // getDefault() called but no default has been set

export interface RegistryError {
  code:    RegistryErrorCode;
  message: string;
}

// ─── Registry result ──────────────────────────────────────────────────────────

export type RegistryResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: RegistryError };

// ─── ProviderRegistry ─────────────────────────────────────────────────────────

export class ProviderRegistry {
  private readonly store: Map<ProviderId, ProviderEntry> = new Map();
  private defaultId?: ProviderId;

  /**
   * Registers a provider entry.
   *
   * Fails with DUPLICATE_ID if the id is already taken and overwrite is not set.
   * Returns the registered id on success.
   */
  register(entry: ProviderEntry, options?: RegisterOptions): RegistryResult<ProviderId> {
    if (!options?.overwrite && this.store.has(entry.id)) {
      return regErr(
        'DUPLICATE_ID',
        `Provider '${entry.id}' is already registered; pass overwrite:true to replace`,
      );
    }
    this.store.set(entry.id, entry);
    return { ok: true, value: entry.id };
  }

  /**
   * Removes a provider from the registry.
   *
   * If the unregistered provider was the current default, the default is
   * cleared and subsequent getDefault() calls return NO_DEFAULT.
   */
  unregister(id: ProviderId): RegistryResult<true> {
    if (!this.store.has(id)) {
      return regErr('NOT_FOUND', `Provider '${id}' is not registered`);
    }
    this.store.delete(id);
    if (this.defaultId === id) this.defaultId = undefined;
    return { ok: true, value: true };
  }

  /** Returns the entry for the given id, or NOT_FOUND. */
  get(id: ProviderId): RegistryResult<ProviderEntry> {
    const entry = this.store.get(id);
    if (!entry) {
      return regErr('NOT_FOUND', `Provider '${id}' is not registered`);
    }
    return { ok: true, value: entry };
  }

  /** Returns all registered entries.  Always succeeds (empty array when empty). */
  list(): ProviderEntry[] {
    return Array.from(this.store.values());
  }

  /** Returns true if the given id is currently registered. */
  has(id: ProviderId): boolean {
    return this.store.has(id);
  }

  /**
   * Returns the current default provider entry.
   *
   * Fails with NO_DEFAULT if setDefault() has never been called or the
   * previously-set default was subsequently unregistered.
   */
  getDefault(): RegistryResult<ProviderEntry> {
    if (this.defaultId === undefined) {
      return regErr('NO_DEFAULT', 'No default provider has been set');
    }
    const entry = this.store.get(this.defaultId);
    if (!entry) {
      // Safety net: defaultId set, but provider was removed without clearing it.
      return regErr('NOT_FOUND', `Default provider '${this.defaultId}' is no longer registered`);
    }
    return { ok: true, value: entry };
  }

  /**
   * Sets the default provider by id.
   *
   * The id must already be registered.  Returns the id on success.
   */
  setDefault(id: ProviderId): RegistryResult<ProviderId> {
    if (!this.store.has(id)) {
      return regErr(
        'NOT_FOUND',
        `Cannot set default: provider '${id}' is not registered`,
      );
    }
    this.defaultId = id;
    return { ok: true, value: id };
  }
}

// ─── Internal helper ──────────────────────────────────────────────────────────

function regErr<T>(code: RegistryErrorCode, message: string): RegistryResult<T> {
  return { ok: false, error: { code, message } };
}
