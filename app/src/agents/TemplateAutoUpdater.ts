/**
 * Legal v5.2 — TemplateAutoUpdater
 *
 * planTemplateUpdates(lastAppliedDate, currentDate) → TemplateUpdatePlan
 *
 * Translates the per-component impact produced by ChangeImpactAgent into
 * concrete template-update tasks, one task per canonical template type:
 *
 *   Template types (canonical order):
 *     'procurementBands' | 'contractTypes' | 'fundSources'
 *
 * Mapping rules (applied in canonical order, not input order):
 *   shouldUpdate = false     → updateTasks = [], all 3 types → skippedTasks (SKIP)
 *   type in affectedTemplates → REGENERATE task  → updateTasks
 *   requiresHumanReview=true → additionally add REVIEW_MANUALLY task for the same type → updateTasks
 *   type not in affectedTemplates → SKIP task → skippedTasks
 *
 * Deduplication:
 *   - affectedTemplates in output is deduplicated (Set, insertion order)
 *   - task arrays are naturally deduplicated by iterating the fixed 3-type list
 *
 * planFromAnalysis() is exported so tests can inject synthetic ImpactAnalysis
 * objects for scenarios (MEDIUM/CRITICAL, template changes) that cannot be
 * produced from the current two-version snapshot set.
 *
 * Calls ChangeImpactAgent.analyzeImpact() exactly once.
 * Never calls LegalUpdateAgent or any v4.x engine directly.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. Deterministic. No singleton. No cache. No side effects.
 * No LLM. No browser globals. No hooks. No IndexedDB. No UI.
 */

import { ChangeImpactAgent } from './ChangeImpactAgent';
import type { ImpactLevel } from '../ai/updatePackageEngine';

// ─── Public types ─────────────────────────────────────────────────────────────

export type TemplateType   = 'procurementBands' | 'contractTypes' | 'fundSources';
export type TemplateAction = 'REGENERATE' | 'REVIEW_MANUALLY' | 'SKIP';

export interface TemplateTask {
  templateType: TemplateType;
  action:       TemplateAction;
  reason:       string;
}

export interface TemplateUpdatePlan {
  shouldUpdate:        boolean;
  requiresHumanReview: boolean;
  impactLevel:         ImpactLevel;
  affectedTemplates:   readonly string[];
  updateTasks:         readonly TemplateTask[];
  skippedTasks:        readonly TemplateTask[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_TEMPLATE_TYPES: readonly TemplateType[] = [
  'procurementBands',
  'contractTypes',
  'fundSources',
];

// ─── Internal narrow type ─────────────────────────────────────────────────────

// Only the fields planFromAnalysis actually reads.
interface MinAnalysis {
  shouldUpdate:        boolean;
  requiresHumanReview: boolean;
  impactLevel:         ImpactLevel;
  affectedTemplates:   readonly string[];
}

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function planFromAnalysis(analysis: MinAnalysis): TemplateUpdatePlan {
  const updateTasks:  TemplateTask[] = [];
  const skippedTasks: TemplateTask[] = [];

  if (!analysis.shouldUpdate) {
    for (const t of ALL_TEMPLATE_TYPES) {
      skippedTasks.push({
        templateType: t,
        action:       'SKIP',
        reason:       'No regulatory changes require template updates',
      });
    }
  } else {
    for (const t of ALL_TEMPLATE_TYPES) {
      if (analysis.affectedTemplates.includes(t)) {
        updateTasks.push({
          templateType: t,
          action:       'REGENERATE',
          reason:       `${t} templates require regeneration due to regulatory changes`,
        });
        if (analysis.requiresHumanReview) {
          updateTasks.push({
            templateType: t,
            action:       'REVIEW_MANUALLY',
            reason:       `${t} templates require manual review before regeneration`,
          });
        }
      } else {
        skippedTasks.push({
          templateType: t,
          action:       'SKIP',
          reason:       `${t} not affected by current regulatory changes`,
        });
      }
    }
  }

  return {
    shouldUpdate:        analysis.shouldUpdate,
    requiresHumanReview: analysis.requiresHumanReview,
    impactLevel:         analysis.impactLevel,
    affectedTemplates:   [...new Set(analysis.affectedTemplates)],
    updateTasks,
    skippedTasks,
  };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class TemplateAutoUpdater {
  constructor(private readonly changeAgent: ChangeImpactAgent = new ChangeImpactAgent()) {}

  planTemplateUpdates(lastAppliedDate: string, currentDate: string): TemplateUpdatePlan {
    return planFromAnalysis(this.changeAgent.analyzeImpact(lastAppliedDate, currentDate));
  }
}
