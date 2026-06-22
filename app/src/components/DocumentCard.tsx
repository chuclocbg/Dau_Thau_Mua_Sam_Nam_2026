/**
 * Phase 10.1 — DocumentCard
 *
 * Renders a single AuditRecord as a structured card.
 * Composes LegalStatusBadge, LegalActionBadge, and LegalCountBadge from
 * Phase 10.0 (LegalBadges). No other component dependencies.
 *
 * Data-* contract (stable for testing):
 *   data-panel="document-card"   — root container
 *   data-sequence={n}            — 0-based raw sequence from AuditRecord
 *   data-code={primaryCode}      — primaryCode mirrored on root for fast lookup
 *   data-field="sequence"        — displays 1-based ordinal (sequence + 1)
 *   data-field="target-date"     — displays record.targetDate string
 *
 * Child badges follow their own data-* contracts from LegalBadges:
 *   data-badge="legal-status"    — RecommendationCode via LegalStatusBadge
 *   data-badge="legal-action"    — hasActions via LegalActionBadge
 *   data-badge="legal-count"     — appears twice:
 *     first  → totalCount + default label "tài liệu"
 *     second → recommendationCount + label "khuyến nghị"
 *
 * Sequence display:
 *   data-sequence attribute holds the 0-based raw value for programmatic use.
 *   The data-field="sequence" text shows (sequence + 1) for 1-based UI display.
 *
 * cardFromRecord() is exported as a pure mapping helper so tests can build
 * props without constructing JSX.
 *
 * Returns a populated div — callers are responsible for null/empty guards.
 * Never throws. No browser globals. No LLM calls. No IndexedDB. SSR-compatible.
 * Pure functional. No hooks. No state. No side effects.
 */

import React from 'react';
import type { AuditRecord } from '../agents/AuditTrail';
import {
  LegalStatusBadge,
  LegalActionBadge,
  LegalCountBadge,
} from './LegalBadges';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DocumentCardProps {
  record:     AuditRecord;
  className?: string;
}

// ─── Exported pure helper ─────────────────────────────────────────────────────

export function cardFromRecord(record: AuditRecord): DocumentCardProps {
  return { record };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentCard({ record, className }: DocumentCardProps) {
  return (
    <div
      data-panel="document-card"
      data-sequence={record.sequence}
      data-code={record.primaryCode}
      className={className}
    >
      <div data-field="sequence">{record.sequence + 1}</div>
      <div data-field="target-date">{record.targetDate}</div>
      <LegalStatusBadge code={record.primaryCode} />
      <LegalActionBadge hasActions={record.hasActions} />
      <LegalCountBadge count={record.totalCount} />
      <LegalCountBadge count={record.recommendationCount} label="khuyến nghị" />
    </div>
  );
}
