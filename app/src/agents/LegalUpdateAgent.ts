/**
 * Legal v5.0 — LegalUpdateAgent
 *
 * Orchestrates the full v4.x regulation-update pipeline in a single call.
 * Each of the four engines is invoked exactly once; their results are
 * collected and re-exposed on the return value so callers never need to
 * call any sub-engine independently.
 *
 * Pipeline (in call order):
 *   1. buildUpdateNotification()  → notification
 *   2. buildComplianceReport()    → complianceReport
 *   3. buildMigrationPlan()       → migrationPlan   ← source of impactLevel / requiresHumanReview
 *   4. buildAuditTrail()          → auditTrail
 *
 * shouldUpdate rules:
 *   LOW      → false   (no material change, no action required)
 *   MEDIUM   → true
 *   HIGH     → true
 *   CRITICAL → true
 *
 * Equivalent to: shouldUpdate = impactLevel !== 'LOW'
 *
 * Does NOT modify ChatAgent, LegalReviewerAgent, LegalPipelineEnricher,
 * DocumentGenerator, ContractReviewer, DecisionAssistant, or any v4.x engine.
 * Existing APIs remain 100% unchanged.
 *
 * Pure (no instance state). Deterministic. No singleton. No cache.
 * No side effects. No LLM. No browser globals. No hooks. No IndexedDB. No UI.
 */

import { buildUpdateNotification } from '../ai/updateNotificationEngine';
import { buildComplianceReport }   from '../ai/complianceReportEngine';
import { buildMigrationPlan }      from '../ai/migrationEngine';
import { buildAuditTrail }         from '../ai/auditTrailEngine';
import type { UpdateNotification } from '../ai/updateNotificationEngine';
import type { ComplianceReport }   from '../ai/complianceReportEngine';
import type { MigrationPlan }      from '../ai/migrationEngine';
import type { AuditTrail }         from '../ai/auditTrailEngine';
import type { ImpactLevel }        from '../ai/updatePackageEngine';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface UpdateCheckResult {
  notification:        UpdateNotification;
  complianceReport:    ComplianceReport;
  migrationPlan:       MigrationPlan;
  auditTrail:          AuditTrail;
  requiresHumanReview: boolean;
  shouldUpdate:        boolean;
  impactLevel:         ImpactLevel;
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class LegalUpdateAgent {
  /**
   * Runs the full regulation-update pipeline for the given date range.
   * Returns a single result object containing the output of all four
   * pipeline engines plus derived flags (shouldUpdate, requiresHumanReview).
   *
   * @param lastAppliedDate  ISO 8601 date of the last applied regulation snapshot
   * @param currentDate      ISO 8601 date to check for new regulations
   */
  checkForUpdates(lastAppliedDate: string, currentDate: string): UpdateCheckResult {
    const notification     = buildUpdateNotification(lastAppliedDate, currentDate);
    const complianceReport = buildComplianceReport(lastAppliedDate, currentDate);
    const migrationPlan    = buildMigrationPlan(lastAppliedDate, currentDate);
    const auditTrail       = buildAuditTrail(lastAppliedDate, currentDate);
    const impactLevel      = migrationPlan.impactLevel;
    return {
      notification,
      complianceReport,
      migrationPlan,
      auditTrail,
      requiresHumanReview: migrationPlan.requiresHumanReview,
      shouldUpdate:        impactLevel !== 'LOW',
      impactLevel,
    };
  }
}
