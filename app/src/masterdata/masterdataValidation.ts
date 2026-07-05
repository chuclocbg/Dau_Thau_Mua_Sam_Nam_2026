/**
 * Master data validation rules.
 * All functions are async and accept repository references (DI).
 *
 * Rules:
 *   - Unique code per entity type
 *   - Unique name per entity type
 *   - No duplicate approval authority level
 *   - Inactive / archived records cannot be referenced
 *   - Blacklisted vendors cannot be selected
 *   - BudgetYear date range must be valid
 */

import type { MasterDataEntity, ApprovalAuthority, Vendor, BudgetYear } from './masterdataTypes';
import { MasterDataValidationError } from './masterdataTypes';
import type { IMasterDataRepository } from './masterdataRepository';

// ─── Generic validators ───────────────────────────────────────────────────────

export async function validateUniqueCode<T extends MasterDataEntity>(
  repo:       IMasterDataRepository<T>,
  code:       string,
  excludeId?: string,
): Promise<boolean> {
  const existing = await repo.findByCode(code);
  return !existing || existing.id === excludeId;
}

export async function validateUniqueName<T extends MasterDataEntity>(
  repo:       IMasterDataRepository<T>,
  name:       string,
  excludeId?: string,
): Promise<boolean> {
  const result = await repo.search({ term: name });
  const exact  = result.items.filter(e => e.name === name);
  return exact.length === 0 || (exact.length === 1 && exact[0]!.id === excludeId);
}

export async function validateActiveReference<T extends MasterDataEntity>(
  repo: IMasterDataRepository<T>,
  id:   string,
): Promise<boolean> {
  const entity = await repo.findById(id);
  return entity !== null && entity.isActive && !entity.isArchived;
}

// ─── Entity-specific validators ───────────────────────────────────────────────

export async function validateUniqueAuthorityLevel(
  repo:       IMasterDataRepository<ApprovalAuthority>,
  level:      number,
  excludeId?: string,
): Promise<boolean> {
  const all    = await repo.findActive();
  const conflict = all.find(a => a.level === level && a.id !== excludeId);
  return !conflict;
}

export async function validateVendorNotBlacklisted(
  repo: IMasterDataRepository<Vendor>,
  id:   string,
): Promise<boolean> {
  const vendor = await repo.findById(id);
  if (!vendor) return false;
  return !vendor.isBlacklisted;
}

export async function validateBudgetYearDates(
  startDate: string,
  endDate:   string,
): Promise<boolean> {
  return startDate < endDate;
}

// ─── Create / update guards (throw on violation) ──────────────────────────────

export async function assertUniqueCode<T extends MasterDataEntity>(
  repo:       IMasterDataRepository<T>,
  code:       string,
  excludeId?: string,
): Promise<void> {
  const ok = await validateUniqueCode(repo, code, excludeId);
  if (!ok) {
    throw new MasterDataValidationError('DUPLICATE_CODE', 'code', `Code '${code}' already exists`);
  }
}

export async function assertUniqueName<T extends MasterDataEntity>(
  repo:       IMasterDataRepository<T>,
  name:       string,
  excludeId?: string,
): Promise<void> {
  const ok = await validateUniqueName(repo, name, excludeId);
  if (!ok) {
    throw new MasterDataValidationError('DUPLICATE_NAME', 'name', `Name '${name}' already exists`);
  }
}

export async function assertActiveReference<T extends MasterDataEntity>(
  repo:  IMasterDataRepository<T>,
  id:    string,
  field: string,
): Promise<void> {
  const ok = await validateActiveReference(repo, id);
  if (!ok) {
    throw new MasterDataValidationError('INACTIVE_REFERENCE', field, `Referenced entity '${id}' is inactive or archived`);
  }
}

export async function assertBudgetYearDates(
  year: Pick<BudgetYear, 'startDate' | 'endDate'>,
): Promise<void> {
  const ok = await validateBudgetYearDates(year.startDate, year.endDate);
  if (!ok) {
    throw new MasterDataValidationError('INVALID_DATE_RANGE', 'endDate', 'endDate must be after startDate');
  }
}
