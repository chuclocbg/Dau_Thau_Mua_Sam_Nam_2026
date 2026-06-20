/**
 * Legal v2.0 — Shared pipeline runner
 *
 * Executes the full legal pipeline in order:
 *   determineApplicability → buildChecklist → evaluateRisk
 *
 * Called by LegalReviewerAgent and ChatAgent to inject legal enrichment
 * fields into their AgentMessage responses.
 *
 * Exported:
 *   LegalPipelineOptions    — optional context from the caller
 *   LegalPipelineEnrichment — all fields injected into AgentMessage
 *   runLegalPipeline()      — never throws; returns safe defaults on error
 *
 * Callers are responsible for mapping their domain inputs (methodCode,
 * fundingSourceName, dossier dates) to LegalPipelineOptions before calling.
 *
 * Pure. Deterministic. No LLM. No side effects.
 */

import {
  determineApplicability,
  type ApplicableDocument,
  type ProcurementMethod,
  type FundSource,
  type WorkflowDocType,
} from './legalApplicabilityEngine';

import {
  buildChecklist,
  type ChecklistDocType,
  type RequiredDocument,
} from './legalChecklistEngine';

import {
  evaluateRisk,
  type RiskLevel,
} from './legalRiskEngine';

export type { ProcurementMethod, FundSource, ChecklistDocType, ApplicableDocument, RequiredDocument, RiskLevel };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LegalPipelineOptions {
  procurementMethod?: ProcurementMethod;
  sourceOfFunds?:     FundSource;
  /**
   * Target document type for checklist evaluation.
   * Defaults to 'hop-dong' (contract stage — requires 4 prerequisites).
   */
  documentType?:      ChecklistDocType;
  /**
   * Documents already present in the dossier.
   * The checklist computes missing = required ∩ ¬existingDocuments.
   */
  existingDocuments?: ChecklistDocType[];
}

export interface LegalPipelineEnrichment {
  applicableDocuments: ApplicableDocument[];
  missingDocuments:    RequiredDocument[];
  warnings:            string[];
  completionScore:     number;   // 0–100
  riskLevel:           RiskLevel;
  riskScore:           number;
  recommendations:     string[];
}

// ─── Internal constant ────────────────────────────────────────────────────────

// Maps ChecklistDocType → v1.6 WorkflowDocType for determineApplicability().
// Mirrors TO_WORKFLOW in legalChecklistEngine / legalRiskEngine.
const TO_WORKFLOW: Record<ChecklistDocType, WorkflowDocType> = {
  'to-trinh':             'to-trinh',
  'khlcnt':               'khlcnt',
  'hsyc':                 'hsyc',
  'quyet-dinh-phe-duyet': 'to-trinh',
  'hop-dong':             'hop-dong',
  'bien-ban-nghiem-thu':  'bien-ban-nghiem-thu',
  'bien-ban-ban-giao':    'bien-ban-nghiem-thu',
  'thanh-toan':           'thanh-toan',
  'thanh-ly':             'thanh-ly',
};

// Safe defaults returned whenever the pipeline throws.
const SAFE_DEFAULT: LegalPipelineEnrichment = {
  applicableDocuments: [],
  missingDocuments:    [],
  warnings:            [],
  completionScore:     100,
  riskLevel:           'LOW',
  riskScore:           0,
  recommendations:     [],
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the full legal pipeline for one procurement context.
 *
 * Pipeline:
 *   1. determineApplicability()  → applicableDocuments
 *   2. buildChecklist()          → missingDocuments, warnings, completionScore
 *   3. evaluateRisk()            → riskLevel, riskScore, recommendations
 *
 * Never throws. Returns SAFE_DEFAULT on any pipeline error so that callers
 * (agents) can always spread the result unconditionally onto AgentMessage.
 */
export function runLegalPipeline(opts: LegalPipelineOptions = {}): LegalPipelineEnrichment {
  try {
    const method   = opts.procurementMethod ?? 'chi-dinh-thau';
    const fund     = opts.sourceOfFunds    ?? 'ngan-sach-nha-nuoc';
    const docType  = opts.documentType     ?? 'hop-dong';
    const existing = opts.existingDocuments ?? [];

    const { applicableDocuments } = determineApplicability({
      packageCategory:   'hang-hoa',
      workflowDocType:   TO_WORKFLOW[docType],
      procurementMethod: method,
      fundSource:        fund,
    });

    const checklist = buildChecklist({
      documentType:      docType,
      packageCategory:   'hang-hoa',
      procurementMethod: method,
      sourceOfFunds:     fund,
      existingDocuments: existing,
    });

    const risk = evaluateRisk({
      documentType:      docType,
      procurementMethod: method,
      sourceOfFunds:     fund,
      missingDocuments:  checklist.missingDocuments,
      warnings:          checklist.warnings,
      completionScore:   checklist.completionScore,
    });

    return {
      applicableDocuments,
      missingDocuments: checklist.missingDocuments,
      warnings:         checklist.warnings,
      completionScore:  checklist.completionScore,
      riskLevel:        risk.riskLevel,
      riskScore:        risk.riskScore,
      recommendations:  risk.recommendations,
    };
  } catch {
    return { ...SAFE_DEFAULT };
  }
}
