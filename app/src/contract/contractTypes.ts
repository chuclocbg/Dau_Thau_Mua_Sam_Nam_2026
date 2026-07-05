/**
 * Contract Module — entity types, enums, error class.
 *
 * Legal basis:
 *   Luật 22/2023/QH15   — Chương IX: Ký kết và thực hiện hợp đồng
 *   NĐ 214/2025/NĐ-CP   — Chương IX: Loại hợp đồng và bảo đảm thực hiện
 *   NĐ 104/2026/NĐ-CP   — Điều khoản sửa đổi về phụ lục hợp đồng
 *   TT 13/2026/TT-BCT   — Mẫu hợp đồng mua sắm hàng hóa
 *   TT 79/2025/TT-BTC   — Tạm ứng và thanh toán hợp đồng
 */

// ─── Contract status ──────────────────────────────────────────────────────────

export const CONTRACT_STATUSES = [
  'DRAFT',
  'SIGNED',
  'EFFECTIVE',
  'SUSPENDED',
  'COMPLETED',
  'TERMINATED',
] as const;
export type ContractStatus = typeof CONTRACT_STATUSES[number];

// ─── Contract type (Loại hợp đồng — NĐ 214/2025 Điều 53) ────────────────────

export const CONTRACT_TYPES = [
  'LUMP_SUM',    // Hợp đồng trọn gói
  'UNIT_PRICE',  // Hợp đồng theo đơn giá
  'TIME_BASED',  // Hợp đồng theo thời gian
  'MIXED',       // Hợp đồng hỗn hợp
] as const;
export type ContractType = typeof CONTRACT_TYPES[number];

// ─── Amendment status ─────────────────────────────────────────────────────────

export const AMENDMENT_STATUSES = ['DRAFT', 'APPROVED', 'REJECTED'] as const;
export type AmendmentStatus = typeof AMENDMENT_STATUSES[number];

// ─── Milestone status ─────────────────────────────────────────────────────────

export const MILESTONE_STATUSES = ['PENDING', 'REACHED', 'DELAYED', 'CANCELLED'] as const;
export type MilestoneStatus = typeof MILESTONE_STATUSES[number];

// ─── Guarantee type (NĐ 214/2025 Điều 56, 57) ────────────────────────────────

export const GUARANTEE_TYPES = [
  'PERFORMANCE',      // Bảo đảm thực hiện hợp đồng
  'ADVANCE_PAYMENT',  // Bảo đảm tạm ứng
  'WARRANTY',         // Bảo đảm bảo hành
] as const;
export type GuaranteeType = typeof GUARANTEE_TYPES[number];

// ─── Guarantee status ─────────────────────────────────────────────────────────

export const GUARANTEE_STATUSES = ['ACTIVE', 'EXPIRED', 'RETURNED', 'FORFEITED'] as const;
export type GuaranteeStatus = typeof GUARANTEE_STATUSES[number];

// ─── Contract actions (history) ───────────────────────────────────────────────

export const CONTRACT_ACTIONS = [
  'CREATED', 'SIGNED', 'ACTIVATED', 'SUSPENDED', 'RESUMED',
  'AMENDMENT_CREATED', 'AMENDMENT_APPROVED', 'AMENDMENT_REJECTED',
  'MILESTONE_REACHED', 'MILESTONE_DELAYED',
  'GUARANTEE_ADDED', 'GUARANTEE_RETURNED', 'GUARANTEE_FORFEITED',
  'ATTACHMENT_ADDED', 'COMPLETED', 'TERMINATED', 'NOTE_ADDED',
] as const;
export type ContractAction = typeof CONTRACT_ACTIONS[number];

// ─── Contract document types ──────────────────────────────────────────────────

export const CONTRACT_DOC_TYPES = [
  'CONTRACT_DOCUMENT',
  'AMENDMENT_DOCUMENT',
  'PERFORMANCE_SECURITY',
  'ADVANCE_PAYMENT_GUARANTEE',
  'WARRANTY_GUARANTEE',
  'TECHNICAL_SPECIFICATION',
  'ACCEPTANCE_RECORD',
  'PAYMENT_RECORD',
  'OTHER',
] as const;
export type ContractDocumentType = typeof CONTRACT_DOC_TYPES[number];

