/**
 * Phase 13 — LegalService
 *
 * Application service for querying the Legal Registry and Knowledge Graph.
 * Coordinates RegistryQueryEngine, GraphQueryEngine, and GovernanceImpactEngine.
 * Contains zero business rules.
 *
 * Public APIs:
 *   resolveApplicableLaw(ctx)          → GovernanceResult<readonly LegalDocument[]>
 *   getLegalImpact(nodeId, ctx)         → GovernanceResult<ImpactReport>
 *   searchLaw(keyword, ctx)             → GovernanceResult<readonly LegalDocument[]>
 *   buildLegalService(query, impact)    → LegalService
 */

import type { LegalDocument }           from '../legal/legalRegistry';
import type { RegistryQueryEngine }     from '../legal/registryQueryEngine';
import type { GovernanceImpactEngine, ImpactReport } from '../legal/governanceImpactEngine';
import type { GovernanceContext, GovernanceResult }  from './governanceContext';
import { createResult, createAuditEntry }             from './governanceContext';

// ─── Service ──────────────────────────────────────────────────────────────────

export class LegalService {
  constructor(
    private readonly queryEngine:  RegistryQueryEngine,
    private readonly impactEngine: GovernanceImpactEngine,
  ) {}

  /**
   * Returns all legal documents that are ACTIVE and effective on ctx.currentDate.
   * Combines findActive() with findEffectiveOn() for a status-aware date filter.
   */
  resolveApplicableLaw(ctx: GovernanceContext): GovernanceResult<readonly LegalDocument[]> {
    const audit = [createAuditEntry('resolveApplicableLaw', ctx.actor, ctx.currentDate)];

    const activeIds = new Set(this.queryEngine.findActive().map(d => d.id));
    const effective = this.queryEngine
      .findEffectiveOn(ctx.effectiveDate ?? ctx.currentDate)
      .filter(d => activeIds.has(d.id));

    return createResult('SUCCESS', {
      data:            effective,
      messages:        [`${effective.length} applicable legal document(s) on ${ctx.currentDate}.`],
      auditTrail:      audit,
      legalReferences: effective.map(d => d.id),
      confidence:      effective.length > 0
        ? effective.reduce((s, d) => s + d.confidence, 0) / effective.length
        : 1.0,
      metadata:        { date: ctx.currentDate, count: String(effective.length) },
    });
  }

  /**
   * Generates a full impact report for a Knowledge Graph node.
   * Returns FAILED if the node does not exist in the graph.
   */
  getLegalImpact(nodeId: string, ctx: GovernanceContext): GovernanceResult<ImpactReport> {
    const audit  = [createAuditEntry('getLegalImpact', ctx.actor, nodeId)];
    const report = this.impactEngine.generateImpactReport(nodeId);

    if (!report.sourceNode) {
      return createResult('FAILED', {
        errors:     [`Graph node "${nodeId}" not found.`],
        auditTrail: audit,
        metadata:   { nodeId },
      });
    }

    const status = report.criticalCount > 0 ? 'REQUIRES_REVIEW' : 'SUCCESS';
    const warnings = report.criticalCount > 0
      ? [`${report.criticalCount} critical impact(s) detected.`] : [];

    return createResult(status, {
      data:            report,
      messages:        [`Impact analysis complete: ${report.impacts.length} affected node(s).`],
      warnings,
      auditTrail:      audit,
      legalReferences: [nodeId],
      metadata:        { nodeId, impactCount: String(report.impacts.length) },
    });
  }

  /**
   * Case-insensitive keyword search across title, symbol, summary, and tags.
   * Returns FAILED for blank keywords.
   */
  searchLaw(keyword: string, ctx: GovernanceContext): GovernanceResult<readonly LegalDocument[]> {
    const audit = [createAuditEntry('searchLaw', ctx.actor, keyword)];

    if (!keyword.trim()) {
      return createResult('FAILED', {
        errors:     ['Search keyword must not be blank.'],
        auditTrail: audit,
        metadata:   { keyword },
      });
    }

    const results = this.queryEngine.searchByKeyword(keyword);
    return createResult('SUCCESS', {
      data:            results,
      messages:        [`${results.length} result(s) for "${keyword}".`],
      auditTrail:      audit,
      legalReferences: results.map(d => d.id),
      metadata:        { keyword, count: String(results.length) },
    });
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function buildLegalService(
  queryEngine:  RegistryQueryEngine,
  impactEngine: GovernanceImpactEngine,
): LegalService {
  return new LegalService(queryEngine, impactEngine);
}
