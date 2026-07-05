/**
 * Prisma repository implementations — Phase M1 Production Prisma Layer.
 * STATUS: IMPLEMENTED, PENDING PRODUCTION VERIFICATION — never executed against a real
 * database in this environment (Docker unavailable).
 *
 * `PermissionGrant` has a TS type in authTypes.ts but no repository interface in
 * AuthRepositories — not persisted today, so no repository class here either
 * (the `AuthPermissionGrant` Prisma model exists for future use but is unused,
 * preserving existing behavior rather than inventing a new one).
 */

import type {
  User, Role, Permission, Session, DelegationGrant, ApprovalHierarchy, Policy,
} from '../types/authTypes.ts'
import type { AuthAuditEvent, AuthAuditEventType, IAuditEventRepository } from '../types/auditTypes.ts'
import type {
  IUserRepository, IRoleRepository, IPermissionRepository, ISessionRepository,
  IDelegationRepository, IApprovalHierarchyRepository, IPolicyRepository,
  AuthRepositories,
} from './authRepositories.ts'
import { getPrismaClient } from '../../persistence/prismaClient.ts'
import { mapPrismaRow } from '../../persistence/decimalMapping.ts'

export class PrismaUserRepository implements IUserRepository {
  async create(entity: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const row = await getPrismaClient().authUser.create({ data: entity as never })
    return mapPrismaRow(row) as unknown as User
  }
  async update(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User> {
    const row = await getPrismaClient().authUser.update({ where: { id }, data: updates as never })
    return mapPrismaRow(row) as unknown as User
  }
  async delete(id: string): Promise<void> { await getPrismaClient().authUser.delete({ where: { id } }) }
  async findById(id: string): Promise<User | null> {
    const row = await getPrismaClient().authUser.findUnique({ where: { id } })
    return row ? (mapPrismaRow(row) as unknown as User) : null
  }
  async findAll(): Promise<readonly User[]> {
    const rows = await getPrismaClient().authUser.findMany()
    return rows.map(r => mapPrismaRow(r) as unknown as User)
  }
  async count(): Promise<number> { return getPrismaClient().authUser.count() }

  async findByUsername(username: string): Promise<User | null> {
    const row = await getPrismaClient().authUser.findUnique({ where: { username } })
    return row ? (mapPrismaRow(row) as unknown as User) : null
  }
  async findByEmail(email: string): Promise<User | null> {
    const row = await getPrismaClient().authUser.findUnique({ where: { email } })
    return row ? (mapPrismaRow(row) as unknown as User) : null
  }
  async findByExternalId(externalId: string, provider: string): Promise<User | null> {
    const row = await getPrismaClient().authUser.findFirst({ where: { externalId, externalProvider: provider } })
    return row ? (mapPrismaRow(row) as unknown as User) : null
  }
  async findByDepartment(departmentId: string): Promise<readonly User[]> {
    const rows = await getPrismaClient().authUser.findMany({ where: { departmentId } })
    return rows.map(r => mapPrismaRow(r) as unknown as User)
  }
  async findActive(): Promise<readonly User[]> {
    const rows = await getPrismaClient().authUser.findMany({ where: { isActive: true } })
    return rows.map(r => mapPrismaRow(r) as unknown as User)
  }
}

export class PrismaRoleRepository implements IRoleRepository {
  async create(entity: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<Role> {
    const row = await getPrismaClient().authRole.create({ data: entity as never })
    return mapPrismaRow(row) as unknown as Role
  }
  async update(id: string, updates: Partial<Omit<Role, 'id' | 'createdAt'>>): Promise<Role> {
    const row = await getPrismaClient().authRole.update({ where: { id }, data: updates as never })
    return mapPrismaRow(row) as unknown as Role
  }
  async delete(id: string): Promise<void> { await getPrismaClient().authRole.delete({ where: { id } }) }
  async findById(id: string): Promise<Role | null> {
    const row = await getPrismaClient().authRole.findUnique({ where: { id } })
    return row ? (mapPrismaRow(row) as unknown as Role) : null
  }
  async findAll(): Promise<readonly Role[]> {
    const rows = await getPrismaClient().authRole.findMany()
    return rows.map(r => mapPrismaRow(r) as unknown as Role)
  }
  async count(): Promise<number> { return getPrismaClient().authRole.count() }

  async findByCode(code: string): Promise<Role | null> {
    const row = await getPrismaClient().authRole.findUnique({ where: { code } })
    return row ? (mapPrismaRow(row) as unknown as Role) : null
  }
  async findByIds(ids: readonly string[]): Promise<readonly Role[]> {
    const rows = await getPrismaClient().authRole.findMany({ where: { id: { in: [...ids] } } })
    return rows.map(r => mapPrismaRow(r) as unknown as Role)
  }
  async findActive(): Promise<readonly Role[]> {
    const rows = await getPrismaClient().authRole.findMany({ where: { isActive: true } })
    return rows.map(r => mapPrismaRow(r) as unknown as Role)
  }
  async findChildren(parentRoleId: string): Promise<readonly Role[]> {
    const rows = await getPrismaClient().authRole.findMany({ where: { parentRoleId } })
    return rows.map(r => mapPrismaRow(r) as unknown as Role)
  }
}

export class PrismaPermissionRepository implements IPermissionRepository {
  async create(entity: Omit<Permission, 'id' | 'createdAt' | 'updatedAt'>): Promise<Permission> {
    const row = await getPrismaClient().authPermission.create({ data: entity as never })
    return mapPrismaRow(row) as unknown as Permission
  }
  async update(id: string, updates: Partial<Omit<Permission, 'id' | 'createdAt'>>): Promise<Permission> {
    const row = await getPrismaClient().authPermission.update({ where: { id }, data: updates as never })
    return mapPrismaRow(row) as unknown as Permission
  }
  async delete(id: string): Promise<void> { await getPrismaClient().authPermission.delete({ where: { id } }) }
  async findById(id: string): Promise<Permission | null> {
    const row = await getPrismaClient().authPermission.findUnique({ where: { id } })
    return row ? (mapPrismaRow(row) as unknown as Permission) : null
  }
  async findAll(): Promise<readonly Permission[]> {
    const rows = await getPrismaClient().authPermission.findMany()
    return rows.map(r => mapPrismaRow(r) as unknown as Permission)
  }
  async count(): Promise<number> { return getPrismaClient().authPermission.count() }

