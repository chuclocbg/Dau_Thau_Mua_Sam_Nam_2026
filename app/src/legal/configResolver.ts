/**
 * Phase 11.5.3 — Configuration Resolver
 *
 * Determines the set of currently applicable GovernanceConfig objects for a
 * given governance domain, effective date, and confidence threshold.
 *
 * "Applicable" means:
 *   status === 'ACTIVE'
 *   effectiveDate <= asOfDate
 *   !expiredDate || expiredDate > asOfDate    (exclusive upper bound)
 *   confidence >= minConfidence
 *
 * Results are sorted by priority desc, then effectiveDate desc (newest wins
 * at the same priority). All configs in the result are valid to use; callers
 * take the first one when only a single value is needed.
 *
 * Public APIs:
 *   resolveConfiguration(type, options?)  — generic resolver by ConfigType
 *   resolveWorkflow(options?)             — WORKFLOW_DEFINITION configs
 *   resolveThreshold(options?)            — PROCUREMENT_THRESHOLD configs
 *   resolveAuthority(options?)            — AUTHORITY_MATRIX configs
 *   resolveTemplate(options?)             — DOCUMENT_TEMPLATE configs
 *   resolveAuditRule(options?)            — AUDIT_RULE configs
 *   buildConfigResolver(repo)             — factory
 *
 * All named resolvers delegate to resolveConfiguration — no duplicated logic.
 *
 * asOfDate defaults to today's ISO date (YYYY-MM-DD) when omitted.
 * Tests always pass asOfDate explicitly for determinism.
 *
 * Pure. No I/O. No side effects. No any. No React. No browser globals.
 */

import type { ConfigType, GovernanceConfig } from './governanceConfig';
import type { ConfigRepository } from './configRepository';

// ─── Options ──────────────────────────────────────────────────────────────────

export interface ResolverOptions {
  /** ISO YYYY-MM-DD reference date. Defaults to today's local date. */
  readonly asOfDate?:      string;
  /** Exclude configs below this confidence level. Default: 0. */
  readonly minConfidence?: number;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function todayISO(): string {
  // ponytail: Date.now() is non-deterministic — callers pass asOfDate in tests
  return new Date().toISOString().slice(0, 10);
}

function isApplicable(
  config:        GovernanceConfig,
  asOfDate:      string,
  minConfidence: number,
): boolean {
  return (
    config.status === 'ACTIVE' &&
    config.effectiveDate <= asOfDate &&
    (!config.expiredDate || config.expiredDate > asOfDate) &&
    config.confidence >= minConfidence
  );
}

function byPriorityDesc(a: GovernanceConfig, b: GovernanceConfig): number {
  if (b.priority !== a.priority) return b.priority - a.priority;
  return b.effectiveDate.localeCompare(a.effectiveDate);
}

// ─── Resolver ─────────────────────────────────────────────────────────────────

export class ConfigResolver {
  constructor(private readonly repo: ConfigRepository) {}

  /**
   * Returns all applicable configs of the given type, sorted by priority desc.
   * This is the single resolution algorithm — all named resolvers call this.
   */
  resolveConfiguration(
    type:     ConfigType,
    options:  ResolverOptions = {},
  ): readonly GovernanceConfig[] {
    const asOfDate      = options.asOfDate      ?? todayISO();
    const minConfidence = options.minConfidence  ?? 0;

    const matching = [...this.repo.getByType(type)]
      .filter(c => isApplicable(c, asOfDate, minConfidence))
      .sort(byPriorityDesc);

    return Object.freeze(matching);
  }

  resolveWorkflow(options?: ResolverOptions): readonly GovernanceConfig[] {
    return this.resolveConfiguration('WORKFLOW_DEFINITION', options);
  }

  resolveThreshold(options?: ResolverOptions): readonly GovernanceConfig[] {
    return this.resolveConfiguration('PROCUREMENT_THRESHOLD', options);
  }

  resolveAuthority(options?: ResolverOptions): readonly GovernanceConfig[] {
    return this.resolveConfiguration('AUTHORITY_MATRIX', options);
  }

  resolveTemplate(options?: ResolverOptions): readonly GovernanceConfig[] {
    return this.resolveConfiguration('DOCUMENT_TEMPLATE', options);
  }

  resolveAuditRule(options?: ResolverOptions): readonly GovernanceConfig[] {
    return this.resolveConfiguration('AUDIT_RULE', options);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function buildConfigResolver(repo: ConfigRepository): ConfigResolver {
  return new ConfigResolver(repo);
}
