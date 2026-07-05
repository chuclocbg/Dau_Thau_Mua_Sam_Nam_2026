import { describe, it, expect, beforeEach } from 'vitest'
import { TemplateService } from '../notification/application/templateService.ts'
import { buildMemoryNotificationRepositories } from '../notification/infrastructure/memoryNotificationRepositories.ts'
import type { NotificationRepositories } from '../notification/infrastructure/notificationRepositories.ts'
import { NotificationError } from '../notification/types/notificationTypes.ts'

let repos: NotificationRepositories
let service: TemplateService

beforeEach(() => {
  repos = buildMemoryNotificationRepositories()
  service = new TemplateService(repos)
})

describe('registerTemplate', () => {
  it('creates a new template', async () => {
    const t = await service.registerTemplate({
      code: 'APPROVAL_NOTICE', name: 'Approval Notice',
      subjectTemplate: 'Approval {{approvalCode}}', bodyTemplate: 'Body {{approvalCode}}',
      requiredVariables: ['approvalCode'], channels: ['EMAIL'],
    })
    expect(t.code).toBe('APPROVAL_NOTICE')
    expect(t.isActive).toBe(true)
  })

  it('rejects a duplicate template code', async () => {
    await service.registerTemplate({
      code: 'DUP', name: 'N', subjectTemplate: 'S', bodyTemplate: 'B', requiredVariables: [], channels: ['EMAIL'],
    })
    await expect(service.registerTemplate({
      code: 'DUP', name: 'N2', subjectTemplate: 'S', bodyTemplate: 'B', requiredVariables: [], channels: ['SMS'],
    })).rejects.toThrow(NotificationError)
  })

  it('rejects an invalid template code', async () => {
    await expect(service.registerTemplate({
      code: 'bad-code', name: 'N', subjectTemplate: 'S', bodyTemplate: 'B', requiredVariables: [], channels: ['EMAIL'],
    })).rejects.toThrow(NotificationError)
  })
})

describe('getTemplate', () => {
  it('returns the registered template', async () => {
    await service.registerTemplate({
      code: 'T1', name: 'N', subjectTemplate: 'S', bodyTemplate: 'B', requiredVariables: [], channels: ['EMAIL'],
    })
    expect((await service.getTemplate('T1'))?.name).toBe('N')
  })

  it('returns null for unknown code', async () => {
    expect(await service.getTemplate('MISSING')).toBeNull()
  })
})

describe('listActiveTemplates', () => {
  it('excludes inactive templates', async () => {
    const t = await service.registerTemplate({
      code: 'T1', name: 'N', subjectTemplate: 'S', bodyTemplate: 'B', requiredVariables: [], channels: ['EMAIL'],
    })
    await repos.templates.update(t.id, { isActive: false })
    expect(await service.listActiveTemplates()).toHaveLength(0)
  })
})

describe('renderForNotification', () => {
  it('renders subject and body with variables', async () => {
    await service.registerTemplate({
      code: 'PAY', name: 'Payment', subjectTemplate: 'Payment {{paymentCode}}',
      bodyTemplate: 'Amount: {{amount}}', requiredVariables: ['paymentCode', 'amount'], channels: ['EMAIL'],
    })
    const rendered = await service.renderForNotification('PAY', { paymentCode: 'PM-1', amount: '5000000' })
    expect(rendered.subject).toBe('Payment PM-1')
    expect(rendered.body).toBe('Amount: 5000000')
  })

  it('throws TEMPLATE_NOT_FOUND for unknown code', async () => {
    await expect(service.renderForNotification('MISSING', {})).rejects.toThrow(NotificationError)
  })

  it('throws TEMPLATE_NOT_FOUND when template is inactive', async () => {
    const t = await service.registerTemplate({
      code: 'INACTIVE', name: 'N', subjectTemplate: 'S', bodyTemplate: 'B', requiredVariables: [], channels: ['EMAIL'],
    })
    await repos.templates.update(t.id, { isActive: false })
    await expect(service.renderForNotification('INACTIVE', {})).rejects.toThrow(NotificationError)
  })

  it('throws when a required variable is missing', async () => {
    await service.registerTemplate({
      code: 'REQ', name: 'N', subjectTemplate: '{{a}}', bodyTemplate: '{{b}}',
      requiredVariables: ['a', 'b'], channels: ['EMAIL'],
    })
    await expect(service.renderForNotification('REQ', { a: '1' })).rejects.toThrow(NotificationError)
  })
})