  async findByIds(ids: readonly string[]): Promise<readonly Permission[]> {
    const rows = await getPrismaClient().authPermission.findMany({ where: { id: { in: [...ids] } } })
    return rows.map(r => mapPrismaRow(r) as unknown as Permission)
  }
  async findByResource(resource: string): Promise<readonly Permission[]> {
    const rows = await getPrismaClient().authPermission.findMany({ where: { resource } })
    return rows.map(r => mapPrismaRow(r) as unknown as Permission)
  }
  async findByResourceAndAction(resource: string, action: string): Promise<readonly Permission[]> {
    const rows = await getPrismaClient().authPermission.findMany({ where: { resource, action } })
    return rows.map(r => mapPrismaRow(r) as unknown as Permission)
  }
}

export class PrismaSessionRepository implements ISessionRepository {
  async create(entity: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>): Promise<Session> {
    const row = await getPrismaClient().authSession.create({ data: entity as never })
    return mapPrismaRow(row) as unknown as Session
  }
  async update(id: string, updates: Partial<Omit<Session, 'id' | 'createdAt'>>): Promise<Session> {
    const row = await getPrismaClient().authSession.update({ where: { id }, data: updates as never })
    return mapPrismaRow(row) as unknown as Session
  }
  async delete(id: string): Promise<void> { await getPrismaClient().authSession.delete({ where: { id } }) }
  async findById(id: string): Promise<Session | null> {
    const row = await getPrismaClient().authSession.findUnique({ where: { id } })
    return row ? (mapPrismaRow(row) as unknown as Session) : null
  }
  async findAll(): Promise<readonly Session[]> {
    const rows = await getPrismaClient().authSession.findMany()
    return rows.map(r => mapPrismaRow(r) as unknown as Session)
  }
  async count(): Promise<number> { return getPrismaClient().authSession.count() }

