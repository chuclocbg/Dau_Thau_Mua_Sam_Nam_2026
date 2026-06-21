/**
 * Legal v4.7 — Compliance Report Engine
 *
 * buildComplianceReport(oldDate, newDate) → ComplianceReport
 *
 * Composes the full audit-ready compliance report by calling buildMigrationPlan()
 * and translating its output into a structured section list.
 *
 * Section generation rules:
 *   Each affected area produces one section (title, severity, lines derived
 *   from primary action reasons).  Empty areas are omitted.
 *   Sections appear in this fixed order:
 *     1 thresholds       → "Threshold changes"       severity HIGH
 *     2 procurementBands → "Procurement band changes" severity MEDIUM
 *     3 contractTypes    → "Contract type changes"    severity MEDIUM
 *     4 fundSources      → "Fund source changes"      severity LOW
 *     5 riskThresholds   → "Risk rule changes"        severity CRITICAL
 *     6 (if humanReviewRequired) "Manual review items"  severity HIGH
 *     7 (if impactLevel=CRITICAL) "Critical impact"     severity CRITICAL
 *
 * Summary rules:
 *   0 affected areas → "No regulatory changes detected."
 *   n affected areas → "<n> affected areas detected."
 *
 * buildSections() is exported so tests can exercise it with synthetic data
 * for categories that produce no real-data changes (MEDIUM/CRITICAL scenarios).
 *
 * Does NOT modify any existing engine, loader, resolver, diff engine,
 * update package engine, or migration engine.
 * Existing APIs remain 100% unchanged.
 *
 * Pure function. Deterministic. No singleton. No cache. No side effects.
 * No LLM. No browser globals. No hooks. No IndexedDB. No UI.
 */

import { buildMigrationPlan } from './migrationEngine';
import type { Action } from './migrationEngine';
import type { ImpactLevel, AffectedArea } from './updatePackageEngine';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface Section {
  title:    string;
  severity: ImpactLevel;
  lines:    readonly string[];
}

export interface ComplianceReport {
  oldDate:             string;
  newDate:             string;
  impactLevel:         ImpactLevel;
  summary:             string;
  affectedAreas:       readonly AffectedArea[];
  actions:             readonly Action[];
  humanReviewRequired: boolean;
  sections:            readonly Section[];
}

// ─── Area configuration (defines section titles, severities, and ordering) ────

interface AreaConfig {
  area:     AffectedArea;
  title:    string;
  severity: ImpactLevel;
}

const AREA_CONFIGS: readonly AreaConfig[] = [
  { area: 'thresholds',       title: 'Threshold changes',       severity: 'HIGH'     },
  { area: 'procurementBands', title: 'Procurement band changes', severity: 'MEDIUM'   },
  { area: 'contractTypes',    title: 'Contract type changes',    severity: 'MEDIUM'   },
  { area: 'fundSources',      title: 'Fund source changes',      severity: 'LOW'      },
  { area: 'riskThresholds',   title: 'Risk rule changes',        severity: 'CRITICAL' },
];

// ─── Exported section builder (used directly in tests for synthetic data) ──────

/**
 * Builds the ordered section list from migration plan components.
 * Accepts these parameters separately so tests can supply synthetic data
 * without going through the full JSON-snapshot pipeline.
 */
export function buildSections(
  affectedAreas:       readonly AffectedArea[],
  actions:             readonly Action[],
  impactLevel:         ImpactLevel,
  humanReviewRequired: boolean,
): readonly Section[] {
  const sections: Section[] = [];

  // Positions 1–5: one section per affected area, in AREA_CONFIGS order
  for (const config of AREA_CONFIGS) {
    if (!affectedAreas.includes(config.area)) continue;
    const lines = actions
      .filter(a => a.area === config.area && a.action !== 'REVIEW_MANUALLY')
      .map(a => a.reason);
    sections.push({ title: config.title, severity: config.severity, lines });
  }

  // Position 6: manual review section — appended when humanReviewRequired
  if (humanReviewRequired) {
    const reviewLines = actions
      .filter(a => a.action === 'REVIEW_MANUALLY')
      .map(a => `${a.area}: ${a.reason}`);
    sections.push({
      title:    'Manual review items',
      severity: 'HIGH',
      lines:    reviewLines.length > 0 ? reviewLines : ['Review required before applying changes.'],
    });
  }

  // Position 7: critical impact section — appended when impactLevel is CRITICAL
  if (impactLevel === 'CRITICAL') {
    sections.push({
      title:    'Critical impact',
      severity: 'CRITICAL',
      lines:    ['Immediate review required.'],
    });
  }

  return sections;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function buildSummary(affectedAreas: readonly AffectedArea[]): string {
  return affectedAreas.length === 0
    ? 'No regulatory changes detected.'
    : `${affectedAreas.length} affected areas detected.`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildComplianceReport(oldDate: string, newDate: string): ComplianceReport {
  const plan = buildMigrationPlan(oldDate, newDate);
  return {
    oldDate,
    newDate,
    impactLevel:         plan.impactLevel,
    summary:             buildSummary(plan.affectedAreas),
    affectedAreas:       plan.affectedAreas,
    actions:             plan.actions,
    humanReviewRequired: plan.requiresHumanReview,
    sections:            buildSections(
      plan.affectedAreas,
      plan.actions,
      plan.impactLevel,
      plan.requiresHumanReview,
    ),
  };
}
