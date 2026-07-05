/**
 * Prisma repository implementations — Phase M1 Production Prisma Layer.
 * STATUS: IMPLEMENTED, PENDING PRODUCTION VERIFICATION — never executed against a real
 * database in this environment (Docker unavailable).
 */

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
import { getPrismaClient } from '../../persistence/prismaClient.ts'
import { mapPrismaRow } from '../../persistence/decimalMapping.ts'

export class PrismaNotificationRepository implements INotificationRepository {
  async create(entity: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>): Promise<Notification> {
    const { scheduleTime, ...rest } = entity
    const row = await getPrismaClient().notification.create({
      data: {
        ...rest,
        scheduledAt: scheduleTime?.scheduledAt,
        recurrence: scheduleTime?.recurrence ?? undefined,
      } as never,
    })
    return this.toDomain(row)
  }
  async update(id: string, updates: Partial<Omit<Notification, 'id' | 'createdAt'>>): Promise<Notification> {
    const { scheduleTime, ...rest } = updates
    const data: Record<string, unknown> = { ...rest }
    if (scheduleTime !== undefined) {
      data.scheduledAt = scheduleTime?.scheduledAt
      data.recurrence = scheduleTime?.recurrence ?? undefined
    }
    const row = await getPrismaClient().notification.update({ where: { id }, data: data as never })
    return this.toDomain(row)
  }
  async delete(id: string): Promise<void> { await getPrismaClient().notification.delete({ where: { id } }) }
  async findById(id: string): Promise<Notification | null> {
    const row = await getPrismaClient().notification.findUnique({ where: { id } })
    return row ? this.toDomain(row) : null
  }
  async findAll(): Promise<readonly Notification[]> {
    const rows = await getPrismaClient().notification.findMany()
    return rows.map(r => this.toDomain(r))
  }
  async count(): Promise<number> { return getPrismaClient().notification.count() }

  async findByModule(moduleType: string, moduleId: string): Promise<readonly Notification[]> {
    const rows = await getPrismaClient().notification.findMany({ where: { moduleType, moduleId } })
    return rows.map(r => this.toDomain(r))
  }
  async findByBatchId(batchId: string): Promise<readonly Notification[]> {
    const rows = await getPrismaClient().notification.findMany({ where: { batchId } })
    return rows.map(r => this.toDomain(r))
  }
  async findByStatus(status: DeliveryStatus): Promise<readonly Notification[]> {
    const rows = await getPrismaClient().notification.findMany({ where: { status } })
    return rows.map(r => this.toDomain(r))
  }
  async findDueSchedules(asOf: string): Promise<readonly Notification[]> {
    const rows = await getPrismaClient().notification.findMany({
      where: { status: 'QUEUED', scheduledAt: { not: null, lte: new Date(asOf) } },
    })
    return rows.map(r => this.toDomain(r))
  }
  async markStatus(id: string, status: DeliveryStatus): Promise<Notification> {
    const row = await getPrismaClient().notification.update({ where: { id }, data: { status } })
    return this.toDomain(row)
  }

  /** Notification.scheduleTime is split across flat `scheduledAt` + `recurrence` columns (see schema comment). */
  private toDomain(row: Record<string, unknown>): Notification {
    const mapped = mapPrismaRow(row)
    const { scheduledAt, recurrence, ...rest } = mapped as Record<string, unknown>
    return {
      ...rest,
      scheduleTime: scheduledAt ? { scheduledAt, recurrence: recurrence ?? undefined } : undefined,
    } as unknown as Notification
  }
}

