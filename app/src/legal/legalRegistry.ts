/**
 * Phase 11.2.1 — Legal Registry Core
 *
 * Domain model for the Legal Registry: the single source of truth for every
 * legal instrument that governs the AI Governance Platform.
 *
 * Supported document types (Vietnamese legal hierarchy):
 *   LAW               — Luật (National Assembly)
 *   RESOLUTION        — Nghị quyết (National Assembly / Standing Committee)
 *   DECREE            — Nghị định (Government)
 *   CIRCULAR          — Thông tư (Ministry)
 *   DECISION          — Quyết định (Prime Minister / Ministry)
 *   INTERNAL_REGULATION — Quy chế / Quy định nội bộ (Institution)
 *   GUIDELINE         — Hướng dẫn (Any issuing authority)
 *
 * LegalDocument fields:
 *   id            — Stable kebab-case identifier; never changes after publication.
 *   symbol        — Official Vietnamese symbol (e.g. "22/2023/QH15").
 *   title         — Full Vietnamese title.
 *   type          — LegalDocumentType (see above).
 *   issuer        — Issuing authority (e.g. "Quốc hội", "Bộ Tài chính").
 *   effectiveDate — YYYY-MM-DD when the document became effective.
 *   expiredDate   — YYYY-MM-DD when the document expired; absent if still active.
 *   status        — Current lifecycle status (ACTIVE | EXPIRED | SUPERSEDED | DRAFT | REPEALED).
 *   supersededBy  — id of the document that supersedes this one.
 *   replaces      — ids of older documents this document supersedes.
 *   source        — Official gazette reference (Công báo) or publication URL.
 *   priority      — Ordering weight within the same type; 1 = highest priority.
 *   tags          — Vietnamese keyword tags for full-text search.
 *   summary       — Single-sentence Vietnamese description.
 *   confidence    — 0.0–1.0 confidence score for AI-derived or inferred metadata.
 *
 * Extension points for future phases:
 *   - Phase 11.3 (Dependency Graph): add `dependsOn?: readonly string[]` for
 *     explicit cross-document references beyond supersession.
 *   - Phase 11.4 (Impact Analyzer): LegalRegistry already exposes `replaces` and
 *     `supersededBy` for traversal; add `affectsThresholds?: readonly string[]`
 *     for direct threshold linkage.
 *   - Phase 11.5 (Coverage): `tags` + `type` + `issuer` already support coverage
 *     grouping; add `coverageGroup?: string` for explicit coverage domains.
 *
 * createRegistry() builds the indexed form of the registry from a validated
 * flat array. It is the only function that creates LegalRegistry values.
 * All other modules receive a LegalRegistry (or MinLegalRegistry) by injection.
 *
 * Pure. No I/O. No side effects. No singleton. Deterministic per input.
 */

// ─── Document type / status ───────────────────────────────────────────────────

export type LegalDocumentType =
  | 'LAW'
  | 'RESOLUTION'
  | 'DECREE'
  | 'CIRCULAR'
  | 'DECISION'
  | 'INTERNAL_REGULATION'
  | 'GUIDELINE';

export type LegalDocumentStatus =
  | 'ACTIVE'
  | 'EXPIRED'
  | 'SUPERSEDED'
  | 'DRAFT'
  | 'REPEALED';

// ─── Core domain entity ───────────────────────────────────────────────────────

export interface LegalDocument {
  readonly id:            string;
  readonly symbol:        string;
  readonly title:         string;
  readonly type:          LegalDocumentType;
  readonly issuer:        string;
  readonly effectiveDate: string;              // YYYY-MM-DD
  readonly expiredDate?:  string;              // YYYY-MM-DD — absent if still active
  readonly status:        LegalDocumentStatus;
  readonly supersededBy?: string;              // id of the document that supersedes this one
  readonly replaces?:     readonly string[];   // ids of older documents this document supersedes
  readonly source:        string;              // Official gazette reference
  readonly priority:      number;              // 1 = highest priority within type
  readonly tags:          readonly string[];
  readonly summary:       string;
  readonly confidence:    number;              // 0.0–1.0
  readonly fullText?:     string;
}

// ─── Registry aggregate ───────────────────────────────────────────────────────

export interface RegistryMetadata {
  readonly version:       string;
  readonly lastUpdated:   string;   // YYYY-MM-DD or '' if not tracked
  readonly documentCount: number;
  readonly sources:       readonly string[];
}

export interface LegalRegistry {
  readonly documents:   readonly LegalDocument[];
  readonly index:       Readonly<Record<string, LegalDocument>>;  // keyed by id
  readonly symbolIndex: Readonly<Record<string, LegalDocument>>;  // keyed by symbol
  readonly metadata:    RegistryMetadata;
}

// ─── MinXxx interface (dependency inversion for consumers) ────────────────────

/** Narrow interface — consumers depend only on what they need. */
export interface MinLegalRegistry {
  readonly documents:   readonly LegalDocument[];
  readonly index:       Readonly<Record<string, LegalDocument>>;
  readonly symbolIndex: Readonly<Record<string, LegalDocument>>;
}

// ─── Type sets ────────────────────────────────────────────────────────────────

export const LEGAL_DOCUMENT_TYPES: readonly LegalDocumentType[] = [
  'LAW',
  'RESOLUTION',
  'DECREE',
  'CIRCULAR',
  'DECISION',
  'INTERNAL_REGULATION',
  'GUIDELINE',
];

export const LEGAL_DOCUMENT_STATUSES: readonly LegalDocumentStatus[] = [
  'ACTIVE',
  'EXPIRED',
  'SUPERSEDED',
  'DRAFT',
  'REPEALED',
];

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isLegalDocumentType(value: unknown): value is LegalDocumentType {
  return typeof value === 'string' &&
    (LEGAL_DOCUMENT_TYPES as readonly string[]).includes(value);
}

export function isLegalDocumentStatus(value: unknown): value is LegalDocumentStatus {
  return typeof value === 'string' &&
    (LEGAL_DOCUMENT_STATUSES as readonly string[]).includes(value);
}

/** Matches ISO 8601 YYYY-MM-DD dates only. */
const ISO_DATE_RE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE_RE.test(value);
}

// ─── Registry factory ─────────────────────────────────────────────────────────

/**
 * Builds a LegalRegistry from a validated flat array of LegalDocuments.
 * Does NOT perform validation — that is the responsibility of the caller
 * (registryLoader.ts).  Assumes ids and symbols are unique.
 *
 * @param documents   Validated legal documents in any order.
 * @param version     Registry schema version string (default '1.0.0').
 * @param lastUpdated YYYY-MM-DD of the last update (default '' = not tracked).
 */
export function createRegistry(
  documents: readonly LegalDocument[],
  version    = '1.0.0',
  lastUpdated = '',
): LegalRegistry {
  const index:        Record<string, LegalDocument> = {};
  const symbolIndex:  Record<string, LegalDocument> = {};
  const sourcesSet:   string[]                      = [];

  for (const doc of documents) {
    index[doc.id]           = doc;
    symbolIndex[doc.symbol] = doc;
    if (!sourcesSet.includes(doc.source)) sourcesSet.push(doc.source);
  }

  return {
    documents,
    index:       Object.freeze(index),
    symbolIndex: Object.freeze(symbolIndex),
    metadata: {
      version,
      lastUpdated,
      documentCount: documents.length,
      sources:       Object.freeze(sourcesSet),
    },
  };
}