// ─── Error class ──────────────────────────────────────────────────────────────

export class ContractError extends Error {
  constructor(readonly code: string, readonly field: string, message: string) {
    super(message);
    this.name = 'ContractError';
  }
}

// ─── Core entities ────────────────────────────────────────────────────────────

export interface Contract {
  readonly id:                         string;
  readonly contractNumber:             string;    // unique, e.g. HĐ/DTMS/2026/001
  readonly contractType:               ContractType;
  readonly packageId:                  string;    // FK → ProcurementPackage
  readonly approvalId?:                string;    // FK → ApprovalRequest
  readonly workflowId?:                string;    // FK → WorkflowInstance.context.id
  readonly winnerCode:                 string;    // contractor/vendor code
  readonly winnerName:                 string;
  readonly contractValue:              number;    // VNĐ
  readonly currency:                   string;    // default 'VND'
  readonly signedDate?:                string;    // YYYY-MM-DD
  readonly effectiveDate?:             string;    // YYYY-MM-DD
  readonly expiryDate?:                string;    // YYYY-MM-DD
  readonly performanceSecurityAmount?: number;    // bảo đảm thực hiện (VNĐ)
  readonly performanceSecurityPercent?: number;   // % of contractValue
  readonly advancePaymentAmount?:      number;    // tạm ứng (VNĐ)
  readonly advancePaymentPercent?:     number;    // % of contractValue
  readonly status:                     ContractStatus;
  readonly notes?:                     string;
  readonly createdAt:                  string;
  readonly updatedAt:                  string;
}

export interface ContractAmendment {
  readonly id:                 string;
  readonly contractId:         string;
  readonly amendmentNumber:    number;    // sequential within contract (1, 2, 3…)
  readonly amendmentCode:      string;    // e.g. PLHD/DTMS/2026/001/01
  readonly reason:             string;
  readonly changedFields:      readonly string[];  // list of fields changed
  readonly valueChange?:       number;   // VNĐ delta (positive = increase)
  readonly timeExtensionDays?: number;   // additional calendar days
  readonly approvedBy?:        string;
  readonly approvedAt?:        string;
  readonly status:             AmendmentStatus;
  readonly notes?:             string;
  readonly createdAt:          string;
  readonly updatedAt:          string;
}

export interface ContractMilestone {
  readonly id:           string;
  readonly contractId:   string;
  readonly milestoneCode: string;
  readonly title:        string;
  readonly description?: string;
  readonly plannedDate:  string;    // YYYY-MM-DD
  readonly actualDate?:  string;
  readonly plannedValue: number;    // VNĐ expected at milestone
  readonly actualValue?: number;
  readonly status:       MilestoneStatus;
  readonly verifiedBy?:  string;
  readonly createdAt:    string;
  readonly updatedAt:    string;
}

export interface ContractGuarantee {
  readonly id:              string;
  readonly contractId:      string;
  readonly guaranteeType:   GuaranteeType;
  readonly amount:          number;    // VNĐ
  readonly percent?:        number;    // % of contractValue
  readonly issuerCode:      string;    // bank / insurance company code
  readonly issuerName:      string;
  readonly guaranteeNumber: string;    // reference from issuer
  readonly issuedDate:      string;    // YYYY-MM-DD
  readonly expiryDate:      string;    // YYYY-MM-DD
  readonly status:          GuaranteeStatus;
  readonly returnedDate?:   string;
  readonly notes?:          string;
  readonly createdAt:       string;
  readonly updatedAt:       string;
}

export interface ContractHistoryEntry {
  readonly id:          string;
  readonly contractId:  string;
  readonly action:      ContractAction;
  readonly performedBy: string;
  readonly performedAt: string;
  readonly fromStatus?: ContractStatus;
  readonly toStatus?:   ContractStatus;
  readonly notes?:      string;
  readonly createdAt:   string;
  readonly updatedAt:   string;
}

