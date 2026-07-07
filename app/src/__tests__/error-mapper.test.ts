import { describe, it, expect } from 'vitest'
import { mapErrorToHttpResponse } from '../middleware/errorMapper.ts'

describe('mapErrorToHttpResponse — validation errors', () => {
  it('maps a Fastify validation error to 400 VALIDATION_ERROR', () => {
    const result = mapErrorToHttpResponse({ validation: [{ keyword: 'required' }], message: 'body must have required property' }, 'development')
    expect(result.statusCode).toBe(400)
    expect(result.body).toEqual({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'body must have required property' } })
  })
})

describe('mapErrorToHttpResponse — known status codes', () => {
  it('preserves a 4xx statusCode/code/message as-is', () => {
    const result = mapErrorToHttpResponse({ statusCode: 404, code: 'NOT_FOUND', message: 'no such route' }, 'development')
    expect(result).toEqual({ statusCode: 404, body: { ok: false, error: { code: 'NOT_FOUND', message: 'no such route' } } })
  })
})

describe('mapErrorToHttpResponse — unexpected/server errors', () => {
  it('defaults to 500 INTERNAL_ERROR for a plain thrown Error', () => {
    const result = mapErrorToHttpResponse(new Error('boom'), 'development')
    expect(result.statusCode).toBe(500)
    expect(result.body.error.code).toBe('INTERNAL_ERROR')
    expect(result.body.error.message).toBe('boom')
  })

  it('hides the real message behind a generic string in production for 5xx errors', () => {
    const result = mapErrorToHttpResponse(new Error('database password leaked in stack trace'), 'production')
    expect(result.statusCode).toBe(500)
    expect(result.body.error.message).toBe('An unexpected error occurred.')
  })

  it('still shows the real message for 4xx errors even in production', () => {
    const result = mapErrorToHttpResponse({ statusCode: 400, message: 'bad input' }, 'production')
    expect(result.body.error.message).toBe('bad input')
  })

  it('clamps an out-of-range statusCode to 500', () => {
    const result = mapErrorToHttpResponse({ statusCode: 999, message: 'weird' }, 'development')
    expect(result.statusCode).toBe(500)
  })

  it('never throws for null/undefined input', () => {
    expect(() => mapErrorToHttpResponse(undefined, 'development')).not.toThrow()
    expect(() => mapErrorToHttpResponse(null, 'development')).not.toThrow()
    expect(mapErrorToHttpResponse(undefined, 'development').statusCode).toBe(500)
  })
})
