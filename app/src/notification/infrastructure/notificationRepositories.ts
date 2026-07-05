import type { IBaseRepository } from '../../shared/repository/IBaseRepository.ts'
import type {
  Notification, NotificationRecipient, NotificationChannel, NotificationTemplate,
  NotificationDelivery, NotificationBatch, NotificationPreference, NotificationRule, NotificationEvent,
  ChannelType, DeliveryStatus,
} from '../types/notificationTypes.ts'
import type { INotificationAuditRepository } from '../types/auditTypes.ts'

// ── Notification ──────────────────────────────────────────────────────────────

export interface INotificationRepository extends IBaseRepository<Notification> {
  findByModule(moduleType: string, moduleId: string): Promise<readonly Notification[]>
  findByBatchId(batchId: string): Promise<readonly Notification[]>
  findByStatus(status: DeliveryStatus): Promise<readonly Notification[]>
  findDueSchedules(asOf: string): Promise<readonly Notification[]>
  markStatus(id: string, status: DeliveryStatus): Promise<Notification>
}

// ── Recipient ──────────────────────────────────────────────────────────────────

export interface IRecipientRepository extends IBaseRepository<NotificationRecipient> {
  findByNotificationId(notificationId: string): Promise<readonly NotificationRecipient[]>
  markStatus(id: string, status: DeliveryStatus): Promise<NotificationRecipient>
}

// ── Channel ────────────────────────────────────────────────────────────────────

export interface IChannelRepository extends IBaseRepository<NotificationChannel> {
  findByChannelType(channelType: ChannelType): Promise<readonly NotificationChannel[]>
  findEnabled(): Promise<readonly NotificationChannel[]>
}

// ── Template ───────────────────────────────────────────────────────────────────

export interface ITemplateRepository extends IBaseRepository<NotificationTemplate> {
  findByCode(code: string): Promise<NotificationTemplate | null>
  findActive(): Promise<readonly NotificationTemplate[]>
}

// ── Delivery ───────────────────────────────────────────────────────────────────

export interface IDeliveryRepository extends IBaseRepository<NotificationDelivery> {
  findByNotificationId(notificationId: string): Promise<readonly NotificationDelivery[]>
  findByRecipientId(recipientId: string): Promise<readonly NotificationDelivery[]>
  findByStatus(status: DeliveryStatus): Promise<readonly NotificationDelivery[]>
  markStatus(id: string, status: DeliveryStatus, extra?: Partial<NotificationDelivery>): Promise<NotificationDelivery>
}

// ── Batch ──────────────────────────────────────────────────────────────────────

export interface IBatchRepository extends IBaseRepository<NotificationBatch> {
  incrementCounts(id: string, delta: { sent?: number; failed?: number; queued?: number }): Promise<NotificationBatch>
}

// ── Preference ─────────────────────────────────────────────────────────────────

export interface IPreferenceRepository extends IBaseRepository<NotificationPreference> {
  findByUserAndChannel(userId: string, channelType: ChannelType): Promise<NotificationPreference | null>
  findByUserId(userId: string): Promise<readonly NotificationPreference[]>
}

// ── Rule ───────────────────────────────────────────────────────────────────────

export interface IRuleRepository extends IBaseRepository<NotificationRule> {
  findByEventType(eventType: string): Promise<readonly NotificationRule[]>
  findActive(): Promise<readonly NotificationRule[]>
}

// ── Event ──────────────────────────────────────────────────────────────────────
// Append-mostly: created on receipt, updated once with processedAt.

export interface IEventRepository {
  create(event: Omit<NotificationEvent, 'id' | 'createdAt'>): Promise<NotificationEvent>
  findById(id: string): Promise<NotificationEvent | null>
  markProcessed(id: string, processedAt: string): Promise<NotificationEvent>
  findUnprocessed(): Promise<readonly NotificationEvent[]>
  findByEventType(eventType: string): Promise<readonly NotificationEvent[]>
}

// ── Aggregate ──────────────────────────────────────────────────────────────────

export interface NotificationRepositories {
  readonly notifications: INotificationRepository
  readonly recipients: IRecipientRepository
  readonly channels: IChannelRepository
  readonly templates: ITemplateRepository
  readonly deliveries: IDeliveryRepository
  readonly batches: IBatchRepository
  readonly preferences: IPreferenceRepository
  readonly rules: IRuleRepository
  readonly events: IEventRepository
  readonly auditEvents: INotificationAuditRepository
}
