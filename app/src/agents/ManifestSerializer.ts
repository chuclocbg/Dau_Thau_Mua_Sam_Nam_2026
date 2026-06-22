/**
 * Legal v9.5 — ManifestSerializer
 *
 * Accepts a DocumentManifest and a QueryDescriptor, calls dm.manifest()
 * exactly once, and produces a SerializedManifest with three text formats
 * plus convenience scalars.
 *
 * SerializedManifest fields:
 *   json         — JSON string of the full manifest (labels, counts, date, named)
 *   list         — newline-joined string of all labels in source order
 *   requiredList — newline-joined string of required labels only
 *   optionalList — newline-joined string of optional labels only
 *   targetDate   — forwarded from ManifestHeader.targetDate
 *   hasResults   — forwarded from ManifestHeader.hasResults
 *   totalCount   — forwarded from ManifestHeader.totalCount
 *
 * JSON shape (ManifestJson — the parsed object):
 *   { targetDate, hasResults, totalCount, requiredCount, optionalCount,
 *     required: string[], optional: string[], named: string | null }
 *   All entry arrays use the label ("FILENAME.EXT") representation only.
 *   named is the label of the looked-up document, or null if not requested
 *   or not found.
 *
 * List formats:
 *   list / requiredList / optionalList are each Array.join('\n').
 *   An empty section produces an empty string (not "undefined" or "null").
 *
 * serializeManifest() is exported for direct test injection with synthetic
 * MinManifestResult objects.
 *
 * Calls dm.manifest() exactly once per serialize() invocation.
 * Does NOT call ResultFormatter.format() or DocumentRegistry.register() directly.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. No mutation. No cache. No I/O. No side effects.
 * No singleton. No randomness. Deterministic output per fixed input.
 * No AI. No LLM. No filesystem. No browser globals.
 * No hooks. No IndexedDB. No HTTP.
 */

import { buildManifest }             from './DocumentManifest';
import type { DocumentManifest }     from './DocumentManifest';
import type { QueryDescriptor }      from './QueryPlanner';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ManifestJson {
  targetDate:    string;
  hasResults:    boolean;
  totalCount:    number;
  requiredCount: number;
  optionalCount: number;
  required:      readonly string[];
  optional:      readonly string[];
  named:         string | null;
}

export interface SerializedManifest {
  json:         string;
  list:         string;
  requiredList: string;
  optionalList: string;
  targetDate:   string;
  hasResults:   boolean;
  totalCount:   number;
}

// ─── Internal narrow types ────────────────────────────────────────────────────

interface MinEntry { label: string; }

interface MinManifestResult {
  header: {
    targetDate:    string;
    requiredCount: number;
    optionalCount: number;
    totalCount:    number;
    hasResults:    boolean;
  };
  required: readonly MinEntry[];
  optional: readonly MinEntry[];
  all:      readonly MinEntry[];
  named:    MinEntry | undefined;
}

interface MinDocumentManifest {
  manifest(descriptor?: QueryDescriptor): MinManifestResult;
}

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function serializeManifest(result: MinManifestResult): SerializedManifest {
  const { header, required, optional, all, named } = result;

  const jsonObj: ManifestJson = {
    targetDate:    header.targetDate,
    hasResults:    header.hasResults,
    totalCount:    header.totalCount,
    requiredCount: header.requiredCount,
    optionalCount: header.optionalCount,
    required:      required.map(e => e.label),
    optional:      optional.map(e => e.label),
    named:         named?.label ?? null,
  };

  return {
    json:         JSON.stringify(jsonObj),
    list:         all.map(e => e.label).join('\n'),
    requiredList: required.map(e => e.label).join('\n'),
    optionalList: optional.map(e => e.label).join('\n'),
    targetDate:   header.targetDate,
    hasResults:   header.hasResults,
    totalCount:   header.totalCount,
  };
}

// ─── Serializer ───────────────────────────────────────────────────────────────

export class ManifestSerializer {
  constructor(private readonly dm: MinDocumentManifest) {}

  serialize(descriptor: QueryDescriptor = {}): SerializedManifest {
    return serializeManifest(this.dm.manifest(descriptor));
  }
}

// ─── Pipeline factory ─────────────────────────────────────────────────────────

export function buildSerializer(
  lastAppliedDate: string,
  currentDate:     string,
  dm:              DocumentManifest = buildManifest(lastAppliedDate, currentDate),
): ManifestSerializer {
  return new ManifestSerializer(dm);
}
