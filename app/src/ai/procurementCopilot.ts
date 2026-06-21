/**
 * Legal v3.3 — Procurement Copilot
 *
 * Unified orchestrator: combines document-completeness analysis (v3.1)
 * with contract-compliance review (v3.2) and re-evaluates aggregate risk.
 *
 * Aggregation pipeline:
 *   1. documentGenerator  (v3.1) → requiredDocuments, missingDocuments, timeline,
 *                                   initial risk, legalBasis, recommendations
 *   2. contractReviewer   (v3.2) → contractFindings, contract warnings/recommendations
 *   3. determineApplicability     → applicableDocuments for the contract stage
 *   4. buildChecklist             → prerequisite warnings + checklist completionScore
 *   5. evaluateRisk               → re-evaluate with merged warning set
 *   6. Aggregate                  → merge legalBasis, warnings, recommendations;
 *                                   propagate contract severity into riskLevel
 *
 * Pure function. Deterministic: same input always yields identical output.
 * No LLM. No browser globals. No hooks. No IndexedDB. No UI.
 * No agent modifications. No ChatAgent changes. No LegalReviewerAgent changes.
 */

import { generateDocuments }     from './documentGenerator';
import { reviewContract }        from './contractReviewer';
import { determineApplicability } from './legalApplicabilityEngine';
import { buildChecklist }        from './legalChecklistEngine';
import { evaluateRisk }          from './legalRiskEngine';

import type { ProcurementMethod, FundSource, ApplicableDocument } from './legalApplicabilityEngine';
import type { ChecklistDocType, RequiredDocument }                 from './legalChecklistEngine';
import type { RiskLevel }                                          from './legalRiskEngine';
import type { ContractType, ContractFinding }                      from './contractReviewer';
import type { TimelineStage }                                      from './documentGenerator';

// ─── Public types ──────────────────────────────────────────────────────────────

// Re-export constituent types so callers have a single import point.
export type {
  ProcurementMethod, FundSource, ContractType, RiskLevel,
  RequiredDocument, ApplicableDocument, ContractFinding, TimelineStage,
};

export interface ProcurementCopilotInput {
  /** Procurement method — use engine codes directly (e.g. 'dau-thau-rong-rai'). */
  procurementMethod: ProcurementMethod;
  /** Funding source — use engine codes directly (e.g. 'ngan-sach-nha-nuoc'). */
  fundingSource:     FundSource;
  /** Contract type for compliance review. */
  contractType:      ContractType;
  /** Total package value in VND. */
  packageValue:      number;
  /** Contract duration in calendar days. */
  durationDays:      number;
  /** Doc type IDs already present in the dossier (engine codes). */
  existingDocuments: string[];
  /** Clause IDs present in the draft contract. */
  clauses:           string[];
}

export interface ProcurementCopilotOutput {
  /** All documents required by the procurement method lifecycle. */
  requiredDocuments:   RequiredDocument[];
  /** Lifecycle documents not yet present in existingDocuments. */
  missingDocuments:    RequiredDocument[];
  /** Legal documents applicable to the contract-signing stage. */
  applicableDocuments: ApplicableDocument[];
  /** Deduplicated formal citation strings from all engines. */
  legalBasis:          string[];
  /** Merged, deduplicated warnings from document analysis + contract review. */
  warnings:            string[];
  /** Merged, deduplicated recommendations from all engines. */
  recommendations:     string[];
  /** Aggregate risk level — max(document risk, contract severity). */
  riskLevel:           RiskLevel;
  /** Numeric risk score from legalRiskEngine. */
  riskScore:           number;
  /** 0–100: proportion of required lifecycle documents present. */
  completionScore:     number;
  /** DocType IDs of lifecycle documents that are already present. */
  generatedDocuments:  string[];
  /** Contract compliance findings from contractReviewer. */
  contractFindings:    ContractFinding[];
  /** Ordered procurement lifecycle stages with present/missing status. */
  timeline:            TimelineStage[];
}

// ─── Constants ─────────────────────────────────────────────────────────────────

// Neutral placeholder dates passed to documentGenerator.
// end > start avoids the date-sanity warning; the copilot does not expose dates.
const NEUTRAL_PKG_DATES = { start: '2026-01-01', end: '2026-12-31' } as const;

// Runtime set of all valid ChecklistDocType values (9 total).
const VALID_CHECKLIST_TYPES = new Set<string>([
  'to-trinh', 'khlcnt', 'hsyc', 'quyet-dinh-phe-duyet',
  'hop-dong', 'bien-ban-nghiem-thu', 'bien-ban-ban-giao', 'thanh-toan', 'thanh-ly',
]);

