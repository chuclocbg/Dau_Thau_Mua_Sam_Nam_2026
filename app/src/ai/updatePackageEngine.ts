/**
 * Legal v4.5 — Update Package Engine
 *
 * buildUpdatePackage(oldDate, newDate) → UpdatePackage
 *
 * Wraps compareSnapshots() from regulationDiffEngine and enriches the result
 * with a human-readable summary, a computed impact level, and the list of
 * affected regulation categories.
 *
 * Impact level rules (highest-severity wins):
 *   CRITICAL — any risk-threshold values mutated (audit scoring affected)
 *   HIGH     — thresholds added/removed/changed OR risk thresholds added/removed
 *              (procurement-method selection affected)
 *   MEDIUM   — procurement bands or contract types added/removed/changed
 *              (procurement process affected, but not threshold amounts)
 *   LOW      — only fund-source changes, or zero changes
 *
 * computeImpactLevel() and getAffectedAreas() are exported so tests can call
 * them with synthetic SnapshotDiff objects for levels that real data cannot
 * produce (MEDIUM, CRITICAL).
 *
 * Does NOT modify any existing engine, loader, resolver, or diff engine.
 * Existing APIs remain 100% unchanged.
 *
 * Pure function. Deterministic. No singleton. No cache. No side effects.
 * No LLM. No browser globals. No hooks. No IndexedDB. No UI.
 */

import { compareSnapshots } from './regulationDiffEngine';
import type { SnapshotDiff, Changed } from './regulationDiffEngine';
import type {
  Threshold,
  ProcurementBand,
  ContractTypeReg,
  FundSourceReg,
  RiskThreshold,
} from './regulationLoader';

// ─── Public types ─────────────────────────────────────────────────────────────

export type ImpactLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AffectedArea =
  | 'thresholds'
  | 'procurementBands'
  | 'contractTypes'
  | 'fundSources'
  | 'riskThresholds';

export interface CategoryChanges<T> {
  added:   readonly T[];
  removed: readonly T[];
  changed: readonly Changed<T>[];
}

export interface UpdatePackage {
  oldDate:                string;
  newDate:                string;
  summary:                string;
  thresholdChanges:       CategoryChanges<Threshold>;
  procurementBandChanges: CategoryChanges<ProcurementBand>;
  contractTypeChanges:    CategoryChanges<ContractTypeReg>;
  fundSourceChanges:      CategoryChanges<FundSourceReg>;
  riskThresholdChanges:   CategoryChanges<RiskThreshold>;
  impactLevel:            ImpactLevel;
  affectedAreas:          readonly AffectedArea[];
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function sum(...ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0);
}

function buildSummary(diff: SnapshotDiff): string {
  const added = sum(
    diff.addedThresholds.length,
    diff.addedProcurementBands.length,
    diff.addedContractTypes.length,
    diff.addedFundSources.length,
    diff.addedRiskThresholds.length,
  );
  const removed = sum(
    diff.removedThresholds.length,
    diff.removedProcurementBands.length,
    diff.removedContractTypes.length,
    diff.removedFundSources.length,
    diff.removedRiskThresholds.length,
  );
  const changed = sum(
    diff.changedThresholds.length,
    diff.changedProcurementBands.length,
    diff.changedContractTypes.length,
    diff.changedFundSources.length,
    diff.changedRiskThresholds.length,
  );
  if (added + removed + changed === 0) return 'No changes';
  return `Added ${added} entries, removed ${removed} entries, changed ${changed} entries.`;
}

// ─── Exported sub-functions (used directly in tests for synthetic diffs) ──────

export function computeImpactLevel(diff: SnapshotDiff): ImpactLevel {
  // CRITICAL: any risk threshold value mutated — affects audit scoring
  if (diff.changedRiskThresholds.length > 0) return 'CRITICAL';

  // HIGH: threshold count or risk threshold count changes — affects method selection
  if (
    sum(
      diff.addedThresholds.length,
      diff.removedThresholds.length,
      diff.changedThresholds.length,
      diff.addedRiskThresholds.length,
      diff.removedRiskThresholds.length,
    ) > 0
  )
    return 'HIGH';

  // MEDIUM: procurement band or contract type changes — affects procurement process
  if (
    sum(
      diff.addedProcurementBands.length,
      diff.removedProcurementBands.length,
      diff.changedProcurementBands.length,
      diff.addedContractTypes.length,
      diff.removedContractTypes.length,
      diff.changedContractTypes.length,
    ) > 0
  )
    return 'MEDIUM';

  return 'LOW';
}

export function getAffectedAreas(diff: SnapshotDiff): readonly AffectedArea[] {
  const areas: AffectedArea[] = [];
  if (sum(diff.addedThresholds.length, diff.removedThresholds.length, diff.changedThresholds.length) > 0)
    areas.push('thresholds');
  if (sum(diff.addedProcurementBands.length, diff.removedProcurementBands.length, diff.changedProcurementBands.length) > 0)
    areas.push('procurementBands');
  if (sum(diff.addedContractTypes.length, diff.removedContractTypes.length, diff.changedContractTypes.length) > 0)
    areas.push('contractTypes');
  if (sum(diff.addedFundSources.length, diff.removedFundSources.length, diff.changedFundSources.length) > 0)
    areas.push('fundSources');
  if (sum(diff.addedRiskThresholds.length, diff.removedRiskThresholds.length, diff.changedRiskThresholds.length) > 0)
    areas.push('riskThresholds');
  return areas;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildUpdatePackage(oldDate: string, newDate: string): UpdatePackage {
  const diff = compareSnapshots(oldDate, newDate);
  return {
    oldDate,
    newDate,
    summary:                buildSummary(diff),
    thresholdChanges:       { added: diff.addedThresholds,       removed: diff.removedThresholds,       changed: diff.changedThresholds },
    procurementBandChanges: { added: diff.addedProcurementBands, removed: diff.removedProcurementBands, changed: diff.changedProcurementBands },
    contractTypeChanges:    { added: diff.addedContractTypes,    removed: diff.removedContractTypes,    changed: diff.changedContractTypes },
    fundSourceChanges:      { added: diff.addedFundSources,      removed: diff.removedFundSources,      changed: diff.changedFundSources },
    riskThresholdChanges:   { added: diff.addedRiskThresholds,   removed: diff.removedRiskThresholds,   changed: diff.changedRiskThresholds },
    impactLevel:            computeImpactLevel(diff),
    affectedAreas:          getAffectedAreas(diff),
  };
}
