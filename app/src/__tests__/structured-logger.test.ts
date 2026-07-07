import { describe, it, expect, vi } from 'vitest'
import { createStructuredLogger } from '../logging/structuredLogger.ts'

describe('createStructuredLogger — level filtering', () => {
  it('writes entries at or above the configured level', () => {
    const write = vi.fn()
    const logger = createStructuredLogger({ level: 'warn', format: 'json', write })
    logger.debug('should be filtered')
    logger.info('should be filtered')
    logger.warn('should appear')
    logger.error('should appear')
    expect(write).toHaveBeenCalledTimes(2)
  })
})

describe('createStructuredLogger — JSON format', () => {
  it('emits a single JSON line with timestamp/level/message/fields', () => {
    const write = vi.fn()
    const logger = createStructuredLogger({ level: 'debug', format: 'json', write })
    logger.info('hello', { requestId: 'r-1' })
    expect(write).toHaveBeenCalledTimes(1)
    const line = write.mock.calls[0]![0] as string
    const parsed = JSON.parse(line.trim())
    expect(parsed).toMatchObject({ level: 'info', message: 'hello', requestId: 'r-1' })
    expect(typeof parsed.timestamp).toBe('string')
  })
})

describe('createStructuredLogger — pretty format', () => {
  it('emits a human-readable line', () => {
    const write = vi.fn()
    const logger = createStructuredLogger({ level: 'debug', format: 'pretty', write })
    logger.error('boom', { code: 'X' })
    const line = write.mock.calls[0]![0] as string
    expect(line).toContain('ERROR:')
    expect(line).toContain('boom')
    expect(line).toContain('"code":"X"')
  })
})

describe('createStructuredLogger — child loggers', () => {
  it('merges child bindings into every subsequent entry', () => {
    const write = vi.fn()
    const logger = createStructuredLogger({ level: 'debug', format: 'json', write })
    const child = logger.child({ requestId: 'r-1', correlationId: 'c-1' })
    child.info('scoped message')
    const parsed = JSON.parse((write.mock.calls[0]![0] as string).trim())
    expect(parsed.requestId).toBe('r-1')
    expect(parsed.correlationId).toBe('c-1')
  })

  it('nested children accumulate bindings without mutating the parent', () => {
    const write = vi.fn()
    const logger = createStructuredLogger({ level: 'debug', format: 'json', write })
    const child = logger.child({ requestId: 'r-1' })
    const grandchild = child.child({ traceId: 't-1' })
    grandchild.info('deep')
    logger.info('root')

    const deepEntry = JSON.parse((write.mock.calls[0]![0] as string).trim())
    const rootEntry = JSON.parse((write.mock.calls[1]![0] as string).trim())
    expect(deepEntry).toMatchObject({ requestId: 'r-1', traceId: 't-1' })
    expect(rootEntry.requestId).toBeUndefined()
  })
})
