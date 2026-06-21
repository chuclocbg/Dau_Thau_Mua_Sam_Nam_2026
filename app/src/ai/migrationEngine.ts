/**
 * Legal v4.6 — Migration Engine
 *
 * buildMigrationPlan(oldDate, newDate) → MigrationPlan
 *
 * Translates a regulation diff into concrete migration actions: what needs to
 * be updated (templates, decision logic, risk rules), and whether a human
 * reviewer must sign off before applying the changes.
 *
 * Action-generation rules:
 *   thresholds changed      → UPDATE_DECISION_LOGIC
 *   procurementBands changed → UPDATE_TEMPLATE
 *   contractTypes changed   → UPDATE_TEMPLATE
 *   fundSources changed     → UPDATE_TEMPLATE
 *   riskThresholds changed  → UPDATE_RISK_RULES
 *   Any removed entry (any category) → REVIEW_MANUALLY (additional action)
 *
 * A category with no changes produces no actions — NO_ACTION never appears
 * in the output array; it exists in the ActionType union for future use.
 *
 * Human-review flag rules (any condition sufficient):
 *   impactLevel === 'CRITICAL'
 *   OR any REVIEW_MANUALLY action exists (i.e. at least one removed entry)
 *
 * generateActions() and computeRequiresHumanReview() are exported so tests
 * can exercise them directly with synthetic SnapshotDiff objects for
 * categories that produce no real-data changes (MEDIUM/CRITICAL scenarios).
 *
 * Does NOT modify any existing engine, loader, resolver, diff engine, or
 * update package engine.  Existing APIs remain 100% unchanged.
 *
 * Pure function. Deterministic. No singleton. No cache. No side effects.
 * No LLM. No browser globals. No hooks. No IndexedDB. No UI.
 */

import { compareSnapshots } from './regulationDiffEngine';
import type { SnapshotDiff } from './regulationDiffEngine';
import { computeImpactLevel, getAffectedAreas } from './updatePackageEngine';
import type { ImpactLevel, AffectedArea } from './updatePackageEngine';

// ─── Public types ─────────────────────────────────────────────────────────────

export type ActionType =
  | 'NO_ACTION'
  | 'UPDATE_TEMPLATE'
  | 'UPDATE_DECISION_LOGIC'
  | 'UPDATE_RISK_RULES'
  | 'REVIEW_MANUALLY';

export interface Action {
  area:   AffectedArea;
  action: ActionType;
  reason: string;
}

export interface MigrationPlan {
  oldDate:             string;
  newDate:             string;
  impactLevel:         ImpactLevel;
  affectedAreas:       readonly AffectedArea[];
  actions:             readonly Action[];
  requiresHumanReview: boolean;
}

// ─── Internal area configuration ─────────────────────────────────────────────

interface AreaSpec {
  area:    AffectedArea;
  primary: ActionType;
  added:   number;
  removed: number;
  changed: number;
}

function buildAreaSpecs(diff: SnapshotDiff): readonly AreaSpec[] {
  return [
    {
      area: 'thresholds',
      primary: 'UPDATE_DECISION_LOGIC',
      added:   diff.addedThresholds.length,
      removed: diff.removedThresholds.length,
      changed: diff.changedThresholds.length,
    },
    {
      area: 'procurementBands',
      primary: 'UPDATE_TEMPLATE',
      added:   diff.addedProcurementBands.length,
      removed: diff.removedProcurementBands.length,
      changed: diff.changedProcurementBands.length,
    },
    {
      area: 'contractTypes',
      primary: 'UPDATE_TEMPLATE',
      added:   diff.addedContractTypes.length,
      removed: diff.removedContractTypes.length,
      changed: diff.changedContractTypes.length,
    },
    {
      area: 'fundSources',
      primary: 'UPDATE_TEMPLATE',
      added:   diff.addedFundSources.length,
      removed: diff.removedFundSources.length,
      changed: diff.changedFundSources.length,
    },
    {
      area: 'riskThresholds',
      primary: 'UPDATE_RISK_RULES',
      added:   diff.addedRiskThresholds.length,
      removed: diff.removedRiskThresholds.length,
      changed: diff.changedRiskThresholds.length,
    },
  ];
}

// ─── Exported sub-functions (used directly in tests for synthetic diffs) ──────

/**
 * Returns one or two actions per changed category, in area-definition order:
 *   1. Primary action (if any activity in the area)
 *   2. REVIEW_MANUALLY (if removed entries exist in the area)
 *
 * Categories with zero activity are skipped — they produce no actions.
 */
export function generateActions(diff: SnapshotDiff): readonly Action[] {
  const actions: Action[] = [];
  for (const spec of buildAreaSpecs(diff)) {
    if (spec.added + spec.removed + spec.changed === 0) continue;
    actions.push({
      area:   spec.area,
      action: spec.primary,
      reason: `${spec.added} added, ${spec.removed} removed, ${spec.changed} changed`,
    });
    if (spec.removed > 0) {
      actions.push({
        area:   spec.area,
        action: 'REVIEW_MANUALLY',
        reason: `${spec.removed} removed entries require manual review`,
      });
    }
  }
  return actions;
}

/**
 * Returns true when a human must review before the migration is applied.
 * CRITICAL impact or any REVIEW_MANUALLY action (always generated for
 * removed entries) is sufficient to trigger the flag.
 */
export function computeRequiresHumanReview(
  impactLevel: ImpactLevel,
  actions:     readonly Action[],
): boolean {
  return impactLevel === 'CRITICAL' || actions.some(a => a.action === 'REVIEW_MANUALLY');
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildMigrationPlan(oldDate: string, newDate: string): MigrationPlan {
  const diff          = compareSnapshots(oldDate, newDate);
  const impactLevel   = computeImpactLevel(diff);
  const affectedAreas = getAffectedAreas(diff);
  const actions       = generateActions(diff);
  return {
    oldDate,
    newDate,
    impactLevel,
    affectedAreas,
    actions,
    requiresHumanReview: computeRequiresHumanReview(impactLevel, actions),
  };
}
