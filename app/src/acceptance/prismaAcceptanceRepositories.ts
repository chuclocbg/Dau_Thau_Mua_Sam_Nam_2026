/**
 * Prisma repository implementations — Phase M1 Production Prisma Layer.
 * STATUS: IMPLEMENTED, PENDING PRODUCTION VERIFICATION — never executed against a real
 * database in this environment (Docker unavailable).
 */

import type {
  IAcceptanceRequestRepository, IAcceptanceCommitteeRepository,
  IAcceptanceMemberRepository, IAcceptanceSessionRepository,
  IAcceptanceItemRepository, IAcceptanceMinuteRepository,
  IAcceptanceHistoryRepository, IAcceptanceAttachmentRepository,
  AcceptanceRepositories,
} from './acceptanceRepositories';
import type {
  AcceptanceRequest, AcceptanceCommittee, AcceptanceMember,
  AcceptanceSession, AcceptanceItem, AcceptanceMinute,
  AcceptanceHistoryEntry, AcceptanceAttachment,
  AcceptanceStatus, AcceptanceSearchQuery, AcceptanceSearchResult,
} from './acceptanceTypes';
import { getPrismaClient } from '../persistence/prismaClient.ts';
import { mapPrismaRow } from '../persistence/decimalMapping.ts';

export class PrismaAcceptanceRequestRepository implements IAcceptanceRequestRepository {
  async create(entity: Omit<AcceptanceRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<AcceptanceRequest> {
    const row = await getPrismaClient().acceptanceRequest.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as AcceptanceRequest;
  }
  async update(id: string, updates: Partial<Omit<AcceptanceRequest, 'id' | 'createdAt'>>): Promise<AcceptanceRequest> {
    const row = await getPrismaClient().acceptanceRequest.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as AcceptanceRequest;
  }
  async delete(id: string): Promise<void> { await getPrismaClient().acceptanceRequest.delete({ where: { id } }); }
  async findById(id: string): Promise<AcceptanceRequest | null> {
    const row = await getPrismaClient().acceptanceRequest.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as AcceptanceRequest) : null;
  }
  async findAll(): Promise<readonly AcceptanceRequest[]> {
    const rows = await getPrismaClient().acceptanceRequest.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as AcceptanceRequest);
  }
  async count(): Promise<number> { return getPrismaClient().acceptanceRequest.count(); }

  async findByCode(requestCode: string): Promise<AcceptanceRequest | null> {
    const row = await getPrismaClient().acceptanceRequest.findUnique({ where: { requestCode } });
    return row ? (mapPrismaRow(row) as unknown as AcceptanceRequest) : null;
  }
  async findByContractId(contractId: string): Promise<readonly AcceptanceRequest[]> {
    const rows = await getPrismaClient().acceptanceRequest.findMany({ where: { contractId } });
    return rows.map(r => mapPrismaRow(r) as unknown as AcceptanceRequest);
  }
  async findByStatus(status: AcceptanceStatus): Promise<readonly AcceptanceRequest[]> {
    const rows = await getPrismaClient().acceptanceRequest.findMany({ where: { status } });
    return rows.map(r => mapPrismaRow(r) as unknown as AcceptanceRequest);
  }

  async search(query: AcceptanceSearchQuery): Promise<AcceptanceSearchResult<AcceptanceRequest>> {
    const prisma = getPrismaClient();
    const where: Record<string, unknown> = {}
    if (query.contractId) where.contractId = query.contractId
    if (query.status) where.status = query.status
    if (query.acceptanceType) where.acceptanceType = query.acceptanceType
    if (query.department) where.department = query.department
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const skip = (page - 1) * pageSize
    const [rows, total] = await Promise.all([
      prisma.acceptanceRequest.findMany({ where: where as never, skip, take: pageSize }),
      prisma.acceptanceRequest.count({ where: where as never }),
    ])
    return { items: rows.map(r => mapPrismaRow(r) as unknown as AcceptanceRequest), total, page, pageSize };
  }
}

