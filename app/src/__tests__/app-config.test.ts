import { describe, it, expect } from 'vitest'
import { loadAppConfigFromEnv } from '../config/appConfig.ts'

describe('loadAppConfigFromEnv — defaults', () => {
  it('returns sane defaults when no env vars are set', () => {
    const result = loadAppConfigFromEnv({})
    expect(result).toEqual({
      ok: true,
      value: {
        port: 3000, host: '0.0.0.0', nodeEnv: 'development', logLevel: 'info', logFormat: 'json',
        shutdownTimeoutMs: 10_000, streamTimeoutMs: 30_000,
      },
    })
  })
})

describe('loadAppConfigFromEnv — overrides', () => {
  it('reads PORT/HOST/NODE_ENV/LOG_LEVEL/LOG_FORMAT/SHUTDOWN_TIMEOUT_MS/STREAM_TIMEOUT_MS from the given env map', () => {
    const result = loadAppConfigFromEnv({
      PORT: '8080', HOST: '127.0.0.1', NODE_ENV: 'production', LOG_LEVEL: 'debug', LOG_FORMAT: 'pretty',
      SHUTDOWN_TIMEOUT_MS: '5000', STREAM_TIMEOUT_MS: '15000',
    })
    expect(result).toEqual({
      ok: true,
      value: {
        port: 8080, host: '127.0.0.1', nodeEnv: 'production', logLevel: 'debug', logFormat: 'pretty',
        shutdownTimeoutMs: 5000, streamTimeoutMs: 15_000,
      },
    })
  })
})

describe('loadAppConfigFromEnv — validation', () => {
  it('rejects a non-numeric PORT', () => {
    const result = loadAppConfigFromEnv({ PORT: 'not-a-number' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INVALID_PORT')
  })

  it('rejects PORT out of range', () => {
    expect(loadAppConfigFromEnv({ PORT: '0' }).ok).toBe(false)
    expect(loadAppConfigFromEnv({ PORT: '70000' }).ok).toBe(false)
  })

  it('rejects an invalid NODE_ENV', () => {
    const result = loadAppConfigFromEnv({ NODE_ENV: 'staging' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INVALID_NODE_ENV')
  })

  it('rejects an invalid LOG_LEVEL', () => {
    const result = loadAppConfigFromEnv({ LOG_LEVEL: 'trace' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INVALID_LOG_LEVEL')
  })

  it('rejects an invalid LOG_FORMAT', () => {
    const result = loadAppConfigFromEnv({ LOG_FORMAT: 'xml' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INVALID_LOG_FORMAT')
  })

  it('rejects a non-positive SHUTDOWN_TIMEOUT_MS', () => {
    const result = loadAppConfigFromEnv({ SHUTDOWN_TIMEOUT_MS: '-1' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INVALID_SHUTDOWN_TIMEOUT')
  })

  it('rejects a non-positive STREAM_TIMEOUT_MS', () => {
    const result = loadAppConfigFromEnv({ STREAM_TIMEOUT_MS: '0' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INVALID_STREAM_TIMEOUT')
  })

  it('never throws for a garbage env map', () => {
    expect(() => loadAppConfigFromEnv({ PORT: '💥', NODE_ENV: '', LOG_LEVEL: undefined })).not.toThrow()
  })
})
