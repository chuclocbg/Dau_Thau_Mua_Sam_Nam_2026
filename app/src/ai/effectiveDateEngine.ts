/**
 * Legal v4.3 — Effective Date Engine
 *
 * Provides a single entry point for date-aware regulation snapshots:
 *
 *   getRegulationSnapshot(targetDate) → RegulationSnapshot
 *
 * Builds on regulationVersionResolver.ts with one additional guarantee:
 *   when targetDate predates ALL registered snapshots, this engine falls back
 *   to the OLDEST available snapshot instead of returning empty arrays.
 *
 * Summary of behaviors:
 *
 *   targetDate = '2025-08-01'  →  2025-07-01 snapshot  (nearest previous)
 *   targetDate = '2026-03-01'  →  2026-01-01 snapshot  (nearest previous)
 *   targetDate = '2025-07-01'  →  2025-07-01 snapshot  (exact match)
 *   targetDate = '2099-01-01'  →  2026-01-01 snapshot  (newest available)
 *   targetDate = '2020-01-01'  →  2025-07-01 snapshot  (FALLBACK — before all)
 *
 * snapshot.targetDate is always the original query date, not the resolved
 * effective date, so callers can see exactly what they asked for.
 *
 * OLDEST_VERSION is the only coupling to the version registry.  If a snapshot
 * older than 2025-07-01 is ever registered in regulationVersionResolver.ts,
 * update this constant accordingly.
 *
 * Does NOT modify regulationLoader.ts, regulationVersionResolver.ts, or any
 * engine.  Existing APIs remain 100% unchanged.
 *
 * Pure function. Deterministic. No singleton. No cache. No side effects.
 * No LLM. No browser globals. No hooks. No IndexedDB. No UI.
 */

import type {
  Threshold,
  ProcurementBand,
  ContractTypeReg,
  FundSourceReg,
  RiskThreshold,
} from './regulationLoader';

import {
  resolveVersion,
  resolveThresholds,
  resolveProcurementBands,
  resolveContractTypes,
  resolveFundSources,
  resolveRiskThresholds,
} from './regulationVersionResolver';

// ─── Output type ──────────────────────────────────────────────────────────────

export interface RegulationSnapshot {
  /** Original query date supplied by the caller. */
  targetDate:      string;
  thresholds:      readonly Threshold[];
  procurementBands: readonly ProcurementBand[];
  contractTypes:   readonly ContractTypeReg[];
  fundSources:     readonly FundSourceReg[];
  riskThresholds:  readonly RiskThreshold[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Oldest registered snapshot date.  Used as the fallback when targetDate
 * predates all versions in the registry.
 *
 * Must be kept in sync with the earliest date key in regulationVersionResolver.ts.
 */
const OLDEST_VERSION = '2025-07-01';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the regulation snapshot that was in effect on targetDate.
 *
 * Version selection (delegated to regulationVersionResolver):
 *   newest snapshot whose date ≤ targetDate.
 *
 * Fallback (this engine's addition):
 *   when no snapshot qualifies (targetDate < OLDEST_VERSION), return the
 *   oldest snapshot rather than empty arrays.
 */
export function getRegulationSnapshot(targetDate: string): RegulationSnapshot {
  // resolveVersion returns undefined only when targetDate < all registered dates.
  // Using 'thresholds' as the canary — all categories share the same version dates.
  const hasVersion  = resolveVersion('thresholds', targetDate) !== undefined;
  const effectiveDate = hasVersion ? targetDate : OLDEST_VERSION;

  return {
    targetDate,
    thresholds:       resolveThresholds(effectiveDate),
    procurementBands: resolveProcurementBands(effectiveDate),
    contractTypes:    resolveContractTypes(effectiveDate),
    fundSources:      resolveFundSources(effectiveDate),
    riskThresholds:   resolveRiskThresholds(effectiveDate),
  };
}
