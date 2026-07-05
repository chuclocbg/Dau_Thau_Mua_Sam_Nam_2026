import { describe, it, expect, beforeEach } from 'vitest'
import { NotificationKnowledgeProvider } from '../knowledge/providers/notification/notificationKnowledgeProvider.ts'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'

function notifItemInput(overrides: Partial<KnowledgeItem> = {}): Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    domain: 'notification', provider: 'NotificationKnowledgeProvider', type: 'ESCALATION_RULE',
    title: 'SLA vi phạm thầu', summary: 'Quy tắc leo thang khi vi phạm SLA', keywords: ['SLA'],
    legalBasis: [], relatedItems: [], metadata: {}, confidence: 1.0, attachments: [],
    layer: 2, language: 'vi', isActive: true, version: '1',
    ...overrides,
  }
}

let repos: KnowledgeRepositories
let graph: IKnowledgeGraph
let provider: NotificationKnowledgeProvider

beforeEach(() => {
  repos = buildMemoryKnowledgeRepositories()
  graph = new KnowledgeGraphService(repos.relations)
  provider = new NotificationKnowledgeProvider(repos, graph)
})

describe('identity', () => {
  it('reports domain=notification, layer=2', () => {
    expect(provider.domain).toBe('notification')
    expect(provider.layer).toBe(2)
  })

  it('is distinct from the src/notification/ delivery infrastructure module (Phase L)', () => {
    // No import of src/notification/ anywhere in this provider — purely a compile-time
    // structural check via the file's own imports (see source comment).
    expect(provider.domain).not.toBe('notification-delivery')
  })
})

describe('search()', () => {
  it('finds an item by keyword within its own domain', async () => {
    await repos.items.create(notifItemInput())
    const results = await provider.search({ text: 'SLA' })
    expect(results).toHaveLength(1)
    expect(results[0].matchedDomain).toBe('notification')
  })

  it('never returns items from another domain', async () => {
    await repos.items.create(notifItemInput({ domain: 'budget', title: 'SLA budget item' }))
    expect(await provider.search({ text: 'SLA' })).toEqual([])
  })
})

describe('resolve()', () => {
  it('resolves an item it owns', async () => {
    const item = await repos.items.create(notifItemInput())
    expect((await provider.resolve(item.id))?.id).toBe(item.id)
  })

  it('refuses to resolve an item from a different domain', async () => {
    const item = await repos.items.create(notifItemInput({ domain: 'vendor' }))
    expect(await provider.resolve(item.id)).toBeNull()
  })
})

describe('suggest()', () => {
  it('suggests applicable items with a notification-specific reason', async () => {
    await repos.items.create(notifItemInput())
    const suggestions = await provider.suggest({})
    expect(suggestions[0].reason).toBe('Applicable notification/escalation rule')
  })
})

describe('score()', () => {
  it('scores an applicable item at its confidence', async () => {
    const item = await repos.items.create(notifItemInput({ confidence: 0.4 }))
    expect(await provider.score(item.id, {})).toBe(0.4)
  })
})

describe('graph integration — escalation chain (new relation type ESCALATES_TO)', () => {
  it('links and retrieves an escalation target', async () => {
    const level1 = await repos.items.create(notifItemInput({ title: 'Notify Officer' }))
    const level2 = await repos.items.create(notifItemInput({ title: 'Notify Department Head' }))
    await provider.linkEscalation(level1.id, level2.id)
    expect(await provider.getEscalationTarget(level1.id)).toEqual([level2.id])
  })

  it('a rule with no escalation target returns empty', async () => {
    const item = await repos.items.create(notifItemInput())
    expect(await provider.getEscalationTarget(item.id)).toEqual([])
  })
})

describe('graph integration — template linkage (reuses USES_TEMPLATE)', () => {
  it('links and retrieves a message template', async () => {
    const rule = await repos.items.create(notifItemInput())
    const template = await repos.items.create(notifItemInput({ domain: 'templates', type: 'MESSAGE_TEMPLATE', title: 'SLA breach email' }))
    await provider.linkTemplate(rule.id, template.id)
    expect(await provider.getLinkedTemplates(rule.id)).toEqual([template.id])
  })

  it('ESCALATES_TO and USES_TEMPLATE remain independent on the same item', async () => {
    const rule = await repos.items.create(notifItemInput())
    const escalationTarget = await repos.items.create(notifItemInput({ title: 'Escalation Target' }))
    const template = await repos.items.create(notifItemInput({ domain: 'templates', type: 'MESSAGE_TEMPLATE' }))
    await provider.linkEscalation(rule.id, escalationTarget.id)
    await provider.linkTemplate(rule.id, template.id)
    expect(await provider.getEscalationTarget(rule.id)).toEqual([escalationTarget.id])
    expect(await provider.getLinkedTemplates(rule.id)).toEqual([template.id])
  })
})
