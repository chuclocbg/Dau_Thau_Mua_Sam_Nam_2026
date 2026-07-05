import type { IBaseRepository } from '../../shared/repository/IBaseRepository.ts'
import type {
  User, Role, Permission, Session, DelegationGrant, ApprovalHierarchy, Policy,
} from '../types/authTypes.ts'
import type { AuthAuditEvent, AuthAuditEventType, IAuditEventRepository } from '../types/auditTypes.ts'
import type {
  IUserRepository, IRoleRepository, IPermissionRepository,
  ISessionRepository, IDelegationRepository, IApprovalHierarchyRepository,
  IPolicyRepository, AuthRepositories,
} from './authRepositories.ts'

// ── Generic base ──────────────────────────────────────────────────────────────

class MemoryAuthBase<T extends { id: string; createdAt: string; updatedAt: string }>
  implements IBaseRepository<T>
{
  protected readonly store = new Map<string, T>()

  async create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const now = new Date().toISOString()
    const item = { ...entity, id: crypto.randomUUID(), createdAt: now, updatedAt: now } as unknown as T
    this.store.set(item.id, item)
    return item
  }

  async update(id: string, updates: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T> {
    const existing = this.store.get(id)
    if (!existing) throw new Error(`Auth entity not found: ${id}`)
    const updated = { ...existing, ...updates, id, updatedAt: new Date().toISOString() } as T
    this.store.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<void> { this.store.delete(id) }

  async findById(id: string): Promise<T | null> { return this.store.get(id) ?? null }

  async findAll(): Promise<readonly T[]> { return Array.from(this.store.values()) }

  async count(): Promise<number> { return this.store.size }
}

// ── User ──────────────────────────────────────────────────────────────────────

export class MemoryUserRepository extends MemoryAuthBase<User> implements IUserRepository {
  async findByUsername(username: string): Promise<User | null> {
    for (const u of this.store.values()) if (u.username === username) return u
    return null
  }
  async findByEmail(email: string): Promise<User | null> {
    for (const u of this.store.values()) if (u.email === email) return u
    return null
  }
  async findByExternalId(externalId: string, provider: string): Promise<User | null> {
    for (const u of this.store.values()) {
      if (u.externalId === externalId && u.externalProvider === provider) return u
    }
    return null
  }
  async findByDepartment(departmentId: string): Promise<readonly User[]> {
    return Array.from(this.store.values()).filter(u => u.departmentId === departmentId)
  }
  async findActive(): Promise<readonly User[]> {
    return Array.from(this.store.values()).filter(u => u.isActive)
  }
}

// ── Role ──────────────────────────────────────────────────────────────────────

export class MemoryRoleRepository extends MemoryAuthBase<Role> implements IRoleRepository {
  async findByCode(code: string): Promise<Role | null> {
    for (const r of this.store.values()) if (r.code === code) return r
    return null
  }
  async findByIds(ids: readonly string[]): Promise<readonly Role[]> {
    return ids.map(id => this.store.get(id)).filter((r): r is Role => r !== undefined)
  }
  async findActive(): Promise<readonly Role[]> {
    return Array.from(this.store.values()).filter(r => r.isActive)
  }
  async findChildren(parentRoleId: string): Promise<readonly Role[]> {
    return Array.from(this.store.values()).filter(r => r.parentRoleId === parentRoleId)
  }
}

// ── Permission ────────────────────────────────────────────────────────────────

export class MemoryPermissionRepository extends MemoryAuthBase<Permission> implements IPermissionRepository {
  async findByIds(ids: readonly string[]): Promise<readonly Permission[]> {
    return ids.map(id => this.store.get(id)).filter((p): p is Permission => p !== undefined)
  }
  async findByResource(resource: string): Promise<readonly Permission[]> {
    return Array.from(this.store.values()).filter(p => p.resource === resource)
  }
  async findByResourceAndAction(resource: string, action: string): Promise<readonly Permission[]> {
    return Array.from(this.store.values()).filter(p => p.resource === resource && p.action === action)
  }
}

// ── Session ───────────────────────────────────────────────────────────────────

export class MemorySessionRepository extends MemoryAuthBase<Session> implements ISessionRepository {
  async findByUserId(userId: string): Promise<readonly Session[]> {
    return Array.from(this.store.values()).filter(s => s.userId === userId)
  }
  async findActive(sessionId: string): Promise<Session | null> {
    const s = this.store.get(sessionId)
    if (!s) return null
    const now = new Date().toISOString()
    if (s.revokedAt || s.expiresAt <= now) return null
    return s
  }
  async revokeByUserId(userId: string, revokedBy: string): Promise<void> {
    const now = new Date().toISOString()
    for (const [id, s] of this.store.entries()) {
      if (s.userId === userId && !s.revokedAt) {
        this.store.set(id, { ...s, revokedAt: now, revokedBy, updatedAt: now })
      }
    }
  }
  async revokeBySessionId(sessionId: string, revokedBy: string): Promise<Session | null> {
    const s = this.store.get(sessionId)
    if (!s) return null
    const now = new Date().toISOString()
    const revoked = { ...s, revokedAt: now, revokedBy, updatedAt: now }
    this.store.set(sessionId, revoked)
    return revoked
  }
  async cleanExpired(): Promise<number> {
    const now = new Date().toISOString()
    let count = 0
    for (const [id, s] of this.store.entries()) {
      if (s.expiresAt <= now) { this.store.delete(id); count++ }
    }
    return count
  }
}

// ── Delegation ────────────────────────────────────────────────────────────────

export class MemoryDelegationRepository extends MemoryAuthBase<DelegationGrant> implements IDelegationRepository {
  async findByFromUser(fromUserId: string): Promise<readonly DelegationGrant[]> {
    return Array.from(this.store.values()).filter(d => d.fromUserId === fromUserId)
  }
  async findByToUser(toUserId: string): Promise<readonly DelegationGrant[]> {
    return Array.from(this.store.values()).filter(d => d.toUserId === toUserId)
  }
  async findActive(toUserId: string, asOf: string): Promise<readonly DelegationGrant[]> {
    return Array.from(this.store.values()).filter(
      d => d.toUserId === toUserId && !d.revokedAt && d.validFrom <= asOf && d.validUntil > asOf,
    )
  }
}

// ── ApprovalHierarchy ─────────────────────────────────────────────────────────

export class MemoryApprovalHierarchyRepository
  extends MemoryAuthBase<ApprovalHierarchy>
  implements IApprovalHierarchyRepository
{
  async findByUserId(userId: string): Promise<readonly ApprovalHierarchy[]> {
    return Array.from(this.store.values()).filter(h => h.userId === userId)
  }
  async findByDepartment(departmentId: string): Promise<readonly ApprovalHierarchy[]> {
    return Array.from(this.store.values()).filter(h => h.departmentId === departmentId)
  }
  async findActive(userId: string, asOf: string): Promise<readonly ApprovalHierarchy[]> {
    return Array.from(this.store.values()).filter(
      h => h.userId === userId && h.effectiveFrom <= asOf && (!h.effectiveUntil || h.effectiveUntil > asOf),
    )
  }
  async findByAuthorityLevel(level: number): Promise<readonly ApprovalHierarchy[]> {
    return Array.from(this.store.values()).filter(h => h.authorityLevel === level)
  }
}

// ── Policy ────────────────────────────────────────────────────────────────────

export class MemoryPolicyRepository extends MemoryAuthBase<Policy> implements IPolicyRepository {
  async findByResource(resource: string): Promise<readonly Policy[]> {
    return Array.from(this.store.values()).filter(p => p.resource === resource || p.resource === '*')
  }
  async findActive(): Promise<readonly Policy[]> {
    return Array.from(this.store.values()).filter(p => p.isActive)
  }
  async findApplicable(resource: string, action: string): Promise<readonly Policy[]> {
    return Array.from(this.store.values()).filter(
      p => p.isActive && (p.resource === '*' || p.resource === resource) && (p.action === '*' || p.action === action),
    )
  }
}

// ── Audit Events (append-only) ────────────────────────────────────────────────

export class MemoryAuditEventRepository implements IAuditEventRepository {
  private readonly store = new Map<string, AuthAuditEvent>()

  async append(event: Omit<AuthAuditEvent, 'id' | 'createdAt'>): Promise<AuthAuditEvent> {
    const now = new Date().toISOString()
    const stored: AuthAuditEvent = { ...event, id: crypto.randomUUID(), createdAt: now }
    this.store.set(stored.id, stored)
    return stored
  }
  async findById(id: string): Promise<AuthAuditEvent | null> { return this.store.get(id) ?? null }
  async findByUserId(userId: string, limit = 100): Promise<readonly AuthAuditEvent[]> {
    return Array.from(this.store.values()).filter(e => e.userId === userId).slice(0, limit)
  }
  async findBySessionId(sessionId: string): Promise<readonly AuthAuditEvent[]> {
    return Array.from(this.store.values()).filter(e => e.sessionId === sessionId)
  }
  async findByEventType(type: AuthAuditEventType, limit = 100): Promise<readonly AuthAuditEvent[]> {
    return Array.from(this.store.values()).filter(e => e.eventType === type).slice(0, limit)
  }
  async findByTimeRange(from: string, to: string, limit = 100): Promise<readonly AuthAuditEvent[]> {
    return Array.from(this.store.values())
      .filter(e => e.occurredAt >= from && e.occurredAt <= to)
      .slice(0, limit)
  }
  async findByTargetUser(targetUserId: string, limit = 100): Promise<readonly AuthAuditEvent[]> {
    return Array.from(this.store.values()).filter(e => e.targetUserId === targetUserId).slice(0, limit)
  }
  async count(): Promise<number> { return this.store.size }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function buildMemoryAuthRepositories(): AuthRepositories {
  return {
    users: new MemoryUserRepository(),
    roles: new MemoryRoleRepository(),
    permissions: new MemoryPermissionRepository(),
    sessions: new MemorySessionRepository(),
    delegations: new MemoryDelegationRepository(),
    approvalHierarchies: new MemoryApprovalHierarchyRepository(),
    policies: new MemoryPolicyRepository(),
    auditEvents: new MemoryAuditEventRepository(),
  }
}