  async findByUserId(userId: string): Promise<readonly Session[]> {
    const rows = await getPrismaClient().authSession.findMany({ where: { userId } })
    return rows.map(r => mapPrismaRow(r) as unknown as Session)
  }
  async findActive(sessionId: string): Promise<Session | null> {
    const now = new Date().toISOString()
    const row = await getPrismaClient().authSession.findFirst({
      where: { id: sessionId, revokedAt: null, expiresAt: { gt: now } },
    })
    return row ? (mapPrismaRow(row) as unknown as Session) : null
  }
  async revokeByUserId(userId: string, revokedBy: string): Promise<void> {
    const now = new Date()
    await getPrismaClient().authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now, revokedBy },
    })
  }
  async revokeBySessionId(sessionId: string, revokedBy: string): Promise<Session | null> {
    const prisma = getPrismaClient()
    const existing = await prisma.authSession.findUnique({ where: { id: sessionId } })
    if (!existing) return null
    const row = await prisma.authSession.update({
      where: { id: sessionId }, data: { revokedAt: new Date(), revokedBy },
    })
    return mapPrismaRow(row) as unknown as Session
  }
  async cleanExpired(): Promise<number> {
    const now = new Date().toISOString()
    const result = await getPrismaClient().authSession.deleteMany({ where: { expiresAt: { lte: now } } })
    return result.count
  }
}

export class PrismaDelegationRepository implements IDelegationRepository {
  async create(entity: Omit<DelegationGrant, 'id' | 'createdAt' | 'updatedAt'>): Promise<DelegationGrant> {
    const row = await getPrismaClient().authDelegationGrant.create({ data: entity as never })
    return mapPrismaRow(row) as unknown as DelegationGrant
  }
  async update(id: string, updates: Partial<Omit<DelegationGrant, 'id' | 'createdAt'>>): Promise<DelegationGrant> {
    const row = await getPrismaClient().authDelegationGrant.update({ where: { id }, data: updates as never })
    return mapPrismaRow(row) as unknown as DelegationGrant
  }
  async delete(id: string): Promise<void> { await getPrismaClient().authDelegationGrant.delete({ where: { id } }) }
  async findById(id: string): Promise<DelegationGrant | null> {
    const row = await getPrismaClient().authDelegationGrant.findUnique({ where: { id } })
    return row ? (mapPrismaRow(row) as unknown as DelegationGrant) : null
  }
  async findAll(): Promise<readonly DelegationGrant[]> {
    const rows = await getPrismaClient().authDelegationGrant.findMany()
    return rows.map(r => mapPrismaRow(r) as unknown as DelegationGrant)
  }
  async count(): Promise<number> { return getPrismaClient().authDelegationGrant.count() }

  async findByFromUser(fromUserId: string): Promise<readonly DelegationGrant[]> {
    const rows = await getPrismaClient().authDelegationGrant.findMany({ where: { fromUserId } })
    return rows.map(r => mapPrismaRow(r) as unknown as DelegationGrant)
  }
  async findByToUser(toUserId: string): Promise<readonly DelegationGrant[]> {
    const rows = await getPrismaClient().authDelegationGrant.findMany({ where: { toUserId } })
    return rows.map(r => mapPrismaRow(r) as unknown as DelegationGrant)
  }
  async findActive(toUserId: string, asOf: string): Promise<readonly DelegationGrant[]> {
    const rows = await getPrismaClient().authDelegationGrant.findMany({
      where: { toUserId, revokedAt: null, validFrom: { lte: asOf }, validUntil: { gt: asOf } },
    })
    return rows.map(r => mapPrismaRow(r) as unknown as DelegationGrant)
  }
}

