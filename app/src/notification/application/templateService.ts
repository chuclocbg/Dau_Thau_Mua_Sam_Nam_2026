import type { NotificationTemplate } from '../types/notificationTypes.ts'
import { NotificationError } from '../types/notificationTypes.ts'
import type { NotificationRepositories } from '../infrastructure/notificationRepositories.ts'
import { renderMessage, type RenderedMessage } from '../domain/template.ts'
import { validateTemplate } from '../validation/notificationValidation.ts'
import { buildTemplate, type BuildTemplateParams } from './notificationFactory.ts'

// ── TemplateService ────────────────────────────────────────────────────────────

export class TemplateService {
  constructor(private readonly repos: NotificationRepositories) {}

  async registerTemplate(params: BuildTemplateParams): Promise<NotificationTemplate> {
    const existing = await this.repos.templates.findByCode(params.code)
    if (existing) {
      throw new NotificationError('VALIDATION_FAILED', 'code', `Template code already registered: ${params.code}`)
    }
    const built = buildTemplate(params)
    validateTemplate(built)
    return this.repos.templates.create(built)
  }

  async getTemplate(code: string): Promise<NotificationTemplate | null> {
    return this.repos.templates.findByCode(code)
  }

  async listActiveTemplates(): Promise<readonly NotificationTemplate[]> {
    return this.repos.templates.findActive()
  }

  /** Render subject + body for a template code with the given variables. */
  async renderForNotification(
    templateCode: string,
    variables: Readonly<Record<string, string>>,
  ): Promise<RenderedMessage> {
    const template = await this.repos.templates.findByCode(templateCode)
    if (!template) {
      throw new NotificationError('TEMPLATE_NOT_FOUND', 'templateCode', `Template not found: ${templateCode}`)
    }
    if (!template.isActive) {
      throw new NotificationError('TEMPLATE_NOT_FOUND', 'templateCode', `Template is inactive: ${templateCode}`)
    }
    return renderMessage(template.subjectTemplate, template.bodyTemplate, template.requiredVariables, variables)
  }
}
