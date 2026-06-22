/**
 * Legal v8.9 — SearchIndexBuilder
 *
 * Consumes a RegistryResult and builds secondary indexes in a single pass
 * to eliminate repeated filtering across query operations.
 *
 * Secondary indexes produced:
 *   priorityIndex:  Record<number, readonly RegistryEntry[]>
 *     One array per distinct priority value, built by a single forward pass
 *     over entries.  Arrays are new, but every element is a direct reference
 *     to the RegistryEntry object that already exists in the result.
 *
 *   requiredIndex:  readonly RegistryEntry[]
 *     Direct reference to result.requiredEntries — no allocation, no copy.
 *
 *   optionalIndex:  readonly RegistryEntry[]
 *     Direct reference to result.optionalEntries — no allocation, no copy.
 *
 * Reference policy:
 *   priorityIndex bucket arrays are new arrays whose elements are shared
 *   references.  requiredIndex and optionalIndex are the same array objects
 *   that exist on the input RegistryResult.  metadata is forwarded as-is.
 *
 * Single-pass guarantee:
 *   buildIndexFromRegistry() iterates result.entries exactly once.
 *   No second pass, no re-sorting, no copying of RegistryEntry objects.
 *
 * For PENDING_APPROVAL, UNCHANGED, or NONE scope (empty entries):
 *   priorityIndex = {}, requiredIndex = [], optionalIndex = []
 *   Natural result of empty input from v8.7.
 *
 * status, impactScope, and impactLevel are forwarded unchanged from input.
 *
 * buildIndexFromRegistry() is exported so tests can inject synthetic
 * RegistryResult objects for all index/bucket scenarios.
 *
 * Calls DocumentRegistry.register() exactly once per build() invocation.
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
import type { ImpactScope, ImpactLevel }        from './ImpactAnalyzer';
import type { SnapshotStatus }                  from './SnapshotBuilder';

// ─── Internal narrow type ─────────────────────────────────────────────────────

// Only the fields SearchIndexBuilder reads — no `index` needed.
interface MinRegistryResult {
  status:          SnapshotStatus;
  impactScope:     ImpactScope;
  impactLevel:     ImpactLevel;
  entries:         readonly RegistryEntry[];
  requiredEntries: readonly RegistryEntry[];
  optionalEntries: readonly RegistryEntry[];
  metadata:        RegistryMetadata;
}

// ─── Public output type ───────────────────────────────────────────────────────

export interface SearchIndex {
  status:        SnapshotStatus;
  impactScope:   ImpactScope;
  impactLevel:   ImpactLevel;
  priorityIndex: Readonly<Record<number, readonly RegistryEntry[]>>;
  requiredIndex: readonly RegistryEntry[];
  optionalIndex: readonly RegistryEntry[];
  metadata:      RegistryMetadata;
}

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function buildIndexFromRegistry(result: MinRegistryResult): SearchIndex {
  const { status, impactScope, impactLevel, metadata } = result;

  // Single pass over entries — group by priority, preserve source order within each bucket.
  const priorityBuckets: Record<number, RegistryEntry[]> = {};
  for (const entry of result.entries) {
    if (!priorityBuckets[entry.priority]) {
      priorityBuckets[entry.priority] = [];
    }
    priorityBuckets[entry.priority].push(entry);  // element is a reference, not a copy
  }

  return {
    status,
    impactScope,
    impactLevel,
    priorityIndex: priorityBuckets,
    requiredIndex: result.requiredEntries,   // direct reference — no allocation
    optionalIndex: result.optionalEntries,   // direct reference — no allocation
    metadata,
  };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class SearchIndexBuilder {
  constructor(
    private readonly registry: DocumentRegistry = new DocumentRegistry(),
  ) {}

  build(lastAppliedDate: string, currentDate: string): SearchIndex {
    return buildIndexFromRegistry(this.registry.register(lastAppliedDate, currentDate));
  }
}
