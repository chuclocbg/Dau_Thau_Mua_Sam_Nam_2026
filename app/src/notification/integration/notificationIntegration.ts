/**
 * notificationIntegration.ts — the ONLY file in src/notification/ that may import from
 * other modules. Frozen modules (Workflow, Approval, Contract, Acceptance, Payment) must
 * NOT import notification directly — an orchestration layer above both sides observes a
 * business-module state change and calls recordEventFromModule() to translate it into a
 * NotificationEvent. Business modules never know a notification was sent.
 */

import type { Department } from '../../masterdata/masterdataTypes.ts'
import type { MasterDataRepositories } from '../../masterdata/masterdataRepository.ts'
import type { Notification, NotificationEvent } from '../types/notificationTypes.ts'
import type { NotificationRepositories } from '../infrastructure/notificationRepositories.ts'

// ── Source modules allowed to originate events ────────────────────────────────

export const NOTIFICATION_SOURCE_MODULES = [
  'WORKFLOW', 'APPROVAL', 'CONTRACT', 'ACCEPTANCE', 'PAYMENT',
] as const
export type NotificationSourceModule = typeof NOTIFICATION_SOURCE_MODULES[number]

// ── Department resolution ─────────────────────────────────────────────────────

/** Resolve the department responsible for a notification's originating module. */
export async function resolveDepartmentForNotification(
  notification: Notification,
  masterdata: MasterDataRepositories,
): Promise<Department | null> {
  if (!notification.moduleType) return null
  return await masterdata.departments.findByCode(notification.moduleType) ?? null
}

// ── Event ingestion from a business module ────────────────────────────────────

/** Record an inbound event from a frozen business module. Never called by that module itself. */
export async function recordEventFromModule(
  sourceModule: NotificationSourceModule,
  eventType: string,
  sourceId: string,
  payload: Readonly<Record<string, string>>,
  notificationRepos: NotificationRepositories,
  occurredAt: string = new Date().toISOString(),
): Promise<NotificationEvent> {
  const event = await notificationRepos.events.create({ eventType, sourceModule, sourceId, payload, occurredAt })

  await notificationRepos.auditEvents.append({
    eventType: 'EVENT_RECEIVED',
    userId: 'system',
    outcome: 'SUCCESS',
    occurredAt,
    metadata: { eventType: event.eventType, sourceModule, sourceId },
  })

  return event
}

// ── Notification lookup (called by frozen modules via id string only) ────────

/** Load all notifications raised for a specific business entity. */
export async function resolveNotificationsForModule(
  moduleType: string,
  moduleId: string,
  notificationRepos: NotificationRepositories,
): Promise<readonly Notification[]> {
  return notificationRepos.notifications.findByModule(moduleType, moduleId)
}