export class PrismaApprovalHierarchyRepository implements IApprovalHierarchyRepository {
  async create(entity: Omit<ApprovalHierarchy, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApprovalHierarchy> {
    const row = await getPrismaClient().authApprovalHierarchy.create({ data: entity as never })
    return mapPrismaRow(row) as unknown as ApprovalHierarchy
  }
  async update(id: string, updates: Partial<Omit<ApprovalHierarchy, 'id' | 'createdAt'>>): Promise<ApprovalHierarchy> {
    const row = await getPrismaClient().authApprovalHierarchy.update({ where: { id }, data: updates as never })
    return mapPrismaRow(row) as unknown as ApprovalHierarchy
  }
  async delete(id: string): Promise<void> { await getPrismaClient().authApprovalHierarchy.delete({ where: { id } }) }
  async findById(id: string): Promise<ApprovalHierarchy | null> {
    const row = await getPrismaClient().authApprovalHierarchy.findUnique({ where: { id } })
    return row ? (mapPrismaRow(row) as unknown as ApprovalHierarchy) : null
  }
  async findAll(): Promise<readonly ApprovalHierarchy[]> {
    const rows = await getPrismaClient().authApprovalHierarchy.findMany()
    return rows.map(r => mapPrismaRow(r) as unknown as ApprovalHierarchy)
  }
  async count(): Promise<number> { return getPrismaClient().authApprovalHierarchy.count() }

  async findByUserId(userId: string): Promise<readonly ApprovalHierarchy[]> {
    const rows = await getPrismaClient().authApprovalHierarchy.findMany({ where: { userId } })
    return rows.map(r => mapPrismaRow(r) as unknown as ApprovalHierarchy)
  }
  async findByDepartment(departmentId: string): Promise<readonly ApprovalHierarchy[]> {
    const rows = await getPrismaClient().authApprovalHierarchy.findMany({ where: { departmentId } })
    return rows.map(r => mapPrismaRow(r) as unknown as ApprovalHierarchy)
  }
  async findActive(userId: string, asOf: string): Promise<readonly ApprovalHierarchy[]> {
    const rows = await getPrismaClient().authApprovalHierarchy.findMany({
      where: {
        userId, effectiveFrom: { lte: asOf },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: asOf } }],
      },
    })
    return rows.map(r => mapPrismaRow(r) as unknown as ApprovalHierarchy)
  }
  async findByAuthorityLevel(level: number): Promise<readonly ApprovalHierarchy[]> {
    const rows = await getPrismaClient().authApprovalHierarchy.findMany({ where: { authorityLevel: level } })
    return rows.map(r => mapPrismaRow(r) as unknown as ApprovalHierarchy)
  }
}

export class PrismaPolicyRepository implements IPolicyRepository {
  async create(entity: Omit<Policy, 'id' | 'createdAt' | 'updatedAt'>): Promise<Policy> {
    const row = await getPrismaClient().authPolicy.create({ data: entity as never })
    return mapPrismaRow(row) as unknown as Policy
  }
  async update(id: string, updates: Partial<Omit<Policy, 'id' | 'createdAt'>>): Promise<Policy> {
    const row = await getPrismaClient().authPolicy.update({ where: { id }, data: updates as never })
    return mapPrismaRow(row) as unknown as Policy
  }
  async delete(id: string): Promise<void> { await getPrismaClient().authPolicy.delete({ where: { id } }) }
  async findById(id: string): Promise<Policy | null> {
    const row = await getPrismaClient().authPolicy.findUnique({ where: { id } })
    return row ? (mapPrismaRow(row) as unknown as Policy) : null
  }
  async findAll(): Promise<readonly Policy[]> {
    const rows = await getPrismaClient().authPolicy.findMany()
    return rows.map(r => mapPrismaRow(r) as unknown as Policy)
  }
  async count(): Promise<number> { return getPrismaClient().authPolicy.count() }

