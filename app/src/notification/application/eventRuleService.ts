import type { NotificationRule, NotificationEvent, Notification } from '../types/notificationTypes.ts'
import { NotificationError } from '../types/notificationTypes.ts'
import type { NotificationRepositories } from '../infrastructure/notificationRepositories.ts'
import { validateRule } from '../validation/notificationValidation.ts'
import { buildRule, buildEvent, type BuildRuleParams } from './notificationFactory.ts'
import { NotificationService, type RecipientInput } from './notificationService.ts'

// ── Condition matching — pure, exported for direct testing ───────────────────
// A rule's conditions must all match the event payload exactly (AND semantics).
// Empty conditions match every event of the rule's eventType.

export function matchesConditions(
  conditions: Readonly<Record<string, string>>,
  payload: Readonly<Record<string, string>>,
): boolean {
  return Object.entries(conditions).every(([key, value]) => payload[key] === value)
}

// ── EventRuleService ────────────────────────────────────────────────────────────

export class EventRuleService {
  constructor(
    private readonly repos: NotificationRepositories,
    private readonly notifications: NotificationService,
  ) {}

  async registerRule(params: BuildRuleParams): Promise<NotificationRule> {
    const built = buildRule(params)
    validateRule(built)
    return this.repos.rules.create(built)
  }

  async recordEvent(
    eventType: string,
    sourceModule: string,
    sourceId: string,
    payload: Readonly<Record<string, string>>,
    occurredAt: string = new Date().toISOString(),
  ): Promise<NotificationEvent> {
    const event = await this.repos.events.create(buildEvent(eventType, sourceModule, sourceId, payload, occurredAt))

    await this.repos.auditEvents.append({
      eventType: 'EVENT_RECEIVED',
      userId: 'system',
      outcome: 'SUCCESS',
      occurredAt,
      metadata: { eventType: event.eventType, sourceModule, sourceId },
    })

    return event
  }

  /** Match active rules against a recorded event and create one notification per match. */
  async triggerFromEvent(
    event: NotificationEvent,
    recipients: readonly RecipientInput[],
    createdBy: string,
  ): Promise<readonly Notification[]> {
    const rules = (await this.repos.rules.findByEventType(event.eventType))
      .filter(r => r.isActive && matchesConditions(r.conditions, event.payload))

    if (rules.length === 0) {
      await this.repos.events.markProcessed(event.id, new Date().toISOString())
      return []
    }

    const created: Notification[] = []
    for (const rule of rules) {
      const notification = await this.notifications.createNotification({
        templateCode: rule.templateCode,
        variables: event.payload,
        recipients,
        priority: rule.priority,
        mode: 'EVENT_DRIVEN',
        moduleType: event.sourceModule,
        moduleId: event.sourceId,
        ruleId: rule.id,
        createdBy,
      })
      created.push(notification)

      await this.repos.auditEvents.append({
        eventType: 'RULE_TRIGGERED',
        notificationId: notification.id,
        ruleId: rule.id,
        userId: createdBy,
        outcome: 'SUCCESS',
        occurredAt: new Date().toISOString(),
        metadata: { eventType: event.eventType },
      })
    }

    await this.repos.events.markProcessed(event.id, new Date().toISOString())
    return created
  }

  async getRule(id: string): Promise<NotificationRule | null> {
    const rule = await this.repos.rules.findById(id)
    if (!rule) throw new NotificationError('RULE_NOT_FOUND', 'id', `Rule not found: ${id}`)
    return rule
  }

  async listActiveRules(): Promise<readonly NotificationRule[]> {
    return this.repos.rules.findActive()
  }
}