export interface ContractAttachment {
  readonly id:           string;
  readonly contractId:   string;
  readonly fileName:     string;
  readonly fileType:     string;
  readonly fileSize:     number;    // bytes
  readonly uploadedBy:   string;
  readonly documentType: ContractDocumentType;
  readonly createdAt:    string;
  readonly updatedAt:    string;
}

// ─── Params ───────────────────────────────────────────────────────────────────

export interface CreateContractParams {
  readonly contractNumber:              string;
  readonly contractType:                ContractType;
  readonly packageId:                   string;
  readonly approvalId?:                 string;
  readonly workflowId?:                 string;
  readonly winnerCode:                  string;
  readonly winnerName:                  string;
  readonly contractValue:               number;
  readonly currency?:                   string;
  readonly effectiveDate?:              string;
  readonly expiryDate?:                 string;
  readonly performanceSecurityAmount?:  number;
  readonly performanceSecurityPercent?: number;
  readonly advancePaymentAmount?:       number;
  readonly advancePaymentPercent?:      number;
  readonly notes?:                      string;
}

export interface CreateAmendmentParams {
  readonly reason:             string;
  readonly changedFields:      readonly string[];
  readonly valueChange?:       number;
  readonly timeExtensionDays?: number;
  readonly notes?:             string;
}

export interface AddMilestoneParams {
  readonly milestoneCode: string;
  readonly title:         string;
  readonly description?:  string;
  readonly plannedDate:   string;
  readonly plannedValue:  number;
}

export interface AddGuaranteeParams {
  readonly guaranteeType:   GuaranteeType;
  readonly amount:          number;
  readonly percent?:        number;
  readonly issuerCode:      string;
  readonly issuerName:      string;
  readonly guaranteeNumber: string;
  readonly issuedDate:      string;
  readonly expiryDate:      string;
  readonly notes?:          string;
}

export interface AddAttachmentParams {
  readonly fileName:     string;
  readonly fileType:     string;
  readonly fileSize:     number;
  readonly documentType: ContractDocumentType;
}

// ─── Search / result ──────────────────────────────────────────────────────────

export interface ContractSearchQuery {
  readonly term?:        string;
  readonly status?:      ContractStatus;
  readonly contractType?: ContractType;
  readonly packageId?:   string;
  readonly winnerCode?:  string;
  readonly page?:        number;
  readonly pageSize?:    number;
}

export interface ContractSearchResult<T> {
  readonly items:    readonly T[];
  readonly total:    number;
  readonly page:     number;
  readonly pageSize: number;
}

export interface ContractValidationResult {
  readonly valid:    boolean;
  readonly errors:   readonly string[];
  readonly warnings: readonly string[];
}

export interface ContractSummary {
  readonly contractNumber:       string;
  readonly contractType:         ContractType;
  readonly status:               ContractStatus;
  readonly winnerCode:           string;
  readonly winnerName:           string;
  readonly contractValue:        number;
  readonly milestoneCount:       number;
  readonly reachedMilestoneCount: number;
  readonly guaranteeCount:       number;
  readonly activeGuaranteeCount: number;
  readonly amendmentCount:       number;
  readonly attachmentCount:      number;
  readonly completionPercent:    number;  // 0–100
}

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isContractStatus(v: unknown): v is ContractStatus {
  return typeof v === 'string' && (CONTRACT_STATUSES as readonly string[]).includes(v);
}

export function isContractType(v: unknown): v is ContractType {
  return typeof v === 'string' && (CONTRACT_TYPES as readonly string[]).includes(v);
}

export function isGuaranteeType(v: unknown): v is GuaranteeType {
  return typeof v === 'string' && (GUARANTEE_TYPES as readonly string[]).includes(v);
}

export function isMilestoneStatus(v: unknown): v is MilestoneStatus {
  return typeof v === 'string' && (MILESTONE_STATUSES as readonly string[]).includes(v);
}

export function isAmendmentStatus(v: unknown): v is AmendmentStatus {
  return typeof v === 'string' && (AMENDMENT_STATUSES as readonly string[]).includes(v);
}
