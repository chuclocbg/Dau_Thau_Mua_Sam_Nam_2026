/**
 * Repository interfaces for the Procurement Package module.
 * 5 repositories per PM spec.
 */

import type {
  ProcurementPackage, PackageItem, PackageBudget,
  PackageAttachment, PackageHistory,
  PackageStatus, PackageSearchQuery, PackageSearchResult,
} from './packageTypes';
import type { IBaseRepository } from '../../shared/repository/IBaseRepository';
export type { IBaseRepository } from '../../shared/repository/IBaseRepository';

// ─── ProcurementPackage repository ───────────────────────────────────────────

export interface IProcurementPackageRepository extends IBaseRepository<ProcurementPackage> {
  findByCode(code: string): Promise<ProcurementPackage | null>;
  findByStatus(status: PackageStatus): Promise<readonly ProcurementPackage[]>;
  findByDepartment(deptCode: string): Promise<readonly ProcurementPackage[]>;
  search(query: PackageSearchQuery): Promise<PackageSearchResult>;
}

// ─── PackageItem repository ───────────────────────────────────────────────────

export interface IPackageItemRepository extends IBaseRepository<PackageItem> {
  findByPackageId(packageId: string): Promise<readonly PackageItem[]>;
  deleteByPackageId(packageId: string): Promise<void>;
  sumByPackageId(packageId: string): Promise<number>;
}

// ─── Budget repository ────────────────────────────────────────────────────────

export interface IBudgetRepository extends IBaseRepository<PackageBudget> {
  findByPackageId(packageId: string): Promise<PackageBudget | null>;
}

// ─── Attachment repository ────────────────────────────────────────────────────

export interface IAttachmentRepository extends IBaseRepository<PackageAttachment> {
  findByPackageId(packageId: string): Promise<readonly PackageAttachment[]>;
  findByDocumentType(packageId: string, docType: string): Promise<readonly PackageAttachment[]>;
}

// ─── History repository ───────────────────────────────────────────────────────

export interface IHistoryRepository extends IBaseRepository<PackageHistory> {
  findByPackageId(packageId: string): Promise<readonly PackageHistory[]>;
  findByAction(packageId: string, action: string): Promise<readonly PackageHistory[]>;
}

// ─── Repository bag ───────────────────────────────────────────────────────────

export interface PackageRepositories {
  readonly packages:     IProcurementPackageRepository;
  readonly items:        IPackageItemRepository;
  readonly budgets:      IBudgetRepository;
  readonly attachments:  IAttachmentRepository;
  readonly history:      IHistoryRepository;
}
