/**
 * Legal v4.8 — Update Notification Engine
 *
 * buildUpdateNotification(oldDate, newDate) → UpdateNotification
 *
 * Thin presentation adapter over buildComplianceReport().  Converts the
 * structured compliance report into a notification-ready payload: a title,
 * a severity badge, and a flat list of message lines ready for display or
 * delivery (email, dashboard alert, audit log entry).
 *
 * Title rules:
 *   0 affected areas → "No regulatory changes"
 *   n affected areas → "Regulatory update detected"
 *
 * Severity: propagated directly from impactLevel (LOW/MEDIUM/HIGH/CRITICAL).
 *
 * messageLines construction (in order, no empty lines, no duplicates):
 *   1. "From <oldDate> to <newDate>"
 *   2. summary    (e.g. "1 affected areas detected." or "No regulatory changes detected.")
 *   3. one line per section title, in section order
 *
 * Ordering follows complianceReportEngine section order:
 *   thresholds → procurementBands → contractTypes → fundSources →
 *   riskThresholds → manual review → critical impact
 *
 * Does NOT modify any existing engine, loader, resolver, diff engine,
 * update package engine, migration engine, or compliance report engine.
 * Existing APIs remain 100% unchanged.
 *
 * Pure function. Deterministic. No singleton. No cache. No side effects.
 * No LLM. No browser globals. No hooks. No IndexedDB. No UI.
 */

import { buildComplianceReport } from './complianceReportEngine';
import type { Section } from './complianceReportEngine';
import type { ImpactLevel, AffectedArea } from './updatePackageEngine';

// ─── Public type ──────────────────────────────────────────────────────────────

export interface UpdateNotification {
  title:               string;
  severity:            ImpactLevel;
  summary:             string;
  affectedAreas:       readonly AffectedArea[];
  requiresHumanReview: boolean;
  sections:            readonly Section[];
  messageLines:        readonly string[];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildUpdateNotification(oldDate: string, newDate: string): UpdateNotification {
  const report = buildComplianceReport(oldDate, newDate);
  const title  = report.affectedAreas.length === 0
    ? 'No regulatory changes'
    : 'Regulatory update detected';
  const messageLines: readonly string[] = [
    `From ${oldDate} to ${newDate}`,
    report.summary,
    ...report.sections.map(s => s.title),
  ];
  return {
    title,
    severity:            report.impactLevel,
    summary:             report.summary,
    affectedAreas:       report.affectedAreas,
    requiresHumanReview: report.humanReviewRequired,
    sections:            report.sections,
    messageLines,
  };
}
