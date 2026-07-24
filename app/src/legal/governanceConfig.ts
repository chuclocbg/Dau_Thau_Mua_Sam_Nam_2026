/**
 * Phase 11.5.1 — Governance Configuration Domain
 *
 * Central type system for the Governance Configuration Platform.
 * Every governance domain (Procurement, Assets, HR, Finance, Audit,
 * Executive Dashboard) consumes configuration from this single source.
 *
 * ConfigType covers 11 governance domains:
 *   PROCUREMENT_THRESHOLD  — bid-value thresholds by method and authority
 *   AUTHORITY_MATRIX       — approval authority chain by role and amount
 *   WORKFLOW_DEFINITION    — process steps, transitions, and actors
 *   FUNDING_SOURCE         — budget chapters, funding codes, and limits
 *   ASSET_CATEGORY         — asset classification and depreciation rules
 *   DOCUMENT_TEMPLATE      — template references with version control
 *   AUDIT_RULE             — audit scope, criteria, and sampling rules
 *   RISK_RULE              — risk threshold and escalation triggers
 *   APPROVAL_POLICY        — multi-level approval conditions
 *   CHECKLIST_DEFINITION   — checklist items and completion criteria
 *   DASHBOARD_WIDGET       — executive dashboard widget configuration
 *
 * Every GovernanceConfig carries:
 *   id, type, version, effectiveDate, status, priority, source,
 *   metadata, confidence, tags (mirrors LegalDocument for graph bridging).
 *
 * createConfig() is the single factory — no hardcoded defaults in domain code.
 * validateConfigs() (configValidator.ts) is the validation boundary.
 *
 * Pure. No I/O. No side effects. No any. No React. No browser globals.
 */

// ─── Config types ─────────────────────────────────────────────────────────────

export type ConfigType =
  | 'PROCUREMENT_THRESHOLD'
  | 'AUTHORITY_MATRIX'
  | 'WORKFLOW_DEFINITION'
  | 'FUNDING_SOURCE'
  | 'ASSET_CATEGORY'
  | 'DOCUMENT_TEMPLATE'
  | 'AUDIT_RULE'
  | 'RISK_RULE'
  | 'APPROVAL_POLICY'
  | 'CHECKLIST_DEFINITION'
  | 'DASHBOARD_WIDGET';

export type ConfigStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'DRAFT'
  | 'SUPERSEDED'
  | 'EXPIRED';

// ─── Domain entity ────────────────────────────────────────────────────────────

/**
 * A single governance configuration object.
 *
 * effectiveDate  ISO YYYY-MM-DD — first day this config applies (inclusive)
 * expiredDate    ISO YYYY-MM-DD — first day this config no longer applies
 *                (exclusive, absent = indefinitely active)
 * priority       Higher value wins when multiple configs of the same type
 *                and date range are active simultaneously.
 * source         References either a LegalDocument.id in the Knowledge Graph
 *                or an internal governance policy identifier.
 * confidence     0.0..1.0 — certainty that this config correctly reflects
 *                the authoritative source.
 */
export interface GovernanceConfig {
  readonly id:            string;
  readonly type:          ConfigType;
  readonly version:       string;
  readonly effectiveDate: string;
  readonly expiredDate?:  string;
  readonly status:        ConfigStatus;
  readonly priority:      number;
  readonly source:        string;
  readonly metadata:      Readonly<Record<string, string>>;
  readonly confidence:    number;
  readonly tags:          readonly string[];
}

// ─── Type-set constants ───────────────────────────────────────────────────────

export const CONFIG_TYPES: readonly ConfigType[] = [
  'PROCUREMENT_THRESHOLD',
  'AUTHORITY_MATRIX',
  'WORKFLOW_DEFINITION',
  'FUNDING_SOURCE',
  'ASSET_CATEGORY',
  'DOCUMENT_TEMPLATE',
  'AUDIT_RULE',
  'RISK_RULE',
  'APPROVAL_POLICY',
  'CHECKLIST_DEFINITION',
  'DASHBOARD_WIDGET',
];

export const CONFIG_STATUSES: readonly ConfigStatus[] = [
  'ACTIVE',
  'INACTIVE',
  'DRAFT',
  'SUPERSEDED',
  'EXPIRED',
];

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isConfigType(value: unknown): value is ConfigType {
  return typeof value === 'string' &&
    (CONFIG_TYPES as readonly string[]).includes(value);
}

export function isConfigStatus(value: unknown): value is ConfigStatus {
  return typeof value === 'string' &&
    (CONFIG_STATUSES as readonly string[]).includes(value);
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates an immutable GovernanceConfig.
 *
 * Required: id, type, version, effectiveDate, source.
 * Defaults:  status='DRAFT', priority=1, confidence=1.0, metadata={}, tags=[].
 */
export function createConfig(input: {
  readonly id:            string;
  readonly type:          ConfigType;
  readonly version:       string;
  readonly effectiveDate: string;
  readonly source:        string;
  readonly status?:       ConfigStatus;
  readonly priority?:     number;
  readonly expiredDate?:  string;
  readonly metadata?:     Readonly<Record<string, string>>;
  readonly confidence?:   number;
  readonly tags?:         readonly string[];
}): GovernanceConfig {
  return {
    id:            input.id,
    type:          input.type,
    version:       input.version,
    effectiveDate: input.effectiveDate,
    expiredDate:   input.expiredDate,
    status:        input.status     ?? 'DRAFT',
    priority:      input.priority   ?? 1,
    source:        input.source,
    metadata:      Object.freeze({ ...(input.metadata ?? {}) }),
    confidence:    input.confidence ?? 1.0,
    tags:          Object.freeze([...(input.tags ?? [])]) as readonly string[],
  };
}
