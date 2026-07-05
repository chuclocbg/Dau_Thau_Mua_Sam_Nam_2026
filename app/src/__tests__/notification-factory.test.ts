import { describe, it, expect } from 'vitest'
import {
  buildNotification, buildRecipient, buildChannel, buildTemplate,
  buildDelivery, buildBatch, buildPreference, buildRule, buildEvent,
} from '../notification/application/notificationFactory.ts'

describe('buildNotification', () => {
  it('defaults priority to NORMAL and mode to IMMEDIATE', () => {
    const n = buildNotification({
      templateCode: 'T1', subject: 'S', body: 'B', channels: ['EMAIL'], createdBy: 'u1',
    })
    expect(n.priority).toBe('NORMAL')
    expect(n.mode).toBe('IMMEDIATE')
    expect(n.status).toBe('QUEUED')
    expect(n.variables).toEqual({})
  })

  it('honors explicit priority and mode', () => {
    const n = buildNotification({
      templateCode: 'T1', subject: 'S', body: 'B', channels: ['SMS'],
      priority: 'CRITICAL', mode: 'SCHEDULED', createdBy: 'u1',
    })
    expect(n.priority).toBe('CRITICAL')
    expect(n.mode).toBe('SCHEDULED')
  })

  it('carries moduleType/moduleId/batchId/ruleId through', () => {
    const n = buildNotification({
      templateCode: 'T1', subject: 'S', body: 'B', channels: ['EMAIL'],
      moduleType: 'APPROVAL', moduleId: 'a1', batchId: 'b1', ruleId: 'r1', createdBy: 'u1',
    })
    expect(n.moduleType).toBe('APPROVAL')
    expect(n.moduleId).toBe('a1')
    expect(n.batchId).toBe('b1')
    expect(n.ruleId).toBe('r1')
  })
})

describe('buildRecipient', () => {
  it('builds a QUEUED recipient', () => {
    const r = buildRecipient('n1', 'u1', 'u1@example.com', 'EMAIL')
    expect(r).toEqual({ notificationId: 'n1', userId: 'u1', address: 'u1@example.com', channelType: 'EMAIL', status: 'QUEUED' })
  })
})

describe('buildChannel', () => {
  it('defaults isEnabled true, priority 0, empty config', () => {
    const c = buildChannel({ channelType: 'EMAIL', providerType: 'smtp' })
    expect(c.isEnabled).toBe(true)
    expect(c.priority).toBe(0)
    expect(c.config).toEqual({})
  })

  it('honors explicit priority and config', () => {
    const c = buildChannel({ channelType: 'SMS', providerType: 'zalo_oa', priority: 5, config: { region: 'vn' } })
    expect(c.priority).toBe(5)
    expect(c.config).toEqual({ region: 'vn' })
  })
})

describe('buildTemplate', () => {
  it('defaults legalBasis to empty array and isActive true', () => {
    const t = buildTemplate({
      code: 'APPROVAL_NOTICE', name: 'Approval Notice',
      subjectTemplate: 'S {{x}}', bodyTemplate: 'B {{x}}',
      requiredVariables: ['x'], channels: ['EMAIL'],
    })
    expect(t.legalBasis).toEqual([])
    expect(t.isActive).toBe(true)
  })

  it('carries legalBasis through when provided', () => {
    const t = buildTemplate({
      code: 'X', name: 'X', subjectTemplate: 'S', bodyTemplate: 'B',
      requiredVariables: [], channels: ['EMAIL'],
      legalBasis: [{ document: '22/2023/QH15' }],
    })
    expect(t.legalBasis).toHaveLength(1)
  })
})

describe('buildDelivery', () => {
  it('builds a QUEUED delivery with given attempt', () => {
    const d = buildDelivery('n1', 'r1', 'EMAIL', 'smtp', 2)
    expect(d).toEqual({ notificationId: 'n1', recipientId: 'r1', channelType: 'EMAIL', providerType: 'smtp', status: 'QUEUED', attempt: 2 })
  })
})

describe('buildBatch', () => {
  it('sets queuedCount to totalCount and zeroes sent/failed', () => {
    const b = buildBatch('Monthly digest', 'DIGEST', 50, 'u1')
    expect(b.totalCount).toBe(50)
    expect(b.queuedCount).toBe(50)
    expect(b.sentCount).toBe(0)
    expect(b.failedCount).toBe(0)
    expect(b.status).toBe('PENDING')
  })
})

describe('buildPreference', () => {
  it('builds with quiet hours', () => {
    const p = buildPreference('u1', 'EMAIL', true, '22:00', '06:00')
    expect(p.isOptedIn).toBe(true)
    expect(p.quietHoursStart).toBe('22:00')
    expect(p.quietHoursEnd).toBe('06:00')
  })

  it('builds without quiet hours', () => {
    const p = buildPreference('u1', 'SMS', false)
    expect(p.quietHoursStart).toBeUndefined()
    expect(p.isOptedIn).toBe(false)
  })
})

describe('buildRule', () => {
  it('defaults priority to NORMAL and conditions to empty object', () => {
    const r = buildRule({ eventType: 'APPROVAL_REQUESTED', templateCode: 'T1', channels: ['EMAIL'] })
    expect(r.priority).toBe('NORMAL')
    expect(r.conditions).toEqual({})
    expect(r.isActive).toBe(true)
  })

  it('honors explicit conditions', () => {
    const r = buildRule({ eventType: 'X', templateCode: 'T1', channels: ['EMAIL'], conditions: { status: 'URGENT' } })
    expect(r.conditions).toEqual({ status: 'URGENT' })
  })
})

describe('buildEvent', () => {
  it('builds an event with the given fields', () => {
    const e = buildEvent('APPROVAL_REQUESTED', 'APPROVAL', 'a1', { amount: '1000' }, '2026-01-01T00:00:00Z')
    expect(e).toEqual({
      eventType: 'APPROVAL_REQUESTED', sourceModule: 'APPROVAL', sourceId: 'a1',
      payload: { amount: '1000' }, occurredAt: '2026-01-01T00:00:00Z',
    })
  })
})
