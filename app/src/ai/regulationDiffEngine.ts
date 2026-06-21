/**
 * Legal v4.4 — Regulation Diff Engine
 *
 * compareSnapshots(oldDate, newDate) → SnapshotDiff
 *
 * Compares two date-stamped regulation snapshots and categorises every entry
 * as added, removed, or changed.  Uses getRegulationSnapshot() so the
 * effective-date fallback rules from v4.3 apply automatically.
 *
 * Identity keys (what makes two entries "the same object"):
 *   Threshold        → code            (e.g. 'DIRECT_50_LIMIT')
 *   ProcurementBand  → code            (e.g. 'DIRECT_50')
 *   ContractTypeReg  → contractType    (e.g. 'tron-goi')
 *   FundSourceReg    → fundSource      (e.g. 'ngan-sach-nha-nuoc')
 *   RiskThreshold    → minScore        (e.g. 40)
 *
 * Diff algorithm (per category):
 *   1. Build id→item maps for old and new snapshots.
 *   2. For each id in new-map:
 *        – not in old-map  →  added
 *        – in old-map, JSON equal  →  unchanged (omitted from output)
 *        – in old-map, JSON differs  →  changed  { old, new }
 *   3. For each id in old-map not in new-map  →  removed
 *
 * JSON.stringify is used for deep equality; property order is stable because
 * entries are imported from static JSON files by the same module-load path.
 *
 * Does NOT modify any existing engine or loader.
 * Existing APIs remain 100% unchanged.
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

import { getRegulationSnapshot } from './effectiveDateEngine';

// ─── Changed-entry pair ───────────────────────────────────────────────────────
// `new` is a valid property name in TypeScript/JavaScript (reserved words are
// permitted in property positions).

export interface Changed<T> {
  old: T;
  // eslint-disable-next-line @typescript-eslint/no-shadow
  new: T;
}

// ─── Output type ──────────────────────────────────────────────────────────────

export interface SnapshotDiff {
  oldDate: string;
  newDate: string;

  addedThresholds:   readonly Threshold[];
  removedThresholds: readonly Threshold[];
  changedThresholds: readonly Changed<Threshold>[];

  addedProcurementBands:   readonly ProcurementBand[];
  removedProcurementBands: readonly ProcurementBand[];
  changedProcurementBands: readonly Changed<ProcurementBand>[];

  addedContractTypes:   readonly ContractTypeReg[];
  removedContractTypes: readonly ContractTypeReg[];
  changedContractTypes: readonly Changed<ContractTypeReg>[];

  addedFundSources:   readonly FundSourceReg[];
  removedFundSources: readonly FundSourceReg[];
  changedFundSources: readonly Changed<FundSourceReg>[];

  addedRiskThresholds:   readonly RiskThreshold[];
  removedRiskThresholds: readonly RiskThreshold[];
  changedRiskThresholds: readonly Changed<RiskThreshold>[];
}

// ─── Generic diff helper ──────────────────────────────────────────────────────

interface CategoryDiff<T> {
  added:   readonly T[];
  removed: readonly T[];
  changed: readonly Changed<T>[];
}

function diffCategory<T>(
  oldItems: readonly T[],
  newItems: readonly T[],
  getId: (item: T) => string | number,
): CategoryDiff<T> {
  const oldMap = new Map(oldItems.map(item => [String(getId(item)), item]));
  const newMap = new Map(newItems.map(item => [String(getId(item)), item]));

  const added:   T[]          = [];
  const removed: T[]          = [];
  const changed: Changed<T>[] = [];

  for (const [id, newItem] of newMap) {
    const oldItem = oldMap.get(id);
    if (oldItem === undefined) {
      added.push(newItem);
    } else if (JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
      changed.push({ old: oldItem, new: newItem });
    }
  }

  for (const [id, oldItem] of oldMap) {
    if (!newMap.has(id)) {
      removed.push(oldItem);
    }
  }

  return { added, removed, changed };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns a structured diff between the regulation snapshots in effect on
 * oldDate and newDate.  Both dates pass through getRegulationSnapshot() so
 * the oldest-version fallback applies when a date predates all snapshots.
 */
export function compareSnapshots(oldDate: string, newDate: string): SnapshotDiff {
  const oldSnap = getRegulationSnapshot(oldDate);
  const newSnap = getRegulationSnapshot(newDate);

  const thresholds     = diffCategory(oldSnap.thresholds,       newSnap.thresholds,       t  => t.code);
  const bands          = diffCategory(oldSnap.procurementBands, newSnap.procurementBands, b  => b.code);
  const contractTypes  = diffCategory(oldSnap.contractTypes,    newSnap.contractTypes,    ct => ct.contractType);
  const fundSources    = diffCategory(oldSnap.fundSources,      newSnap.fundSources,      fs => fs.fundSource);
  const riskThresholds = diffCategory(oldSnap.riskThresholds,   newSnap.riskThresholds,   rt => rt.minScore);

  return {
    oldDate,
    newDate,

    addedThresholds:   thresholds.added,
    removedThresholds: thresholds.removed,
    changedThresholds: thresholds.changed,

    addedProcurementBands:   bands.added,
    removedProcurementBands: bands.removed,
    changedProcurementBands: bands.changed,

    addedContractTypes:   contractTypes.added,
    removedContractTypes: contractTypes.removed,
    changedContractTypes: contractTypes.changed,

    addedFundSources:   fundSources.added,
    removedFundSources: fundSources.removed,
    changedFundSources: fundSources.changed,

    addedRiskThresholds:   riskThresholds.added,
    removedRiskThresholds: riskThresholds.removed,
    changedRiskThresholds: riskThresholds.changed,
  };
}
