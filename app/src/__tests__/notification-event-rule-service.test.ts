import { describe, it, expect, beforeEach } from 'vitest'
import { NotificationService } from '../notification/application/notificationService.ts'
import { TemplateService } from '../notification/application/templateService.ts'
import { EventRuleService, matchesConditions } from '../notification/application/eventRuleService.ts'
import { buildMemoryNotificationRepositories } from '../notification/infrastructure/memoryNotificationRepositories.ts'
import type { NotificationRepositories } from '../notification/infrastructure/notificationRepositories.ts'
import { NotificationError } from '../notification/types/notificationTypes.ts'

let repos: NotificationRepositories
let rules: EventRuleService

beforeEach(async () => {
  repos = buildMemoryNotificationRepositories()
  const templates = new TemplateService(repos)
  await templates.registerTemplate({
    code: 'APPROVAL_NOTICE', name: 'Approval Notice', subjectTemplate: 'Approval {{approvalCode}}',
    bodyTemplate: 'Status: {{status}}', requiredVariables: ['approvalCode', 'status'], channels: ['EMAIL'],
  })
  const notifications = new NotificationService(repos)
  rules = new EventRuleService(repos, notifications)
})

describe('matchesConditions', () => {
  it('true when all conditions match the payload', () => {
    expect(matchesConditions({ status: 'URGENT' }, { status: 'URGENT', other: 'x' })).toBe(true)
  })
  it('false when any condition mismatches', () => {
    expect(matchesConditions({ status: 'URGENT' }, { status: 'NORMAL' })).toBe(false)
  })
  it('true for empty conditions (matches everything)', () => {
    expect(matchesConditions({}, { anything: 'x' })).toBe(true)
  })
  it('false when the payload is missing a required key', () => {
    expect(matchesConditions({ status: 'URGENT' }, {})).toBe(false)
  })
})

describe('registerRule', () => {
  it('creates an active rule', async () => {
    const rule = await rules.registerRule({ eventType: 'APPROVAL_REQUESTED', templateCode: 'APPROVAL_NOTICE', channels: ['EMAIL'] })
    expect(rule.isActive).toBe(true)
  })

  it('rejects an invalid rule (missing eventType)', async () => {
    await expect(rules.registerRule({ eventType: '', templateCode: 'APPROVAL_NOTICE', channels: ['EMAIL'] }))
      .rejects.toThrow(NotificationError)
  })
})

describe('recordEvent', () => {
  it('persists the event and records EVENT_RECEIVED', async () => {
    const event = await rules.recordEvent('APPROVAL_REQUESTED', 'APPROVAL', 'a1', { approvalCode: 'AP-1', status: 'URGENT' })
    expect(event.eventType).toBe('APPROVAL_REQUESTED')
    const auditEvents = await repos.auditEvents.findByEventType('EVENT_RECEIVED')
    expect(auditEvents).toHaveLength(1)
  })
})

describe('triggerFromEvent', () => {
  const recipients = [{ userId: 'u1', channelType: 'EMAIL' as const, address: 'u1@x.com' }]

  it('creates a notification for each matching active rule', async () => {
    await rules.registerRule({ eventType: 'APPROVAL_REQUESTED', templateCode: 'APPROVAL_NOTICE', channels: ['EMAIL'] })
    const event = await rules.recordEvent('APPROVAL_REQUESTED', 'APPROVAL', 'a1', { approvalCode: 'AP-1', status: 'URGENT' })

    const created = await rules.triggerFromEvent(event, recipients, 'system')
    expect(created).toHaveLength(1)
    expect(created[0].subject).toBe('Approval AP-1')
    expect(created[0].mode).toBe('EVENT_DRIVEN')
    expect(created[0].ruleId).toBeTruthy()
  })

  it('does not trigger inactive rules', async () => {
    const rule = await rules.registerRule({ eventType: 'APPROVAL_REQUESTED', templateCode: 'APPROVAL_NOTICE', channels: ['EMAIL'] })
    await repos.rules.update(rule.id, { isActive: false })
    const event = await rules.recordEvent('APPROVAL_REQUESTED', 'APPROVAL', 'a1', { approvalCode: 'AP-1', status: 'URGENT' })

    const created = await rules.triggerFromEvent(event, recipients, 'system')
    expect(created).toHaveLength(0)
  })

  it('does not trigger a rule whose conditions do not match the event payload', async () => {
    await rules.registerRule({
      eventType: 'APPROVAL_REQUESTED', templateCode: 'APPROVAL_NOTICE', channels: ['EMAIL'],
      conditions: { status: 'URGENT' },
    })
    const event = await rules.recordEvent('APPROVAL_REQUESTED', 'APPROVAL', 'a1', { approvalCode: 'AP-1', status: 'NORMAL' })

    const created = await rules.triggerFromEvent(event, recipients, 'system')
    expect(created).toHaveLength(0)
  })

  it('triggers a rule whose conditions match the event payload', async () => {
    await rules.registerRule({
      eventType: 'APPROVAL_REQUESTED', templateCode: 'APPROVAL_NOTICE', channels: ['EMAIL'],
      conditions: { status: 'URGENT' },
    })
    const event = await rules.recordEvent('APPROVAL_REQUESTED', 'APPROVAL', 'a1', { approvalCode: 'AP-1', status: 'URGENT' })

    const created = await rules.triggerFromEvent(event, recipients, 'system')
    expect(created).toHaveLength(1)
  })

  it('marks the event processed regardless of whether any rule matched', async () => {
    const event = await rules.recordEvent('UNMATCHED_EVENT', 'APPROVAL', 'a1', {})
    await rules.triggerFromEvent(event, recipients, 'system')
    const stored = await repos.events.findById(event.id)
    expect(stored?.processedAt).toBeTruthy()
  })

  it('records a RULE_TRIGGERED audit event per match', async () => {
    await rules.registerRule({ eventType: 'APPROVAL_REQUESTED', templateCode: 'APPROVAL_NOTICE', channels: ['EMAIL'] })
    const event = await rules.recordEvent('APPROVAL_REQUESTED', 'APPROVAL', 'a1', { approvalCode: 'AP-1', status: 'URGENT' })
    await rules.triggerFromEvent(event, recipients, 'system')
    const triggered = await repos.auditEvents.findByEventType('RULE_TRIGGERED')
    expect(triggered).toHaveLength(1)
  })
})

describe('getRule / listActiveRules', () => {
  it('getRule throws RULE_NOT_FOUND for unknown id', async () => {
    await expect(rules.getRule('missing')).rejects.toThrow(NotificationError)
  })

  it('getRule returns the rule when found', async () => {
    const rule = await rules.registerRule({ eventType: 'X', templateCode: 'APPROVAL_NOTICE', channels: ['EMAIL'] })
    expect((await rules.getRule(rule.id))!.id).toBe(rule.id)
  })

  it('listActiveRules excludes inactive rules', async () => {
    const rule = await rules.registerRule({ eventType: 'X', templateCode: 'APPROVAL_NOTICE', channels: ['EMAIL'] })
    await repos.rules.update(rule.id, { isActive: false })
    expect(await rules.listActiveRules()).toHaveLength(0)
  })
})
