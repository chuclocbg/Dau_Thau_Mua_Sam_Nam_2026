/**
 * Legal v9.4 — DocumentManifest
 *
 * Accepts a ResultFormatter and a QueryDescriptor, calls formatter.format()
 * exactly once, and produces a ManifestResult that groups FormattedEntries
 * into a delivery-ready structure with a header block and named sections.
 *
 * ManifestHeader fields:
 *   targetDate    — forwarded from FormattedResult.targetDate
 *   requiredCount — forwarded from FormattedResult.requiredCount
 *   optionalCount — forwarded from FormattedResult.optionalCount
 *   totalCount    — forwarded from FormattedResult.totalCount
 *   hasResults    — forwarded from FormattedResult.hasResults
 *   descriptor    — forwarded from FormattedResult.descriptor (by reference)
 *
 * ManifestResult sections:
 *   header    — ManifestHeader (see above)
 *   required  — FormattedEntry[] for entries where required=true
 *   optional  — FormattedEntry[] for entries where required=false
 *   all       — direct reference to FormattedResult.entries (no copy)
 *   named     — direct reference to FormattedResult.named
 *
 * Splitting strategy:
 *   FormattedResult.entries is ordered [...required, ...optional], established
 *   by DocumentRegistry and preserved through every layer.  required and
 *   optional are produced via slice(0, requiredCount) and slice(requiredCount)
 *   — no element comparison, O(n) copy of indices only.
 *   Elements (FormattedEntry objects) are shared references, not copies.
 *
 * all is the same array object as FormattedResult.entries — no allocation.
 * named is the same object reference as FormattedResult.named.
 * header.descriptor is the same object reference as FormattedResult.descriptor.
 *
 * manifestFromFormatted() is exported for direct test injection with
 * synthetic FormattedResult objects.
 *
 * Calls formatter.format() exactly once per manifest() invocation.
 * Does NOT call QueryExecutor.execute() or DocumentRegistry.register() directly.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. No mutation. No cache. No I/O. No side effects.
 * No singleton. No randomness. Deterministic output per fixed input.
 * No AI. No LLM. No filesystem. No browser globals.
 * No hooks. No IndexedDB. No HTTP.
 */

import { buildFormatter }                               from './ResultFormatter';
import type { ResultFormatter, FormattedEntry, FormattedResult } from './ResultFormatter';
import type { QueryDescriptor }                         from './QueryPlanner';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ManifestHeader {
  targetDate:    string;
  requiredCount: number;
  optionalCount: number;
  totalCount:    number;
  hasResults:    boolean;
  descriptor:    QueryDescriptor;
}

export interface ManifestResult {
  header:   ManifestHeader;
  required: readonly FormattedEntry[];
  optional: readonly FormattedEntry[];
  all:      readonly FormattedEntry[];
  named:    FormattedEntry | undefined;
}

// ─── Internal narrow types ────────────────────────────────────────────────────

interface MinFormattedResult {
  entries:       readonly FormattedEntry[];
  named:         FormattedEntry | undefined;
  requiredCount: number;
  optionalCount: number;
  totalCount:    number;
  targetDate:    string;
  hasResults:    boolean;
  descriptor:    QueryDescriptor;
}

interface MinResultFormatter {
  format(descriptor?: QueryDescriptor): MinFormattedResult;
}

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function manifestFromFormatted(result: MinFormattedResult): ManifestResult {
  return {
    header: {
      targetDate:    result.targetDate,
      requiredCount: result.requiredCount,
      optionalCount: result.optionalCount,
      totalCount:    result.totalCount,
      hasResults:    result.hasResults,
      descriptor:    result.descriptor,
    },
    // entries is ordered [...required, ...optional]; slice splits without comparison
    required: result.entries.slice(0, result.requiredCount),
    optional: result.entries.slice(result.requiredCount),
    all:      result.entries,
    named:    result.named,
  };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class DocumentManifest {
  constructor(private readonly formatter: MinResultFormatter) {}

  manifest(descriptor: QueryDescriptor = {}): ManifestResult {
    return manifestFromFormatted(this.formatter.format(descriptor));
  }
}

// ─── Pipeline factory ─────────────────────────────────────────────────────────

export function buildManifest(
  lastAppliedDate: string,
  currentDate:     string,
  formatter:       ResultFormatter = buildFormatter(lastAppliedDate, currentDate),
): DocumentManifest {
  return new DocumentManifest(formatter);
}
