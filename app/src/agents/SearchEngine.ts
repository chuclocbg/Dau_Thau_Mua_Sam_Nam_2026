/**
 * Legal v9.0 — SearchEngine
 *
 * Composes RegistrySearcher (v8.8) and SearchIndexBuilder (v8.9) into a
 * unified query surface.  Delegates every method to the appropriate layer;
 * no logic is duplicated from either layer.
 *
 * Delegation rules:
 *   findByFilename  → RegistrySearcher  (O(1) via filename index)
 *   findByPriority  → SearchIndex       (O(1) via priorityIndex bucket)
 *   findRequired    → SearchIndex       (requiredIndex reference)
 *   findOptional    → SearchIndex       (optionalIndex reference)
 *   listAll         → RegistrySearcher  (entries reference)
 *   getMetadata     → RegistrySearcher  (metadata reference)
 *
 * Both inner layers are constructed once from the same RegistryResult so
 * they share the same underlying RegistryEntry object graph.  No data is
 * duplicated, filtered, or copied by SearchEngine itself.
 *
 * buildEngine(lastAppliedDate, currentDate, registry?) factory calls
 * registry.register() exactly once and wires the result into SearchEngine.
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

import { RegistrySearcher }                    from './RegistrySearcher';
import { buildIndexFromRegistry }              from './SearchIndexBuilder';
import { DocumentRegistry }                    from './DocumentRegistry';
import type { RegistryEntry, RegistryMetadata } from './DocumentRegistry';
import type { ImpactScope, ImpactLevel }        from './ImpactAnalyzer';
import type { SnapshotStatus }                  from './SnapshotBuilder';

// ─── Internal narrow type ─────────────────────────────────────────────────────

// Union of what RegistrySearcher and buildIndexFromRegistry each need.
interface MinRegistryResult {
  status:          SnapshotStatus;
  impactScope:     ImpactScope;
  impactLevel:     ImpactLevel;
  entries:         readonly RegistryEntry[];
  requiredEntries: readonly RegistryEntry[];
  optionalEntries: readonly RegistryEntry[];
  index:           Readonly<Record<string, RegistryEntry>>;
  metadata:        RegistryMetadata;
}

// ─── Facade ───────────────────────────────────────────────────────────────────

export class SearchEngine {
  private readonly searcher:     RegistrySearcher;
  private readonly searchIndex:  ReturnType<typeof buildIndexFromRegistry>;

  constructor(result: MinRegistryResult) {
    this.searcher    = new RegistrySearcher(result);
    this.searchIndex = buildIndexFromRegistry(result);
  }

  /** O(1) via filename index in RegistrySearcher. */
  findByFilename(filename: string): RegistryEntry | undefined {
    return this.searcher.findByFilename(filename);
  }

  /** O(1) via priorityIndex bucket in SearchIndex. Returns [] for unknown priority. */
  findByPriority(priority: number): readonly RegistryEntry[] {
    return this.searchIndex.priorityIndex[priority] ?? [];
  }

  /** Reference to requiredIndex from SearchIndex — no copy. */
  findRequired(): readonly RegistryEntry[] {
    return this.searchIndex.requiredIndex;
  }

  /** Reference to optionalIndex from SearchIndex — no copy. */
  findOptional(): readonly RegistryEntry[] {
    return this.searchIndex.optionalIndex;
  }

  /** Reference to entries from RegistrySearcher — no copy. */
  listAll(): readonly RegistryEntry[] {
    return this.searcher.listAll();
  }

  /** Reference to metadata from RegistrySearcher — no copy. */
  getMetadata(): RegistryMetadata {
    return this.searcher.getMetadata();
  }
}

// ─── Pipeline factory ─────────────────────────────────────────────────────────

export function buildEngine(
  lastAppliedDate: string,
  currentDate:     string,
  registry:        DocumentRegistry = new DocumentRegistry(),
): SearchEngine {
  return new SearchEngine(registry.register(lastAppliedDate, currentDate));
}
