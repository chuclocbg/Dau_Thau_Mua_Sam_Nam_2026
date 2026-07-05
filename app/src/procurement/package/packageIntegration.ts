/**
 * Integration bridge — Procurement Package ↔ WorkflowEngine / MasterData / RuleEngine.
 *
 * The WorkflowEngine and procurement rules are frozen. This module provides
 * async helpers that connect ProcurementPackage to the rest of the platform
 * without modifying any frozen files.
 */

import type { ProcurementPackage, PackageValidationResult } from './packageTypes';
import type { PackageRepositories } from './packageRepository';
import type { MasterDataRepositories } from '../../masterdata/masterdataRepository';
import type { ProcurementDecision, ProcurementCase } from '../domain/procurementTypes';
import { ProcurementEngine } from '../application/procurementEngine';
import {
  buildWorkflowParamsFromMasterData,
  validateApprovalAuthorityFromMasterData,
} from '../../masterdata/masterdataIntegration';
import { createWorkflow } from '../workflow/workflowEngine';
import type { WorkflowInstance } from '../workflow/workflowEngine';

// ─── Validate package against master data ─────────────────────────────────────

export interface MasterDataValidationErrors {
  readonly valid:    boolean;
  readonly errors:   readonly string[];
  readonly warnings: readonly string[];
}

export async function validatePackageAgainstMasterData(
  pkg:        ProcurementPackage,
  masterRepos: Pick<MasterDataRepositories, 'departments' | 'fundSources' | 'approvalAuthorities' | 'packageTypes' | 'procurementMethods'>,
): Promise<MasterDataValidationErrors> {
  const errors:   string[] = [];
  const warnings: string[] = [];

  const [dept, fs, pkgType, method] = await Promise.all([
    masterRepos.departments.findByCode(pkg.department),
    masterRepos.fundSources.findByCode(pkg.fundSource),
    masterRepos.packageTypes.findByCode(pkg.packageType),
    masterRepos.procurementMethods.findByCode(pkg.procurementMethod),
  ]);

  if (!dept || !dept.isActive || dept.isArchived)
    errors.push(`Department not found or inactive: ${pkg.department}`);
  if (!fs || !fs.isActive || fs.isArchived)
    errors.push(`Fund source not found or inactive: ${pkg.fundSource}`);
  if (!pkgType || !pkgType.isActive || pkgType.isArchived)
    errors.push(`Package type not found or inactive: ${pkg.packageType}`);
  if (!method || !method.isActive || method.isArchived)
    errors.push(`Procurement method not found or inactive: ${pkg.procurementMethod}`);

  // Approval authority check (if authority code matches a known code)
  const authorityValid = await validateApprovalAuthorityFromMasterData(
    { estimatedValue: pkg.estimatedValue, approvalAuthority: pkg.procurementMethod },
    masterRepos.approvalAuthorities,
  );
  if (!authorityValid) {
    warnings.push('Estimated value may exceed approval authority limit — verify before submission');
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── Evaluate package with Rule Engine ────────────────────────────────────────

const DEFAULT_ENGINE = new ProcurementEngine();

export function evaluatePackageWithRuleEngine(
  pkg:     ProcurementPackage,
  engine?: ProcurementEngine,
): ProcurementDecision {
  const e = engine ?? DEFAULT_ENGINE;
  const procCase: ProcurementCase = {
    id:              pkg.id,
    packageType:     pkg.packageType as Parameters<typeof e.evaluate>[0]['packageType'],
    estimatedValue:  pkg.estimatedValue,
    fundSource:      pkg.fundSource as Parameters<typeof e.evaluate>[0]['fundSource'],
    isUrgent:        false,
    isNationalSec:   false,
    isInternational: false,
    asOfDate:        pkg.createdAt.slice(0, 10),
  };
  return e.evaluate(procCase);
}

// ─── Create package + workflow in one call ────────────────────────────────────

export interface PackageWithWorkflow {
  readonly pkg:      ProcurementPackage;
  readonly workflow: WorkflowInstance;
}

export async function createPackageWithWorkflow(
  pkg:         ProcurementPackage,
  masterRepos: Pick<MasterDataRepositories, 'packageTypes' | 'procurementMethods' | 'approvalAuthorities'>,
  performedBy: string,
): Promise<PackageWithWorkflow> {
  const workflowParams = await buildWorkflowParamsFromMasterData(
    {
      packageId:             pkg.id,
      packageTypeCode:       pkg.packageType,
      estimatedValue:        pkg.estimatedValue,
      procurementMethodCode: pkg.procurementMethod,
      approvalAuthorityCode: 'UNIT_HEAD',  // ponytail: default; resolve from pkg.department in future
      performedBy,
    },
    masterRepos,
  );

  const workflow = createWorkflow(workflowParams);
  return { pkg, workflow };
}

// ─── Link workflow ID to package ──────────────────────────────────────────────

export async function linkWorkflowToPackage(
  packageId:  string,
  workflowId: string,
  repos:      PackageRepositories,
): Promise<ProcurementPackage> {
  const pkg = await repos.packages.findById(packageId);
  if (!pkg) throw new Error(`Package not found: ${packageId}`);
  return repos.packages.update(packageId, { workflowId });
}

// ─── Build summary for AI agents ─────────────────────────────────────────────

export interface PackageSummary {
  readonly packageCode:        string;
  readonly packageName:        string;
  readonly estimatedValue:     number;
  readonly status:             string;
  readonly ruleEngineDecision: ProcurementDecision;
}

export function buildPackageSummary(pkg: ProcurementPackage): PackageSummary {
  return {
    packageCode:        pkg.packageCode,
    packageName:        pkg.packageName,
    estimatedValue:     pkg.estimatedValue,
    status:             pkg.status,
    ruleEngineDecision: evaluatePackageWithRuleEngine(pkg),
  };
}
