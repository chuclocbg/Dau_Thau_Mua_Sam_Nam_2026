import { describe, it, expect, vi } from 'vitest'
import * as appConfigModule from '../config/appConfig.ts'
import { validateEnvironment, formatEnvironmentReport } from '../config/environmentValidator.ts'

describe('validateEnvironment — parity: genuinely delegates to loadAppConfigFromEnv', () => {
  it('calls the real, unmodified loadAppConfigFromEnv rather than reimplementing parsing', () => {
    const spy = vi.spyOn(appConfigModule, 'loadAppConfigFromEnv')
    validateEnvironment({ NODE_ENV: 'production' })
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
})

describe('validateEnvironment — profile-aware success', () => {
  it('resolves the development profile and applies its defaults when NODE_ENV is unset', () => {
    const result = validateEnvironment({})
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.profile).toBe('development')
      expect(result.config.logLevel).toBe('debug')
      expect(result.config.logFormat).toBe('pretty')
    }
  })

  it('resolves the production profile and applies its defaults', () => {
    const result = validateEnvironment({ NODE_ENV: 'production' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.profile).toBe('production')
      expect(result.config.logLevel).toBe('info')
      expect(result.config.logFormat).toBe('json')
    }
  })

  it('an explicit LOG_LEVEL still overrides the profile default', () => {
    const result = validateEnvironment({ NODE_ENV: 'production', LOG_LEVEL: 'debug' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.config.logLevel).toBe('debug')
  })
})

describe('validateEnvironment — failure passthrough', () => {
  it('surfaces the real AppConfigError unchanged when validation fails', () => {
    const result = validateEnvironment({ PORT: 'not-a-number' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INVALID_PORT')
  })
})

describe('formatEnvironmentReport', () => {
  it('formats a success report including the profile and key config fields', () => {
    const result = validateEnvironment({ NODE_ENV: 'test' })
    const report = formatEnvironmentReport(result)
    expect(report).toContain('OK')
    expect(report).toContain('profile: test')
  })

  it('formats a failure report including the error code', () => {
    const result = validateEnvironment({ PORT: '-1' })
    const report = formatEnvironmentReport(result)
    expect(report).toContain('FAILED')
    expect(report).toContain('INVALID_PORT')
  })
})
