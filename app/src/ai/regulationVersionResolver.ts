/**
 * Legal v4.2 — Regulation Version Resolver
 *
 * Selects the correct regulation snapshot for a given effective date using
 * the rule:
 *
 *   "Choose the newest version whose date ≤ targetDate."
 *
 * Examples:
 *   targetDate = '2025-08-01'  →  uses  2025-07-01 snapshot
 *   targetDate = '2026-03-01'  →  uses  2026-01-01 snapshot
 *   targetDate = '2025-06-30'  →  no version qualifies → returns undefined / []
 *
 * Algorithm:
 *   1. Collect all version keys for the requested category.
 *   2. Filter to keys where key (YYYY-MM-DD) ≤ targetDate (lexicographic order
 *      equals chronological order for ISO 8601 date strings).
 *   3. Sort ascending and take the last element (newest eligible).
 *
 * All versioned JSON files are statically imported so the bundler can include
 * them at build time.  Version selection happens at call time via string
 * comparison — no I/O, no fetch, no browser globals.
 *
 * Does NOT modify regulationLoader.ts, regulationDB.ts, or any engine.
 * Existing APIs (loadThresholds, THRESHOLDS, getAllThresholds, …) are unchanged.
 *
 * Pure functions. Deterministic. No singleton. No cache. No side effects.
 * No LLM. No hooks. No IndexedDB. No UI.
 */

import type {
  Threshold,
  ProcurementBand,
  ContractTypeReg,
  FundSourceReg,
  RiskThreshold,
} from './regulationLoader';

// ─── Static JSON imports (all versions, all categories) ───────────────────────
// Path: app/src/ai/ → ../../.. = project root → regulations/<category>/<date>.json

import t_2025_07_01  from '../../../regulations/thresholds/2025-07-01.json';
import t_2026_01_01  from '../../../regulations/thresholds/2026-01-01.json';

import pb_2025_07_01 from '../../../regulations/procurementBands/2025-07-01.json';
import pb_2026_01_01 from '../../../regulations/procurementBands/2026-01-01.json';

import ct_2025_07_01 from '../../../regulations/contractTypes/2025-07-01.json';
import ct_2026_01_01 from '../../../regulations/contractTypes/2026-01-01.json';

import fs_2025_07_01 from '../../../regulations/fundSources/2025-07-01.json';
import fs_2026_01_01 from '../../../regulations/fundSources/2026-01-01.json';

import rt_2025_07_01 from '../../../regulations/riskThresholds/2025-07-01.json';
import rt_2026_01_01 from '../../../regulations/riskThresholds/2026-01-01.json';

// ─── Version registries ───────────────────────────────────────────────────────
// One Record<versionDate, data> per category.  Adding a new version requires
// only a new JSON file and a new entry here.

const THRESHOLD_VERSIONS: Record<string, readonly Threshold[]> = {
  '2025-07-01': t_2025_07_01  as unknown as readonly Threshold[],
  '2026-01-01': t_2026_01_01  as unknown as readonly Threshold[],
};

const BAND_VERSIONS: Record<string, readonly ProcurementBand[]> = {
  '2025-07-01': pb_2025_07_01 as unknown as readonly ProcurementBand[],
  '2026-01-01': pb_2026_01_01 as unknown as readonly ProcurementBand[],
};

const CONTRACT_TYPE_VERSIONS: Record<string, readonly ContractTypeReg[]> = {
  '2025-07-01': ct_2025_07_01 as unknown as readonly ContractTypeReg[],
  '2026-01-01': ct_2026_01_01 as unknown as readonly ContractTypeReg[],
};

const FUND_SOURCE_VERSIONS: Record<string, readonly FundSourceReg[]> = {
  '2025-07-01': fs_2025_07_01 as unknown as readonly FundSourceReg[],
  '2026-01-01': fs_2026_01_01 as unknown as readonly FundSourceReg[],
};

const RISK_THRESHOLD_VERSIONS: Record<string, readonly RiskThreshold[]> = {
  '2025-07-01': rt_2025_07_01 as unknown as readonly RiskThreshold[],
  '2026-01-01': rt_2026_01_01 as unknown as readonly RiskThreshold[],
};

// ─── Category map ─────────────────────────────────────────────────────────────

export type Category =
  | 'thresholds'
  | 'procurementBands'
  | 'contractTypes'
  | 'fundSources'
  | 'riskThresholds';

// Keyed by Category so resolveVersion() can look up available dates without
// per-category branching.
const CATEGORY_REGISTRY: Record<Category, Record<string, unknown>> = {
  thresholds:       THRESHOLD_VERSIONS,
  procurementBands: BAND_VERSIONS,
  contractTypes:    CONTRACT_TYPE_VERSIONS,
  fundSources:      FUND_SOURCE_VERSIONS,
  riskThresholds:   RISK_THRESHOLD_VERSIONS,
};

// ─── Core algorithm ───────────────────────────────────────────────────────────

/**
 * Returns the newest version date ≤ targetDate for the given category,
 * or undefined if no version qualifies (targetDate predates all snapshots).
 *
 * Date comparison is lexicographic; YYYY-MM-DD format makes this equivalent
 * to chronological ordering.
 */
export function resolveVersion(category: Category, targetDate: string): string | undefined {
  const registry = CATEGORY_REGISTRY[category];
  const eligible  = Object.keys(registry).filter(v => v <= targetDate).sort();
  return eligible.length > 0 ? eligible[eligible.length - 1] : undefined;
}

// ─── Per-category resolve functions ──────────────────────────────────────────

/** Returns thresholds effective on targetDate, or [] if targetDate predates all versions. */
export function resolveThresholds(targetDate: string): readonly Threshold[] {
  const v = resolveVersion('thresholds', targetDate);
  return v !== undefined ? THRESHOLD_VERSIONS[v]! : [];
}

/** Returns procurement bands effective on targetDate, or []. */
export function resolveProcurementBands(targetDate: string): readonly ProcurementBand[] {
  const v = resolveVersion('procurementBands', targetDate);
  return v !== undefined ? BAND_VERSIONS[v]! : [];
}

/** Returns contract type regulations effective on targetDate, or []. */
export function resolveContractTypes(targetDate: string): readonly ContractTypeReg[] {
  const v = resolveVersion('contractTypes', targetDate);
  return v !== undefined ? CONTRACT_TYPE_VERSIONS[v]! : [];
}

/** Returns fund source regulations effective on targetDate, or []. */
export function resolveFundSources(targetDate: string): readonly FundSourceReg[] {
  const v = resolveVersion('fundSources', targetDate);
  return v !== undefined ? FUND_SOURCE_VERSIONS[v]! : [];
}

/** Returns risk thresholds effective on targetDate, or []. */
export function resolveRiskThresholds(targetDate: string): readonly RiskThreshold[] {
  const v = resolveVersion('riskThresholds', targetDate);
  return v !== undefined ? RISK_THRESHOLD_VERSIONS[v]! : [];
}
