/**
 * Procurement Package — core entity types.
 *
 * ProcurementPackage is the central business object. All other modules
 * (Workflow, Budget, Documents, Audit, AI) attach to it by packageId.
 *
 * PackageSchedule, PackageFunding, PackageParticipant are embedded directly
 * on ProcurementPackage (no separate DB tables until Prisma is wired).
 * PackageItem, PackageBudget, PackageAttachment, PackageHistory are separate
 * repositories (one-to-many relationships).
 */

// ─── Status lifecycle ─────────────────────────────────────────────────────────

export const PACKAGE_STATUSES = [
  'DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'CANCELLED', 'COMPLETED', 'ARCHIVED',
] as const;
export type PackageStatus = typeof PACKAGE_STATUSES[number];

export const PARTICIPANT_ROLES = ['OWNER', 'EVALUATOR', 'APPROVER', 'OBSERVER'] as const;
export type ParticipantRole = typeof PARTICIPANT_ROLES[number];

// ─── Embedded entities (stored on ProcurementPackage) ────────────────────────

export interface PackageSchedule {
  readonly planningDate?:   string;  // YYYY-MM-DD
  readonly approvalDate?:   string;
  readonly tenderDate?:     string;
  readonly evaluationDate?: string;
  readonly awardDate?:      string;
  readonly contractDate?:   string;
  readonly completionDate?: string;
}

export interface PackageFunding {
  readonly fundSourceCode: string;
  readonly amount:         number;
  readonly percentage:     number;  // 0–100
}

export interface PackageParticipant {
  readonly employeeCode: string;
  readonly role:         ParticipantRole;
  readonly assignedAt:   string;  // ISO
}

// ─── Root aggregate ───────────────────────────────────────────────────────────

export interface ProcurementPackage {
  readonly id:                  string;
  readonly packageCode:         string;   // unique, e.g. DTMS/2026/001
  readonly packageName:         string;
  readonly description:         string;
  readonly packageType:         string;   // from PackageType.code
  readonly procurementMethod:   string;   // from ProcurementMethod.code
  readonly procurementCategory?: string;  // from ProcurementCategory.code
  readonly estimatedValue:      number;   // VNĐ
  readonly approvedValue?:      number;
  readonly fundSource:          string;   // from FundSource.code
  readonly budgetYear:          string;   // from BudgetYear.code
  readonly department:          string;   // from Department.code
  readonly owner:               string;   // Employee code
  readonly workflowId?:         string;   // links to WorkflowInstance.context.id
  readonly status:              PackageStatus;
  readonly schedule:            PackageSchedule;
  readonly funding:             readonly PackageFunding[];
  readonly participants:        readonly PackageParticipant[];
  readonly createdAt:           string;
  readonly updatedAt:           string;
}

// ─── Separate repository entities ─────────────────────────────────────────────

export interface PackageItem {
  readonly id:                    string;
  readonly packageId:             string;
  readonly itemCode:              string;
  readonly name:                  string;
  readonly unit:                  string;
  readonly quantity:              number;
  readonly estimatedUnitPrice:    number;
  readonly estimatedTotal:        number;  // quantity × estimatedUnitPrice
  readonly category:              string;
  readonly technicalSpecification: string;
  readonly createdAt:             string;
  readonly updatedAt:             string;
}

export interface PackageBudget {
  readonly id:              string;
  readonly packageId:       string;
  readonly budgetSource:    string;
  readonly approvedAmount:  number;
  readonly remainingAmount: number;  // approvedAmount − committedAmount − spentAmount
  readonly committedAmount: number;
  readonly spentAmount:     number;
  readonly createdAt:       string;
  readonly updatedAt:       string;
}

export interface PackageAttachment {
  readonly id:           string;
  readonly packageId:    string;
  readonly fileName:     string;
  readonly fileType:     string;
  readonly fileSize:     number;
  readonly uploadedBy:   string;
  readonly uploadedAt:   string;
  readonly documentType: string;  // e.g. 'KHLCNT', 'HSMT', 'BBDG'
  readonly createdAt:    string;
  readonly updatedAt:    string;
}

export interface PackageHistory {
  readonly id:          string;
  readonly packageId:   string;
  readonly action:      string;
  readonly fromStatus?: PackageStatus;
  readonly toStatus?:   PackageStatus;
  readonly performedBy: string;
  readonly performedAt: string;
  readonly notes?:      string;
  readonly createdAt:   string;
  readonly updatedAt:   string;
}

// ─── Service params ───────────────────────────────────────────────────────────

export interface CreatePackageParams {
  readonly packageCode:          string;
  readonly packageName:          string;
  readonly description?:         string;
  readonly packageType:          string;
  readonly procurementMethod:    string;
  readonly procurementCategory?: string;
  readonly estimatedValue:       number;
  readonly fundSource:           string;
  readonly budgetYear:           string;
  readonly department:           string;
  readonly owner:                string;
}

export interface UpdatePackageParams {
  readonly packageName?:         string;
  readonly description?:         string;
  readonly procurementMethod?:   string;
  readonly procurementCategory?: string;
  readonly estimatedValue?:      number;
  readonly approvedValue?:       number;
  readonly status?:              PackageStatus;
  readonly schedule?:            Partial<PackageSchedule>;
  readonly workflowId?:          string;
}

// ─── Search ───────────────────────────────────────────────────────────────────

export interface PackageSearchQuery {
  readonly term?:         string;
  readonly status?:       PackageStatus;
  readonly department?:   string;
  readonly packageType?:  string;
  readonly fundSource?:   string;
  readonly minValue?:     number;
  readonly maxValue?:     number;
  readonly page?:         number;
  readonly pageSize?:     number;
}

export interface PackageSearchResult {
  readonly items:    readonly ProcurementPackage[];
  readonly total:    number;
  readonly page:     number;
  readonly pageSize: number;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface PackageValidationResult {
  readonly valid:    boolean;
  readonly errors:   readonly string[];
  readonly warnings: readonly string[];
}

// ─── Error ────────────────────────────────────────────────────────────────────

export class PackageError extends Error {
  constructor(
    readonly code:  string,
    readonly field: string,
    message:        string,
  ) {
    super(message);
    this.name = 'PackageError';
  }
}

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isPackageStatus(v: unknown): v is PackageStatus {
  return typeof v === 'string' && (PACKAGE_STATUSES as readonly string[]).includes(v);
}

export function isParticipantRole(v: unknown): v is ParticipantRole {
  return typeof v === 'string' && (PARTICIPANT_ROLES as readonly string[]).includes(v);
}
