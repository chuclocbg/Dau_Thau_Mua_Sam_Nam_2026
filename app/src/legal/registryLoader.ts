/**
 * Phase 11.2.2 — Registry Loader
 *
 * Loads a LegalRegistry from raw input (unknown / JSON-parsed data).
 * Performs four-phase validation before building the registry.
 *
 * Phase 1 — Structural: is the input an array of plain objects?
 * Phase 2 — Field-level: required fields, valid enum values, date formats,
 *            confidence range, non-empty source.
 * Phase 3 — Uniqueness: no duplicate ids, no duplicate symbols.
 * Phase 4 — Referential: supersededBy and replaces targets must exist;
 *            no cyclic supersededBy chains.
 *
 * All errors are accumulated before returning. The result is either:
 *   { ok: true,  registry: LegalRegistry }
 *   { ok: false, errors: readonly RegistryLoadError[] }
 *
 * A registry is only built when ALL four phases pass with zero errors.
 * Callers should run validateRegistry() (Phase 11.2.3) afterward for
 * semantic warnings (low confidence, missing expiry on superseded docs, etc.).
 *
 * loadRegistry() is the only public function. All helpers are module-private.
 *
 * Pure. No I/O. No side effects. No singleton. Deterministic per input.
 * No any. No React. No browser globals.
 */

import {
  createRegistry,
  isIsoDate,
  isLegalDocumentStatus,
  isLegalDocumentType,
} from './legalRegistry';
import type { LegalDocument, LegalRegistry } from './legalRegistry';

// ─── Error types ──────────────────────────────────────────────────────────────

export type RegistryLoadErrorCode =
  | 'NOT_AN_ARRAY'
  | 'NOT_AN_OBJECT'
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_TYPE'
  | 'INVALID_STATUS'
  | 'INVALID_DATE_FORMAT'
  | 'INVALID_EFFECTIVE_PERIOD'
  | 'INVALID_CONFIDENCE'
  | 'MISSING_SOURCE'
  | 'DUPLICATE_ID'
  | 'DUPLICATE_SYMBOL'
  | 'BROKEN_REFERENCE'
  | 'CYCLIC_SUPERSESSION';

export interface RegistryLoadError {
  readonly code:        RegistryLoadErrorCode;
  readonly message:     string;
  readonly documentId?: string;
  readonly field?:      string;
}

export type RegistryLoadResult =
  | { readonly ok: true;  readonly registry: LegalRegistry }
  | { readonly ok: false; readonly errors: readonly RegistryLoadError[] };

// ─── Field extraction helpers (no any) ───────────────────────────────────────

function getString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === 'string' ? v : undefined;
}

function getNumber(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key];
  return typeof v === 'number' ? v : undefined;
}

function getStringArray(obj: Record<string, unknown>, key: string): readonly string[] | undefined {
  const v = obj[key];
  if (!Array.isArray(v)) return undefined;
  if (!v.every((el): el is string => typeof el === 'string')) return undefined;
  return v;
}

// ─── Phase 1 + 2: per-document validation ────────────────────────────────────

