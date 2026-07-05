import { NotificationError } from '../types/notificationTypes.ts'

// ── Template rendering — provider-neutral, pure string substitution ──────────
// Variables use {{name}} syntax. No HTML/markdown assumptions — a channel's
// provider decides how to present plain rendered text (HTML email, SMS, push).

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

/** Extract the set of {{variable}} names referenced by a template string. */
export function extractVariables(template: string): readonly string[] {
  const found = new Set<string>()
  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    found.add(match[1])
  }
  return Array.from(found)
}

/** Verify every variable required by the template is present in the supplied map. */
export function validateRequiredVariables(
  requiredVariables: readonly string[],
  variables: Readonly<Record<string, string>>,
): void {
  const missing = requiredVariables.filter(name => !(name in variables))
  if (missing.length > 0) {
    throw new NotificationError(
      'TEMPLATE_RENDER_FAILED',
      'variables',
      `Missing required template variables: ${missing.join(', ')}`,
    )
  }
}

/** Substitute {{variable}} tokens with values. Unknown tokens are left as-is. */
export function renderTemplate(template: string, variables: Readonly<Record<string, string>>): string {
  return template.replace(VARIABLE_PATTERN, (whole, name: string) => {
    return name in variables ? variables[name] : whole
  })
}

export interface RenderedMessage {
  readonly subject: string
  readonly body: string
}

/** Render both subject and body templates, validating required variables first. */
export function renderMessage(
  subjectTemplate: string,
  bodyTemplate: string,
  requiredVariables: readonly string[],
  variables: Readonly<Record<string, string>>,
): RenderedMessage {
  validateRequiredVariables(requiredVariables, variables)
  return {
    subject: renderTemplate(subjectTemplate, variables),
    body: renderTemplate(bodyTemplate, variables),
  }
}
