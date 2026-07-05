import type { IBaseRepository } from '../shared/repository/IBaseRepository';
import type {
  AcceptanceRequest, AcceptanceCommittee, AcceptanceMember,
  AcceptanceSession, AcceptanceItem, AcceptanceMinute,
  AcceptanceHistoryEntry, AcceptanceAttachment,
  AcceptanceStatus, AcceptanceSearchQuery, AcceptanceSearchResult,
} from './acceptanceTypes';

export interface IAcceptanceRequestRepository extends IBaseRepository<AcceptanceRequest> {
  findByCode(requestCode: string): Promise<AcceptanceRequest | null>;
  findByContractId(contractId: string): Promise<readonly AcceptanceRequest[]>;
  findByStatus(status: AcceptanceStatus): Promise<readonly AcceptanceRequest[]>;
  search(query: AcceptanceSearchQuery): Promise<AcceptanceSearchResult<AcceptanceRequest>>;
}

export interface IAcceptanceCommitteeRepository extends IBaseRepository<AcceptanceCommittee> {
  findByRequestId(requestId: string): Promise<AcceptanceCommittee | null>;
}

export interface IAcceptanceMemberRepository extends IBaseRepository<AcceptanceMember> {
  findByCommitteeId(committeeId: string): Promise<readonly AcceptanceMember[]>;
  findActiveByCommitteeId(committeeId: string): Promise<readonly AcceptanceMember[]>;
  findByRequestId(requestId: string): Promise<readonly AcceptanceMember[]>;
}

export interface IAcceptanceSessionRepository extends IBaseRepository<AcceptanceSession> {
  findByRequestId(requestId: string): Promise<readonly AcceptanceSession[]>;
  findLatestByRequestId(requestId: string): Promise<AcceptanceSession | null>;
  findCompletedByRequestId(requestId: string): Promise<readonly AcceptanceSession[]>;
}

export interface IAcceptanceItemRepository extends IBaseRepository<AcceptanceItem> {
  findBySessionId(sessionId: string): Promise<readonly AcceptanceItem[]>;
  findByRequestId(requestId: string): Promise<readonly AcceptanceItem[]>;
  countAcceptedByRequestId(requestId: string): Promise<number>;
  countRejectedByRequestId(requestId: string): Promise<number>;
}

export interface IAcceptanceMinuteRepository extends IBaseRepository<AcceptanceMinute> {
  findBySessionId(sessionId: string): Promise<AcceptanceMinute | null>;
  findByRequestId(requestId: string): Promise<readonly AcceptanceMinute[]>;
}

export interface IAcceptanceHistoryRepository extends IBaseRepository<AcceptanceHistoryEntry> {
  findByRequestId(requestId: string): Promise<readonly AcceptanceHistoryEntry[]>;
}

export interface IAcceptanceAttachmentRepository extends IBaseRepository<AcceptanceAttachment> {
  findByRequestId(requestId: string): Promise<readonly AcceptanceAttachment[]>;
  countByRequestId(requestId: string): Promise<number>;
}

export interface AcceptanceRepositories {
  readonly requests:    IAcceptanceRequestRepository;
  readonly committees:  IAcceptanceCommitteeRepository;
  readonly members:     IAcceptanceMemberRepository;
  readonly sessions:    IAcceptanceSessionRepository;
  readonly items:       IAcceptanceItemRepository;
  readonly minutes:     IAcceptanceMinuteRepository;
  readonly history:     IAcceptanceHistoryRepository;
  readonly attachments: IAcceptanceAttachmentRepository;
}
