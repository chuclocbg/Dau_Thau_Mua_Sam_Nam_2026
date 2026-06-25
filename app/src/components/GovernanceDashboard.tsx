/**
 * Phase 11.1 — GovernanceDashboard
 *
 * Enterprise-grade Legal Governance dashboard for Vietnamese public
 * procurement institutions.  Displays five governance sections derived from
 * two authoritative data sources:
 *
 *   AuditHistory       (Legal v10.0 AuditTrail)
 *   RegulationSnapshot (Legal v4.3 EffectiveDateEngine)
 *
 * Sections (rendered in fixed order):
 *
 *   1. procurement-summary  — latest AuditRecord status badges + target date
 *   2. audit-summary        — aggregate totalAudits + actionableCount counters
 *   3. legal-alerts         — records where hasActions === true
 *   4. missing-documents    — records where totalCount > 0 (documents to prepare)
 *   5. legal-snapshot       — RegulationSnapshot: effective date + threshold list
 *
 * Naming:
 *   Named GovernanceDashboard (not LegalDashboard) to avoid collision with the
 *   existing Legal v3.0 LegalDashboard component, which renders AgentMessage-based
 *   data in 7 severity panels and must remain unchanged.
 *
 * Data-* contract (stable for testing):
 *   data-panel="governance-dashboard"             — root <div>
 *   data-section="procurement-summary"            — section 1
 *   data-section="audit-summary"                  — section 2
 *   data-section="legal-alerts"                   — section 3
 *   data-alert-count={n}                          — alert count on section 3
 *   data-section="missing-documents"              — section 4
 *   data-missing-count={n}                        — missing count on section 4
 *   data-section="legal-snapshot"                 — section 5
 *   data-snapshot-date={snapshot.targetDate}      — on section 5
 *   data-field="total-audits"                     — history.totalAudits
 *   data-field="actionable-count"                 — history.actionableCount
 *   data-field="target-date"                      — record.targetDate or snapshot date
 *   data-field="threshold-count"                  — snapshot.thresholds.length
 *   data-field="band-count"                       — snapshot.procurementBands.length
 *   data-item="alert"          data-sequence      — per-record in legal-alerts
 *   data-item="missing"        data-sequence      — per-record in missing-documents
 *   data-item="threshold"      data-code          — per-threshold in legal-snapshot
 *   data-row="empty-state"                        — fallback when a section is empty
 *
 * Legal Versioning principle:
 *   The RegulationSnapshot must already be resolved by the caller via
 *   EffectiveDateEngine.getRegulationSnapshot(targetDate) before passing it
 *   here.  This component never calls EffectiveDateEngine directly — the
 *   snapshot is injected via props (dependency inversion).
 *
 * dashboardFromInputs() is exported as a pure mapping helper following the
 * established Phase 10 helper pattern.
 *
 * Never throws. No browser globals. No LLM calls. No IndexedDB.
 * SSR-compatible. Pure functional. No hooks. No state. No side effects.
 */

import React from 'react';
import type { AuditHistory, AuditRecord } from '../agents/AuditTrail';
import type { RegulationSnapshot }        from '../ai/effectiveDateEngine';
import {
  LegalStatusBadge,
  LegalActionBadge,
  LegalCountBadge,
} from './LegalBadges';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GovernanceDashboardProps {
  history:    AuditHistory;
  snapshot:   RegulationSnapshot;
  className?: string;
}

// ─── Exported pure helper ─────────────────────────────────────────────────────

export function dashboardFromInputs(
  history:  AuditHistory,
  snapshot: RegulationSnapshot,
): GovernanceDashboardProps {
  return { history, snapshot };
}

// ─── Internal sub-sections ────────────────────────────────────────────────────

function ProcurementSummary({ record }: { record: AuditRecord | undefined }) {
  if (!record) {
    return (
      <section data-section="procurement-summary">
        <span data-row="empty-state">Chưa có dữ liệu đấu thầu</span>
      </section>
    );
  }
  return (
    <section data-section="procurement-summary">
      <LegalStatusBadge code={record.primaryCode} />
      <LegalActionBadge hasActions={record.hasActions} />
      <LegalCountBadge count={record.totalCount} />
      <span data-field="target-date">{record.targetDate}</span>
    </section>
  );
}

function AuditSummary({ history }: { history: AuditHistory }) {
  return (
    <section data-section="audit-summary">
      <span data-field="total-audits">{history.totalAudits}</span>
      <span data-field="actionable-count">{history.actionableCount}</span>
    </section>
  );
}

function LegalAlerts({ alerts }: { alerts: readonly AuditRecord[] }) {
  return (
    <section data-section="legal-alerts" data-alert-count={alerts.length}>
      {alerts.length > 0 ? (
        <ul data-list="alerts">
          {alerts.map(r => (
            <li
              key={r.sequence}
              data-item="alert"
              data-sequence={r.sequence}
              data-code={r.primaryCode}
            >
              <LegalStatusBadge code={r.primaryCode} />
              <span data-field="target-date">{r.targetDate}</span>
            </li>
          ))}
        </ul>
      ) : (
        <span data-row="empty-state">Không có cảnh báo</span>
      )}
    </section>
  );
}

function MissingDocuments({ missing }: { missing: readonly AuditRecord[] }) {
  return (
    <section data-section="missing-documents" data-missing-count={missing.length}>
      {missing.length > 0 ? (
        <ul data-list="missing-items">
          {missing.map(r => (
            <li
              key={r.sequence}
              data-item="missing"
              data-sequence={r.sequence}
              data-count={r.totalCount}
            >
              <LegalCountBadge count={r.totalCount} />
              <span data-field="target-date">{r.targetDate}</span>
            </li>
          ))}
        </ul>
      ) : (
        <span data-row="empty-state">Đủ tài liệu</span>
      )}
    </section>
  );
}

function LegalSnapshotSection({ snapshot }: { snapshot: RegulationSnapshot }) {
  return (
    <section
      data-section="legal-snapshot"
      data-snapshot-date={snapshot.targetDate}
    >
      <span data-field="snapshot-date">{snapshot.targetDate}</span>
      <span data-field="threshold-count">{snapshot.thresholds.length}</span>
      <span data-field="band-count">{snapshot.procurementBands.length}</span>
      {snapshot.thresholds.length > 0 && (
        <ul data-list="thresholds">
          {snapshot.thresholds.map(t => (
            <li key={t.code} data-item="threshold" data-code={t.code}>
              <span data-field="description">{t.description}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GovernanceDashboard({
  history,
  snapshot,
  className,
}: GovernanceDashboardProps) {
  const alertRecords   = history.records.filter(r => r.hasActions);
  const missingRecords = history.records.filter(r => r.totalCount > 0);

  return (
    <div data-panel="governance-dashboard" className={className}>
      <ProcurementSummary record={history.latestRecord} />
      <AuditSummary       history={history} />
      <LegalAlerts        alerts={alertRecords} />
      <MissingDocuments   missing={missingRecords} />
      <LegalSnapshotSection snapshot={snapshot} />
    </div>
  );
}
