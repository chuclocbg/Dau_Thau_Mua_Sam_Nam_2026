/**
 * Prisma repository implementations — Phase M1 Production Prisma Layer.
 * STATUS: IMPLEMENTED, PENDING PRODUCTION VERIFICATION — never executed against a real
 * database in this environment (Docker unavailable).
 */

import type {
  IApprovalRequestRepository, IApprovalDecisionRepository,
  IApprovalHistoryRepository, IApprovalCommentRepository,
  IApprovalAttachmentRepository, ApprovalRepositories,
} from './approvalRepositories';
import type {
  ApprovalRequest, ApprovalDecisionRecord, ApprovalHistoryEntry,
  ApprovalComment, ApprovalAttachment,
  ApprovalStatus, ApprovalType, ApprovalSearchQuery, ApprovalSearchResult,
} from './approvalTypes';
import { getPrismaClient } from '../persistence/prismaClient.ts';
import { mapPrismaRow } from '../persistence/decimalMapping.ts';

export class PrismaApprovalRequestRepository implements IApprovalRequestRepository {
  async create(entity: Omit<ApprovalRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApprovalRequest> {
    const row = await getPrismaClient().approvalRequest.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as ApprovalRequest;
  }
  async update(id: string, updates: Partial<Omit<ApprovalRequest, 'id' | 'createdAt'>>): Promise<ApprovalRequest> {
    const row = await getPrismaClient().approvalRequest.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as ApprovalRequest;
  }
  async delete(id: string): Promise<void> { await getPrismaClient().approvalRequest.delete({ where: { id } }); }
  async findById(id: string): Promise<ApprovalRequest | null> {
    const row = await getPrismaClient().approvalRequest.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as ApprovalRequest) : null;
  }
  async findAll(): Promise<readonly ApprovalRequest[]> {
    const rows = await getPrismaClient().approvalRequest.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as ApprovalRequest);
  }
  async count(): Promise<number> { return getPrismaClient().approvalRequest.count(); }

  async findByCode(code: string): Promise<ApprovalRequest | null> {
    const row = await getPrismaClient().approvalRequest.findUnique({ where: { requestCode: code } });
    return row ? (mapPrismaRow(row) as unknown as ApprovalRequest) : null;
  }
  async findByStatus(status: ApprovalStatus): Promise<readonly ApprovalRequest[]> {
    const rows = await getPrismaClient().approvalRequest.findMany({ where: { status } });
    return rows.map(r => mapPrismaRow(r) as unknown as ApprovalRequest);
  }
  async findBySubjectId(subjectId: string): Promise<readonly ApprovalRequest[]> {
    const rows = await getPrismaClient().approvalRequest.findMany({ where: { subjectId } });
    return rows.map(r => mapPrismaRow(r) as unknown as ApprovalRequest);
  }
  async findByDepartment(dept: string): Promise<readonly ApprovalRequest[]> {
    const rows = await getPrismaClient().approvalRequest.findMany({ where: { department: dept } });
    return rows.map(r => mapPrismaRow(r) as unknown as ApprovalRequest);
  }
  async findByApprovalType(type: ApprovalType): Promise<readonly ApprovalRequest[]> {
    const rows = await getPrismaClient().approvalRequest.findMany({ where: { approvalType: type } });
    return rows.map(r => mapPrismaRow(r) as unknown as ApprovalRequest);
  }

  async search(query: ApprovalSearchQuery): Promise<ApprovalSearchResult<ApprovalRequest>> {
    const prisma = getPrismaClient();
    const where: Record<string, unknown> = {}
    if (query.status) where.status = query.status
    if (query.approvalType) where.approvalType = query.approvalType
    if (query.department) where.department = query.department
    if (query.subjectId) where.subjectId = query.subjectId
    if (query.term) {
      where.OR = [
        { requestCode: { contains: query.term, mode: 'insensitive' } },
        { notes: { contains: query.term, mode: 'insensitive' } },
      ]
    }
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const skip = (page - 1) * pageSize
    const [rows, total] = await Promise.all([
      prisma.approvalRequest.findMany({ where: where as never, skip, take: pageSize }),
      prisma.approvalRequest.count({ where: where as never }),
    ])
    return { items: rows.map(r => mapPrismaRow(r) as unknown as ApprovalRequest), total, page, pageSize };
  }
}

export class PrismaApprovalDecisionRepository implements IApprovalDecisionRepository {
  async create(entity: Omit<ApprovalDecisionRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApprovalDecisionRecord> {
    const row = await getPrismaClient().approvalDecisionRecord.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as ApprovalDecisionRecord;
  }
  async update(id: string, updates: Partial<Omit<ApprovalDecisionRecord, 'id' | 'createdAt'>>): Promise<ApprovalDecisionRecord> {
    const row = await getPrismaClient().approvalDecisionRecord.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as ApprovalDecisionRecord;
  }
  async delete(id: string): Promise<void> { await getPrismaClient().approvalDecisionRecord.delete({ where: { id } }); }
  async findById(id: string): Promise<ApprovalDecisionRecord | null> {
    const row = await getPrismaClient().approvalDecisionRecord.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as ApprovalDecisionRecord) : null;
  }
  async findAll(): Promise<readonly ApprovalDecisionRecord[]> {
    const rows = await getPrismaClient().approvalDecisionRecord.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as ApprovalDecisionRecord);
  }
  async count(): Promise<number> { return getPrismaClient().approvalDecisionRecord.count(); }

  async findByRequestId(requestId: string): Promise<ApprovalDecisionRecord | null> {
    const row = await getPrismaClient().approvalDecisionRecord.findUnique({ where: { requestId } });
    return row ? (mapPrismaRow(row) as unknown as ApprovalDecisionRecord) : null;
  }
  async findByDecidedBy(employeeCode: string): Promise<readonly ApprovalDecisionRecord[]> {
    const rows = await getPrismaClient().approvalDecisionRecord.findMany({ where: { decidedBy: employeeCode } });
    return rows.map(r => mapPrismaRow(r) as unknown as ApprovalDecisionRecord);
  }
}

