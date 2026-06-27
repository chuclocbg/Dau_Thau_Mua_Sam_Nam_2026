/**
 * Phase 11.2.3 — Registry Validator
 *
 * Semantic audit of an already-built LegalRegistry.  Produces a structured
 * RegistryValidationReport with errors, warnings, and statistics.
 *
 * Distinction from registryLoader.ts:
 *   Loader   — parses raw input and rejects structurally invalid data.
 *   Validator — audits an existing registry for semantic consistency.
 *
 * Error conditions (invalidate the report's ok flag):
 *   MISSING_SOURCE        — document.source is empty after trim
 *   DUPLICATE_SYMBOL      — two documents share the same symbol
 *   INVALID_PERIOD        — expiredDate < effectiveDate
 *   BROKEN_SUPERSEDED_BY  — supersededBy references a non-existent id
 *   BROKEN_REPLACES       — replaces contains a non-existent id
 *   CYCLIC_SUPERSESSION   — a supersededBy chain forms a cycle
 *
 * Warning conditions (do not affect ok):
 *   LOW_CONFIDENCE            — document.confidence < 0.5
 *   NO_TAGS                   — document.tags is empty
 *   NO_SUMMARY                — document.summary is empty
 *   MISSING_EXPIRY_ON_SUPERSEDED — status is SUPERSEDED but expiredDate is absent
 *
 * ValidationStats counts documents by status across the full registry.
 *
 * validateRegistry() is the only public function.  It takes a MinLegalRegistry
 * (not the full LegalRegistry) so any consumer can audit a partial registry.
 *
 * Pure. No I/O. No side effects. No singleton. Deterministic per input.
 * No any. No React. No browser globals.
 */

import type { MinLegalRegistry, LegalDocument } from './legalRegistry';

// ─── Error / warning types ────────────────────────────────────────────────────

export type ValidationErrorCode =
  | 'MISSING_SOURCE'
  | 'DUPLICATE_SYMBOL'
  | 'INVALID_PERIOD'
  | 'BROKEN_SUPERSEDED_BY'
  | 'BROKEN_REPLACES'
  | 'CYCLIC_SUPERSESSION';

export type ValidationWarningCode =
  | 'LOW_CONFIDENCE'
  | 'NO_TAGS'
  | 'NO_SUMMARY'
  | 'MISSING_EXPIRY_ON_SUPERSEDED';

export interface ValidationError {
  readonly code:        ValidationErrorCode;
  readonly message:     string;
  readonly documentId?: string;
}

export interface ValidationWarning {
  readonly code:        ValidationWarningCode;
  readonly message:     string;
  readonly documentId?: string;
}

export interface ValidationStats {
  readonly total:      number;
  readonly active:     number;
  readonly expired:    number;
  readonly superseded: number;
  readonly draft:      number;
  readonly repealed:   number;
}

export interface RegistryValidationReport {
  readonly ok:       boolean;
  readonly errors:   readonly ValidationError[];
  readonly warnings: readonly ValidationWarning[];
  readonly stats:    ValidationStats;
}

// ─── Cycle detection ──────────────────────────────────────────────────────────

