/**
 * Legal v4.9 — Audit Trail Engine
 *
 * buildAuditTrail(oldDate, newDate, generatedAt?) → AuditTrail
 *
 * Produces a 7-stage pipeline audit record for any regulation-date pair.
 * Every stage always exists; ordering is fixed; status is derived from
 * the impactLevel returned by the underlying pipeline.
 *
 * Stage ordering:
 *   0  Resolve versions
 *   1  Load snapshots
 *   2  Compute diff
 *   3  Build update package
 *   4  Build migration plan
 *   5  Build compliance report
 *   6  Build notification
 *
 * Status rules (derived from impactLevel):
 *   LOW      → all 7 stages: SUCCESS
 *   MEDIUM   → stages 0–5: SUCCESS  | stage 6: WARNING
 *   HIGH     → stages 0–3: SUCCESS  | stages 4–6: WARNING
 *   CRITICAL → stages 0–2: SUCCESS  | stages 3–6: CRITICAL
 *
 * Summary strings:
 *   LOW      → "No significant regulatory impact."
 *   MEDIUM   → "Moderate impact detected."
 *   HIGH     → "High impact detected."
 *   CRITICAL → "Critical impact detected."
 *
 * generatedAt defaults to new Date().toISOString().  Accept it as a
 * parameter so tests can supply a fixed value for deterministic assertions.
 *
 * computeStageStatus() is exported so tests can verify status rules for
 * MEDIUM and CRITICAL impact levels that cannot be produced from real data.
 *
 * Does NOT modify any existing engine, loader, resolver, or pipeline layer.
 * Existing APIs remain 100% unchanged.
 *
 * Pure function (given a fixed generatedAt). Deterministic. No singleton.
 * No cache. No side effects. No LLM. No browser globals. No hooks.
 * No IndexedDB. No UI.
 */

import { buildUpdateNotification } from './updateNotificationEngine';
import type { UpdateNotification } from './updateNotificationEngine';
import type { ImpactLevel } from './updatePackageEngine';

// ─── Public types ─────────────────────────────────────────────────────────────

export type StatusLevel = 'SUCCESS' | 'WARNING' | 'CRITICAL';

export interface Stage {
  name:    string;
  status:  StatusLevel;
  details: string;
}

export interface AuditTrail {
  generatedAt:         string;
  oldDate:             string;
  newDate:             string;
  impactLevel:         ImpactLevel;
  requiresHumanReview: boolean;
  stages:              readonly Stage[];
  summary:             string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_NAMES = [
  'Resolve versions',
  'Load snapshots',
  'Compute diff',
  'Build update package',
  'Build migration plan',
  'Build compliance report',
  'Build notification',
] as const;

const SUMMARIES: Record<ImpactLevel, string> = {
  LOW:      'No significant regulatory impact.',
  MEDIUM:   'Moderate impact detected.',
  HIGH:     'High impact detected.',
  CRITICAL: 'Critical impact detected.',
};

// ─── Exported helper (used directly in tests for synthetic impact levels) ──────

/**
 * Returns the stage status for a given stage index and impact level.
 * Exported so tests can verify status rules for MEDIUM/CRITICAL scenarios
 * that cannot be produced from real snapshot data.
 *
 *   LOW      → SUCCESS (all stages)
 *   MEDIUM   → WARNING only at index 6 (notification)
 *   HIGH     → WARNING at indices 4–6 (migration, report, notification)
 *   CRITICAL → CRITICAL at indices 3–6 (all post-diff stages)
 */
export function computeStageStatus(stageIndex: number, impactLevel: ImpactLevel): StatusLevel {
  if (impactLevel === 'CRITICAL') return stageIndex <= 2 ? 'SUCCESS' : 'CRITICAL';
  if (impactLevel === 'HIGH')     return stageIndex <= 3 ? 'SUCCESS' : 'WARNING';
  if (impactLevel === 'MEDIUM')   return stageIndex === 6 ? 'WARNING' : 'SUCCESS';
  return 'SUCCESS'; // LOW
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function stageDetails(name: string, notification: UpdateNotification): string {
  switch (name) {
    case 'Resolve versions':
      return `Regulation versions resolved for ${notification.oldDate} → ${notification.newDate}`;
    case 'Load snapshots':
      return `Snapshots loaded; ${notification.affectedAreas.length} area(s) affected`;
    case 'Compute diff':
      return `Diff computed; impact level: ${notification.severity}`;
    case 'Build update package':
      return `Update package built; ${notification.affectedAreas.length} area(s) changed`;
    case 'Build migration plan':
      return `Migration plan built; human review ${notification.requiresHumanReview ? 'required' : 'not required'}`;
    case 'Build compliance report':
      return `Compliance report generated; ${notification.sections.length} section(s)`;
    case 'Build notification':
      return notification.title;
    default:
      return name;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildAuditTrail(
  oldDate:     string,
  newDate:     string,
  generatedAt: string = new Date().toISOString(),
): AuditTrail {
  const notification = buildUpdateNotification(oldDate, newDate);
  const impactLevel  = notification.severity;
  return {
    generatedAt,
    oldDate,
    newDate,
    impactLevel,
    requiresHumanReview: notification.requiresHumanReview,
    stages: STAGE_NAMES.map((name, i) => ({
      name,
      status:  computeStageStatus(i, impactLevel),
      details: stageDetails(name, notification),
    })),
    summary: SUMMARIES[impactLevel],
  };
}
