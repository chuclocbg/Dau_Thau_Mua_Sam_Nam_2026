/**
 * Legal v10.0 — AuditTrail
 *
 * Boundary layer: calls RecommendationEngine.recommend(descriptor) once per
 * audit() invocation, captures the outcome into an AuditRecord, appends it to
 * an in-memory history, and exposes a stable AuditHistory snapshot via report().
 *
 * This is NOT a processing layer (no transformation of document data).
 * It is an observation layer — it records what happened without changing it.
 *
 * AuditRecord fields:
 *   sequence            — 0-based call counter; monotonically increasing, never gaps
 *   descriptor          — exact QueryDescriptor reference passed to audit()
 *   primaryCode         — RecommendationCode from the engine result
 *   hasActions          — forwarded from RecommendationResult.hasActions
 *   totalCount          — forwarded from RecommendationResult.totalCount
 *   targetDate          — forwarded from RecommendationResult.targetDate
 *   recommendationCount — RecommendationResult.recommendations.length
 *
 * AuditHistory fields:
 *   records         — all AuditRecords in call order (direct reference to internal array)
 *   totalAudits     — records.length
 *   actionableCount — count of records where hasActions === true
 *   latestRecord    — records[records.length - 1] (undefined when empty)
 *   firstRecord     — records[0] (undefined when empty)
 *   primaryCodes    — records.map(r => r.primaryCode), source order
 *
 * auditFromResult() and historyFromRecords() are exported pure functions for
 * direct injection in tests with synthetic RecommendationResult objects.
 * Both are stateless: same input → same output, always.
 *
 * AuditRecord identity:
 *   audit() returns the exact same object reference that is appended to the
 *   history — no copy. caller.audit(d) === trail.report().records[n] is
 *   guaranteed for the nth call.
 *
 * Memory:
 *   Records accumulate in this.history for the lifetime of the AuditTrail
 *   instance. Each AuditRecord is a flat struct of primitives plus one
 *   object reference (descriptor). No nested arrays are copied.
 *   Garbage collection of the instance frees all records atomically.
 *
 * Calls engine.recommend() exactly once per audit() invocation.
 * Does NOT call DocumentListPanel.render() or any lower layer directly.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * auditFromResult() and historyFromRecords(): pure. No mutation. No cache. No I/O.
 * AuditTrail.audit(): in-memory append only; no I/O, no persistence, no singleton.
 * No randomness. No AI. No LLM. No filesystem. No browser globals.
 * No hooks. No IndexedDB. No HTTP.
 */

import { buildRecommendationEngine }          from './RecommendationEngine';
import type { RecommendationEngine,
              RecommendationCode }            from './RecommendationEngine';
import type { QueryDescriptor }              from './QueryPlanner';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface AuditRecord {
  sequence:            number;
  descriptor:          QueryDescriptor;
  primaryCode:         RecommendationCode;
  hasActions:          boolean;
  totalCount:          number;
  targetDate:          string;
  recommendationCount: number;
}

export interface AuditHistory {
  records:         readonly AuditRecord[];
  totalAudits:     number;
  actionableCount: number;
  latestRecord:    AuditRecord | undefined;
  firstRecord:     AuditRecord | undefined;
  primaryCodes:    readonly RecommendationCode[];
}

// ─── Internal narrow types ────────────────────────────────────────────────────

interface MinRecommendationResult {
  primaryCode:     RecommendationCode;
  hasActions:      boolean;
  totalCount:      number;
  targetDate:      string;
  recommendations: readonly unknown[];
}

interface MinRecommendationEngine {
  recommend(descriptor?: QueryDescriptor): MinRecommendationResult;
}

// ─── Exported pure helpers ────────────────────────────────────────────────────

export function auditFromResult(
  result:     MinRecommendationResult,
  descriptor: QueryDescriptor,
  sequence:   number,
): AuditRecord {
  return {
    sequence,
    descriptor,
    primaryCode:         result.primaryCode,
    hasActions:          result.hasActions,
    totalCount:          result.totalCount,
    targetDate:          result.targetDate,
    recommendationCount: result.recommendations.length,
  };
}

export function historyFromRecords(records: readonly AuditRecord[]): AuditHistory {
  return {
    records,
    totalAudits:     records.length,
    actionableCount: records.filter(r => r.hasActions).length,
    latestRecord:    records[records.length - 1],
    firstRecord:     records[0],
    primaryCodes:    records.map(r => r.primaryCode),
  };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class AuditTrail {
  private readonly history: AuditRecord[] = [];

  constructor(private readonly engine: MinRecommendationEngine) {}

  audit(descriptor: QueryDescriptor = {}): AuditRecord {
    const result = this.engine.recommend(descriptor);
    const record = auditFromResult(result, descriptor, this.history.length);
    this.history.push(record);
    return record;
  }

  report(): AuditHistory {
    return historyFromRecords(this.history);
  }
}

// ─── Pipeline factory ─────────────────────────────────────────────────────────

export function buildAuditTrail(
  lastAppliedDate: string,
  currentDate:     string,
  engine:          RecommendationEngine = buildRecommendationEngine(lastAppliedDate, currentDate),
): AuditTrail {
  return new AuditTrail(engine);
}
