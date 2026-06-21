/**
 * Legal v4.1 — Regulation Loader
 *
 * Pure load functions that return typed, readonly data from external JSON files.
 * The JSON files live under regulations/ at the project root, outside the
 * TypeScript source tree, so they can be updated without recompiling.
 *
 * Each function is:
 *   - Pure: no side effects, no state mutation
 *   - Deterministic: same input (none) → identical output every call
 *   - Readonly: returns readonly arrays
 *   - No singleton: no module-level cached variable holding the result
 *   - No cache: the module system handles JSON loading; functions do not add an
 *     application-level cache on top of it
 *
 * Type definitions live here (not in regulationDB.ts) so that regulationDB.ts
 * can import both the types and the loaders without a circular dependency.
 *
 * Dependency graph (no cycles):
 *   JSON files
 *     └─► regulationLoader.ts  (types + loaders)
 *           └─► regulationDB.ts  (thin adapter, re-exports same names as v4.0)
 *                 └─► regulationExtractor.ts  (unchanged from v4.0)
 *
 * Pure data. No LLM. No browser globals. No hooks. No IndexedDB. No UI.
 */

import type { ProcurementMethod, FundSource } from './legalApplicabilityEngine';
import type { ContractType }                   from './contractReviewer';
import type { RiskLevel }                      from './legalRiskEngine';

// JSON imports — resolved by TypeScript's resolveJsonModule + Vite's bundler.
// Paths are relative to this file (app/src/ai/); three levels up reaches the
// project root where the regulations/ directory lives.
import thresholdsRaw      from '../../../regulations/thresholds.json';
import bandsRaw           from '../../../regulations/procurementBands.json';
import contractTypesRaw   from '../../../regulations/contractTypes.json';
import fundSourcesRaw     from '../../../regulations/fundSources.json';
import riskThresholdsRaw  from '../../../regulations/riskThresholds.json';

// ─── Entity types ─────────────────────────────────────────────────────────────
// Defined here so regulationDB.ts can import them without circular deps.

export interface Threshold {
  code: string;
  value: number;
  currency: 'VND';
  source: string;
  effectiveDate: string;
  description: string;
}

export interface ProcurementBand {
  code: 'DIRECT_50' | 'DIRECT_SELECTION_SIMPLIFIED' | 'COMPETITIVE_SHOPPING' | 'OPEN_BIDDING';
  recommendedMethod: ProcurementMethod;
  valueMin: number;
  valueMax: number;
  source: string;
}

export interface ContractTypeReg {
  contractType: ContractType;
  maxDurationDays: number;
  mandatoryClauses: string[];
  compatibleMethods: ProcurementMethod[];
  source: string;
}

export interface FundSourceReg {
  fundSource: FundSource;
  mandatoryClauses: string[];
  source: string;
}

export interface DocumentRequirement {
  stage: string;
  requiredDocument: string;
  source: string;
}

export interface RiskThreshold {
  minScore: number;
  riskLevel: RiskLevel;
}

// ─── Load functions ───────────────────────────────────────────────────────────

/** Returns all VND procurement thresholds. */
export function loadThresholds(): readonly Threshold[] {
  return thresholdsRaw as unknown as readonly Threshold[];
}

/** Returns all procurement value bands (mirrors docTemplates.ts getProcurementMethod). */
export function loadProcurementBands(): readonly ProcurementBand[] {
  return bandsRaw as unknown as readonly ProcurementBand[];
}

/** Returns all contract type regulations (duration, compatible methods, mandatory clauses). */
export function loadContractTypes(): readonly ContractTypeReg[] {
  return contractTypesRaw as unknown as readonly ContractTypeReg[];
}

/** Returns all fund source regulations (additional mandatory clauses per source). */
export function loadFundSources(): readonly FundSourceReg[] {
  return fundSourcesRaw as unknown as readonly FundSourceReg[];
}

/** Returns risk score → risk level mapping (descending minScore order). */
export function loadRiskThresholds(): readonly RiskThreshold[] {
  return riskThresholdsRaw as unknown as readonly RiskThreshold[];
}
