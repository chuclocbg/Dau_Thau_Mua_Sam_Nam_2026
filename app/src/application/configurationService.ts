/**
 * Phase 13 — ConfigurationService
 *
 * Application service for resolving governance configurations and creating
 * governance contexts.  Wraps ConfigResolver in the standard GovernanceResult
 * envelope.  Contains zero business rules.
 *
 * Public APIs:
 *   resolveConfiguration(type, ctx)          → GovernanceResult<readonly GovernanceConfig[]>
 *   resolveThreshold(ctx)                    → GovernanceResult<readonly GovernanceConfig[]>
 *   generateGovernanceContext(params)         → GovernanceContext
 *   buildConfigurationService(resolver)       → ConfigurationService
 */

import type { ConfigResolver }         from '../legal/configResolver';
import type { GovernanceConfig, ConfigType } from '../legal/governanceConfig';
import type { GovernanceContext, GovernanceResult } from './governanceContext';
import {
  createResult, createAuditEntry,
  generateGovernanceContext as buildContext,
  type AuditEntry,
} from './governanceContext';
import type { Actor } from '../legal/workflowOrchestrator';

// ─── Service ──────────────────────────────────────────────────────────────────

export class ConfigurationService {
  constructor(private readonly resolver: ConfigResolver) {}

  /**
   * Returns all applicable configs of the given type, effective on
   * ctx.currentDate (or ctx.effectiveDate when present).
   * Wraps ConfigResolver.resolveConfiguration in the standard result envelope.
   */
  resolveConfiguration(
    type: ConfigType,
    ctx:  GovernanceContext,
  ): GovernanceResult<readonly GovernanceConfig[]> {
    const audit    = [createAuditEntry('resolveConfiguration', ctx.actor, type)];
    const asOfDate = ctx.effectiveDate ?? ctx.currentDate;
    const configs  = this.resolver.resolveConfiguration(type, { asOfDate });

    return createResult('SUCCESS', {
      data:            configs,
      messages:        [`${configs.length} active ${type} config(s) on ${asOfDate}.`],
      auditTrail:      audit,
      legalReferences: configs.map(c => c.source),
      confidence:      configs.length > 0
        ? configs.reduce((s, c) => s + c.confidence, 0) / configs.length
        : 1.0,
      metadata:        { type, asOfDate, count: String(configs.length) },
    });
  }

  /**
   * Convenience resolver for PROCUREMENT_THRESHOLD configs.
   * Delegates to resolveConfiguration('PROCUREMENT_THRESHOLD', ctx).
   */
  resolveThreshold(ctx: GovernanceContext): GovernanceResult<readonly GovernanceConfig[]> {
    return this.resolveConfiguration('PROCUREMENT_THRESHOLD', ctx);
  }

  /**
   * Creates a GovernanceContext from raw parameters.
   * This is the canonical context factory for all application service callers.
   */
  generateGovernanceContext(params: {
    readonly currentDate:      string;
    readonly actor:            Actor;
    readonly requestId:        string;
    readonly effectiveDate?:   string;
    readonly organization?:    string;
    readonly department?:      string;
    readonly fundingSource?:   string;
    readonly procurementType?: string;
    readonly packageValue?:    number;
    readonly assetCategory?:   string;
    readonly legalSnapshot?:   string;
    readonly locale?:          string;
    readonly traceId?:         string;
    readonly metadata?:        Record<string, string>;
  }): GovernanceContext {
    return buildContext(params);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function buildConfigurationService(resolver: ConfigResolver): ConfigurationService {
  return new ConfigurationService(resolver);
}
