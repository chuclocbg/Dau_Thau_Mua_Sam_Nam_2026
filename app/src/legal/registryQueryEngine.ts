/**
 * Phase 11.2.4 — Registry Query Engine
 *
 * Pure TypeScript query layer over a LegalRegistry.  Provides the standard
 * lookup and search APIs used by every downstream module:
 *
 *   findById(id)              → exact id lookup
 *   findBySymbol(symbol)      → exact symbol lookup
 *   findEffectiveOn(date)     → documents in effect on a given YYYY-MM-DD date
 *   findActive()              → documents where status === 'ACTIVE'
 *   findSuperseded()          → documents where status === 'SUPERSEDED'
 *   findChildren(id)          → documents that supersede the given document
 *                               (i.e. docs that include id in their replaces list)
 *   findParents(id)           → older documents that the given document supersedes
 *                               (i.e. the ids from doc.replaces, resolved to docs)
 *   searchByKeyword(keyword)  → case-insensitive match in title, symbol, summary, tags
 *
 * findEffectiveOn semantics:
 *   Includes a document when effectiveDate ≤ date AND
 *   (expiredDate is absent OR expiredDate ≥ date).
 *   This is purely date-based — status field is not consulted.
 *   Callers combine with findActive() for status-aware queries.
 *
 * findChildren / findParents use the replaces relationship (not supersededBy):
 *   findParents("nd-214-2025") → docs listed in nd-214-2025.replaces
 *   findChildren("nd-24-2024") → docs where "nd-24-2024" ∈ doc.replaces
 *
 * Injection pattern (MinLegalRegistry):
 *   RegistryQueryEngine accepts MinLegalRegistry so consumers that only
 *   have a partial registry can still use the engine.
 *
 * Extension point for Phase 11.3 (Dependency Graph):
 *   Add findByDependency(id) once LegalDocument gains dependsOn.
 *
 * buildQueryEngine() is exported as a factory following the Phase 10 pattern.
 *
 * All methods return readonly arrays or undefined — no mutation.
 * Pure. No I/O. No side effects. No singleton. Deterministic per input.
 * No any. No React. No browser globals.
 */

import type { LegalDocument, MinLegalRegistry } from './legalRegistry';

// ─── Engine class ─────────────────────────────────────────────────────────────

export class RegistryQueryEngine {
  constructor(private readonly registry: MinLegalRegistry) {}

  // ── Exact lookups ──────────────────────────────────────────────────────────

  findById(id: string): LegalDocument | undefined {
    return this.registry.index[id];
  }

  findBySymbol(symbol: string): LegalDocument | undefined {
    return this.registry.symbolIndex[symbol];
  }

  // ── Date-range query ───────────────────────────────────────────────────────

  /**
   * Returns documents that were in effect on the given YYYY-MM-DD date.
   * Purely date-based — does not filter by status.
   */
  findEffectiveOn(date: string): readonly LegalDocument[] {
    return this.registry.documents.filter(
      d =>
        d.effectiveDate <= date &&
        (d.expiredDate === undefined || d.expiredDate >= date),
    );
  }

  // ── Status filters ─────────────────────────────────────────────────────────

  findActive(): readonly LegalDocument[] {
    return this.registry.documents.filter(d => d.status === 'ACTIVE');
  }

  findSuperseded(): readonly LegalDocument[] {
    return this.registry.documents.filter(d => d.status === 'SUPERSEDED');
  }

  // ── Supersession graph traversal ───────────────────────────────────────────

  /**
   * Returns documents that list the given id in their replaces field.
   * These are the "newer" documents that supersede the given one.
   */
  findChildren(id: string): readonly LegalDocument[] {
    return this.registry.documents.filter(
      d => d.replaces !== undefined && d.replaces.includes(id),
    );
  }

  /**
   * Returns the "older" documents that the given document replaces.
   * Uses the doc's own replaces list, resolved to LegalDocument objects.
   * Unknown ids in replaces are silently skipped (caller can validate with
   * validateRegistry() first).
   */
  findParents(id: string): readonly LegalDocument[] {
    const doc = this.registry.index[id];
    if (doc === undefined || doc.replaces === undefined) return [];
    return doc.replaces
      .map(rid => this.registry.index[rid])
      .filter((d): d is LegalDocument => d !== undefined);
  }

  // ── Keyword search ─────────────────────────────────────────────────────────

  /**
   * Case-insensitive substring search across title, symbol, summary, and tags.
   * Returns documents in source array order.
   */
  searchByKeyword(keyword: string): readonly LegalDocument[] {
    if (keyword.trim() === '') return [];
    const lower = keyword.toLowerCase();
    return this.registry.documents.filter(
      d =>
        d.title.toLowerCase().includes(lower) ||
        d.symbol.toLowerCase().includes(lower) ||
        d.summary.toLowerCase().includes(lower) ||
        d.tags.some(tag => tag.toLowerCase().includes(lower)),
    );
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function buildQueryEngine(registry: MinLegalRegistry): RegistryQueryEngine {
  return new RegistryQueryEngine(registry);
}
