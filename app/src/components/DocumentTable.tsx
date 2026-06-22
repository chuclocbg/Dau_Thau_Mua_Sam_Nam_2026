/**
 * Phase 10.4 — DocumentTable
 *
 * Renders a complete AuditHistory as an HTML <table>.
 * Delegates each record row to DocumentTableRow (Phase 10.3).
 *
 * Table structure:
 *   <table>
 *     <thead>  — four column headers matching DocumentTableRow cell layout
 *     <tbody>  — one DocumentTableRow per AuditHistory.records entry,
 *                OR a single empty-state <tr> when records is empty
 *
 * Column order matches DocumentTableRow cell order:
 *   card → status → action → count
 *
 * Data-* contract (stable for testing):
 *   data-table="document-table"              — root <table>
 *   data-total-audits={history.totalAudits}  — from AuditHistory
 *   data-actionable-count={history.actionableCount}
 *   data-section="header"                   — <thead>
 *   data-col="card"/"status"/"action"/"count" — <th> in header
 *   data-section="body"                     — <tbody>
 *   data-row="document-table-row"           — each DocumentTableRow <tr>
 *   data-row="empty-state"                  — fallback <tr> when records is empty
 *
 * When records.length === 0 the <tbody> renders a single
 * <tr data-row="empty-state"> with a "Không có dữ liệu" message
 * spanning all four columns.
 *
 * tableFromHistory() is exported as a pure mapping helper following the
 * established cardFromRecord / panelFromResult / rowFromRecord pattern.
 *
 * Depends only on:
 *   DocumentTableRow (Phase 10.3) — row renderer
 *   AuditHistory type (AuditTrail v10.0) — input shape
 *
 * Never throws. No browser globals. No LLM calls. No IndexedDB.
 * SSR-compatible. Pure functional. No hooks. No state. No side effects.
 */

import React from 'react';
import type { AuditHistory } from '../agents/AuditTrail';
import { DocumentTableRow } from './DocumentTableRow';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DocumentTableProps {
  history:    AuditHistory;
  className?: string;
}

// ─── Exported pure helper ─────────────────────────────────────────────────────

export function tableFromHistory(history: AuditHistory): DocumentTableProps {
  return { history };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentTable({ history, className }: DocumentTableProps) {
  return (
    <table
      data-table="document-table"
      data-total-audits={history.totalAudits}
      data-actionable-count={history.actionableCount}
      className={className}
    >
      <thead data-section="header">
        <tr>
          <th data-col="card">Tài liệu</th>
          <th data-col="status">Trạng thái</th>
          <th data-col="action">Hành động</th>
          <th data-col="count">Số lượng</th>
        </tr>
      </thead>
      <tbody data-section="body">
        {history.records.length > 0
          ? history.records.map(record => (
              <DocumentTableRow key={record.sequence} record={record} />
            ))
          : (
              <tr data-row="empty-state">
                <td colSpan={4}>Không có dữ liệu</td>
              </tr>
            )
        }
      </tbody>
    </table>
  );
}