function validateDocument(
  raw:    Record<string, unknown>,
  index:  number,
  errors: RegistryLoadError[],
): LegalDocument | null {
  const id = getString(raw, 'id')?.trim() || undefined;

  function err(
    code:    RegistryLoadErrorCode,
    message: string,
    field?:  string,
  ): void {
    errors.push({ code, message, documentId: id ?? `[index ${index}]`, field });
  }

  // Required string fields
  if (!id) {
    err('MISSING_REQUIRED_FIELD', 'Field "id" is required and must be a non-empty string.', 'id');
  }

  const symbol = getString(raw, 'symbol')?.trim() || undefined;
  if (!symbol) {
    err('MISSING_REQUIRED_FIELD', 'Field "symbol" is required.', 'symbol');
  }

  const title = getString(raw, 'title')?.trim() || undefined;
  if (!title) {
    err('MISSING_REQUIRED_FIELD', 'Field "title" is required.', 'title');
  }

  const issuer = getString(raw, 'issuer')?.trim() || undefined;
  if (!issuer) {
    err('MISSING_REQUIRED_FIELD', 'Field "issuer" is required.', 'issuer');
  }

  const summary = getString(raw, 'summary') ?? '';

  // type enum
  const rawType = getString(raw, 'type');
  if (!rawType) {
    err('MISSING_REQUIRED_FIELD', 'Field "type" is required.', 'type');
  } else if (!isLegalDocumentType(rawType)) {
    err('INVALID_TYPE', `"${rawType}" is not a valid LegalDocumentType.`, 'type');
  }

  // status enum
  const rawStatus = getString(raw, 'status');
  if (!rawStatus) {
    err('MISSING_REQUIRED_FIELD', 'Field "status" is required.', 'status');
  } else if (!isLegalDocumentStatus(rawStatus)) {
    err('INVALID_STATUS', `"${rawStatus}" is not a valid LegalDocumentStatus.`, 'status');
  }

  // effectiveDate
  const effectiveDate = getString(raw, 'effectiveDate');
  if (!effectiveDate) {
    err('MISSING_REQUIRED_FIELD', 'Field "effectiveDate" is required.', 'effectiveDate');
  } else if (!isIsoDate(effectiveDate)) {
    err('INVALID_DATE_FORMAT', `"effectiveDate" must be YYYY-MM-DD; got "${effectiveDate}".`, 'effectiveDate');
  }

  // expiredDate (optional)
  const rawExpiredDate = getString(raw, 'expiredDate');
  if (rawExpiredDate !== undefined) {
    if (!isIsoDate(rawExpiredDate)) {
      err('INVALID_DATE_FORMAT', `"expiredDate" must be YYYY-MM-DD; got "${rawExpiredDate}".`, 'expiredDate');
    } else if (effectiveDate && isIsoDate(effectiveDate) && rawExpiredDate < effectiveDate) {
      err(
        'INVALID_EFFECTIVE_PERIOD',
        `"expiredDate" (${rawExpiredDate}) must not precede "effectiveDate" (${effectiveDate}).`,
        'expiredDate',
      );
    }
  }

  // source — required and non-empty
  const source = getString(raw, 'source');
  if (source === undefined) {
    err('MISSING_REQUIRED_FIELD', 'Field "source" is required.', 'source');
  } else if (source.trim() === '') {
    err('MISSING_SOURCE', 'Field "source" must not be empty.', 'source');
  }

  // priority — required number
  const priority = getNumber(raw, 'priority');
  if (priority === undefined) {
    err('MISSING_REQUIRED_FIELD', 'Field "priority" is required and must be a number.', 'priority');
  }

  // confidence — required, 0.0–1.0
  const confidence = getNumber(raw, 'confidence');
  if (confidence === undefined) {
    err('MISSING_REQUIRED_FIELD', 'Field "confidence" is required and must be a number.', 'confidence');
  } else if (confidence < 0 || confidence > 1) {
    err('INVALID_CONFIDENCE', `"confidence" must be 0.0–1.0; got ${confidence}.`, 'confidence');
  }

  // tags — required array of strings
  const tags = getStringArray(raw, 'tags');
  if (tags === undefined) {
    err('MISSING_REQUIRED_FIELD', 'Field "tags" is required and must be an array of strings.', 'tags');
  }

  // supersededBy and replaces — optional, validated in phase 4
  const supersededBy = getString(raw, 'supersededBy');
  const replaces     = getStringArray(raw, 'replaces');

  // If any required field is missing or invalid, we cannot safely construct
  // the document — return null so phase 3/4 skip this element.
  if (
    !id || !symbol || !title || !issuer ||
    !rawType || !isLegalDocumentType(rawType) ||
    !rawStatus || !isLegalDocumentStatus(rawStatus) ||
    !effectiveDate || !isIsoDate(effectiveDate) ||
    source === undefined || source.trim() === '' ||
    priority === undefined ||
    confidence === undefined || confidence < 0 || confidence > 1 ||
    tags === undefined
  ) {
    return null;
  }

  const doc: LegalDocument = {
    id,
    symbol,
    title,
    type:          rawType,
    issuer,
    effectiveDate,
    status:        rawStatus,
    source:        source.trim(),
    priority,
    tags,
    summary,
    confidence,
    ...(rawExpiredDate !== undefined && isIsoDate(rawExpiredDate) ? { expiredDate: rawExpiredDate } : {}),
    ...(supersededBy !== undefined ? { supersededBy } : {}),
    ...(replaces !== undefined ? { replaces } : {}),
  };

  return doc;
}

