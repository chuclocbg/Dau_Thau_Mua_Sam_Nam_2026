import { describe, it, expect } from 'vitest'
import {
  extractVariables, validateRequiredVariables, renderTemplate, renderMessage,
} from '../notification/domain/template.ts'
import { NotificationError } from '../notification/types/notificationTypes.ts'

describe('extractVariables', () => {
  it('extracts a single variable', () => {
    expect(extractVariables('Hello {{name}}')).toEqual(['name'])
  })

  it('extracts multiple distinct variables in first-appearance order', () => {
    expect(extractVariables('{{packageCode}} - {{packageName}} for {{recipient}}')).toEqual([
      'packageCode', 'packageName', 'recipient',
    ])
  })

  it('deduplicates repeated variables', () => {
    expect(extractVariables('{{name}} and {{name}} again')).toEqual(['name'])
  })

  it('returns empty array when no variables present', () => {
    expect(extractVariables('No variables here')).toEqual([])
  })

  it('tolerates whitespace inside braces', () => {
    expect(extractVariables('{{ name }}')).toEqual(['name'])
  })
})

describe('validateRequiredVariables', () => {
  it('passes when all required variables are present', () => {
    expect(() => validateRequiredVariables(['name', 'date'], { name: 'A', date: '2026-01-01' })).not.toThrow()
  })

  it('throws TEMPLATE_RENDER_FAILED when a variable is missing', () => {
    expect(() => validateRequiredVariables(['name', 'amount'], { name: 'A' }))
      .toThrow(NotificationError)
  })

  it('lists all missing variables in the error message', () => {
    try {
      validateRequiredVariables(['a', 'b', 'c'], {})
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(NotificationError)
      expect((err as NotificationError).message).toContain('a')
      expect((err as NotificationError).message).toContain('b')
      expect((err as NotificationError).message).toContain('c')
    }
  })

  it('passes with empty required list', () => {
    expect(() => validateRequiredVariables([], {})).not.toThrow()
  })
})

describe('renderTemplate', () => {
  it('substitutes a single variable', () => {
    expect(renderTemplate('Hello {{name}}', { name: 'World' })).toBe('Hello World')
  })

  it('substitutes multiple variables', () => {
    expect(renderTemplate('{{packageCode}}: {{amount}}', { packageCode: 'PKG-1', amount: '1000' }))
      .toBe('PKG-1: 1000')
  })

  it('leaves unknown tokens untouched', () => {
    expect(renderTemplate('Hello {{unknown}}', {})).toBe('Hello {{unknown}}')
  })

  it('handles repeated variables', () => {
    expect(renderTemplate('{{name}}-{{name}}', { name: 'X' })).toBe('X-X')
  })

  it('handles all 9 documented variable names', () => {
    const template = '{{packageCode}} {{packageName}} {{contractCode}} {{supplier}} {{approvalCode}} {{paymentCode}} {{recipient}} {{date}} {{amount}}'
    const vars = {
      packageCode: 'P1', packageName: 'N1', contractCode: 'C1', supplier: 'S1',
      approvalCode: 'A1', paymentCode: 'PM1', recipient: 'R1', date: '2026-01-01', amount: '500',
    }
    expect(renderTemplate(template, vars)).toBe('P1 N1 C1 S1 A1 PM1 R1 2026-01-01 500')
  })
})

describe('renderMessage', () => {
  it('renders subject and body together', () => {
    const result = renderMessage('Package {{packageCode}}', 'Body {{packageCode}}', ['packageCode'], { packageCode: 'PKG-9' })
    expect(result.subject).toBe('Package PKG-9')
    expect(result.body).toBe('Body PKG-9')
  })

  it('throws before rendering if a required variable is missing', () => {
    expect(() => renderMessage('{{a}}', '{{b}}', ['a', 'b'], { a: '1' })).toThrow(NotificationError)
  })
})
