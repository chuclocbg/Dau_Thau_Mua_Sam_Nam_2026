/**
 * Legal v9.6 — PipelineOrchestrator
 *
 * Single public entry point for the full procurement document pipeline:
 *   DocumentDependencyResolver → ... → ManifestSerializer → SerializedManifest
 *
 * Two usage patterns:
 *
 *   1. One-shot function (no DI needed):
 *        runPipeline(lastAppliedDate, currentDate, descriptor?)
 *        → SerializedManifest
 *
 *   2. Injectable class (for testing or wiring):
 *        buildOrchestrator(lastAppliedDate, currentDate, serializer?)
 *        → PipelineOrchestrator
 *        orchestrator.run(descriptor?)
 *        → SerializedManifest
 *
 * PipelineOrchestrator holds a MinManifestSerializer and delegates run()
 * to serializer.serialize().  It adds no data transformation; it is a
 * named public boundary, not a processing layer.
 *
 * buildOrchestrator(last, cur, serializer?) and runPipeline(last, cur,
 * descriptor?) both call buildSerializer(last, cur) to wire the full chain:
 *   buildSerializer → buildManifest → buildFormatter → buildExecutor
 *   → buildPlanner  → buildEngine   → DocumentRegistry.register()
 *
 * Calls serializer.serialize() exactly once per run() invocation.
 * Does NOT call DocumentManifest.manifest() or ResultFormatter.format() directly.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. No mutation. No cache. No I/O. No side effects.
 * No singleton. No randomness. Deterministic output per fixed input.
 * No AI. No LLM. No filesystem. No browser globals.
 * No hooks. No IndexedDB. No HTTP.
 */

import { buildSerializer }              from './ManifestSerializer';
import type { ManifestSerializer, SerializedManifest } from './ManifestSerializer';
import type { QueryDescriptor }         from './QueryPlanner';

// ─── Internal narrow type ─────────────────────────────────────────────────────

interface MinManifestSerializer {
  serialize(descriptor?: QueryDescriptor): SerializedManifest;
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export class PipelineOrchestrator {
  constructor(private readonly serializer: MinManifestSerializer) {}

  run(descriptor: QueryDescriptor = {}): SerializedManifest {
    return this.serializer.serialize(descriptor);
  }
}

// ─── Pipeline factory ─────────────────────────────────────────────────────────

export function buildOrchestrator(
  lastAppliedDate: string,
  currentDate:     string,
  serializer:      ManifestSerializer = buildSerializer(lastAppliedDate, currentDate),
): PipelineOrchestrator {
  return new PipelineOrchestrator(serializer);
}

// ─── Exported one-shot function ───────────────────────────────────────────────

export function runPipeline(
  lastAppliedDate: string,
  currentDate:     string,
  descriptor:      QueryDescriptor = {},
): SerializedManifest {
  return buildSerializer(lastAppliedDate, currentDate).serialize(descriptor);
}
