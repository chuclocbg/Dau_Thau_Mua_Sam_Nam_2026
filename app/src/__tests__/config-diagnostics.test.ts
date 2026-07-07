import { describe, it, expect } from 'vitest'
import { buildConfigDiagnostics, formatConfigDiagnostics } from '../startup/configDiagnostics.ts'
import type { AppConfig } from '../config/appConfig.ts'

function fakeConfig(): AppConfig {
  return {
    port: 3000, host: '0.0.0.0', nodeEnv: 'production', logLevel: 'info', logFormat: 'json',
    shutdownTimeoutMs: 10_000, streamTimeoutMs: 30_000,
  }
}

describe('buildConfigDiagnostics', () => {
  it('lists every AppConfig field with its value', () => {
    const report = buildConfigDiagnostics(fakeConfig(), 'production')
    const keys = report.fields.map(f => f.key)
    expect(keys).toEqual(['port', 'host', 'nodeEnv', 'logLevel', 'logFormat', 'shutdownTimeoutMs', 'streamTimeoutMs'])
    expect(report.profile).toBe('production')
  })

  it('never throws for a config with no redactable fields', () => {
    expect(() => buildConfigDiagnostics(fakeConfig(), 'development')).not.toThrow()
  })
})

describe('formatConfigDiagnostics', () => {
  it('produces a human-readable multi-line report', () => {
    const text = formatConfigDiagnostics(buildConfigDiagnostics(fakeConfig(), 'production'))
    expect(text).toContain('profile: production')
    expect(text).toContain('port = 3000')
    expect(text).toContain('logFormat = json')
  })
})