export class PrismaAcceptanceCommitteeRepository implements IAcceptanceCommitteeRepository {
  async create(entity: Omit<AcceptanceCommittee, 'id' | 'createdAt' | 'updatedAt'>): Promise<AcceptanceCommittee> {
    const row = await getPrismaClient().acceptanceCommittee.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as AcceptanceCommittee;
  }
  async update(id: string, updates: Partial<Omit<AcceptanceCommittee, 'id' | 'createdAt'>>): Promise<AcceptanceCommittee> {
    const row = await getPrismaClient().acceptanceCommittee.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as AcceptanceCommittee;
  }
  async delete(id: string): Promise<void> { await getPrismaClient().acceptanceCommittee.delete({ where: { id } }); }
  async findById(id: string): Promise<AcceptanceCommittee | null> {
    const row = await getPrismaClient().acceptanceCommittee.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as AcceptanceCommittee) : null;
  }
  async findAll(): Promise<readonly AcceptanceCommittee[]> {
    const rows = await getPrismaClient().acceptanceCommittee.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as AcceptanceCommittee);
  }
  async count(): Promise<number> { return getPrismaClient().acceptanceCommittee.count(); }

  async findByRequestId(requestId: string): Promise<AcceptanceCommittee | null> {
    const row = await getPrismaClient().acceptanceCommittee.findUnique({ where: { requestId } });
    return row ? (mapPrismaRow(row) as unknown as AcceptanceCommittee) : null;
  }
}

export class PrismaAcceptanceMemberRepository implements IAcceptanceMemberRepository {
  async create(entity: Omit<AcceptanceMember, 'id' | 'createdAt' | 'updatedAt'>): Promise<AcceptanceMember> {
    const row = await getPrismaClient().acceptanceMember.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as AcceptanceMember;
  }
  async update(id: string, updates: Partial<Omit<AcceptanceMember, 'id' | 'createdAt'>>): Promise<AcceptanceMember> {
    const row = await getPrismaClient().acceptanceMember.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as AcceptanceMember;
  }
  async delete(id: string): Promise<void> { await getPrismaClient().acceptanceMember.delete({ where: { id } }); }
  async findById(id: string): Promise<AcceptanceMember | null> {
    const row = await getPrismaClient().acceptanceMember.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as AcceptanceMember) : null;
  }
  async findAll(): Promise<readonly AcceptanceMember[]> {
    const rows = await getPrismaClient().acceptanceMember.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as AcceptanceMember);
  }
  async count(): Promise<number> { return getPrismaClient().acceptanceMember.count(); }

  async findByCommitteeId(committeeId: string): Promise<readonly AcceptanceMember[]> {
    const rows = await getPrismaClient().acceptanceMember.findMany({ where: { committeeId } });
    return rows.map(r => mapPrismaRow(r) as unknown as AcceptanceMember);
  }
  async findActiveByCommitteeId(committeeId: string): Promise<readonly AcceptanceMember[]> {
    const rows = await getPrismaClient().acceptanceMember.findMany({ where: { committeeId, isActive: true } });
    return rows.map(r => mapPrismaRow(r) as unknown as AcceptanceMember);
  }
  async findByRequestId(requestId: string): Promise<readonly AcceptanceMember[]> {
    const rows = await getPrismaClient().acceptanceMember.findMany({ where: { requestId, isActive: true } });
    return rows.map(r => mapPrismaRow(r) as unknown as AcceptanceMember);
  }
}