export class PrismaApprovalHistoryRepository implements IApprovalHistoryRepository {
  async create(entity: Omit<ApprovalHistoryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApprovalHistoryEntry> {
    const row = await getPrismaClient().approvalHistoryEntry.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as ApprovalHistoryEntry;
  }
  async update(id: string, updates: Partial<Omit<ApprovalHistoryEntry, 'id' | 'createdAt'>>): Promise<ApprovalHistoryEntry> {
    const row = await getPrismaClient().approvalHistoryEntry.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as ApprovalHistoryEntry;
  }
  async delete(id: string): Promise<void> { await getPrismaClient().approvalHistoryEntry.delete({ where: { id } }); }
  async findById(id: string): Promise<ApprovalHistoryEntry | null> {
    const row = await getPrismaClient().approvalHistoryEntry.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as ApprovalHistoryEntry) : null;
  }
  async findAll(): Promise<readonly ApprovalHistoryEntry[]> {
    const rows = await getPrismaClient().approvalHistoryEntry.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as ApprovalHistoryEntry);
  }
  async count(): Promise<number> { return getPrismaClient().approvalHistoryEntry.count(); }

  async findByRequestId(requestId: string): Promise<readonly ApprovalHistoryEntry[]> {
    const rows = await getPrismaClient().approvalHistoryEntry.findMany({ where: { requestId } });
    return rows.map(r => mapPrismaRow(r) as unknown as ApprovalHistoryEntry);
  }
  async findByPerformedBy(employeeCode: string): Promise<readonly ApprovalHistoryEntry[]> {
    const rows = await getPrismaClient().approvalHistoryEntry.findMany({ where: { performedBy: employeeCode } });
    return rows.map(r => mapPrismaRow(r) as unknown as ApprovalHistoryEntry);
  }
}

export class PrismaApprovalCommentRepository implements IApprovalCommentRepository {
  async create(entity: Omit<ApprovalComment, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApprovalComment> {
    const row = await getPrismaClient().approvalComment.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as ApprovalComment;
  }
  async update(id: string, updates: Partial<Omit<ApprovalComment, 'id' | 'createdAt'>>): Promise<ApprovalComment> {
    const row = await getPrismaClient().approvalComment.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as ApprovalComment;
  }
  async delete(id: string): Promise<void> { await getPrismaClient().approvalComment.delete({ where: { id } }); }
  async findById(id: string): Promise<ApprovalComment | null> {
    const row = await getPrismaClient().approvalComment.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as ApprovalComment) : null;
  }
  async findAll(): Promise<readonly ApprovalComment[]> {
    const rows = await getPrismaClient().approvalComment.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as ApprovalComment);
  }
  async count(): Promise<number> { return getPrismaClient().approvalComment.count(); }

  async findByRequestId(requestId: string): Promise<readonly ApprovalComment[]> {
    const rows = await getPrismaClient().approvalComment.findMany({ where: { requestId } });
    return rows.map(r => mapPrismaRow(r) as unknown as ApprovalComment);
  }
  async countByRequestId(requestId: string): Promise<number> {
    return getPrismaClient().approvalComment.count({ where: { requestId } });
  }
}

export class PrismaApprovalAttachmentRepository implements IApprovalAttachmentRepository {
  async create(entity: Omit<ApprovalAttachment, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApprovalAttachment> {
    const row = await getPrismaClient().approvalAttachment.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as ApprovalAttachment;
  }
  async update(id: string, updates: Partial<Omit<ApprovalAttachment, 'id' | 'createdAt'>>): Promise<ApprovalAttachment> {
    const row = await getPrismaClient().approvalAttachment.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as ApprovalAttachment;
  }
  async delete(id: string): Promise<void> { await getPrismaClient().approvalAttachment.delete({ where: { id } }); }
  async findById(id: string): Promise<ApprovalAttachment | null> {
    const row = await getPrismaClient().approvalAttachment.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as ApprovalAttachment) : null;
  }
  async findAll(): Promise<readonly ApprovalAttachment[]> {
    const rows = await getPrismaClient().approvalAttachment.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as ApprovalAttachment);
  }
  async count(): Promise<number> { return getPrismaClient().approvalAttachment.count(); }

  async findByRequestId(requestId: string): Promise<readonly ApprovalAttachment[]> {
    const rows = await getPrismaClient().approvalAttachment.findMany({ where: { requestId } });
    return rows.map(r => mapPrismaRow(r) as unknown as ApprovalAttachment);
  }
  async countByRequestId(requestId: string): Promise<number> {
    return getPrismaClient().approvalAttachment.count({ where: { requestId } });
  }
}

export function buildPrismaApprovalRepositories(): ApprovalRepositories {
  return {
    requests: new PrismaApprovalRequestRepository(),
    decisions: new PrismaApprovalDecisionRepository(),
    history: new PrismaApprovalHistoryRepository(),
    comments: new PrismaApprovalCommentRepository(),
    attachments: new PrismaApprovalAttachmentRepository(),
  };
}
