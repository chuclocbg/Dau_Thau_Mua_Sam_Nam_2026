/**
 * Phase 10.3 — DocumentTableRow
 *
 * Renders a single AuditRecord as a <tr> element for use inside a <tbody>.
 * Composes DocumentCard (Phase 10.1) and the three badge atoms from Phase 10.0.
 *
 * Why both DocumentCard and individual badges in the same row:
 *   - data-cell="card"   holds the full DocumentCard for expanded detail display.
 *   - data-cell="status" / "action" / "count" are separate <td> columns so a
 *     table consumer can scan each field independently without parsing the card.
 *
 * Cell layout (fixed order, left to right):
 *   [card]   — DocumentCard (full structured card with all fields)
 *   [status] — LegalStatusBadge (primaryCode → Vietnamese label)
 *   [action] — LegalActionBadge (hasActions → action indicator)
 *   [count]  — LegalCountBadge  (totalCount)
 *
 * Data-* contract (stable for testing):
 *   data-row="document-table-row"   — root <tr>
 *   data-sequence={record.sequence} — 0-based sequence from AuditRecord
 *   data-code={record.primaryCode}  — primaryCode on root for fast row lookup
 *   data-cell="card"                — <td> wrapping DocumentCard
 *   data-cell="status"              — <td> wrapping LegalStatusBadge
 *   data-cell="action"              — <td> wrapping LegalActionBadge
 *   data-cell="count"               — <td> wrapping LegalCountBadge
 *
 * Note on HTML validity:
 *   <tr> without a <table>/<tbody> parent is invalid HTML but renders correctly
 *   in React's renderToString. The consuming DocumentTable component is
 *   responsible for wrapping rows inside a proper <table><tbody>.
 *
 * rowFromRecord() is exported as a pure mapping helper following the established
 * cardFromRecord / panelFromResult pattern.
 *
 * Never throws. No browser globals. No LLM calls. No IndexedDB. SSR-compatible.
 * Pure functional. No hooks. No state. No side effects.
 */

import React from 'react';
import type { AuditRecord } from '../agents/AuditTrail';
import { DocumentCard }     from './DocumentCard';
import {
  LegalStatusBadge,
  LegalActionBadge,
  LegalCountBadge,
} from './LegalBadges';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DocumentTableRowProps {
  record:     AuditRecord;
  className?: string;
}

// ─── Exported pure helper ─────────────────────────────────────────────────────

export function rowFromRecord(record: AuditRecord): DocumentTableRowProps {
  return { record };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentTableRow({ record, className }: DocumentTableRowProps) {
  return (
    <tr
      data-row="document-table-row"
      data-sequence={record.sequence}
      data-code={record.primaryCode}
      className={className}
    >
      <td data-cell="card">
        <DocumentCard record={record} />
      </td>
      <td data-cell="status">
        <LegalStatusBadge code={record.primaryCode} />
      </td>
      <td data-cell="action">
        <LegalActionBadge hasActions={record.hasActions} />
      </td>
      <td data-cell="count">
        <LegalCountBadge count={record.totalCount} />
      </td>
    </tr>
  );
}