export class PrismaAcceptanceSessionRepository implements IAcceptanceSessionRepository {
  async create(entity: Omit<AcceptanceSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<AcceptanceSession> {
    const row = await getPrismaClient().acceptanceSession.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as AcceptanceSession;
  }
  async update(id: string, updates: Partial<Omit<AcceptanceSession, 'id' | 'createdAt'>>): Promise<AcceptanceSession> {
    const row = await getPrismaClient().acceptanceSession.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as AcceptanceSession;
  }
  async delete(id: string): Promise<void> { await getPrismaClient().acceptanceSession.delete({ where: { id } }); }
  async findById(id: string): Promise<AcceptanceSession | null> {
    const row = await getPrismaClient().acceptanceSession.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as AcceptanceSession) : null;
  }
  async findAll(): Promise<readonly AcceptanceSession[]> {
    const rows = await getPrismaClient().acceptanceSession.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as AcceptanceSession);
  }
  async count(): Promise<number> { return getPrismaClient().acceptanceSession.count(); }

  async findByRequestId(requestId: string): Promise<readonly AcceptanceSession[]> {
    const rows = await getPrismaClient().acceptanceSession.findMany({ where: { requestId } });
    return rows.map(r => mapPrismaRow(r) as unknown as AcceptanceSession);
  }
  async findLatestByRequestId(requestId: string): Promise<AcceptanceSession | null> {
    const row = await getPrismaClient().acceptanceSession.findFirst({
      where: { requestId }, orderBy: { createdAt: 'desc' },
    });
    return row ? (mapPrismaRow(row) as unknown as AcceptanceSession) : null;
  }
  async findCompletedByRequestId(requestId: string): Promise<readonly AcceptanceSession[]> {
    const rows = await getPrismaClient().acceptanceSession.findMany({ where: { requestId, status: 'COMPLETED' } });
    return rows.map(r => mapPrismaRow(r) as unknown as AcceptanceSession);
  }
}

export class PrismaAcceptanceItemRepository implements IAcceptanceItemRepository {
  async create(entity: Omit<AcceptanceItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<AcceptanceItem> {
    const row = await getPrismaClient().acceptanceItem.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as AcceptanceItem;
  }
  async update(id: string, updates: Partial<Omit<AcceptanceItem, 'id' | 'createdAt'>>): Promise<AcceptanceItem> {
    const row = await getPrismaClient().acceptanceItem.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as AcceptanceItem;
  }
  async delete(id: string): Promise<void> { await getPrismaClient().acceptanceItem.delete({ where: { id } }); }
  async findById(id: string): Promise<AcceptanceItem | null> {
    const row = await getPrismaClient().acceptanceItem.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as AcceptanceItem) : null;
  }
  async findAll(): Promise<readonly AcceptanceItem[]> {
    const rows = await getPrismaClient().acceptanceItem.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as AcceptanceItem);
  }
  async count(): Promise<number> { return getPrismaClient().acceptanceItem.count(); }

  async findBySessionId(sessionId: string): Promise<readonly AcceptanceItem[]> {
    const rows = await getPrismaClient().acceptanceItem.findMany({ where: { sessionId } });
    return rows.map(r => mapPrismaRow(r) as unknown as AcceptanceItem);
  }
  async findByRequestId(requestId: string): Promise<readonly AcceptanceItem[]> {
    const rows = await getPrismaClient().acceptanceItem.findMany({ where: { requestId } });
    return rows.map(r => mapPrismaRow(r) as unknown as AcceptanceItem);
  }
  async countAcceptedByRequestId(requestId: string): Promise<number> {
    return getPrismaClient().acceptanceItem.count({ where: { requestId, status: 'ACCEPTED' } });
  }
  async countRejectedByRequestId(requestId: string): Promise<number> {
    return getPrismaClient().acceptanceItem.count({ where: { requestId, status: 'REJECTED' } });
  }
}

export class PrismaAcceptanceMinuteRepository implements IAcceptanceMinuteRepository {
  async create(entity: Omit<AcceptanceMinute, 'id' | 'createdAt' | 'updatedAt'>): Promise<AcceptanceMinute> {
    const row = await getPrismaClient().acceptanceMinute.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as AcceptanceMinute;
  }
  async update(id: string, updates: Partial<Omit<AcceptanceMinute, 'id' | 'createdAt'>>): Promise<AcceptanceMinute> {
    const row = await getPrismaClient().acceptanceMinute.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as AcceptanceMinute;
  }
  async delete(id: string): Promise<void> { await getPrismaClient().acceptanceMinute.delete({ where: { id } }); }
  async findById(id: string): Promise<AcceptanceMinute | null> {
    const row = await getPrismaClient().acceptanceMinute.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as AcceptanceMinute) : null;
  }
  async findAll(): Promise<readonly AcceptanceMinute[]> {
    const rows = await getPrismaClient().acceptanceMinute.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as AcceptanceMinute);
  }
  async count(): Promise<number> { return getPrismaClient().acceptanceMinute.count(); }

  async findBySessionId(sessionId: string): Promise<AcceptanceMinute | null> {
    const row = await getPrismaClient().acceptanceMinute.findFirst({ where: { sessionId } });
    return row ? (mapPrismaRow(row) as unknown as AcceptanceMinute) : null;
  }
  async findByRequestId(requestId: string): Promise<readonly AcceptanceMinute[]> {
    const rows = await getPrismaClient().acceptanceMinute.findMany({ where: { requestId } });
    return rows.map(r => mapPrismaRow(r) as unknown as AcceptanceMinute);
  }
}