// ─── Phase 4: cycle detection in supersededBy chain ──────────────────────────

function detectCycle(
  startId:        string,
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
 * Loads and validates a LegalRegistry from raw input.
 *
 * @param raw  Unknown input — typically the result of JSON.parse().
 * @param version  Registry version string embedded in metadata (default '1.0.0').
 * @param lastUpdated  YYYY-MM-DD metadata field (default '' = not tracked).
 */
export function loadRegistry(
  raw:         unknown,
  version      = '1.0.0',
  lastUpdated  = '',
): RegistryLoadResult {
  const errors: RegistryLoadError[] = [];

  // Phase 1: must be an array
  if (!Array.isArray(raw)) {
    return {
      ok: false,
      errors: [{ code: 'NOT_AN_ARRAY', message: 'Registry input must be an array of document objects.' }],
    };
  }

  // Phase 1 continued: each element must be a plain object
  const rawObjects: Record<string, unknown>[] = [];
  for (let i = 0; i < raw.length; i++) {
    const el = raw[i];
    if (typeof el !== 'object' || el === null || Array.isArray(el)) {
      errors.push({
        code:    'NOT_AN_OBJECT',
        message: `Element at index ${i} must be a plain object.`,
      });
    } else {
      rawObjects.push(el as Record<string, unknown>);
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  // Phase 2: validate each document's fields
  const validDocs: LegalDocument[] = [];
  for (let i = 0; i < rawObjects.length; i++) {
    const doc = validateDocument(rawObjects[i]!, i, errors);
    if (doc !== null) validDocs.push(doc);
  }

  // Phase 3: uniqueness checks (only on valid docs)
  const seenIds     = new Map<string, number>(); // id → first-seen index
  const seenSymbols = new Map<string, number>();

  for (let i = 0; i < validDocs.length; i++) {
    const doc = validDocs[i]!;

    if (seenIds.has(doc.id)) {
      errors.push({
        code:       'DUPLICATE_ID',
        message:    `Duplicate id "${doc.id}" at index ${i} (first seen at index ${seenIds.get(doc.id)}).`,
        documentId: doc.id,
        field:      'id',
      });
    } else {
      seenIds.set(doc.id, i);
    }

    if (seenSymbols.has(doc.symbol)) {
      errors.push({
        code:       'DUPLICATE_SYMBOL',
        message:    `Duplicate symbol "${doc.symbol}" at index ${i} (first seen at index ${seenSymbols.get(doc.symbol)}).`,
        documentId: doc.id,
        field:      'symbol',
      });
    } else {
      seenSymbols.set(doc.symbol, i);
    }
  }

  // Phase 4: referential integrity + cycle detection (only if no id/symbol errors)
  const hasUniquenessErrors = errors.some(e => e.code === 'DUPLICATE_ID' || e.code === 'DUPLICATE_SYMBOL');

  if (!hasUniquenessErrors) {
    const idSet            = new Set(validDocs.map(d => d.id));
    const supersededByMap  = new Map<string, string>();

    for (const doc of validDocs) {
      // supersededBy must reference an existing id
      if (doc.supersededBy !== undefined) {
        if (!idSet.has(doc.supersededBy)) {
          errors.push({
            code:       'BROKEN_REFERENCE',
            message:    `"supersededBy" references unknown id "${doc.supersededBy}".`,
            documentId: doc.id,
            field:      'supersededBy',
          });
        } else {
          supersededByMap.set(doc.id, doc.supersededBy);
        }
      }

      // replaces items must reference existing ids
      if (doc.replaces !== undefined) {
        for (const refId of doc.replaces) {
          if (!idSet.has(refId)) {
            errors.push({
              code:       'BROKEN_REFERENCE',
              message:    `"replaces" contains unknown id "${refId}".`,
              documentId: doc.id,
              field:      'replaces',
            });
          }
        }
      }
    }

    // Cycle detection in supersededBy chain
    for (const doc of validDocs) {
      if (doc.supersededBy !== undefined && detectCycle(doc.id, supersededByMap)) {
        errors.push({
          code:       'CYCLIC_SUPERSESSION',
          message:    `Cyclic "supersededBy" chain detected starting from "${doc.id}".`,
          documentId: doc.id,
          field:      'supersededBy',
        });
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok:       true,
    registry: createRegistry(validDocs, version, lastUpdated),
  };
}
