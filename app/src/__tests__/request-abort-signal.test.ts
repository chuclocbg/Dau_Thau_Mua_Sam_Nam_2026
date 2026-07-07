import { describe, it, expect } from 'vitest'
import { EventEmitter } from 'node:events'
import { createAbortSignalForResponse } from '../cancellation/requestAbortSignal.ts'

function fakeResponse(): EventEmitter & { writableEnded: boolean } {
  const emitter = new EventEmitter() as EventEmitter & { writableEnded: boolean }
  emitter.writableEnded = false
  return emitter
}

describe('createAbortSignalForResponse — client disconnect detection', () => {
  it('aborts when the response closes before writableEnded (premature disconnect)', () => {
    const res = fakeResponse()
    const signal = createAbortSignalForResponse(res as never)
    expect(signal.aborted).toBe(false)
    res.emit('close')
    expect(signal.aborted).toBe(true)
  })

  it('does NOT abort when the response closes after writableEnded (normal completion)', () => {
    const res = fakeResponse()
    const signal = createAbortSignalForResponse(res as never)
    res.writableEnded = true
    res.emit('close')
    expect(signal.aborted).toBe(false)
  })

  it('returns an already-aborted-safe signal when the response is already ended', () => {
    const res = fakeResponse()
    res.writableEnded = true
    const signal = createAbortSignalForResponse(res as never)
    res.emit('close')
    expect(signal.aborted).toBe(false)
  })

  it('is idempotent — multiple close events do not throw or double-abort', () => {
    const res = fakeResponse()
    const signal = createAbortSignalForResponse(res as never)
    res.emit('close')
    expect(() => res.emit('close')).not.toThrow()
    expect(signal.aborted).toBe(true)
  })
})
