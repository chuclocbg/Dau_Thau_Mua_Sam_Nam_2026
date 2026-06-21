/**
 * Legal v5.1 — ChangeImpactAgent
 *
 * analyzeImpact(lastAppliedDate, currentDate) → ImpactAnalysis
 *
 * Derives per-component impact from the regulation-update pipeline by
 * delegating to LegalUpdateAgent (called exactly once) and mapping its
 * migration actions into typed output arrays:
 *
 *   UPDATE_TEMPLATE       → affectedTemplates + actionPlan
 *   UPDATE_DECISION_LOGIC → affectedDecisionLogic + actionPlan
 *   UPDATE_RISK_RULES     → affectedRiskRules + actionPlan
 *   REVIEW_MANUALLY       → actionPlan only
 *   NO_ACTION             → ignored
 *
 * Deduplication: each area appears at most once per output array;
 * order follows the migration-actions array (deterministic, no sorting).
 *
 * mapImpact() is exported so tests can inject synthetic pipeline results
 * for MEDIUM/CRITICAL scenarios that cannot be produced from the current
 * two-version snapshot set.
 *
 * Does NOT modify any existing engine, loader, resolver, or pipeline layer.
 * Never calls v4.x engines directly — all data comes from LegalUpdateAgent.
 * Existing APIs remain 100% unchanged.
 *
 * Pure. Deterministic. No singleton. No cache. No side effects.
 * No LLM. No browser globals. No hooks. No IndexedDB. No UI.
 */

import { LegalUpdateAgent } from './LegalUpdateAgent';
import type { ImpactLevel, AffectedArea } from '../ai/updatePackageEngine';
import type { Action, ActionType } from '../ai/migrationEngine';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ActionPlanItem {
  category: AffectedArea;
  action:   ActionType;
  reason:   string;
}

export interface ImpactAnalysis {
  impactLevel:           ImpactLevel;
  shouldUpdate:          boolean;
  requiresHumanReview:   boolean;
  affectedAreas:         readonly AffectedArea[];
  affectedTemplates:     readonly AffectedArea[];
  affectedDecisionLogic: readonly AffectedArea[];
  affectedRiskRules:     readonly AffectedArea[];
  actionPlan:            readonly ActionPlanItem[];
}

// ─── Internal narrow type ─────────────────────────────────────────────────────

// Only the fields mapImpact actually reads — makes synthetic test data easy to build.
interface PipelineResult {
  impactLevel:         ImpactLevel;
  shouldUpdate:        boolean;
  requiresHumanReview: boolean;
  migrationPlan: {
    affectedAreas: readonly AffectedArea[];
    actions:       readonly Action[];
  };
}

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function mapImpact(result: PipelineResult): ImpactAnalysis {
  const affectedTemplates:     AffectedArea[]   = [];
  const affectedDecisionLogic: AffectedArea[]   = [];
  const affectedRiskRules:     AffectedArea[]   = [];
  const actionPlan:            ActionPlanItem[]  = [];

  for (const a of result.migrationPlan.actions) {
    if (a.action === 'NO_ACTION') continue;
    actionPlan.push({ category: a.area, action: a.action, reason: a.reason });
    if (a.action === 'UPDATE_TEMPLATE'       && !affectedTemplates.includes(a.area))     affectedTemplates.push(a.area);
    if (a.action === 'UPDATE_DECISION_LOGIC' && !affectedDecisionLogic.includes(a.area)) affectedDecisionLogic.push(a.area);
    if (a.action === 'UPDATE_RISK_RULES'     && !affectedRiskRules.includes(a.area))     affectedRiskRules.push(a.area);
    // REVIEW_MANUALLY → actionPlan only (already pushed above)
  }

  return {
    impactLevel:           result.impactLevel,
    shouldUpdate:          result.shouldUpdate,
    requiresHumanReview:   result.requiresHumanReview,
    affectedAreas:         result.migrationPlan.affectedAreas,
    affectedTemplates,
    affectedDecisionLogic,
    affectedRiskRules,
    actionPlan,
  };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class ChangeImpactAgent {
  constructor(private readonly updateAgent: LegalUpdateAgent = new LegalUpdateAgent()) {}

  analyzeImpact(lastAppliedDate: string, currentDate: string): ImpactAnalysis {
    return mapImpact(this.updateAgent.checkForUpdates(lastAppliedDate, currentDate));
  }
}
