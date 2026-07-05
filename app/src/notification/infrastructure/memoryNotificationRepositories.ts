import type { IBaseRepository } from '../../shared/repository/IBaseRepository.ts'
import type {
  Notification, NotificationRecipient, NotificationChannel, NotificationTemplate,
  NotificationDelivery, NotificationBatch, NotificationPreference, NotificationRule, NotificationEvent,
  ChannelType, DeliveryStatus,
} from '../types/notificationTypes.ts'
import type { NotificationAuditEvent, NotificationAuditEventType, INotificationAuditRepository } from '../types/auditTypes.ts'
import type {
  INotificationRepository, IRecipientRepository, IChannelRepository, ITemplateRepository,
  IDeliveryRepository, IBatchRepository, IPreferenceRepository, IRuleRepository, IEventRepository,
  NotificationRepositories,
} from './notificationRepositories.ts'

// ── Generic base ──────────────────────────────────────────────────────────────

class MemoryBase<T extends { id: string; createdAt: string; updatedAt: string }>
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
    if (!existing) throw new Error(`Notification entity not found: ${id}`)
    const updated = { ...existing, ...updates, id, updatedAt: new Date().toISOString() } as T
    this.store.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<void> { this.store.delete(id) }
  async findById(id: string): Promise<T | null> { return this.store.get(id) ?? null }
  async findAll(): Promise<readonly T[]> { return Array.from(this.store.values()) }
  async count(): Promise<number> { return this.store.size }
}

// ── Notification ──────────────────────────────────────────────────────────────

export class MemoryNotificationRepository extends MemoryBase<Notification> implements INotificationRepository {
  async findByModule(moduleType: string, moduleId: string): Promise<readonly Notification[]> {
    return Array.from(this.store.values()).filter(n => n.moduleType === moduleType && n.moduleId === moduleId)
  }
  async findByBatchId(batchId: string): Promise<readonly Notification[]> {
    return Array.from(this.store.values()).filter(n => n.batchId === batchId)
  }
  async findByStatus(status: DeliveryStatus): Promise<readonly Notification[]> {
    return Array.from(this.store.values()).filter(n => n.status === status)
  }
  async findDueSchedules(asOf: string): Promise<readonly Notification[]> {
    return Array.from(this.store.values()).filter(
      n => n.status === 'QUEUED' && n.scheduleTime !== undefined && n.scheduleTime.scheduledAt <= asOf,
    )
  }
  async markStatus(id: string, status: DeliveryStatus): Promise<Notification> {
    return this.update(id, { status })
  }
}

// ── Recipient ──────────────────────────────────────────────────────────────────

export class MemoryRecipientRepository extends MemoryBase<NotificationRecipient> implements IRecipientRepository {
  async findByNotificationId(notificationId: string): Promise<readonly NotificationRecipient[]> {
    return Array.from(this.store.values()).filter(r => r.notificationId === notificationId)
  }
  async markStatus(id: string, status: DeliveryStatus): Promise<NotificationRecipient> {
    return this.update(id, { status })
  }
}

// ── Channel ────────────────────────────────────────────────────────────────────

export class MemoryChannelRepository extends MemoryBase<NotificationChannel> implements IChannelRepository {
  async findByChannelType(channelType: ChannelType): Promise<readonly NotificationChannel[]> {
    return Array.from(this.store.values()).filter(c => c.channelType === channelType)
  }
  async findEnabled(): Promise<readonly NotificationChannel[]> {
    return Array.from(this.store.values()).filter(c => c.isEnabled)
  }
}

// ── Template ───────────────────────────────────────────────────────────────────

export class MemoryTemplateRepository extends MemoryBase<NotificationTemplate> implements ITemplateRepository {
  async findByCode(code: string): Promise<NotificationTemplate | null> {
    for (const t of this.store.values()) {
      if (t.code === code) return t
    }
    return null
  }
  async findActive(): Promise<readonly NotificationTemplate[]> {
    return Array.from(this.store.values()).filter(t => t.isActive)
  }
}

// ── Delivery ───────────────────────────────────────────────────────────────────

export class MemoryDeliveryRepository extends MemoryBase<NotificationDelivery> implements IDeliveryRepository {
  async findByNotificationId(notificationId: string): Promise<readonly NotificationDelivery[]> {
    return Array.from(this.store.values()).filter(d => d.notificationId === notificationId)
  }
  async findByRecipientId(recipientId: string): Promise<readonly NotificationDelivery[]> {
    return Array.from(this.store.values()).filter(d => d.recipientId === recipientId)
  }
  async findByStatus(status: DeliveryStatus): Promise<readonly NotificationDelivery[]> {
    return Array.from(this.store.values()).filter(d => d.status === status)
  }
  async markStatus(id: string, status: DeliveryStatus, extra?: Partial<NotificationDelivery>): Promise<NotificationDelivery> {
    return this.update(id, { status, ...extra })
  }
}

