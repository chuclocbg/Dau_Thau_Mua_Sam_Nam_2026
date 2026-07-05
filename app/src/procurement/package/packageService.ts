/**
 * Procurement Package service functions.
 *
 * Functions:
 *   createPackage()        — validates unique code, creates package + history entry
 *   updatePackage()        — validates, merges updates, records history
 *   clonePackage()         — deep copy with new code, status reset to DRAFT
 *   archivePackage()       — sets status = ARCHIVED, records history
 *   calculateTotals()      — sums PackageItem.estimatedTotal for a package
 *   validatePackage()      — sync structural validation
 *   generatePackageNumber() — e.g. DTMS/2026/001
 */

import type {
  ProcurementPackage, CreatePackageParams, UpdatePackageParams,
  PackageValidationResult,
} from './packageTypes';
import { PackageError } from './packageTypes';
import type { PackageRepositories } from './packageRepository';
import { validatePackageSync, assertUniquePackageCode } from './packageValidation';

// ─── generatePackageNumber ────────────────────────────────────────────────────

export function generatePackageNumber(
  prefix: string = 'DTMS',
  year:   number = new Date().getFullYear(),
  seq:    number = 1,
): string {
  return `${prefix}/${year}/${String(seq).padStart(3, '0')}`;
}

// ─── createPackage ────────────────────────────────────────────────────────────

export async function createPackage(
  params: CreatePackageParams,
  repos:  PackageRepositories,
): Promise<ProcurementPackage> {
  await assertUniquePackageCode(params.packageCode, repos.packages);

  const syncCheck = validatePackageSync(params);
  if (!syncCheck.valid) {
    throw new PackageError('INVALID_PACKAGE', 'package', syncCheck.errors.join('; '));
  }

  const now  = new Date().toISOString();
  const pkg  = await repos.packages.create({
    packageCode:         params.packageCode,
    packageName:         params.packageName,
    description:         params.description ?? '',
    packageType:         params.packageType,
    procurementMethod:   params.procurementMethod,
    procurementCategory: params.procurementCategory,
    estimatedValue:      params.estimatedValue,
    fundSource:          params.fundSource,
    budgetYear:          params.budgetYear,
    department:          params.department,
    owner:               params.owner,
    status:              'DRAFT',
    schedule:            {},
    funding:             [],
    participants:        [{ employeeCode: params.owner, role: 'OWNER', assignedAt: now }],
  });

  await repos.history.create({
    packageId:   pkg.id,
    action:      'CREATED',
    toStatus:    'DRAFT',
    performedBy: params.owner,
    performedAt: now,
  });

  return pkg;
}

// ─── updatePackage ────────────────────────────────────────────────────────────

export async function updatePackage(
  id:         string,
  params:     UpdatePackageParams,
  repos:      PackageRepositories,
  performedBy: string,
): Promise<ProcurementPackage> {
  const existing = await repos.packages.findById(id);
  if (!existing) throw new PackageError('NOT_FOUND', 'id', `Package not found: ${id}`);

  if (existing.status === 'ARCHIVED') {
    throw new PackageError('IMMUTABLE', 'status', 'Archived packages cannot be updated');
  }

  const scheduleUpdate = params.schedule
    ? { ...existing.schedule, ...params.schedule }
    : undefined;

  const updated = await repos.packages.update(id, {
    ...params,
    ...(scheduleUpdate ? { schedule: scheduleUpdate } : {}),
  });

  await repos.history.create({
    packageId:   id,
    action:      'UPDATED',
    fromStatus:  existing.status,
    toStatus:    params.status ?? existing.status,
    performedBy,
    performedAt: new Date().toISOString(),
  });

  return updated;
}

// ─── clonePackage ─────────────────────────────────────────────────────────────

export async function clonePackage(
  id:          string,
  newCode:     string,
  repos:       PackageRepositories,
  performedBy: string,
): Promise<ProcurementPackage> {
  const source = await repos.packages.findById(id);
  if (!source) throw new PackageError('NOT_FOUND', 'id', `Package not found: ${id}`);

  await assertUniquePackageCode(newCode, repos.packages);

  const now   = new Date().toISOString();
  const clone = await repos.packages.create({
    ...source,
    packageCode:  newCode,
    status:       'DRAFT',
    workflowId:   undefined,
    approvedValue: undefined,
    schedule:     {},
    funding:      [...source.funding],
    participants: [{ employeeCode: performedBy, role: 'OWNER', assignedAt: now }],
  });

  await repos.history.create({
    packageId:   clone.id,
    action:      'CLONED',
    toStatus:    'DRAFT',
    performedBy,
    performedAt: now,
    notes:       `Cloned from ${source.packageCode}`,
  });

  return clone;
}

// ─── archivePackage ───────────────────────────────────────────────────────────

export async function archivePackage(
  id:          string,
  repos:       PackageRepositories,
  performedBy: string,
): Promise<ProcurementPackage> {
  const existing = await repos.packages.findById(id);
  if (!existing) throw new PackageError('NOT_FOUND', 'id', `Package not found: ${id}`);

  if (existing.status === 'ARCHIVED') {
    throw new PackageError('ALREADY_ARCHIVED', 'status', 'Package is already archived');
  }
  if (existing.status === 'ACTIVE') {
    throw new PackageError('CANNOT_ARCHIVE', 'status', 'Cannot archive an active package');
  }

  const archived = await repos.packages.update(id, { status: 'ARCHIVED' });

  await repos.history.create({
    packageId:   id,
    action:      'ARCHIVED',
    fromStatus:  existing.status,
    toStatus:    'ARCHIVED',
    performedBy,
    performedAt: new Date().toISOString(),
  });

  return archived;
}

// ─── calculateTotals ──────────────────────────────────────────────────────────

export async function calculateTotals(
  packageId: string,
  repos:     PackageRepositories,
): Promise<number> {
  return repos.items.sumByPackageId(packageId);
}

// ─── validatePackage ──────────────────────────────────────────────────────────

export function validatePackage(
  pkg: Partial<ProcurementPackage>,
): PackageValidationResult {
  return validatePackageSync(pkg);
}
