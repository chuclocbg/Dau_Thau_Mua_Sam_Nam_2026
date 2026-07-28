/**
 * Legal v9.7 — UiIntegrationLayer
 *
 * Presentation adapter that wraps PipelineOrchestrator output into a
 * UiViewModel ready for direct binding in React components without any
 * further computation.
 *
 * Accepts a PipelineOrchestrator, calls orchestrator.run(descriptor) exactly
 * once, then adapts the SerializedManifest into UiViewModel by:
 *
 *   • Splitting text lists into string arrays (never [''] for empty sections):
 *       displayLines  — all labels as string[]
 *       requiredLines — required labels as string[]
 *       optionalLines — optional labels as string[]
 *
 *   • Pre-parsing JSON once:
 *       parsedJson — ManifestJson (avoids JSON.parse in component render)
 *
 *   • Deriving two boolean/string UI fields:
 *       isEmpty     — !hasResults  (for conditional rendering gates)
 *       statusLabel — "${n} document(s)" | "No documents"
 *
 *   • Forwarding all SerializedManifest scalars unchanged:
 *       json, list, requiredList, optionalList, targetDate, hasResults, totalCount
 *
 * Split strategy:
 *   list / requiredList / optionalList are joined with '\n' by ManifestSerializer.
 *   Splitting back: `s.length > 0 ? s.split('\n') : []` — ensures empty sections
 *   produce [], not [''], so component .map() calls produce zero elements.
 *
 * viewFromSerialized() is exported for direct test injection with synthetic
 * SerializedManifest objects.
 *
 * Calls orchestrator.run() exactly once per prepare() invocation.
 * Does NOT call ManifestSerializer.serialize() or DocumentManifest.manifest() directly.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. No mutation. No cache. No I/O. No side effects.
 * No singleton. No randomness. Deterministic output per fixed input.
 * No AI. No LLM. No filesystem. No browser globals.
 * No hooks. No IndexedDB. No HTTP.
 */

import { buildOrchestrator }                                    from './PipelineOrchestrator';
import type { PipelineOrchestrator }                            from './PipelineOrchestrator';
import type { ManifestJson }                                    from './ManifestSerializer';
import type { QueryDescriptor }                                 from './QueryPlanner';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface UiViewModel {
  // Forwarded scalars
  json:         string;
  list:         string;
  requiredList: string;
  optionalList: string;
  targetDate:   string;
  hasResults:   boolean;
  totalCount:   number;
  // Derived for UI binding
  isEmpty:       boolean;
  displayLines:  readonly string[];
  requiredLines: readonly string[];
  optionalLines: readonly string[];
  parsedJson:    ManifestJson;
  statusLabel:   string;
}

// ─── Internal narrow types ────────────────────────────────────────────────────

interface MinSerializedManifest {
  json:         string;
  list:         string;
  requiredList: string;
  optionalList: string;
  targetDate:   string;
  hasResults:   boolean;
  totalCount:   number;
}

interface MinPipelineOrchestrator {
  run(descriptor?: QueryDescriptor): MinSerializedManifest;
}

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function viewFromSerialized(result: MinSerializedManifest): UiViewModel {
  return {
    json:         result.json,
    list:         result.list,
    requiredList: result.requiredList,
    optionalList: result.optionalList,
    targetDate:   result.targetDate,
    hasResults:   result.hasResults,
    totalCount:   result.totalCount,
    isEmpty:      !result.hasResults,
    displayLines:  result.list.length         > 0 ? result.list.split('\n')         : [],
    requiredLines: result.requiredList.length > 0 ? result.requiredList.split('\n') : [],
    optionalLines: result.optionalList.length > 0 ? result.optionalList.split('\n') : [],
    parsedJson:   JSON.parse(result.json) as ManifestJson,
    statusLabel:  result.hasResults
      ? `${result.totalCount} document${result.totalCount !== 1 ? 's' : ''}`
      : 'No documents',
  };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class UiIntegrationLayer {
  constructor(private readonly orchestrator: MinPipelineOrchestrator) {}

  prepare(descriptor: QueryDescriptor = {}): UiViewModel {
    return viewFromSerialized(this.orchestrator.run(descriptor));
  }
}

// ─── Pipeline factory ─────────────────────────────────────────────────────────

export function buildUiLayer(
  lastAppliedDate: string,
  currentDate:     string,
  orchestrator:    PipelineOrchestrator = buildOrchestrator(lastAppliedDate, currentDate),
): UiIntegrationLayer {
  return new UiIntegrationLayer(orchestrator);
}