function hasCycle(
  startId:         string,
  supersededByMap: Map<string, string>,
): boolean {
  const visited = new Set<string>();
  let current: string | undefined = startId;
  while (current !== undefined) {
    if (visited.has(current)) return true;
    visited.add(current);
    current = supersededByMap.get(current);
  }
  return false;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validates a LegalRegistry and returns a structured report.
 *
 * @param registry  Any MinLegalRegistry — the full LegalRegistry satisfies this.
 */
export function validateRegistry(
  registry: MinLegalRegistry,
): RegistryValidationReport {
  const errors:   ValidationError[]   = [];
  const warnings: ValidationWarning[] = [];
  const docs:     readonly LegalDocument[] = registry.documents;

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats: ValidationStats = {
    total:      docs.length,
    active:     docs.filter(d => d.status === 'ACTIVE').length,
    expired:    docs.filter(d => d.status === 'EXPIRED').length,
    superseded: docs.filter(d => d.status === 'SUPERSEDED').length,
    draft:      docs.filter(d => d.status === 'DRAFT').length,
    repealed:   docs.filter(d => d.status === 'REPEALED').length,
  };

  if (docs.length === 0) {
    return { ok: true, errors, warnings, stats };
  }

  const idSet          = new Set(docs.map(d => d.id));
  const seenSymbols    = new Map<string, string>(); // symbol → first id
  const supersededByMap = new Map<string, string>();

  for (const doc of docs) {

    // Error: empty source
    if (doc.source.trim() === '') {
      errors.push({
        code:       'MISSING_SOURCE',
        message:    `Document "${doc.id}" has an empty "source" field.`,
        documentId: doc.id,
      });
    }

    // Error: duplicate symbol
    if (seenSymbols.has(doc.symbol)) {
      errors.push({
        code:       'DUPLICATE_SYMBOL',
        message:    `Symbol "${doc.symbol}" is shared by "${doc.id}" and "${seenSymbols.get(doc.symbol)}".`,
        documentId: doc.id,
      });
    } else {
      seenSymbols.set(doc.symbol, doc.id);
    }

    // Error: invalid effective period
    if (doc.expiredDate !== undefined && doc.expiredDate < doc.effectiveDate) {
      errors.push({
        code:       'INVALID_PERIOD',
        message:    `Document "${doc.id}" has expiredDate (${doc.expiredDate}) before effectiveDate (${doc.effectiveDate}).`,
        documentId: doc.id,
      });
    }

    // Error: broken supersededBy reference
    if (doc.supersededBy !== undefined) {
      if (!idSet.has(doc.supersededBy)) {
        errors.push({
          code:       'BROKEN_SUPERSEDED_BY',
          message:    `Document "${doc.id}" supersededBy references unknown id "${doc.supersededBy}".`,
          documentId: doc.id,
        });
      } else {
        supersededByMap.set(doc.id, doc.supersededBy);
      }
    }

    // Error: broken replaces references
    if (doc.replaces !== undefined) {
      for (const refId of doc.replaces) {
        if (!idSet.has(refId)) {
          errors.push({
            code:       'BROKEN_REPLACES',
            message:    `Document "${doc.id}" replaces references unknown id "${refId}".`,
            documentId: doc.id,
          });
        }
      }
    }

    // Warning: low confidence
    if (doc.confidence < 0.5) {
      warnings.push({
        code:       'LOW_CONFIDENCE',
        message:    `Document "${doc.id}" has low confidence score (${doc.confidence}).`,
        documentId: doc.id,
      });
    }

    // Warning: no tags
    if (doc.tags.length === 0) {
      warnings.push({
        code:       'NO_TAGS',
        message:    `Document "${doc.id}" has no tags — will not appear in keyword searches.`,
        documentId: doc.id,
      });
    }

    // Warning: no summary
    if (doc.summary.trim() === '') {
      warnings.push({
        code:       'NO_SUMMARY',
        message:    `Document "${doc.id}" has no summary.`,
        documentId: doc.id,
      });
    }

    // Warning: SUPERSEDED without expiredDate
    if (doc.status === 'SUPERSEDED' && doc.expiredDate === undefined) {
      warnings.push({
        code:       'MISSING_EXPIRY_ON_SUPERSEDED',
        message:    `Document "${doc.id}" is SUPERSEDED but has no expiredDate.`,
        documentId: doc.id,
      });
    }
  }

  // Cycle detection (only over documents with valid supersededBy references)
  const cycleReported = new Set<string>();
  for (const doc of docs) {
    if (
      doc.supersededBy !== undefined &&
      idSet.has(doc.supersededBy) &&
      !cycleReported.has(doc.id) &&
      hasCycle(doc.id, supersededByMap)
    ) {
      errors.push({
        code:       'CYCLIC_SUPERSESSION',
        message:    `Cyclic supersession chain detected starting from "${doc.id}".`,
        documentId: doc.id,
      });
      cycleReported.add(doc.id);
    }
  }

  return {
    ok:       errors.length === 0,
    errors:   Object.freeze(errors),
    warnings: Object.freeze(warnings),
    stats,
  };
}
