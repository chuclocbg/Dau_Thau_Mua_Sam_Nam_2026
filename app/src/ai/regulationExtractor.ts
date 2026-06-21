/**
 * Legal v4.0 — Regulation Extractor
 *
 * Query interface over regulationDB. All functions are pure and deterministic.
 *
 * Existing engines (contractReviewer, legalRiskEngine, legalChecklistEngine,
 * procurementCopilot, templateGenerator, decisionAssistant) are NOT modified.
 * This module only reads from regulationDB and re-exposes the data as
 * structured queries for consumers who need source-tracked, queryable rules.
 *
 * Pure functions. No LLM. No browser globals. No hooks. No IndexedDB. No UI.
 */

import type { ProcurementMethod, FundSource } from './legalApplicabilityEngine';
import type { ContractType }                   from './contractReviewer';
import type { RiskLevel }                      from './legalRiskEngine';
import {
  THRESHOLDS,
  PROCUREMENT_BANDS,
  CONTRACT_TYPE_REGS,
  FUND_SOURCE_REGS,
  DOCUMENT_REQUIREMENTS,
  RISK_THRESHOLDS,
  type Threshold,
  type ProcurementBand,
  type ContractTypeReg,
  type FundSourceReg,
  type DocumentRequirement,
  type RiskThreshold,
} from './regulationDB';

// Re-export types so callers import from one place.
export type {
  Threshold,
  ProcurementBand,
  ContractTypeReg,
  FundSourceReg,
  DocumentRequirement,
  RiskThreshold,
};

// ─── Threshold queries ────────────────────────────────────────────────────────

/** Returns all registered thresholds. */
export function getAllThresholds(): readonly Threshold[] {
  return THRESHOLDS;
}

/** Looks up a threshold by its unique code. */
export function getThreshold(code: string): Threshold | undefined {
  return THRESHOLDS.find(t => t.code === code);
}

// ─── Procurement band queries ─────────────────────────────────────────────────

/** Returns all procurement value bands in ascending order. */
export function getAllProcurementBands(): readonly ProcurementBand[] {
  return PROCUREMENT_BANDS;
}

/**
 * Returns the procurement band that applies to a given package value.
 * Mirrors the ≤ comparisons in docTemplates.ts getProcurementMethod().
 */
export function getProcurementBandForValue(value: number): ProcurementBand {
  if (value <= 50_000_000)      return PROCUREMENT_BANDS[0]!;
  if (value <= 500_000_000)     return PROCUREMENT_BANDS[1]!;
  if (value <= 5_000_000_000)   return PROCUREMENT_BANDS[2]!;
  return PROCUREMENT_BANDS[3]!;
}

// ─── Contract type queries ────────────────────────────────────────────────────

/** Returns the regulation entry for a contract type. */
export function getContractTypeReg(contractType: ContractType): ContractTypeReg | undefined {
  return CONTRACT_TYPE_REGS.find(r => r.contractType === contractType);
}

/**
 * Returns the contract types that are compatible with a given procurement method.
 * Mirrors contractReviewer.ts METHOD_COMPATIBLE_TYPES.
 */
export function getCompatibleContractTypes(method: ProcurementMethod): ContractType[] {
  return CONTRACT_TYPE_REGS
    .filter(r => r.compatibleMethods.includes(method))
    .map(r => r.contractType);
}

/**
 * Returns the maximum allowed duration in calendar days for a contract type.
 * Returns 0 if the contract type is not registered.
 */
export function getMaxDurationDays(contractType: ContractType): number {
  return CONTRACT_TYPE_REGS.find(r => r.contractType === contractType)?.maxDurationDays ?? 0;
}

/**
 * Returns all mandatory clause IDs for a given contract type (universal + type-specific).
 * Returns [] if the type is not registered.
 */
export function getMandatoryClausesForContractType(contractType: ContractType): string[] {
  return [...(CONTRACT_TYPE_REGS.find(r => r.contractType === contractType)?.mandatoryClauses ?? [])];
}

// ─── Fund source queries ──────────────────────────────────────────────────────

/** Returns the regulation entry for a fund source. */
export function getFundSourceReg(fundSource: FundSource): FundSourceReg | undefined {
  return FUND_SOURCE_REGS.find(r => r.fundSource === fundSource);
}

/**
 * Returns the additional mandatory clause IDs required by a fund source.
 * Mirrors contractReviewer.ts FUND_MANDATORY_CLAUSES.
 */
export function getMandatoryClausesForFund(fundSource: FundSource): string[] {
  return [...(FUND_SOURCE_REGS.find(r => r.fundSource === fundSource)?.mandatoryClauses ?? [])];
}

// ─── Document requirement queries ─────────────────────────────────────────────

/**
 * Returns all document requirements for a given stage —
 * i.e. every document that must exist before `stage` can be prepared.
 * Mirrors legalChecklistEngine.ts PREREQUISITES.
 */
export function getDocumentRequirements(stage: string): readonly DocumentRequirement[] {
  return DOCUMENT_REQUIREMENTS.filter(r => r.stage === stage);
}

/**
 * Returns all stages that depend on a given document —
 * i.e. every stage for which `requiredDocument` is a prerequisite.
 */
export function getDependentStages(requiredDocument: string): string[] {
  return [...new Set(
    DOCUMENT_REQUIREMENTS
      .filter(r => r.requiredDocument === requiredDocument)
      .map(r => r.stage),
  )];
}

// ─── Risk threshold queries ───────────────────────────────────────────────────

/**
 * Returns all risk thresholds in descending minScore order.
 * Mirrors legalRiskEngine.ts RISK_THRESHOLDS.
 */
export function getAllRiskThresholds(): readonly RiskThreshold[] {
  return RISK_THRESHOLDS;
}

/**
 * Returns the risk level for a given score.
 * First threshold whose minScore ≤ score wins (thresholds are ordered descending).
 */
export function getRiskLevelForScore(score: number): RiskLevel {
  for (const t of RISK_THRESHOLDS) {
    if (score >= t.minScore) return t.riskLevel;
  }
  return 'LOW';
}
