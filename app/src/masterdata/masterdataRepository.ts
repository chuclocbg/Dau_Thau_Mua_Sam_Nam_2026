/**
 * Generic repository interface and the aggregate MasterDataRepositories type.
 * Every repository supports: Create, Update, Delete, Archive, Search, Filter, Pagination.
 */

import type {
  MasterDataEntity,
  SearchQuery,
  PagedResult,
  Department,
  Employee,
  ApprovalAuthority,
  Vendor,
  FundSource,
  BudgetYear,
  PackageType,
  ProcurementMethod,
  ProcurementCategory,
  DocumentTemplate,
} from './masterdataTypes';

// ─── Generic interface ────────────────────────────────────────────────────────

export interface IMasterDataRepository<T extends MasterDataEntity> {
  /** Create a new entity; id, createdAt, updatedAt are generated. */
  create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;

  /** Update mutable fields; id and createdAt are immutable. */
  update(id: string, updates: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T>;

  /** Hard-delete. Use only for non-legally-required data; prefer archive(). */
  delete(id: string): Promise<void>;

  /** Soft-delete: sets isArchived=true, isActive=false. */
  archive(id: string): Promise<T>;

  findById(id: string):    Promise<T | null>;
  findByCode(code: string): Promise<T | null>;

  /** Returns all active, non-archived entities. */
  findActive(): Promise<readonly T[]>;

  /** Full-text + filter search with pagination. */
  search(query: SearchQuery): Promise<PagedResult<T>>;

  /** Total count of all records (including archived). */
  count(): Promise<number>;
}

// ─── Collection of all 10 repositories ───────────────────────────────────────

export interface MasterDataRepositories {
  readonly departments:           IMasterDataRepository<Department>;
  readonly employees:             IMasterDataRepository<Employee>;
  readonly approvalAuthorities:   IMasterDataRepository<ApprovalAuthority>;
  readonly fundSources:           IMasterDataRepository<FundSource>;
  readonly budgetYears:           IMasterDataRepository<BudgetYear>;
  readonly vendors:               IMasterDataRepository<Vendor>;
  readonly procurementCategories: IMasterDataRepository<ProcurementCategory>;
  readonly packageTypes:          IMasterDataRepository<PackageType>;
  readonly procurementMethods:    IMasterDataRepository<ProcurementMethod>;
  readonly documentTemplates:     IMasterDataRepository<DocumentTemplate>;
}
