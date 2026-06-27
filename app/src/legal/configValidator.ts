/**
 * Phase 11.5.4 — Configuration Validation
 *
 * Validates a set of GovernanceConfig objects and produces a structured report.
 * Operates on plain arrays — no dependency on ConfigRepository.
 * Accepts an optional MinKnowledgeGraph for cross-domain reference checks.
 *
 * Error codes:
 *   DUPLICATE_ID            — two configs share the same id
 *   OVERLAPPING_DATES       — same type, same priority, both ACTIVE,
 *                             overlapping effective date ranges
 *   MISSING_SOURCE          — source field is empty
 *   ORPHAN_CONFIG           — source references a node id absent from the graph
 *                             (only checked when MinKnowledgeGraph is supplied)
 *   INVALID_AUTHORITY_CHAIN — metadata.parentId references an id not in the set
 *
 * Warning codes:
 *   LOW_CONFIDENCE          — confidence < 0.7
 *   MISSING_TAGS            — tags array is empty
 *
 * ConfigValidationStats counts by status and ConfigType.
 *
 * Pure. No I/O. No side effects. No any. No React. No browser globals.
 */

import type { ConfigType, GovernanceConfig } from './governanceConfig';
import type { MinKnowledgeGraph } from './knowledgeGraph';

// ─── Error / warning types ────────────────────────────────────────────────────

export type ConfigValidationErrorCode =
  | 'DUPLICATE_ID'
  | 'OVERLAPPING_DATES'
  | 'MISSING_SOURCE'
  | 'ORPHAN_CONFIG'
  | 'INVALID_AUTHORITY_CHAIN';

export type ConfigValidationWarningCode =
  | 'LOW_CONFIDENCE'
  | 'MISSING_TAGS';

export interface ConfigValidationError {
  readonly code:    ConfigValidationErrorCode;
  readonly id:      string;
  readonly message: string;
}

export interface ConfigValidationWarning {
  readonly code:    ConfigValidationWarningCode;
  readonly id:      string;
  readonly message: string;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface ConfigValidationStats {
  readonly total:      number;
  readonly active:     number;
  readonly draft:      number;
  readonly expired:    number;
  readonly superseded: number;
  readonly byType:     Readonly<Partial<Record<ConfigType, number>>>;
}

// ─── Report ───────────────────────────────────────────────────────────────────

export interface ConfigValidationReport {
  readonly ok:       boolean;
  readonly errors:   readonly ConfigValidationError[];
  readonly warnings: readonly ConfigValidationWarning[];
  readonly stats:    ConfigValidationStats;
}

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * Validates configs and returns a structured report.
 *
 * @param configs  The full config set to validate.
 * @param graph    Optional knowledge graph. When provided, ORPHAN_CONFIG check
 *                 verifies that each config's source exists as a graph node.
 */
export function validateConfigs(
  configs: readonly GovernanceConfig[],
  graph?:  MinKnowledgeGraph,
): ConfigValidationReport {
  const errors:   ConfigValidationError[]   = [];
  const warnings: ConfigValidationWarning[] = [];

  // ── Pass 1: id index + DUPLICATE_ID ───────────────────────────────────────
  const seenIds = new Set<string>();
  const dupIds  = new Set<string>();
  for (const c of configs) {
    if (seenIds.has(c.id)) {
      dupIds.add(c.id);
    } else {
      seenIds.add(c.id);
    }
  }
  for (const id of dupIds) {
    errors.push({ code: 'DUPLICATE_ID', id, message: `Duplicate config id "${id}".` });
  }

  // ── Pass 2: MISSING_SOURCE ────────────────────────────────────────────────
  for (const c of configs) {
    if (!c.source || c.source.trim() === '') {
      errors.push({
        code: 'MISSING_SOURCE', id: c.id,
        message: `Config "${c.id}" has no source reference.`,
      });
    }
  }

  // ── Pass 3: OVERLAPPING_DATES — same type, same priority, both ACTIVE ─────
  const activeByType = new Map<ConfigType, GovernanceConfig[]>();
  for (const c of configs) {
    if (c.status !== 'ACTIVE') continue;
    if (!activeByType.has(c.type)) activeByType.set(c.type, []);
    activeByType.get(c.type)!.push(c);
  }

  const reportedPairs = new Set<string>();
  for (const group of activeByType.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!;
        const b = group[j]!;
        if (a.priority !== b.priority) continue;
        // expiredDate is exclusive: interval [effectiveDate, expiredDate)
        const aEnd = a.expiredDate ?? '9999-12-31';
        const bEnd = b.expiredDate ?? '9999-12-31';
        if (a.effectiveDate < bEnd && b.effectiveDate < aEnd) {
          const pair = [a.id, b.id].sort().join('\0');
          if (!reportedPairs.has(pair)) {
            reportedPairs.add(pair);
            errors.push({
              code: 'OVERLAPPING_DATES', id: a.id,
              message: `Configs "${a.id}" and "${b.id}" overlap at priority ${a.priority} (${a.type}).`,
            });
          }
        }
      }
    }
  }

  // ── Pass 4: ORPHAN_CONFIG (requires graph) ────────────────────────────────
  if (graph) {
    for (const c of configs) {
      if (c.source && !graph.nodeIndex[c.source]) {
        errors.push({
          code: 'ORPHAN_CONFIG', id: c.id,
          message: `Config "${c.id}" source "${c.source}" not found in knowledge graph.`,
        });
      }
    }
  }

  // ── Pass 5: INVALID_AUTHORITY_CHAIN ───────────────────────────────────────
  for (const c of configs) {
    const parentId = c.metadata['parentId'];
    if (parentId !== undefined && !seenIds.has(parentId)) {
      errors.push({
        code: 'INVALID_AUTHORITY_CHAIN', id: c.id,
        message: `Config "${c.id}" metadata.parentId "${parentId}" not found in config set.`,
      });
    }
  }

  // ── Warnings ──────────────────────────────────────────────────────────────
  for (const c of configs) {
    if (c.confidence < 0.7) {
      warnings.push({
        code: 'LOW_CONFIDENCE', id: c.id,
        message: `Config "${c.id}" has low confidence (${c.confidence}).`,
      });
    }
    if (c.tags.length === 0) {
      warnings.push({
        code: 'MISSING_TAGS', id: c.id,
        message: `Config "${c.id}" has no tags.`,
      });
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const byType: Partial<Record<ConfigType, number>> = {};
  for (const c of configs) {
    byType[c.type] = (byType[c.type] ?? 0) + 1;
  }

  const stats: ConfigValidationStats = {
    total:      configs.length,
    active:     configs.filter(c => c.status === 'ACTIVE').length,
    draft:      configs.filter(c => c.status === 'DRAFT').length,
    expired:    configs.filter(c => c.status === 'EXPIRED').length,
    superseded: configs.filter(c => c.status === 'SUPERSEDED').length,
    byType:     Object.freeze(byType),
  };

  return {
    ok:       errors.length === 0,
    errors:   Object.freeze(errors),
    warnings: Object.freeze(warnings),
    stats,
  };
}
