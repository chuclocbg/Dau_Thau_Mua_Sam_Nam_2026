/**
 * Cross-domain services — citation building, cross-references,
 * procurement rules, and threshold resolution.
 *
 * Rules:
 *   - Pure functions receive all data as parameters.
 *   - Async functions inject repository interfaces only.
 *   - No concrete repository class is imported or referenced.
 */

import type { ILegalDocumentRepository, ICitationRepository } from '../legalRepositories';
import type {
  CitationTarget,
  CrossReferenceResult,
  ProcurementRule,
  ThresholdBand,
  ThresholdResult,
} from './legalDomainTypes';

// ─── 1. buildCitation ────────────────────────────────────────────────────────
// Async: resolves document symbol from docRepo; builds Vietnamese citation string.
// Order: điểm > khoản > Điều > symbol (matches Vietnamese legal citation convention).

export async function buildCitation(
  target: CitationTarget,
  docRepo: ILegalDocumentRepository,
): Promise<string> {
  const parts: string[] = [];

  if (target.pointLabel  !== undefined) parts.push(`điểm ${target.pointLabel}`);
  if (target.clauseNumber !== undefined) parts.push(`khoản ${target.clauseNumber}`);
  if (target.articleNumber !== undefined) parts.push(`Điều ${target.articleNumber}`);

  const doc = await docRepo.findById(target.docId);
  parts.push(doc?.symbol ?? target.docId);

  return parts.join(' ');
}

// ─── 2. findCrossReferences ──────────────────────────────────────────────────
// Async: fetches both outbound (cites) and inbound (citedBy) citations in parallel.

export async function findCrossReferences(
  docId: string,
  citationRepo: ICitationRepository,
): Promise<CrossReferenceResult> {
  const [cites, citedBy] = await Promise.all([
    citationRepo.listCitationsFrom(docId),
    citationRepo.listCitationsTo(docId),
  ]);
  return { cites, citedBy };
}

// ─── 3. determineProcurementRule ─────────────────────────────────────────────
// Pure. Returns the first matching rule: value in [minValue, maxValue) and
// optional method filter. Returns null if no rule matches.

export function determineProcurementRule(
  value: number,
  method: string | null,
  rules: readonly ProcurementRule[],
): ProcurementRule | null {
  return rules.find(r =>
    value >= r.minValue &&
    (r.maxValue === null || value < r.maxValue) &&
    (method === null || r.method === method),
  ) ?? null;
}

// ─── 4. resolveThresholdRule ──────────────────────────────────────────────────
// Pure. Returns the threshold band and procurement method for the given value
// and domain. Bands with domain '*' match any domain. Returns null if the value
// falls below all bands (caller should treat as error / non-applicable).

export function resolveThresholdRule(
  value: number,
  domain: string,
  bands: readonly ThresholdBand[],
): ThresholdResult | null {
  const band = bands.find(b =>
    (b.domain === '*' || b.domain === domain) &&
    value >= b.minValue &&
    (b.maxValue === null || value < b.maxValue),
  );
  return band ? { band, method: band.method } : null;
}