export class PrismaRecipientRepository implements IRecipientRepository {
  async create(entity: Omit<NotificationRecipient, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationRecipient> {
    const row = await getPrismaClient().notificationRecipient.create({ data: entity as never })
    return mapPrismaRow(row) as unknown as NotificationRecipient
  }
  async update(id: string, updates: Partial<Omit<NotificationRecipient, 'id' | 'createdAt'>>): Promise<NotificationRecipient> {
    const row = await getPrismaClient().notificationRecipient.update({ where: { id }, data: updates as never })
    return mapPrismaRow(row) as unknown as NotificationRecipient
  }
  async delete(id: string): Promise<void> { await getPrismaClient().notificationRecipient.delete({ where: { id } }) }
  async findById(id: string): Promise<NotificationRecipient | null> {
    const row = await getPrismaClient().notificationRecipient.findUnique({ where: { id } })
    return row ? (mapPrismaRow(row) as unknown as NotificationRecipient) : null
  }
  async findAll(): Promise<readonly NotificationRecipient[]> {
    const rows = await getPrismaClient().notificationRecipient.findMany()
    return rows.map(r => mapPrismaRow(r) as unknown as NotificationRecipient)
  }
  async count(): Promise<number> { return getPrismaClient().notificationRecipient.count() }

  async findByNotificationId(notificationId: string): Promise<readonly NotificationRecipient[]> {
    const rows = await getPrismaClient().notificationRecipient.findMany({ where: { notificationId } })
    return rows.map(r => mapPrismaRow(r) as unknown as NotificationRecipient)
  }
  async markStatus(id: string, status: DeliveryStatus): Promise<NotificationRecipient> {
    const row = await getPrismaClient().notificationRecipient.update({ where: { id }, data: { status } })
    return mapPrismaRow(row) as unknown as NotificationRecipient
  }
}

export class PrismaChannelRepository implements IChannelRepository {
  async create(entity: Omit<NotificationChannel, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationChannel> {
    const row = await getPrismaClient().notificationChannel.create({ data: entity as never })
    return mapPrismaRow(row) as unknown as NotificationChannel
  }
  async update(id: string, updates: Partial<Omit<NotificationChannel, 'id' | 'createdAt'>>): Promise<NotificationChannel> {
    const row = await getPrismaClient().notificationChannel.update({ where: { id }, data: updates as never })
    return mapPrismaRow(row) as unknown as NotificationChannel
  }
  async delete(id: string): Promise<void> { await getPrismaClient().notificationChannel.delete({ where: { id } }) }
  async findById(id: string): Promise<NotificationChannel | null> {
    const row = await getPrismaClient().notificationChannel.findUnique({ where: { id } })
    return row ? (mapPrismaRow(row) as unknown as NotificationChannel) : null
  }
  async findAll(): Promise<readonly NotificationChannel[]> {
    const rows = await getPrismaClient().notificationChannel.findMany()
    return rows.map(r => mapPrismaRow(r) as unknown as NotificationChannel)
  }
  async count(): Promise<number> { return getPrismaClient().notificationChannel.count() }

  async findByChannelType(channelType: ChannelType): Promise<readonly NotificationChannel[]> {
    const rows = await getPrismaClient().notificationChannel.findMany({ where: { channelType } })
    return rows.map(r => mapPrismaRow(r) as unknown as NotificationChannel)
  }
  async findEnabled(): Promise<readonly NotificationChannel[]> {
    const rows = await getPrismaClient().notificationChannel.findMany({ where: { isEnabled: true } })
    return rows.map(r => mapPrismaRow(r) as unknown as NotificationChannel)
  }
}

export class PrismaTemplateRepository implements ITemplateRepository {
  async create(entity: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationTemplate> {
    const row = await getPrismaClient().notificationTemplate.create({ data: entity as never })
    return mapPrismaRow(row) as unknown as NotificationTemplate
  }
  async update(id: string, updates: Partial<Omit<NotificationTemplate, 'id' | 'createdAt'>>): Promise<NotificationTemplate> {
    const row = await getPrismaClient().notificationTemplate.update({ where: { id }, data: updates as never })
    return mapPrismaRow(row) as unknown as NotificationTemplate
  }
  async delete(id: string): Promise<void> { await getPrismaClient().notificationTemplate.delete({ where: { id } }) }
  async findById(id: string): Promise<NotificationTemplate | null> {
    const row = await getPrismaClient().notificationTemplate.findUnique({ where: { id } })
    return row ? (mapPrismaRow(row) as unknown as NotificationTemplate) : null
  }
  async findAll(): Promise<readonly NotificationTemplate[]> {
    const rows = await getPrismaClient().notificationTemplate.findMany()
    return rows.map(r => mapPrismaRow(r) as unknown as NotificationTemplate)
  }
  async count(): Promise<number> { return getPrismaClient().notificationTemplate.count() }

  async findByCode(code: string): Promise<NotificationTemplate | null> {
    const row = await getPrismaClient().notificationTemplate.findUnique({ where: { code } })
    return row ? (mapPrismaRow(row) as unknown as NotificationTemplate) : null
  }
  async findActive(): Promise<readonly NotificationTemplate[]> {
    const rows = await getPrismaClient().notificationTemplate.findMany({ where: { isActive: true } })
    return rows.map(r => mapPrismaRow(r) as unknown as NotificationTemplate)
  }
}

export class PrismaDeliveryRepository implements IDeliveryRepository {
  async create(entity: Omit<NotificationDelivery, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationDelivery> {
    const row = await getPrismaClient().notificationDelivery.create({ data: entity as never })
    return mapPrismaRow(row) as unknown as NotificationDelivery
  }
  async update(id: string, updates: Partial<Omit<NotificationDelivery, 'id' | 'createdAt'>>): Promise<NotificationDelivery> {
    const row = await getPrismaClient().notificationDelivery.update({ where: { id }, data: updates as never })
    return mapPrismaRow(row) as unknown as NotificationDelivery
  }
  async delete(id: string): Promise<void> { await getPrismaClient().notificationDelivery.delete({ where: { id } }) }
  async findById(id: string): Promise<NotificationDelivery | null> {
    const row = await getPrismaClient().notificationDelivery.findUnique({ where: { id } })
    return row ? (mapPrismaRow(row) as unknown as NotificationDelivery) : null
  }
  async findAll(): Promise<readonly NotificationDelivery[]> {
    const rows = await getPrismaClient().notificationDelivery.findMany()
    return rows.map(r => mapPrismaRow(r) as unknown as NotificationDelivery)
  }
  async count(): Promise<number> { return getPrismaClient().notificationDelivery.count() }

  async findByNotificationId(notificationId: string): Promise<readonly NotificationDelivery[]> {
    const rows = await getPrismaClient().notificationDelivery.findMany({ where: { notificationId } })
    return rows.map(r => mapPrismaRow(r) as unknown as NotificationDelivery)
  }
  async findByRecipientId(recipientId: string): Promise<readonly NotificationDelivery[]> {
    const rows = await getPrismaClient().notificationDelivery.findMany({ where: { recipientId } })
    return rows.map(r => mapPrismaRow(r) as unknown as NotificationDelivery)
  }
  async findByStatus(status: DeliveryStatus): Promise<readonly NotificationDelivery[]> {
    const rows = await getPrismaClient().notificationDelivery.findMany({ where: { status } })
    return rows.map(r => mapPrismaRow(r) as unknown as NotificationDelivery)
  }
  async markStatus(id: string, status: DeliveryStatus, extra?: Partial<NotificationDelivery>): Promise<NotificationDelivery> {
    const row = await getPrismaClient().notificationDelivery.update({ where: { id }, data: { status, ...extra } as never })
    return mapPrismaRow(row) as unknown as NotificationDelivery
  }
}

export class PrismaBatchRepository implements IBatchRepository {
  async create(entity: Omit<NotificationBatch, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationBatch> {
    const row = await getPrismaClient().notificationBatch.create({ data: entity as never })
    return mapPrismaRow(row) as unknown as NotificationBatch
  }
  async update(id: string, updates: Partial<Omit<NotificationBatch, 'id' | 'createdAt'>>): Promise<NotificationBatch> {
    const row = await getPrismaClient().notificationBatch.update({ where: { id }, data: updates as never })
    return mapPrismaRow(row) as unknown as NotificationBatch
  }
  async delete(id: string): Promise<void> { await getPrismaClient().notificationBatch.delete({ where: { id } }) }
  async findById(id: string): Promise<NotificationBatch | null> {
    const row = await getPrismaClient().notificationBatch.findUnique({ where: { id } })
    return row ? (mapPrismaRow(row) as unknown as NotificationBatch) : null
  }
  async findAll(): Promise<readonly NotificationBatch[]> {
    const rows = await getPrismaClient().notificationBatch.findMany()
    return rows.map(r => mapPrismaRow(r) as unknown as NotificationBatch)
  }
  async count(): Promise<number> { return getPrismaClient().notificationBatch.count() }

  async incrementCounts(id: string, delta: { sent?: number; failed?: number; queued?: number }): Promise<NotificationBatch> {
    const row = await getPrismaClient().notificationBatch.update({
      where: { id },
      data: {
        ...(delta.sent ? { sentCount: { increment: delta.sent } } : {}),
        ...(delta.failed ? { failedCount: { increment: delta.failed } } : {}),
        ...(delta.queued ? { queuedCount: { increment: delta.queued } } : {}),
      },
    })
    return mapPrismaRow(row) as unknown as NotificationBatch
  }
}

export class PrismaPreferenceRepository implements IPreferenceRepository {
  async create(entity: Omit<NotificationPreference, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationPreference> {
    const row = await getPrismaClient().notificationPreference.create({ data: entity as never })
    return mapPrismaRow(row) as unknown as NotificationPreference
  }
  async update(id: string, updates: Partial<Omit<NotificationPreference, 'id' | 'createdAt'>>): Promise<NotificationPreference> {
    const row = await getPrismaClient().notificationPreference.update({ where: { id }, data: updates as never })
    return mapPrismaRow(row) as unknown as NotificationPreference
  }
  async delete(id: string): Promise<void> { await getPrismaClient().notificationPreference.delete({ where: { id } }) }
  async findById(id: string): Promise<NotificationPreference | null> {
    const row = await getPrismaClient().notificationPreference.findUnique({ where: { id } })
    return row ? (mapPrismaRow(row) as unknown as NotificationPreference) : null
  }
  async findAll(): Promise<readonly NotificationPreference[]> {
    const rows = await getPrismaClient().notificationPreference.findMany()
    return rows.map(r => mapPrismaRow(r) as unknown as NotificationPreference)
  }
  async count(): Promise<number> { return getPrismaClient().notificationPreference.count() }

  async findByUserAndChannel(userId: string, channelType: ChannelType): Promise<NotificationPreference | null> {
    const row = await getPrismaClient().notificationPreference.findUnique({
      where: { userId_channelType: { userId, channelType } },
    })
    return row ? (mapPrismaRow(row) as unknown as NotificationPreference) : null
  }
  async findByUserId(userId: string): Promise<readonly NotificationPreference[]> {
    const rows = await getPrismaClient().notificationPreference.findMany({ where: { userId } })
    return rows.map(r => mapPrismaRow(r) as unknown as NotificationPreference)
  }
}

export class PrismaRuleRepository implements IRuleRepository {
  async create(entity: Omit<NotificationRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationRule> {
    const row = await getPrismaClient().notificationRule.create({ data: entity as never })
    return mapPrismaRow(row) as unknown as NotificationRule
  }
  async update(id: string, updates: Partial<Omit<NotificationRule, 'id' | 'createdAt'>>): Promise<NotificationRule> {
    const row = await getPrismaClient().notificationRule.update({ where: { id }, data: updates as never })
    return mapPrismaRow(row) as unknown as NotificationRule
  }
  async delete(id: string): Promise<void> { await getPrismaClient().notificationRule.delete({ where: { id } }) }
  async findById(id: string): Promise<NotificationRule | null> {
    const row = await getPrismaClient().notificationRule.findUnique({ where: { id } })
    return row ? (mapPrismaRow(row) as unknown as NotificationRule) : null
  }
  async findAll(): Promise<readonly NotificationRule[]> {
    const rows = await getPrismaClient().notificationRule.findMany()
    return rows.map(r => mapPrismaRow(r) as unknown as NotificationRule)
  }
  async count(): Promise<number> { return getPrismaClient().notificationRule.count() }

  async findByEventType(eventType: string): Promise<readonly NotificationRule[]> {
    const rows = await getPrismaClient().notificationRule.findMany({ where: { eventType } })
    return rows.map(r => mapPrismaRow(r) as unknown as NotificationRule)
  }
  async findActive(): Promise<readonly NotificationRule[]> {
    const rows = await getPrismaClient().notificationRule.findMany({ where: { isActive: true } })
    return rows.map(r => mapPrismaRow(r) as unknown as NotificationRule)
  }
}

export class PrismaEventRepository implements IEventRepository {
  async create(event: Omit<NotificationEvent, 'id' | 'createdAt'>): Promise<NotificationEvent> {
    const row = await getPrismaClient().notificationEvent.create({ data: event as never })
    return mapPrismaRow(row) as unknown as NotificationEvent
  }
  async findById(id: string): Promise<NotificationEvent | null> {
    const row = await getPrismaClient().notificationEvent.findUnique({ where: { id } })
    return row ? (mapPrismaRow(row) as unknown as NotificationEvent) : null
  }
  async markProcessed(id: string, processedAt: string): Promise<NotificationEvent> {
    const row = await getPrismaClient().notificationEvent.update({ where: { id }, data: { processedAt } })
    return mapPrismaRow(row) as unknown as NotificationEvent
  }
  async findUnprocessed(): Promise<readonly NotificationEvent[]> {
    const rows = await getPrismaClient().notificationEvent.findMany({ where: { processedAt: null } })
    return rows.map(r => mapPrismaRow(r) as unknown as NotificationEvent)
  }
  async findByEventType(eventType: string): Promise<readonly NotificationEvent[]> {
    const rows = await getPrismaClient().notificationEvent.findMany({ where: { eventType } })
    return rows.map(r => mapPrismaRow(r) as unknown as NotificationEvent)
  }
}

export class PrismaNotificationAuditRepository implements INotificationAuditRepository {
  async append(event: Omit<NotificationAuditEvent, 'id' | 'createdAt'>): Promise<NotificationAuditEvent> {
    const row = await getPrismaClient().notificationAuditEvent.create({ data: event as never })
    return mapPrismaRow(row) as unknown as NotificationAuditEvent
  }
  async findById(id: string): Promise<NotificationAuditEvent | null> {
    const row = await getPrismaClient().notificationAuditEvent.findUnique({ where: { id } })
    return row ? (mapPrismaRow(row) as unknown as NotificationAuditEvent) : null
  }
  async findByNotificationId(notificationId: string, limit = 100): Promise<readonly NotificationAuditEvent[]> {
    const rows = await getPrismaClient().notificationAuditEvent.findMany({ where: { notificationId }, take: limit })
    return rows.map(r => mapPrismaRow(r) as unknown as NotificationAuditEvent)
  }
  async findByUserId(userId: string, limit = 100): Promise<readonly NotificationAuditEvent[]> {
    const rows = await getPrismaClient().notificationAuditEvent.findMany({ where: { userId }, take: limit })
    return rows.map(r => mapPrismaRow(r) as unknown as NotificationAuditEvent)
  }
  async findByEventType(type: NotificationAuditEventType, limit = 100): Promise<readonly NotificationAuditEvent[]> {
    const rows = await getPrismaClient().notificationAuditEvent.findMany({ where: { eventType: type }, take: limit })
    return rows.map(r => mapPrismaRow(r) as unknown as NotificationAuditEvent)
  }
  async findByTimeRange(from: string, to: string, limit = 100): Promise<readonly NotificationAuditEvent[]> {
    const rows = await getPrismaClient().notificationAuditEvent.findMany({
      where: { occurredAt: { gte: from, lte: to } }, take: limit,
    })
    return rows.map(r => mapPrismaRow(r) as unknown as NotificationAuditEvent)
  }
  async count(): Promise<number> { return getPrismaClient().notificationAuditEvent.count() }
}

export function buildPrismaNotificationRepositories(): NotificationRepositories {
  return {
    notifications: new PrismaNotificationRepository(),
    recipients: new PrismaRecipientRepository(),
    channels: new PrismaChannelRepository(),
    templates: new PrismaTemplateRepository(),
    deliveries: new PrismaDeliveryRepository(),
    batches: new PrismaBatchRepository(),
    preferences: new PrismaPreferenceRepository(),
    rules: new PrismaRuleRepository(),
    events: new PrismaEventRepository(),
    auditEvents: new PrismaNotificationAuditRepository(),
  }
}
