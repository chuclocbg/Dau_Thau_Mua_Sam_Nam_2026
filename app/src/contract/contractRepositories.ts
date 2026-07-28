import type { IBaseRepository } from '../shared/repository/IBaseRepository';
import type {
  Contract, ContractAmendment, ContractMilestone, ContractGuarantee,
  ContractHistoryEntry, ContractAttachment,
  ContractStatus, GuaranteeType,
  ContractSearchQuery, ContractSearchResult,
} from './contractTypes';

export type { IBaseRepository } from '../shared/repository/IBaseRepository';

// ─── Contract ─────────────────────────────────────────────────────────────────

export interface IContractRepository extends IBaseRepository<Contract> {
  findByNumber(contractNumber: string): Promise<Contract | null>;
  findByPackageId(packageId: string): Promise<readonly Contract[]>;
  findByStatus(status: ContractStatus): Promise<readonly Contract[]>;
  findByWinnerCode(winnerCode: string): Promise<readonly Contract[]>;
  search(query: ContractSearchQuery): Promise<ContractSearchResult<Contract>>;
}

// ─── Amendment ────────────────────────────────────────────────────────────────

export interface IContractAmendmentRepository extends IBaseRepository<ContractAmendment> {
  findByContractId(contractId: string): Promise<readonly ContractAmendment[]>;
  findLatestByContractId(contractId: string): Promise<ContractAmendment | null>;
}

// ─── Milestone ────────────────────────────────────────────────────────────────

export interface IContractMilestoneRepository extends IBaseRepository<ContractMilestone> {
  findByContractId(contractId: string): Promise<readonly ContractMilestone[]>;
  findPendingByContractId(contractId: string): Promise<readonly ContractMilestone[]>;
}

// ─── Guarantee ────────────────────────────────────────────────────────────────

export interface IContractGuaranteeRepository extends IBaseRepository<ContractGuarantee> {
  findByContractId(contractId: string): Promise<readonly ContractGuarantee[]>;
  findActiveByContractId(contractId: string): Promise<readonly ContractGuarantee[]>;
  findByType(contractId: string, type: GuaranteeType): Promise<ContractGuarantee | null>;
}

// ─── History ──────────────────────────────────────────────────────────────────

export interface IContractHistoryRepository extends IBaseRepository<ContractHistoryEntry> {
  findByContractId(contractId: string): Promise<readonly ContractHistoryEntry[]>;
  findByPerformedBy(employeeCode: string): Promise<readonly ContractHistoryEntry[]>;
}

// ─── Attachment ───────────────────────────────────────────────────────────────

export interface IContractAttachmentRepository extends IBaseRepository<ContractAttachment> {
  findByContractId(contractId: string): Promise<readonly ContractAttachment[]>;
  countByContractId(contractId: string): Promise<number>;
}

// ─── Repository bag ───────────────────────────────────────────────────────────

export interface ContractRepositories {
  readonly contracts:   IContractRepository;
  readonly amendments:  IContractAmendmentRepository;
  readonly milestones:  IContractMilestoneRepository;
  readonly guarantees:  IContractGuaranteeRepository;
  readonly history:     IContractHistoryRepository;
  readonly attachments: IContractAttachmentRepository;
}
