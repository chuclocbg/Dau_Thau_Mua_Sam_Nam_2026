/**
 * Legal v9.2 — QueryExecutor
 *
 * Accepts a QueryPlanner and a QueryDescriptor, executes plan() exactly once,
 * and returns an ExecutionResult that carries the full QueryResult plus a
 * QuerySummary of derived convenience fields.
 *
 * QuerySummary fields:
 *   entryCount:  number   — result.entries.length
 *   namedFound:  boolean  — result.named !== undefined
 *   hasResults:  boolean  — result.entries.length > 0
 *
 * ExecutionResult is flat: every QueryResult field forwarded directly
 * (same references) plus summary.  No data is transformed or copied.
 *
 * Reference policy:
 *   entries    — same reference as QueryResult.entries
 *   named      — same reference as QueryResult.named
 *   descriptor — same reference as QueryResult.descriptor (echoed from input)
 *   metadata   — same reference as QueryResult.metadata
 *   summary    — new plain object; its numeric/boolean fields are computed
 *                from the above references once and are stable for that call.
 *
 * buildExecutor(lastAppliedDate, currentDate, planner?) factory creates a
 * QueryExecutor wired to a freshly built QueryPlanner.
 *
 * Calls planner.plan() exactly once per execute() invocation.
 * Does NOT call DocumentRegistry.register() inside execute().
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. No mutation. No cache. No I/O. No side effects.
 * No singleton. No randomness. Deterministic output per fixed input.
 * No AI. No LLM. No filesystem. No browser globals.
 * No hooks. No IndexedDB. No HTTP.
 */

import { buildPlanner }                         from './QueryPlanner';
import type { QueryPlanner, QueryDescriptor, QueryResult } from './QueryPlanner';
import type { RegistryEntry, RegistryMetadata }  from './DocumentRegistry';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface QuerySummary {
  entryCount:  number;
  namedFound:  boolean;
  hasResults:  boolean;
}

export interface ExecutionResult {
  entries:    readonly RegistryEntry[];
  named:      RegistryEntry | undefined;
  descriptor: QueryDescriptor;
  metadata:   RegistryMetadata;
  summary:    QuerySummary;
}

// ─── Internal narrow type ─────────────────────────────────────────────────────

interface MinQueryPlanner {
  plan(descriptor?: QueryDescriptor): QueryResult;
}

// ─── Executor ─────────────────────────────────────────────────────────────────

export class QueryExecutor {
  constructor(private readonly planner: MinQueryPlanner) {}

  execute(descriptor: QueryDescriptor = {}): ExecutionResult {
    const result = this.planner.plan(descriptor);
    return {
      entries:    result.entries,
      named:      result.named,
      descriptor: result.descriptor,
      metadata:   result.metadata,
      summary: {
        entryCount: result.entries.length,
        namedFound: result.named !== undefined,
        hasResults: result.entries.length > 0,
      },
    };
  }
}

// ─── Pipeline factory ─────────────────────────────────────────────────────────

export function buildExecutor(
  lastAppliedDate: string,
  currentDate:     string,
  planner:         QueryPlanner = buildPlanner(lastAppliedDate, currentDate),
): QueryExecutor {
  return new QueryExecutor(planner);
}
