import { describe, it, expect } from 'vitest'
import { generateRequestId, resolveCorrelationId, CORRELATION_ID_HEADER } from '../logging/requestContext.ts'

describe('generateRequestId', () => {
  it('generates a unique id on every call', () => {
    const a = generateRequestId()
    const b = generateRequestId()
    expect(a).not.toBe(b)
    expect(typeof a).toBe('string')
  })
})

describe('resolveCorrelationId', () => {
  it('honors an existing x-correlation-id header', () => {
    const id = resolveCorrelationId({ [CORRELATION_ID_HEADER]: 'caller-supplied-id' })
    expect(id).toBe('caller-supplied-id')
  })

  it('takes the first value when the header is an array', () => {
    const id = resolveCorrelationId({ [CORRELATION_ID_HEADER]: ['first', 'second'] })
    expect(id).toBe('first')
  })

  it('generates a new id when the header is absent', () => {
    const id = resolveCorrelationId({})
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('generates a new id when the header is blank', () => {
    const id = resolveCorrelationId({ [CORRELATION_ID_HEADER]: '   ' })
    expect(id.trim().length).toBeGreaterThan(0)
  })
})