  async findByResource(resource: string): Promise<readonly Policy[]> {
    const rows = await getPrismaClient().authPolicy.findMany({ where: { resource } })
    return rows.map(r => mapPrismaRow(r) as unknown as Policy)
  }
  async findActive(): Promise<readonly Policy[]> {
    const rows = await getPrismaClient().authPolicy.findMany({ where: { isActive: true } })
    return rows.map(r => mapPrismaRow(r) as unknown as Policy)
  }
  async findApplicable(resource: string, action: string): Promise<readonly Policy[]> {
    const rows = await getPrismaClient().authPolicy.findMany({
      where: {
        isActive: true,
        OR: [{ resource }, { resource: '*' }],
        AND: { OR: [{ action }, { action: '*' }] },
      },
    })
    return rows.map(r => mapPrismaRow(r) as unknown as Policy)
  }
}

export class PrismaAuditEventRepository implements IAuditEventRepository {
  async append(event: Omit<AuthAuditEvent, 'id' | 'createdAt'>): Promise<AuthAuditEvent> {
    const row = await getPrismaClient().authAuditEvent.create({ data: event as never })
    return mapPrismaRow(row) as unknown as AuthAuditEvent
  }
  async findById(id: string): Promise<AuthAuditEvent | null> {
    const row = await getPrismaClient().authAuditEvent.findUnique({ where: { id } })
    return row ? (mapPrismaRow(row) as unknown as AuthAuditEvent) : null
  }
  async findByUserId(userId: string, limit = 100): Promise<readonly AuthAuditEvent[]> {
    const rows = await getPrismaClient().authAuditEvent.findMany({ where: { userId }, take: limit })
    return rows.map(r => mapPrismaRow(r) as unknown as AuthAuditEvent)
  }
  async findBySessionId(sessionId: string): Promise<readonly AuthAuditEvent[]> {
    const rows = await getPrismaClient().authAuditEvent.findMany({ where: { sessionId } })
    return rows.map(r => mapPrismaRow(r) as unknown as AuthAuditEvent)
  }
  async findByEventType(type: AuthAuditEventType, limit = 100): Promise<readonly AuthAuditEvent[]> {
    const rows = await getPrismaClient().authAuditEvent.findMany({ where: { eventType: type }, take: limit })
    return rows.map(r => mapPrismaRow(r) as unknown as AuthAuditEvent)
  }
  async findByTimeRange(from: string, to: string, limit = 100): Promise<readonly AuthAuditEvent[]> {
    const rows = await getPrismaClient().authAuditEvent.findMany({
      where: { occurredAt: { gte: from, lte: to } }, take: limit,
    })
    return rows.map(r => mapPrismaRow(r) as unknown as AuthAuditEvent)
  }
  async findByTargetUser(targetUserId: string, limit = 100): Promise<readonly AuthAuditEvent[]> {
    const rows = await getPrismaClient().authAuditEvent.findMany({ where: { targetUserId }, take: limit })
    return rows.map(r => mapPrismaRow(r) as unknown as AuthAuditEvent)
  }
  async count(): Promise<number> { return getPrismaClient().authAuditEvent.count() }
}

export function buildPrismaAuthRepositories(): AuthRepositories {
  return {
    users: new PrismaUserRepository(),
    roles: new PrismaRoleRepository(),
    permissions: new PrismaPermissionRepository(),
    sessions: new PrismaSessionRepository(),
    delegations: new PrismaDelegationRepository(),
    approvalHierarchies: new PrismaApprovalHierarchyRepository(),
    policies: new PrismaPolicyRepository(),
    auditEvents: new PrismaAuditEventRepository(),
  }
}
