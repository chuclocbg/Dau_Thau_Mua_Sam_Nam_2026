import { describe, it, expect } from 'vitest'
import { resolveProfile, applyProfileDefaults } from '../config/configProfiles.ts'

describe('resolveProfile', () => {
  it('maps NODE_ENV=production to the production profile', () => {
    expect(resolveProfile('production')).toBe('production')
  })

  it('maps NODE_ENV=test to the test profile', () => {
    expect(resolveProfile('test')).toBe('test')
  })

  it('defaults to development for undefined, empty, or unrecognized values', () => {
    expect(resolveProfile(undefined)).toBe('development')
    expect(resolveProfile('')).toBe('development')
    expect(resolveProfile('staging')).toBe('development')
  })
})

describe('applyProfileDefaults', () => {
  it('fills in LOG_LEVEL/LOG_FORMAT for the development profile when unset', () => {
    const result = applyProfileDefaults('development', {})
    expect(result['LOG_LEVEL']).toBe('debug')
    expect(result['LOG_FORMAT']).toBe('pretty')
  })

  it('fills in different defaults for the production profile', () => {
    const result = applyProfileDefaults('production', {})
    expect(result['LOG_LEVEL']).toBe('info')
    expect(result['LOG_FORMAT']).toBe('json')
  })

  it('never overrides an explicitly-set env var', () => {
    const result = applyProfileDefaults('production', { LOG_LEVEL: 'debug' })
    expect(result['LOG_LEVEL']).toBe('debug')
  })

  it('treats a blank explicit value the same as unset', () => {
    const result = applyProfileDefaults('development', { LOG_LEVEL: '   ' })
    expect(result['LOG_LEVEL']).toBe('debug')
  })

  it('preserves every other env var untouched', () => {
    const result = applyProfileDefaults('production', { PORT: '4000' })
    expect(result['PORT']).toBe('4000')
  })
})
