/**
 * Procurement Package validation rules.
 *
 * Rules (PM spec):
 *   1. Package code unique
 *   2. Budget cannot be negative
 *   3. Totals must match (remainingAmount = approvedAmount − committed − spent)
 *   4. Department must exist and be active
 *   5. Fund source must exist and be active
 *   6. Approval authority resolvable for estimatedValue
 */

import type { ProcurementPackage, PackageBudget, PackageValidationResult } from './packageTypes';
import { PackageError } from './packageTypes';
import type { IProcurementPackageRepository } from './packageRepository';
import type { IMasterDataRepository } from '../../masterdata/masterdataRepository';
import type { Department, FundSource } from '../../masterdata/masterdataTypes';
import { resolveApprovalAuthorityLimit } from '../../masterdata/masterdataIntegration';
import type { ApprovalAuthority } from '../../masterdata/masterdataTypes';

// ─── Rule 1: Unique code ──────────────────────────────────────────────────────

export async function validateUniquePackageCode(
  code:       string,
  repo:       IProcurementPackageRepository,
  excludeId?: string,
): Promise<boolean> {
  const existing = await repo.findByCode(code);
  return !existing || existing.id === excludeId;
}

export async function assertUniquePackageCode(
  code:       string,
  repo:       IProcurementPackageRepository,
  excludeId?: string,
): Promise<void> {
  const ok = await validateUniquePackageCode(code, repo, excludeId);
  if (!ok) throw new PackageError('DUPLICATE_CODE', 'packageCode', `Package code '${code}' already exists`);
}

// ─── Rule 2: No negative budget ───────────────────────────────────────────────

export function validateBudgetAmounts(budget: Pick<PackageBudget, 'approvedAmount' | 'committedAmount' | 'spentAmount' | 'remainingAmount'>): PackageValidationResult {
  const errors: string[] = [];
  if (budget.approvedAmount  < 0) errors.push('approvedAmount cannot be negative');
  if (budget.committedAmount < 0) errors.push('committedAmount cannot be negative');
  if (budget.spentAmount     < 0) errors.push('spentAmount cannot be negative');
  if (budget.remainingAmount < 0) errors.push('remainingAmount cannot be negative');
  return { valid: errors.length === 0, errors, warnings: [] };
}

// ─── Rule 3: Budget totals must balance ───────────────────────────────────────

export function validateBudgetBalance(budget: Pick<PackageBudget, 'approvedAmount' | 'committedAmount' | 'spentAmount' | 'remainingAmount'>): PackageValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  const expected = budget.approvedAmount - budget.committedAmount - budget.spentAmount;
  if (Math.abs(expected - budget.remainingAmount) > 0.01) {
    errors.push(`remainingAmount ${budget.remainingAmount} ≠ approved − committed − spent (${expected})`);
  }
  if (budget.committedAmount + budget.spentAmount > budget.approvedAmount) {
    errors.push('committed + spent exceeds approvedAmount');
  }
  if (budget.approvedAmount > 0 && budget.remainingAmount < budget.approvedAmount * 0.1) {
    warnings.push('Less than 10% of budget remaining');
  }
  return { valid: errors.length === 0, errors, warnings };
}

// ─── Rule 4: Department must exist ───────────────────────────────────────────

export async function validateDepartmentExists(
  deptCode: string,
  repo:     IMasterDataRepository<Department>,
): Promise<boolean> {
  const dept = await repo.findByCode(deptCode);
  return dept !== null && dept.isActive && !dept.isArchived;
}

// ─── Rule 5: Fund source must exist ──────────────────────────────────────────

export async function validateFundSourceExists(
  fsCode: string,
  repo:   IMasterDataRepository<FundSource>,
): Promise<boolean> {
  const fs = await repo.findByCode(fsCode);
  return fs !== null && fs.isActive && !fs.isArchived;
}

// ─── Rule 6: Approval authority resolvable ────────────────────────────────────

export async function validateApprovalAuthorityResolvable(
  estimatedValue:    number,
  authorityCode:     string,
  repo:              IMasterDataRepository<ApprovalAuthority>,
): Promise<boolean> {
  const limit = await resolveApprovalAuthorityLimit(authorityCode, repo);
  return limit > 0 && estimatedValue < limit;
}

// ─── estimatedValue basic check ──────────────────────────────────────────────

export function validateEstimatedValue(value: number): PackageValidationResult {
  const errors: string[] = [];
  if (value <= 0) errors.push('estimatedValue must be greater than 0');
  if (!Number.isFinite(value)) errors.push('estimatedValue must be a finite number');
  return { valid: errors.length === 0, errors, warnings: [] };
}

// ─── Required fields check ────────────────────────────────────────────────────

export function validateRequiredFields(pkg: Partial<ProcurementPackage>): PackageValidationResult {
  const errors: string[] = [];
  if (!pkg.packageCode?.trim())       errors.push('packageCode is required');
  if (!pkg.packageName?.trim())       errors.push('packageName is required');
  if (!pkg.packageType?.trim())       errors.push('packageType is required');
  if (!pkg.procurementMethod?.trim()) errors.push('procurementMethod is required');
  if (!pkg.fundSource?.trim())        errors.push('fundSource is required');
  if (!pkg.budgetYear?.trim())        errors.push('budgetYear is required');
  if (!pkg.department?.trim())        errors.push('department is required');
  if (!pkg.owner?.trim())             errors.push('owner is required');
  return { valid: errors.length === 0, errors, warnings: [] };
}

// ─── Composite validation (sync portion only) ─────────────────────────────────

export function validatePackageSync(pkg: Partial<ProcurementPackage>): PackageValidationResult {
  const fields  = validateRequiredFields(pkg);
  const valErr  = validateEstimatedValue(pkg.estimatedValue ?? 0);
  const errors  = [...fields.errors, ...valErr.errors];
  const warnings: string[] = [];
  return { valid: errors.length === 0, errors, warnings };
}
