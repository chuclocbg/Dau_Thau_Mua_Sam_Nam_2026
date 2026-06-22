/**
 * Legal v9.1 — QueryPlanner
 *
 * Accepts a SearchEngine and a QueryDescriptor and executes the optimal
 * sequence of engine lookups to produce a QueryResult.
 *
 * QueryDescriptor fields:
 *   scope?:       'required' | 'optional' | 'all'
 *     Which bucket to start from.  Defaults to 'all' when omitted.
 *     Maps directly to engine.findRequired / findOptional / listAll.
 *
 *   maxPriority?: number
 *     If set, retains only entries where entry.priority <= maxPriority.
 *     Lower priority number = higher importance (1=CRITICAL, 4=optional).
 *     Applied after the scope selection.
 *
 *   filename?: string
 *     If set, performs an independent engine.findByFilename() lookup and
 *     places the result in QueryResult.named.
 *     Named lookup is independent of scope — it can return an entry that
 *     the scope filter excludes from .entries.
 *
 * Dispatch rules (no logic is duplicated from SearchEngine):
 *   scope='required'  →  engine.findRequired()
 *   scope='optional'  →  engine.findOptional()
 *   scope='all'|undef →  engine.listAll()
 *   filename set      →  engine.findByFilename(filename) → .named
 *
 * Reference policy:
 *   When maxPriority is NOT set, .entries is the direct reference returned
 *   by the engine method — no allocation.
 *   When maxPriority IS set, .entries is a new filtered array whose elements
 *   are shared references to RegistryEntry objects.
 *   .metadata and .named are always direct references from the engine.
 *   .descriptor is the exact object passed in — not copied.
 *
 * buildPlanner(lastAppliedDate, currentDate, engine?) factory creates a
 * QueryPlanner wired to a freshly built SearchEngine.
 *
 * Does NOT call DocumentRegistry.register() inside plan().
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. No mutation. No cache. No I/O. No side effects.
 * No singleton. No randomness. Deterministic output per fixed input.
 * No AI. No LLM. No filesystem. No browser globals.
 * No hooks. No IndexedDB. No HTTP.
 */

import { buildEngine }                            from './SearchEngine';
import type { SearchEngine }                       from './SearchEngine';
import type { RegistryEntry, RegistryMetadata }    from './DocumentRegistry';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface QueryDescriptor {
  scope?:       'required' | 'optional' | 'all';
  maxPriority?: number;
  filename?:    string;
}

export interface QueryResult {
  entries:    readonly RegistryEntry[];
  named:      RegistryEntry | undefined;
  descriptor: QueryDescriptor;
  metadata:   RegistryMetadata;
}

// ─── Internal narrow type ─────────────────────────────────────────────────────

interface MinSearchEngine {
  findByFilename(filename: string):    RegistryEntry | undefined;
  findRequired():                      readonly RegistryEntry[];
  findOptional():                      readonly RegistryEntry[];
  listAll():                           readonly RegistryEntry[];
  getMetadata():                       RegistryMetadata;
}

// ─── Planner ──────────────────────────────────────────────────────────────────

export class QueryPlanner {
  constructor(private readonly engine: MinSearchEngine) {}

  plan(descriptor: QueryDescriptor = {}): QueryResult {
    // Select base set from scope — one engine call, no filtering yet.
    const scope = descriptor.scope ?? 'all';
    const base: readonly RegistryEntry[] =
      scope === 'required' ? this.engine.findRequired()
      : scope === 'optional' ? this.engine.findOptional()
      : this.engine.listAll();

    // Apply maxPriority; when absent, return the engine reference directly.
    const entries: readonly RegistryEntry[] =
      descriptor.maxPriority !== undefined
        ? base.filter(e => e.priority <= descriptor.maxPriority!)
        : base;

    const named: RegistryEntry | undefined =
      descriptor.filename !== undefined
        ? this.engine.findByFilename(descriptor.filename)
        : undefined;

    return {
      entries,
      named,
      descriptor,
      metadata: this.engine.getMetadata(),
    };
  }
}

// ─── Pipeline factory ─────────────────────────────────────────────────────────

export function buildPlanner(
  lastAppliedDate: string,
  currentDate:     string,
  engine:          SearchEngine = buildEngine(lastAppliedDate, currentDate),
): QueryPlanner {
  return new QueryPlanner(engine);
}
