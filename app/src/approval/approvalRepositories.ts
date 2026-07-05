import type { IBaseRepository } from '../shared/repository/IBaseRepository';
import type {
  ApprovalRequest, ApprovalDecisionRecord, ApprovalHistoryEntry,
  ApprovalComment, ApprovalAttachment,
  ApprovalStatus, ApprovalType, ApprovalSearchQuery, ApprovalSearchResult,
} from './approvalTypes';

export type { IBaseRepository } from '../shared/repository/IBaseRepository';

// ─── ApprovalRequest ─────────────────────────────────────────────────────────

export interface IApprovalRequestRepository extends IBaseRepository<ApprovalRequest> {
  findByCode(code: string): Promise<ApprovalRequest | null>;
  findByStatus(status: ApprovalStatus): Promise<readonly ApprovalRequest[]>;
  findBySubjectId(subjectId: string): Promise<readonly ApprovalRequest[]>;
  findByDepartment(dept: string): Promise<readonly ApprovalRequest[]>;
  findByApprovalType(type: ApprovalType): Promise<readonly ApprovalRequest[]>;
  search(query: ApprovalSearchQuery): Promise<ApprovalSearchResult<ApprovalRequest>>;
}

// ─── ApprovalDecisionRecord ───────────────────────────────────────────────────

export interface IApprovalDecisionRepository extends IBaseRepository<ApprovalDecisionRecord> {
  findByRequestId(requestId: string): Promise<ApprovalDecisionRecord | null>;
  findByDecidedBy(employeeCode: string): Promise<readonly ApprovalDecisionRecord[]>;
}

// ─── ApprovalHistoryEntry ─────────────────────────────────────────────────────

export interface IApprovalHistoryRepository extends IBaseRepository<ApprovalHistoryEntry> {
  findByRequestId(requestId: string): Promise<readonly ApprovalHistoryEntry[]>;
  findByPerformedBy(employeeCode: string): Promise<readonly ApprovalHistoryEntry[]>;
}

// ─── ApprovalComment ──────────────────────────────────────────────────────────

export interface IApprovalCommentRepository extends IBaseRepository<ApprovalComment> {
  findByRequestId(requestId: string): Promise<readonly ApprovalComment[]>;
  countByRequestId(requestId: string): Promise<number>;
}

// ─── ApprovalAttachment ───────────────────────────────────────────────────────

export interface IApprovalAttachmentRepository extends IBaseRepository<ApprovalAttachment> {
  findByRequestId(requestId: string): Promise<readonly ApprovalAttachment[]>;
  countByRequestId(requestId: string): Promise<number>;
}

// ─── Repository bag ───────────────────────────────────────────────────────────

export interface ApprovalRepositories {
  readonly requests:    IApprovalRequestRepository;
  readonly decisions:   IApprovalDecisionRepository;
  readonly history:     IApprovalHistoryRepository;
  readonly comments:    IApprovalCommentRepository;
  readonly attachments: IApprovalAttachmentRepository;
}