// ── Batch ──────────────────────────────────────────────────────────────────────

export class MemoryBatchRepository extends MemoryBase<NotificationBatch> implements IBatchRepository {
  async incrementCounts(id: string, delta: { sent?: number; failed?: number; queued?: number }): Promise<NotificationBatch> {
    const existing = this.store.get(id)
    if (!existing) throw new Error(`NotificationBatch not found: ${id}`)
    return this.update(id, {
      sentCount: existing.sentCount + (delta.sent ?? 0),
      failedCount: existing.failedCount + (delta.failed ?? 0),
      queuedCount: existing.queuedCount + (delta.queued ?? 0),
    })
  }
}

// ── Preference ─────────────────────────────────────────────────────────────────

export class MemoryPreferenceRepository extends MemoryBase<NotificationPreference> implements IPreferenceRepository {
  async findByUserAndChannel(userId: string, channelType: ChannelType): Promise<NotificationPreference | null> {
    for (const p of this.store.values()) {
      if (p.userId === userId && p.channelType === channelType) return p
    }
    return null
  }
  async findByUserId(userId: string): Promise<readonly NotificationPreference[]> {
    return Array.from(this.store.values()).filter(p => p.userId === userId)
  }
}

// ── Rule ───────────────────────────────────────────────────────────────────────

export class MemoryRuleRepository extends MemoryBase<NotificationRule> implements IRuleRepository {
  async findByEventType(eventType: string): Promise<readonly NotificationRule[]> {
    return Array.from(this.store.values()).filter(r => r.eventType === eventType)
  }
  async findActive(): Promise<readonly NotificationRule[]> {
    return Array.from(this.store.values()).filter(r => r.isActive)
  }
}

// ── Event ──────────────────────────────────────────────────────────────────────

export class MemoryEventRepository implements IEventRepository {
  private readonly store = new Map<string, NotificationEvent>()

  async create(event: Omit<NotificationEvent, 'id' | 'createdAt'>): Promise<NotificationEvent> {
    const stored: NotificationEvent = { ...event, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
    this.store.set(stored.id, stored)
    return stored
  }
  async findById(id: string): Promise<NotificationEvent | null> { return this.store.get(id) ?? null }
  async markProcessed(id: string, processedAt: string): Promise<NotificationEvent> {
    const existing = this.store.get(id)
    if (!existing) throw new Error(`NotificationEvent not found: ${id}`)
    const updated = { ...existing, processedAt }
    this.store.set(id, updated)
    return updated
  }
  async findUnprocessed(): Promise<readonly NotificationEvent[]> {
    return Array.from(this.store.values()).filter(e => e.processedAt === undefined)
  }
  async findByEventType(eventType: string): Promise<readonly NotificationEvent[]> {
    return Array.from(this.store.values()).filter(e => e.eventType === eventType)
  }
}

// ── Notification Audit (append-only) ───────────────────────────────────────────

export class MemoryNotificationAuditRepository implements INotificationAuditRepository {
  private readonly store = new Map<string, NotificationAuditEvent>()

  async append(event: Omit<NotificationAuditEvent, 'id' | 'createdAt'>): Promise<NotificationAuditEvent> {
    const stored: NotificationAuditEvent = { ...event, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
    this.store.set(stored.id, stored)
    return stored
  }
  async findById(id: string): Promise<NotificationAuditEvent | null> { return this.store.get(id) ?? null }
  async findByNotificationId(notificationId: string, limit = 100): Promise<readonly NotificationAuditEvent[]> {
    return Array.from(this.store.values()).filter(e => e.notificationId === notificationId).slice(0, limit)
  }
  async findByUserId(userId: string, limit = 100): Promise<readonly NotificationAuditEvent[]> {
    return Array.from(this.store.values()).filter(e => e.userId === userId).slice(0, limit)
  }
  async findByEventType(type: NotificationAuditEventType, limit = 100): Promise<readonly NotificationAuditEvent[]> {
    return Array.from(this.store.values()).filter(e => e.eventType === type).slice(0, limit)
  }
  async findByTimeRange(from: string, to: string, limit = 100): Promise<readonly NotificationAuditEvent[]> {
    return Array.from(this.store.values())
      .filter(e => e.occurredAt >= from && e.occurredAt <= to)
      .slice(0, limit)
  }
  async count(): Promise<number> { return this.store.size }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function buildMemoryNotificationRepositories(): NotificationRepositories {
  return {
    notifications: new MemoryNotificationRepository(),
    recipients: new MemoryRecipientRepository(),
    channels: new MemoryChannelRepository(),
    templates: new MemoryTemplateRepository(),
    deliveries: new MemoryDeliveryRepository(),
    batches: new MemoryBatchRepository(),
    preferences: new MemoryPreferenceRepository(),
    rules: new MemoryRuleRepository(),
    events: new MemoryEventRepository(),
    auditEvents: new MemoryNotificationAuditRepository(),
  }
}
