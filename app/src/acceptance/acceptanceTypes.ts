// Acceptance Module — Phase H
// Legal basis: Luật 22/2023/QH15, NĐ 214/2025, NĐ 104/2026, TT 13/2026/TT-BCT, TT 79/2025/TT-BTC
// legalBasis[] is open-ended — any additional law, decree, circular, or internal regulation may be cited.

export const ACCEPTANCE_STATUSES = [
  'DRAFT', 'COMMITTEE_FORMED', 'IN_PROGRESS',
  'PARTIAL_ACCEPTED', 'COMPLETED', 'REJECTED', 'WITHDRAWN',
] as const;
export type AcceptanceStatus = typeof ACCEPTANCE_STATUSES[number];

export const ACCEPTANCE_TYPES = ['PARTIAL', 'FINAL', 'WARRANTY'] as const;
export type AcceptanceType = typeof ACCEPTANCE_TYPES[number];

export const SESSION_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export type SessionStatus = typeof SESSION_STATUSES[number];

export const ITEM_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED'] as const;
export type AcceptanceItemStatus = typeof ITEM_STATUSES[number];

export const MINUTE_STATUSES = ['DRAFT', 'SIGNED', 'VOIDED'] as const;
export type MinuteStatus = typeof MINUTE_STATUSES[number];

export const MEMBER_ROLES = ['CHAIRMAN', 'SECRETARY', 'MEMBER', 'EXPERT'] as const;
export type MemberRole = typeof MEMBER_ROLES[number];

export const ACCEPTANCE_ACTIONS = [
  'CREATED', 'COMMITTEE_FORMED', 'MEMBER_ADDED', 'MEMBER_REMOVED',
  'SESSION_STARTED', 'SESSION_COMPLETED', 'SESSION_CANCELLED',
  'ITEM_RECORDED', 'MINUTE_CREATED', 'MINUTE_SIGNED',
  'PARTIAL_ACCEPTED', 'COMPLETED', 'REJECTED', 'WITHDRAWN',
  'ATTACHMENT_ADDED', 'NOTE_ADDED',
] as const;
export type AcceptanceAction = typeof ACCEPTANCE_ACTIONS[number];

export const ACCEPTANCE_DOC_TYPES = [
  'ACCEPTANCE_MINUTE', 'TECHNICAL_SPEC', 'TEST_REPORT',
  'INSPECTION_REPORT', 'HANDOVER_DOCUMENT', 'COMMITTEE_DECISION',
  'CONTRACT_REFERENCE', 'OTHER',
] as const;
export type AcceptanceDocType = typeof ACCEPTANCE_DOC_TYPES[number];

// ─── Error ─────────────────────────────────────────────────────────────────────

export class AcceptanceError extends Error {
  constructor(
    public readonly code: string,
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = 'AcceptanceError';
  }
}

// ─── Entities ──────────────────────────────────────────────────────────────────

