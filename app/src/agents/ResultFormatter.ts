/**
 * Legal v9.3 — ResultFormatter
 *
 * Accepts a QueryExecutor and a QueryDescriptor, calls executor.execute()
 * exactly once, and produces a FormattedResult suitable for delivery.
 *
 * Transformation applied:
 *   RegistryEntry  →  FormattedEntry
 *     Adds label: `${filename}.${extension}`  (e.g. "TO_TRINH_MUA_SAM.DOCX")
 *     All other fields forwarded unchanged.
 *
 * FormattedResult fields:
 *   entries       — FormattedEntry[] built in a single forward pass
 *   named         — FormattedEntry wrapping ExecutionResult.named, or undefined
 *   filenames     — flat string[] of entry filenames, same order as entries
 *   labels        — flat string[] of "filename.extension" strings, same order
 *   requiredCount — entries where required=true
 *   optionalCount — entries where required=false
 *   totalCount    — entries.length
 *   targetDate    — metadata.targetDate forwarded unchanged
 *   hasResults    — summary.hasResults forwarded unchanged
 *   descriptor    — echoed by reference from ExecutionResult.descriptor
 *
 * requiredCount + optionalCount === totalCount always holds; counts are
 * computed from the formatted entries, not from the global registry metadata,
 * so they reflect the filtered result set rather than the full registry.
 *
 * Single-pass construction:
 *   formatFromExecution() iterates entries once, building entries[],
 *   filenames[], labels[], requiredCount, and optionalCount in the same loop.
 *   named is formatted independently (at most one object allocation).
 *
 * formatFromExecution() is exported for direct test injection with
 * synthetic ExecutionResult objects.
 *
 * Calls executor.execute() exactly once per format() invocation.
 * Does NOT call QueryPlanner.plan() or DocumentRegistry.register() directly.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. No mutation. No cache. No I/O. No side effects.
 * No singleton. No randomness. Deterministic output per fixed input.
 * No AI. No LLM. No filesystem. No browser globals.
 * No hooks. No IndexedDB. No HTTP.
 */

import { buildExecutor }                                from './QueryExecutor';
import type { QueryExecutor }                           from './QueryExecutor';
import type { QueryDescriptor }                         from './QueryPlanner';
import type { RegistryEntry }                           from './DocumentRegistry';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface FormattedEntry {
  filename:     string;
  extension:    string;
  payload:      string;
  priority:     number;
  required:     boolean;
  registeredAt: string;
  label:        string;
}

export interface FormattedResult {
  entries:       readonly FormattedEntry[];
  named:         FormattedEntry | undefined;
  filenames:     readonly string[];
  labels:        readonly string[];
  requiredCount: number;
  optionalCount: number;
  totalCount:    number;
  targetDate:    string;
  hasResults:    boolean;
  descriptor:    QueryDescriptor;
}

// ─── Internal narrow types ────────────────────────────────────────────────────

interface MinExecutionResult {
  entries:    readonly RegistryEntry[];
  named:      RegistryEntry | undefined;
  descriptor: QueryDescriptor;
  metadata:   { targetDate: string };
  summary:    { hasResults: boolean };
}

interface MinQueryExecutor {
  execute(descriptor?: QueryDescriptor): MinExecutionResult;
}

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function formatFromExecution(result: MinExecutionResult): FormattedResult {
  const entries:   FormattedEntry[] = [];
  const filenames: string[]         = [];
  const labels:    string[]         = [];
  let requiredCount = 0;
  let optionalCount = 0;

  for (const e of result.entries) {
    const label = `${e.filename}.${e.extension}`;
    entries.push({ filename: e.filename, extension: e.extension, payload: e.payload,
                   priority: e.priority, required: e.required, registeredAt: e.registeredAt,
                   label });
    filenames.push(e.filename);
    labels.push(label);
    if (e.required) requiredCount++;
    else            optionalCount++;
  }

  const named: FormattedEntry | undefined = result.named !== undefined
    ? { filename: result.named.filename, extension: result.named.extension,
        payload:  result.named.payload,  priority:  result.named.priority,
        required: result.named.required, registeredAt: result.named.registeredAt,
        label: `${result.named.filename}.${result.named.extension}` }
    : undefined;

  return {
    entries,
    named,
    filenames,
    labels,
    requiredCount,
    optionalCount,
    totalCount:  entries.length,
    targetDate:  result.metadata.targetDate,
    hasResults:  result.summary.hasResults,
    descriptor:  result.descriptor,
  };
}

// ─── Formatter ────────────────────────────────────────────────────────────────

export class ResultFormatter {
  constructor(private readonly executor: MinQueryExecutor) {}

  format(descriptor: QueryDescriptor = {}): FormattedResult {
    return formatFromExecution(this.executor.execute(descriptor));
  }
}

// ─── Pipeline factory ─────────────────────────────────────────────────────────

export function buildFormatter(
  lastAppliedDate: string,
  currentDate:     string,
  executor:        QueryExecutor = buildExecutor(lastAppliedDate, currentDate),
): ResultFormatter {
  return new ResultFormatter(executor);
}
