/**
 * LegalAmendmentStore — in-memory repository for LegalVersion, Amendment,
 * LegalCitation, LegalKeyword, LegalDomain, EffectivePeriod.
 *
 * Implements the repository pattern for cross-document relational entities.
 * Backed by plain Map — no I/O, no external deps, testable in jsdom.
 *
 * Public API:
 *   addVersion / getVersion / listVersions(documentId) / baselineVersion(documentId)
 *   addAmendment / getAmendment / listAmendments(baseDocumentId)
 *   addCitation  / listCitationsFrom(docId) / listCitationsTo(docId)
 *   addKeyword   / findKeyword(term, domain) / listKeywords(domain)
 *   addDomain    / getDomain / listDomains()
 *   addEffectivePeriod / resolveEffectivePeriod(documentId, asOfDate)
 *   isDocumentInForce(documentId, asOfDate)
 */

import {
  makeVersionId,
  makeEffectivePeriodId,
  isEffectiveOn,
  type LegalVersion,
  type Amendment,
  type LegalCitation,
  type LegalKeyword,
  type LegalDomain,
  type EffectivePeriod,
} from './legalSchema';

export class LegalAmendmentStore {
  private readonly versions         = new Map<string, LegalVersion>();
  private readonly amendments       = new Map<string, Amendment>();
  private readonly citations        = new Map<string, LegalCitation>();
  private readonly keywords         = new Map<string, LegalKeyword>();
  private readonly domains          = new Map<string, LegalDomain>();
  private readonly effectivePeriods = new Map<string, EffectivePeriod>();

  // ── Versions ─────────────────────────────────────────────────────────────────

  addVersion(v: LegalVersion): void {
    this.versions.set(v.id, v);
  }

  getVersion(id: string): LegalVersion | undefined {
    return this.versions.get(id);
  }

  listVersions(documentId: string): LegalVersion[] {
    return [...this.versions.values()]
      .filter(v => v.documentId === documentId)
      .sort((a, b) => a.versionDate.localeCompare(b.versionDate));
  }

  /**
   * Returns the baseline (original) version for a document.
   * Creates one implicitly from the document's effectiveDate if not present.
   */
  baselineVersion(documentId: string, effectiveDate: string): LegalVersion {
    const existing = this.listVersions(documentId).find(v => v.isBaseline);
    if (existing) return existing;

    const id = makeVersionId(documentId, effectiveDate);
    const v: LegalVersion = {
      id,
      documentId,
      versionDate: effectiveDate,
      changeNote:  'Văn bản gốc',
      amendedById: null,
      isBaseline:  true,
    };
    this.addVersion(v);
    return v;
  }

  // ── Amendments ────────────────────────────────────────────────────────────────

  addAmendment(a: Amendment): void {
    this.amendments.set(a.id, a);
  }

  getAmendment(id: string): Amendment | undefined {
    return this.amendments.get(id);
  }

  listAmendments(baseDocumentId: string, asOf?: string): Amendment[] {
    const all = [...this.amendments.values()]
      .filter(a => a.baseDocumentId === baseDocumentId);
    if (!asOf) return all;
    return all
      .filter(a => a.effectiveDate <= asOf)
      .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  }

  // ── Citations ─────────────────────────────────────────────────────────────────

  addCitation(c: LegalCitation): void {
    this.citations.set(c.id, c);
  }

  listCitationsFrom(citingDocId: string): LegalCitation[] {
    return [...this.citations.values()].filter(c => c.citingDocId === citingDocId);
  }

  listCitationsTo(citedDocId: string): LegalCitation[] {
    return [...this.citations.values()].filter(c => c.citedDocId === citedDocId);
  }

  // ── Keywords ──────────────────────────────────────────────────────────────────

  addKeyword(k: LegalKeyword): void {
    this.keywords.set(k.id, k);
  }

  findKeyword(term: string, domain?: string): LegalKeyword | undefined {
    const lower = term.toLowerCase();
    return [...this.keywords.values()].find(k =>
      k.term.toLowerCase() === lower &&
      (!domain || k.domain === domain),
    );
  }

  listKeywords(domain?: string): LegalKeyword[] {
    const all = [...this.keywords.values()];
    return domain ? all.filter(k => k.domain === domain) : all;
  }

  // ── Domains ───────────────────────────────────────────────────────────────────

  addDomain(d: LegalDomain): void {
    this.domains.set(d.id, d);
  }

  getDomain(id: string): LegalDomain | undefined {
    return this.domains.get(id);
  }

  listDomains(): LegalDomain[] {
    return [...this.domains.values()];
  }

  // ── Effective periods ─────────────────────────────────────────────────────────

  addEffectivePeriod(p: EffectivePeriod): void {
    this.effectivePeriods.set(p.id, p);
  }

  /**
   * Returns the EffectivePeriod that covers the given date, or null.
   */
  resolveEffectivePeriod(documentId: string, asOfDate: string): EffectivePeriod | null {
    const periods = [...this.effectivePeriods.values()]
      .filter(p => p.documentId === documentId);
    return periods.find(p => isEffectiveOn(p, asOfDate)) ?? null;
  }

  /**
   * Returns true if the document has an EffectivePeriod that covers asOfDate.
   */
  isDocumentInForce(documentId: string, asOfDate: string): boolean {
    return this.resolveEffectivePeriod(documentId, asOfDate) !== null;
  }

  /**
   * Registers a document as in-force from its effective date.
   * Sets endDate to the effectiveDate of a REPLACE amendment if one exists.
   */
  registerDocumentPeriod(
    documentId: string,
    startDate:  string,
    versionId:  string | null = null,
  ): EffectivePeriod {
    const id = makeEffectivePeriodId(documentId, startDate);
    // Check if a REPLACE amendment already exists → close this period
    const replaceAmendment = [...this.amendments.values()].find(
      a => a.baseDocumentId === documentId && a.amendmentType === 'REPLACE',
    );

    const period: EffectivePeriod = {
      id,
      documentId,
      versionId,
      startDate,
      endDate:   replaceAmendment?.effectiveDate ?? null,
      endReason: replaceAmendment
        ? `REPLACED_BY_${replaceAmendment.amendingDocumentId}`
        : null,
    };
    this.addEffectivePeriod(period);
    return period;
  }

  clear(): void {
    this.versions.clear();
    this.amendments.clear();
    this.citations.clear();
    this.keywords.clear();
    this.domains.clear();
    this.effectivePeriods.clear();
  }
}