export class PrismaAcceptanceHistoryRepository implements IAcceptanceHistoryRepository {
  async create(entity: Omit<AcceptanceHistoryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<AcceptanceHistoryEntry> {
    const row = await getPrismaClient().acceptanceHistoryEntry.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as AcceptanceHistoryEntry;
  }
  async update(id: string, updates: Partial<Omit<AcceptanceHistoryEntry, 'id' | 'createdAt'>>): Promise<AcceptanceHistoryEntry> {
    const row = await getPrismaClient().acceptanceHistoryEntry.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as AcceptanceHistoryEntry;
  }
  async delete(id: string): Promise<void> { await getPrismaClient().acceptanceHistoryEntry.delete({ where: { id } }); }
  async findById(id: string): Promise<AcceptanceHistoryEntry | null> {
    const row = await getPrismaClient().acceptanceHistoryEntry.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as AcceptanceHistoryEntry) : null;
  }
  async findAll(): Promise<readonly AcceptanceHistoryEntry[]> {
    const rows = await getPrismaClient().acceptanceHistoryEntry.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as AcceptanceHistoryEntry);
  }
  async count(): Promise<number> { return getPrismaClient().acceptanceHistoryEntry.count(); }

  async findByRequestId(requestId: string): Promise<readonly AcceptanceHistoryEntry[]> {
    const rows = await getPrismaClient().acceptanceHistoryEntry.findMany({ where: { requestId } });
    return rows.map(r => mapPrismaRow(r) as unknown as AcceptanceHistoryEntry);
  }
}

export class PrismaAcceptanceAttachmentRepository implements IAcceptanceAttachmentRepository {
  async create(entity: Omit<AcceptanceAttachment, 'id' | 'createdAt' | 'updatedAt'>): Promise<AcceptanceAttachment> {
    const row = await getPrismaClient().acceptanceAttachment.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as AcceptanceAttachment;
  }
  async update(id: string, updates: Partial<Omit<AcceptanceAttachment, 'id' | 'createdAt'>>): Promise<AcceptanceAttachment> {
    const row = await getPrismaClient().acceptanceAttachment.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as AcceptanceAttachment;
  }
  async delete(id: string): Promise<void> { await getPrismaClient().acceptanceAttachment.delete({ where: { id } }); }
  async findById(id: string): Promise<AcceptanceAttachment | null> {
    const row = await getPrismaClient().acceptanceAttachment.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as AcceptanceAttachment) : null;
  }
  async findAll(): Promise<readonly AcceptanceAttachment[]> {
    const rows = await getPrismaClient().acceptanceAttachment.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as AcceptanceAttachment);
  }
  async count(): Promise<number> { return getPrismaClient().acceptanceAttachment.count(); }

  async findByRequestId(requestId: string): Promise<readonly AcceptanceAttachment[]> {
    const rows = await getPrismaClient().acceptanceAttachment.findMany({ where: { requestId } });
    return rows.map(r => mapPrismaRow(r) as unknown as AcceptanceAttachment);
  }
  async countByRequestId(requestId: string): Promise<number> {
    return getPrismaClient().acceptanceAttachment.count({ where: { requestId } });
  }
}

export function buildPrismaAcceptanceRepositories(): AcceptanceRepositories {
  return {
    requests: new PrismaAcceptanceRequestRepository(),
    committees: new PrismaAcceptanceCommitteeRepository(),
    members: new PrismaAcceptanceMemberRepository(),
    sessions: new PrismaAcceptanceSessionRepository(),
    items: new PrismaAcceptanceItemRepository(),
    minutes: new PrismaAcceptanceMinuteRepository(),
    history: new PrismaAcceptanceHistoryRepository(),
    attachments: new PrismaAcceptanceAttachmentRepository(),
  };
}
