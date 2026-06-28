/**
 * Phase 13 — DashboardService
 *
 * Application service that aggregates cross-domain governance data into
 * a compact dashboard summary.  Coordinates RegistryQueryEngine (legal stats),
 * ConfigResolver (configuration stats), and GovernanceRuleEngine (compliance
 * status).  Contains zero business rules.
 *
 * Public APIs:
 *   getGovernanceDashboard(ctx)    → GovernanceResult<DashboardSummary>
 *   getLegalSummary(ctx)           → GovernanceResult<LegalSummary>
 *   getActiveConfigurations(ctx, type?) → GovernanceResult<readonly GovernanceConfig[]>
 *   buildDashboardService(...)     → DashboardService
 */

import type { RegistryQueryEngine } from '../legal/registryQueryEngine';
import type { ConfigResolver }      from '../legal/configResolver';
import type { GovernanceRuleEngine } from '../legal/governanceRuleEngine';
import type { GovernanceConfig, ConfigType } from '../legal/governanceConfig';
import type { GovernanceContext, GovernanceResult, ResultStatus } from './governanceContext';
import { createResult, createAuditEntry, toRuleContext } from './governanceContext';

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface DashboardSummary {
  readonly activeLegalDocuments: number;
  readonly activeConfigurations: number;
  readonly complianceStatus:     ResultStatus;
  readonly asOfDate:             string;
}

export interface LegalSummary {
  readonly totalDocuments:  number;
  readonly activeDocuments: number;
  readonly effectiveOnDate: number;
}

// ponytail: keep full list in sync with governanceConfig.ts ConfigType union
const ALL_CONFIG_TYPES: readonly ConfigType[] = [
  'PROCUREMENT_THRESHOLD', 'AUTHORITY_MATRIX', 'WORKFLOW_DEFINITION',
  'FUNDING_SOURCE', 'ASSET_CATEGORY', 'DOCUMENT_TEMPLATE',
  'AUDIT_RULE', 'RISK_RULE', 'APPROVAL_POLICY', 'CHECKLIST_DEFINITION',
  'DASHBOARD_WIDGET',
];

// ─── Service ──────────────────────────────────────────────────────────────────

export class DashboardService {
  constructor(
    private readonly queryEngine: RegistryQueryEngine,
    private readonly resolver:    ConfigResolver,
    private readonly ruleEngine:  GovernanceRuleEngine,
  ) {}

  /**
   * Aggregates active legal documents, active configuration count, and current
   * compliance verdict into a single snapshot.
   */
  getGovernanceDashboard(ctx: GovernanceContext): GovernanceResult<DashboardSummary> {
    const audit   = [createAuditEntry('getGovernanceDashboard', ctx.actor, ctx.currentDate)];
    const asOfDate = ctx.effectiveDate ?? ctx.currentDate;

    const activeLegalDocuments = this.queryEngine.findActive().length;

    const activeConfigurations = ALL_CONFIG_TYPES.reduce(
      (n, t) => n + this.resolver.resolveConfiguration(t, { asOfDate }).length,
      0,
    );

    const compliance    = this.ruleEngine.evaluateCompliance(toRuleContext(ctx));
    const complianceStatus: ResultStatus =
      compliance.verdict === 'REQUIRES_REVIEW' ? 'REQUIRES_REVIEW'
      : compliance.verdict === 'INSUFFICIENT_DATA' ? 'PENDING'
      : compliance.verdict === 'REJECTED'          ? 'FAILED'
      : 'SUCCESS';

    const summary: DashboardSummary = {
      activeLegalDocuments,
      activeConfigurations,
      complianceStatus,
      asOfDate,
    };

    return createResult('SUCCESS', {
      data:      summary,
      messages:  [`Dashboard snapshot as of ${asOfDate}.`],
      auditTrail: audit,
      metadata:  {
        asOfDate,
        activeLegalDocuments: String(activeLegalDocuments),
        activeConfigurations: String(activeConfigurations),
      },
    });
  }

  /**
   * Returns counts of total, active, and effective-on-date legal documents.
   */
  getLegalSummary(ctx: GovernanceContext): GovernanceResult<LegalSummary> {
    const audit   = [createAuditEntry('getLegalSummary', ctx.actor, ctx.currentDate)];
    const refDate  = ctx.effectiveDate ?? ctx.currentDate;
    const all      = this.queryEngine.findActive();

    const summary: LegalSummary = {
      totalDocuments:  this.queryEngine.findEffectiveOn(refDate).length + this.queryEngine.findActive().length,
      activeDocuments: all.length,
      effectiveOnDate: this.queryEngine.findEffectiveOn(refDate).length,
    };

    return createResult('SUCCESS', {
      data:      summary,
      messages:  [`Legal summary as of ${refDate}.`],
      auditTrail: audit,
      metadata:  { refDate, activeDocuments: String(all.length) },
    });
  }

  /**
   * Returns active configurations for a specific type, or all types when
   * type is omitted.
   */
  getActiveConfigurations(
    ctx:   GovernanceContext,
    type?: ConfigType,
  ): GovernanceResult<readonly GovernanceConfig[]> {
    const audit   = [createAuditEntry('getActiveConfigurations', ctx.actor, type ?? 'ALL')];
    const asOfDate = ctx.effectiveDate ?? ctx.currentDate;
    const types    = type ? [type] : ALL_CONFIG_TYPES;

    const configs: GovernanceConfig[] = types.flatMap(
      t => [...this.resolver.resolveConfiguration(t, { asOfDate })],
    );

    return createResult('SUCCESS', {
      data:            configs,
      messages:        [`${configs.length} active configuration(s) as of ${asOfDate}.`],
      auditTrail:      audit,
      legalReferences: configs.map(c => c.source),
      metadata:        { asOfDate, count: String(configs.length), type: type ?? 'ALL' },
    });
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function buildDashboardService(
  queryEngine: RegistryQueryEngine,
  resolver:    ConfigResolver,
  ruleEngine:  GovernanceRuleEngine,
): DashboardService {
  return new DashboardService(queryEngine, resolver, ruleEngine);
}