export interface AcceptanceRequest {
  id: string;
  requestCode: string;
  acceptanceType: AcceptanceType;
  contractId: string;
  packageId?: string;
  workflowId?: string;
  requestedBy: string;
  requestedAt: string;
  department: string;
  description?: string;
  // Extensible: cite any applicable law, decree, circular, sector regulation, or internal reg.
  legalBasis: string[];
  status: AcceptanceStatus;
  completedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcceptanceCommittee {
  id: string;
  requestId: string;
  committeeCode: string;
  establishedBy: string;
  establishedAt: string;
  decisionReference?: string; // QĐ thành lập hội đồng nghiệm thu
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcceptanceMember {
  id: string;
  committeeId: string;
  requestId: string;
  memberCode: string;
  memberName: string;
  role: MemberRole;
  organization?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AcceptanceSession {
  id: string;
  requestId: string;
  sessionNumber: number;
  sessionType: AcceptanceType;
  scheduledDate: string;
  actualDate?: string;
  location?: string;
  status: SessionStatus;
  chairmanCode?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcceptanceItem {
  id: string;
  sessionId: string;
  requestId: string;
  itemCode: string;
  description: string;
  unit?: string;
  contractedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  status: AcceptanceItemStatus;
  rejectReason?: string;
  verifiedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcceptanceMinute {
  id: string;
  requestId: string;
  sessionId: string;
  minuteCode: string;
  content?: string;
  conclusion: string;
  status: MinuteStatus;
  signedBy?: string;
  signedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcceptanceHistoryEntry {
  id: string;
  requestId: string;
  action: AcceptanceAction;
  performedBy: string;
  performedAt: string;
  fromStatus?: AcceptanceStatus;
  toStatus?: AcceptanceStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcceptanceAttachment {
  id: string;
  requestId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  documentType: AcceptanceDocType;
  createdAt: string;
  updatedAt: string;
}

// ─── Params ────────────────────────────────────────────────────────────────────

export interface CreateAcceptanceParams {
  requestCode: string;
  acceptanceType: AcceptanceType;
  contractId: string;
  packageId?: string;
  workflowId?: string;
  requestedBy: string;
  department: string;
  description?: string;
  legalBasis?: string[];
  notes?: string;
}

export interface FormCommitteeParams {
  committeeCode: string;
  establishedBy: string;
  decisionReference?: string;
  notes?: string;
}

export interface AddMemberParams {
  memberCode: string;
  memberName: string;
  role: MemberRole;
  organization?: string;
}

export interface CreateSessionParams {
  sessionType: AcceptanceType;
  scheduledDate: string;
  location?: string;
  chairmanCode?: string;
  notes?: string;
}

export interface RecordItemParams {
  itemCode: string;
  description: string;
  unit?: string;
  contractedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  rejectReason?: string;
  verifiedBy?: string;
}

export interface CreateMinuteParams {
  minuteCode: string;
  content?: string;
  conclusion: string;
}

export interface AddAttachmentParams {
  fileName: string;
  fileType: string;
  fileSize: number;
  documentType: AcceptanceDocType;
}

// ─── Summary ───────────────────────────────────────────────────────────────────

export interface AcceptanceSummary {
  requestCode: string;
  acceptanceType: AcceptanceType;
  status: AcceptanceStatus;
  contractId: string;
  department: string;
  sessionCount: number;
  completedSessionCount: number;
  itemCount: number;
  acceptedItemCount: number;
  rejectedItemCount: number;
  memberCount: number;
  attachmentCount: number;
  legalBasisCount: number;
  acceptanceRate: number;
}

// ─── Search ────────────────────────────────────────────────────────────────────

export interface AcceptanceSearchQuery {
  contractId?: string;
  status?: AcceptanceStatus;
  acceptanceType?: AcceptanceType;
  department?: string;
  page?: number;
  pageSize?: number;
}

export interface AcceptanceSearchResult<T> {
  items: readonly T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AcceptanceValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ─── Type guards ───────────────────────────────────────────────────────────────

export function isAcceptanceStatus(v: unknown): v is AcceptanceStatus {
  return typeof v === 'string' && (ACCEPTANCE_STATUSES as readonly string[]).includes(v);
}
export function isAcceptanceType(v: unknown): v is AcceptanceType {
  return typeof v === 'string' && (ACCEPTANCE_TYPES as readonly string[]).includes(v);
}
export function isMemberRole(v: unknown): v is MemberRole {
  return typeof v === 'string' && (MEMBER_ROLES as readonly string[]).includes(v);
}
export function isSessionStatus(v: unknown): v is SessionStatus {
  return typeof v === 'string' && (SESSION_STATUSES as readonly string[]).includes(v);
}
export function isMinuteStatus(v: unknown): v is MinuteStatus {
  return typeof v === 'string' && (MINUTE_STATUSES as readonly string[]).includes(v);
}
export function isAcceptanceItemStatus(v: unknown): v is AcceptanceItemStatus {
  return typeof v === 'string' && (ITEM_STATUSES as readonly string[]).includes(v);
}
