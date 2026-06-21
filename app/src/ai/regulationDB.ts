/**
 * Legal v4.1 — Regulation Database (thin adapter)
 *
 * Re-exports the same named constants as v4.0 so all existing consumers
 * (regulationExtractor.ts) continue to work without modification.
 *
 * Data for the five primary registries now comes from external JSON files
 * loaded via regulationLoader.ts.  DOCUMENT_REQUIREMENTS is kept here as a
 * hardcoded TypeScript constant because it was not included in the JSON
 * migration scope (no documentRequirements.json was requested).
 *
 * Backward compatibility: 100%.  regulationExtractor.ts imports by name
 * (THRESHOLDS, PROCUREMENT_BANDS, …) and those names are unchanged.
 *
 * Pure data. No LLM. No browser globals. No hooks. No IndexedDB. No UI.
 */

import {
  loadThresholds,
  loadProcurementBands,
  loadContractTypes,
  loadFundSources,
  loadRiskThresholds,
} from './regulationLoader';

// Re-export types so existing consumers (`import type { Threshold } from './regulationDB'`)
// continue to compile without changes.
export type {
  Threshold,
  ProcurementBand,
  ContractTypeReg,
  FundSourceReg,
  DocumentRequirement,
  RiskThreshold,
} from './regulationLoader';

// ─── Five primary registries — data sourced from JSON ─────────────────────────

export const THRESHOLDS         = loadThresholds();
export const PROCUREMENT_BANDS  = loadProcurementBands();
export const CONTRACT_TYPE_REGS = loadContractTypes();
export const FUND_SOURCE_REGS   = loadFundSources();
export const RISK_THRESHOLDS    = loadRiskThresholds();

// ─── Document prerequisites — kept in TypeScript (not in JSON scope) ──────────
// Source: legalChecklistEngine.ts PREREQUISITES map.

import type { DocumentRequirement } from './regulationLoader';

const DOC_REQ_SOURCE = 'Luật Đấu thầu số 22/2023/QH15; Nghị định 214/2025/NĐ-CP';

export const DOCUMENT_REQUIREMENTS: readonly DocumentRequirement[] = [
  { stage: 'khlcnt',               requiredDocument: 'to-trinh',             source: DOC_REQ_SOURCE },
  { stage: 'hsyc',                 requiredDocument: 'to-trinh',             source: DOC_REQ_SOURCE },
  { stage: 'hsyc',                 requiredDocument: 'khlcnt',               source: DOC_REQ_SOURCE },
  { stage: 'quyet-dinh-phe-duyet', requiredDocument: 'to-trinh',             source: DOC_REQ_SOURCE },
  { stage: 'quyet-dinh-phe-duyet', requiredDocument: 'khlcnt',               source: DOC_REQ_SOURCE },
  { stage: 'quyet-dinh-phe-duyet', requiredDocument: 'hsyc',                 source: DOC_REQ_SOURCE },
  { stage: 'hop-dong',             requiredDocument: 'to-trinh',             source: DOC_REQ_SOURCE },
  { stage: 'hop-dong',             requiredDocument: 'khlcnt',               source: DOC_REQ_SOURCE },
  { stage: 'hop-dong',             requiredDocument: 'hsyc',                 source: DOC_REQ_SOURCE },
  { stage: 'hop-dong',             requiredDocument: 'quyet-dinh-phe-duyet', source: DOC_REQ_SOURCE },
  { stage: 'bien-ban-nghiem-thu',  requiredDocument: 'hop-dong',             source: DOC_REQ_SOURCE },
  { stage: 'bien-ban-ban-giao',    requiredDocument: 'hop-dong',             source: DOC_REQ_SOURCE },
  { stage: 'bien-ban-ban-giao',    requiredDocument: 'bien-ban-nghiem-thu',  source: DOC_REQ_SOURCE },
  { stage: 'thanh-toan',           requiredDocument: 'hop-dong',             source: DOC_REQ_SOURCE },
  { stage: 'thanh-toan',           requiredDocument: 'bien-ban-nghiem-thu',  source: DOC_REQ_SOURCE },
  { stage: 'thanh-toan',           requiredDocument: 'bien-ban-ban-giao',    source: DOC_REQ_SOURCE },
  { stage: 'thanh-ly',             requiredDocument: 'hop-dong',             source: DOC_REQ_SOURCE },
  { stage: 'thanh-ly',             requiredDocument: 'bien-ban-nghiem-thu',  source: DOC_REQ_SOURCE },
  { stage: 'thanh-ly',             requiredDocument: 'bien-ban-ban-giao',    source: DOC_REQ_SOURCE },
  { stage: 'thanh-ly',             requiredDocument: 'thanh-toan',           source: DOC_REQ_SOURCE },
];
