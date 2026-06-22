/**
 * Legal v8.8 — RegistrySearcher
 *
 * Provides five query operations over a RegistryResult produced by
 * DocumentRegistry without rebuilding the index or copying data.
 *
 * Query methods:
 *   findByFilename(filename) → RegistryEntry | undefined
 *     O(1) via index — direct property access, returns reference or undefined.
 *
 *   findRequired()           → readonly RegistryEntry[]
 *     Returns requiredEntries reference directly — no filter, no copy.
 *
 *   findOptional()           → readonly RegistryEntry[]
 *     Returns optionalEntries reference directly — no filter, no copy.
 *
 *   findByPriority(priority) → readonly RegistryEntry[]
 *     Filters entries by priority — new array per call, entries are references.
 *
 *   listAll()                → readonly RegistryEntry[]
 *     Returns entries reference directly — no copy.
 *
 *   getMetadata()            → RegistryMetadata
 *     Returns metadata reference directly — no copy.
 *
 * Reference policy:
 *   findRequired, findOptional, listAll, getMetadata return the exact same
 *   object references that exist on the underlying RegistryResult.
 *   findByFilename returns a direct reference to the RegistryEntry in the index.
 *   findByPriority must filter — returns a new array whose elements are
 *   references to the existing RegistryEntry objects.
 *
 * buildSearcher(lastAppliedDate, currentDate, registry?) factory function
 * creates a RegistrySearcher from a date range by calling
 * registry.register() exactly once.  Exported for pipeline integration
 * and spy testing.
 *
 * Does NOT call DocumentRegistry.register() inside any query method.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. No mutation. No cache. No I/O. No side effects.
 * No singleton. No randomness. Deterministic output per fixed input.
 * No AI. No LLM. No filesystem. No browser globals.
 * No hooks. No IndexedDB. No HTTP.
 */

import { DocumentRegistry }                    from './DocumentRegistry';
import type { RegistryEntry, RegistryMetadata } from './DocumentRegistry';

// ─── Internal narrow type ─────────────────────────────────────────────────────

// Only the fields RegistrySearcher actually reads — makes synthetic test
// data easy to construct without satisfying the full RegistryResult shape.
interface MinRegistryResult {
  entries:         readonly RegistryEntry[];
  requiredEntries: readonly RegistryEntry[];
  optionalEntries: readonly RegistryEntry[];
  index:           Readonly<Record<string, RegistryEntry>>;
  metadata:        RegistryMetadata;
}

// ─── Searcher ─────────────────────────────────────────────────────────────────

export class RegistrySearcher {
  constructor(private readonly result: MinRegistryResult) {}

  /** O(1) index lookup. Returns undefined when filename is not registered. */
  findByFilename(filename: string): RegistryEntry | undefined {
    return this.result.index[filename];
  }

  /** Reference to requiredEntries — no copy, no filter. */
  findRequired(): readonly RegistryEntry[] {
    return this.result.requiredEntries;
  }

  /** Reference to optionalEntries — no copy, no filter. */
  findOptional(): readonly RegistryEntry[] {
    return this.result.optionalEntries;
  }

  /** Filtered slice of entries. Returns empty array for unknown priority. */
  findByPriority(priority: number): readonly RegistryEntry[] {
    return this.result.entries.filter(e => e.priority === priority);
  }

  /** Reference to entries — no copy. Ordering: requiredEntries then optionalEntries. */
  listAll(): readonly RegistryEntry[] {
    return this.result.entries;
  }

  /** Reference to metadata — no copy. */
  getMetadata(): RegistryMetadata {
    return this.result.metadata;
  }
}

// ─── Pipeline factory ─────────────────────────────────────────────────────────

export function buildSearcher(
  lastAppliedDate: string,
  currentDate:     string,
  registry:        DocumentRegistry = new DocumentRegistry(),
): RegistrySearcher {
  return new RegistrySearcher(registry.register(lastAppliedDate, currentDate));
}