// Severity → numeric rank (shared by RiskLevel and ContractSeverity — same string values).
const SEVERITY_RANK: Record<string, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function filterChecklistDocs(docs: string[]): ChecklistDocType[] {
  return docs.filter(d => VALID_CHECKLIST_TYPES.has(d)) as ChecklistDocType[];
}

/** Returns the higher-severity string of two severity values. */
function maxSeverityStr(a: string, b: string): string {
  return (SEVERITY_RANK[a] ?? 0) >= (SEVERITY_RANK[b] ?? 0) ? a : b;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the full procurement copilot pipeline.
 *
 * All five engine stages are executed in sequence; their outputs are merged
 * into a single aggregate response. No engine is called more than once.
 */
export function runCopilot(input: ProcurementCopilotInput): ProcurementCopilotOutput {

  // ── 1. Document analysis (documentGenerator v3.1) ────────────────────────
  const docGen = generateDocuments({
    methodCode:        input.procurementMethod,   // engine codes pass through directly
    fundingSourceName: input.fundingSource,
    pkgDates:          NEUTRAL_PKG_DATES,
    existingDocuments: input.existingDocuments,
  });

  // ── 2. Contract review (contractReviewer v3.2) ───────────────────────────
  const contract = reviewContract({
    contractType:      input.contractType,
    procurementMethod: input.procurementMethod,
    fundingSource:     input.fundingSource,
    durationDays:      input.durationDays,
    clauses:           input.clauses,
    packageValue:      input.packageValue,
  });

  // ── 3. Applicable legal documents for the contract stage ─────────────────
  // determineApplicability (legalApplicabilityEngine) surfaces which legal
  // documents govern the 'hop-dong' workflow stage for this method + fund.
  const applicability = determineApplicability({
    packageCategory:   'hang-hoa',
    workflowDocType:   'hop-dong',
    procurementMethod: input.procurementMethod,
    fundSource:        input.fundingSource,
  });

  // ── 4. Checklist engine — prerequisite warnings + completion score ────────
  const checklist = buildChecklist({
    documentType:      'thanh-ly',
    packageCategory:   'hang-hoa',
    procurementMethod: input.procurementMethod,
    sourceOfFunds:     input.fundingSource,
    existingDocuments: filterChecklistDocs(input.existingDocuments),
  });

  // Lifecycle-based completion score (0–100).
  // This is broader than the checklist's prerequisite-only score and more
  // meaningful to users who want to know overall dossier progress.
  const completionScore =
    docGen.requiredDocuments.length === 0
      ? 100
      : Math.round(
          ((docGen.requiredDocuments.length - docGen.missingDocuments.length)
            / docGen.requiredDocuments.length) * 100,
        );

  // ── 5. Risk engine — aggregate with combined warnings ────────────────────
  // Merge all warning sources before re-evaluating risk so the engine sees
  // both document-completeness and contract-compliance signals.
  const mergedWarnings = [
    ...new Set([
      ...docGen.warnings,
      ...checklist.warnings,
      ...contract.warnings,
    ]),
  ];

  const risk = evaluateRisk({
    documentType:      'thanh-ly',
    procurementMethod: input.procurementMethod,
    sourceOfFunds:     input.fundingSource,
    missingDocuments:  docGen.missingDocuments,
    warnings:          mergedWarnings,
    completionScore,
  });

  // Contract severity propagates into the aggregate risk level.
  // If a CRITICAL contract finding exists, the overall risk is CRITICAL
  // even when document completion is high.
  const riskLevel = maxSeverityStr(risk.riskLevel, contract.severity) as RiskLevel;

  // ── 6. Aggregate ─────────────────────────────────────────────────────────
  const legalBasis = [
    ...new Set([...docGen.legalBasis, ...contract.legalBasis]),
  ];

  const recommendations = [
    ...new Set([
      ...docGen.recommendations,
      ...contract.recommendations,
      ...risk.recommendations,
    ]),
  ];

  const existingSet = new Set(input.existingDocuments);
  const generatedDocuments = docGen.requiredDocuments
    .filter(d => existingSet.has(d.docType))
    .map(d => d.docType as string);

  return {
    requiredDocuments:   docGen.requiredDocuments,
    missingDocuments:    docGen.missingDocuments,
    applicableDocuments: applicability.applicableDocuments,
    legalBasis,
    warnings:            mergedWarnings,
    recommendations,
    riskLevel,
    riskScore:           risk.riskScore,
    completionScore,
    generatedDocuments,
    contractFindings:    contract.findings,
    timeline:            docGen.timeline,
  };
}
