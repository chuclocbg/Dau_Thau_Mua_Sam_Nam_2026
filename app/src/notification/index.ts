// ── Public API — Notification Module ──────────────────────────────────────────

// Types
export type {
  ChannelType, Priority, DeliveryStatus, NotificationMode, RecurrenceFrequency,
  RecurrenceRule, ScheduleTime, RetryPolicy, BatchStatus, NotificationErrorCode,
  Notification, NotificationRecipient, NotificationChannel, NotificationTemplate,
  NotificationDelivery, NotificationBatch, NotificationPreference, NotificationRule, NotificationEvent,
} from './types/notificationTypes.ts'
export {
  CHANNEL_TYPES, PRIORITIES, DELIVERY_STATUSES, NOTIFICATION_MODES,
  RECURRENCE_FREQUENCIES, BATCH_STATUSES, NOTIFICATION_ERROR_CODES,
  NotificationError, DEFAULT_RETRY_POLICY,
} from './types/notificationTypes.ts'

// Provider interfaces
export type {
  NotificationProviderType, SendParams, ProviderSendResult,
  INotificationProvider, NotificationProviderRegistry,
} from './types/providerTypes.ts'
export { NOTIFICATION_PROVIDER_TYPES, createProviderRegistry } from './types/providerTypes.ts'

// Audit types
export type {
  NotificationAuditEvent, NotificationAuditEventType, NotificationAuditOutcome, INotificationAuditRepository,
} from './types/auditTypes.ts'
export { NOTIFICATION_AUDIT_EVENT_TYPES, NOTIFICATION_AUDIT_OUTCOMES } from './types/auditTypes.ts'

// Repository interfaces
export type {
  INotificationRepository, IRecipientRepository, IChannelRepository, ITemplateRepository,
  IDeliveryRepository, IBatchRepository, IPreferenceRepository, IRuleRepository, IEventRepository,
  NotificationRepositories,
} from './infrastructure/notificationRepositories.ts'

// Factory
export type {
  CreateNotificationParams, CreateRecipientParams, CreateChannelParams, CreateTemplateParams,
  CreateDeliveryParams, CreateBatchParams, CreatePreferenceParams, CreateRuleParams, CreateEventParams,
  BuildNotificationParams, BuildChannelParams, BuildTemplateParams, BuildRuleParams,
} from './application/notificationFactory.ts'
export {
  buildNotification, buildRecipient, buildChannel, buildTemplate,
  buildDelivery, buildBatch, buildPreference, buildRule, buildEvent,
} from './application/notificationFactory.ts'

// Application services
export { NotificationService } from './application/notificationService.ts'
export type { RecipientInput, CreateNotificationRequest } from './application/notificationService.ts'
export { DeliveryService } from './application/deliveryService.ts'
export { SchedulingService } from './application/schedulingService.ts'
export { BatchService } from './application/batchService.ts'
export { TemplateService } from './application/templateService.ts'
export { PreferenceService } from './application/preferenceService.ts'
export { EventRuleService, matchesConditions } from './application/eventRuleService.ts'

// Domain
export {
  extractVariables, validateRequiredVariables, renderTemplate, renderMessage,
} from './domain/template.ts'
export type { RenderedMessage } from './domain/template.ts'
export { shouldRetry, computeNextRetryDelay, computeNextRetryAt } from './domain/retryPolicy.ts'
export {
  isSchedulePast, isDue, computeNextOccurrence, isRecurrenceExhausted, isInQuietHours,
} from './domain/scheduling.ts'

// Validation
export {
  validateSubject, validateMessageBody, validateTemplateCode, validateChannels,
  validateTemplate, validateScheduleTime, validateRule, validateRecipientAddress,
} from './validation/notificationValidation.ts'

// Memory implementations (for tests and local dev)
export { buildMemoryNotificationRepositories } from './infrastructure/memoryNotificationRepositories.ts'
export { MockNotificationProvider } from './infrastructure/providers/mockNotificationProvider.ts'
export { InAppNotificationProvider } from './infrastructure/providers/inAppNotificationProvider.ts'
export type { InboxMessage } from './infrastructure/providers/inAppNotificationProvider.ts'

// Prisma stubs
export { buildPrismaNotificationRepositories } from './infrastructure/prismaNotificationRepositories.ts'

// Integration bridge
export {
  resolveDepartmentForNotification, recordEventFromModule, resolveNotificationsForModule,
  NOTIFICATION_SOURCE_MODULES,
} from './integration/notificationIntegration.ts'
export type { NotificationSourceModule } from './integration/notificationIntegration.ts'
