/**
 * Master data entity types.
 * All entities share the MasterDataEntity base.
 * Entities are archived (soft-delete), never hard-deleted where legally required.
 */

// ─── Base entity ──────────────────────────────────────────────────────────────

export interface MasterDataEntity {
  readonly id:         string;
  readonly code:       string;  // unique, immutable after creation
  readonly name:       string;
  readonly isActive:   boolean;
  readonly isArchived: boolean;
  readonly createdAt:  string;  // ISO 8601
  readonly updatedAt:  string;
}

// ─── 10 domain entities ───────────────────────────────────────────────────────

export interface Department extends MasterDataEntity {
  readonly parentId?: string;
  readonly level:     number;   // 1 = top-level
}

export interface Employee extends MasterDataEntity {
  readonly departmentId: string;
  readonly email:        string;
  readonly roles:        readonly string[];
}

/** Replaces hardcoded AUTHORITY_VALUE_LIMITS in workflowValidator.ts */
export interface ApprovalAuthority extends MasterDataEntity {
  readonly level:    number;  // seniority rank — lower = more senior
  readonly maxValue: number;  // maximum VNĐ value this authority may approve
}

export interface Vendor extends MasterDataEntity {
  readonly taxCode:       string;
  readonly address:       string;
  readonly contactEmail?: string;
  readonly isBlacklisted: boolean;
}

export interface FundSource extends MasterDataEntity {
  readonly type: 'STATE' | 'ODA' | 'PPP' | 'ENTERPRISE';
}

export interface BudgetYear extends MasterDataEntity {
  readonly year:        number;
  readonly startDate:   string;  // YYYY-MM-DD
  readonly endDate:     string;
  readonly totalBudget: number;  // VNĐ
}

/** Replaces hardcoded PACKAGE_TYPES in procurementTypes.ts */
export interface PackageType extends MasterDataEntity {
  readonly category: string;  // Vietnamese display name
}

/** Replaces hardcoded PROCUREMENT_METHODS in procurementTypes.ts */
export interface ProcurementMethod extends MasterDataEntity {
  readonly applicablePackageTypeCodes: readonly string[];
}

export interface ProcurementCategory extends MasterDataEntity {
  readonly parentCategoryId?: string;
  readonly packageTypeCode:   string;
}

export interface DocumentTemplate extends MasterDataEntity {
  readonly templateType:     string;            // 'HSMT', 'KHLCNT', 'HOP_DONG', ...
  readonly content:          string;            // template body (may contain placeholders)
  readonly applicableStates: readonly string[]; // WorkflowStateId[]
}

// ─── Query / result types ────────────────────────────────────────────────────

export interface SearchQuery {
  readonly term?:       string;   // searches name and code
  readonly isActive?:   boolean;
  readonly isArchived?: boolean;
  readonly page?:       number;   // 1-based
  readonly pageSize?:   number;   // default 20
}

export interface PagedResult<T> {
  readonly items:    readonly T[];
  readonly total:    number;
  readonly page:     number;
  readonly pageSize: number;
}

// ─── Validation error ─────────────────────────────────────────────────────────

export class MasterDataValidationError extends Error {
  constructor(
    readonly code:    string,  // e.g. 'DUPLICATE_CODE', 'INACTIVE_REFERENCE'
    readonly field:   string,
    message:          string,
  ) {
    super(message);
    this.name = 'MasterDataValidationError';
  }
}

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isFundSourceType(v: unknown): v is FundSource['type'] {
  return ['STATE', 'ODA', 'PPP', 'ENTERPRISE'].includes(v as string);
}

export function isMasterDataEntity(v: unknown): v is MasterDataEntity {
  return (
    typeof v === 'object' && v !== null &&
    typeof (v as MasterDataEntity).id === 'string' &&
    typeof (v as MasterDataEntity).code === 'string' &&
    typeof (v as MasterDataEntity).name === 'string'
  );
}
