import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { SSEWriter } from '../streaming/sseWriter.ts'

// A minimal fake ServerResponse: an EventEmitter with write()/end()/writableEnded, enough to
// exercise SSEWriter's real framing/backpressure/close logic without a real socket.
function fakeResponse(overrides: { writeReturns?: boolean } = {}) {
  const emitter = new EventEmitter() as EventEmitter & {
    write: (chunk: string) => boolean
    end: (cb?: () => void) => void
    writableEnded: boolean
  }
  emitter.writableEnded = false
  emitter.write = vi.fn((_chunk: string) => overrides.writeReturns ?? true)
  emitter.end = vi.fn((cb?: () => void) => { emitter.writableEnded = true; cb?.() })
  return emitter
}

describe('SSEWriter — event framing', () => {
  it('writes a well-formed SSE frame with event/data/blank-line terminator', async () => {
    const res = fakeResponse()
    const writer = new SSEWriter(res as never)
    await writer.writeEvent({ event: 'stage', data: { stage: 'reasoning', status: 'started' } })
    expect(res.write).toHaveBeenCalledTimes(1)
    const frame = (res.write as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string
    expect(frame).toContain('event: stage\n')
    expect(frame).toContain('data: {"stage":"reasoning","status":"started"}')
    expect(frame.endsWith('\n\n')).toBe(true)
  })

  it('includes an id line when the event carries one', async () => {
    const res = fakeResponse()
    const writer = new SSEWriter(res as never)
    await writer.writeEvent({ event: 'result', data: {}, id: '42' })
    const frame = (res.write as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string
    expect(frame).toContain('id: 42\n')
  })

  it('escapes newlines within JSON string values rather than breaking SSE framing (JSON.stringify never emits a raw newline)', async () => {
    const res = fakeResponse()
    const writer = new SSEWriter(res as never)
    await writer.writeEvent({ event: 'result', data: { markdown: 'line1\nline2' } })
    const frame = (res.write as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string
    const dataLines = frame.split('\n').filter(l => l.startsWith('data: '))
    expect(dataLines).toHaveLength(1)
    expect(dataLines[0]).toContain('line1\\nline2')
  })
})

describe('SSEWriter — backpressure', () => {
  it('waits for the drain event when write() returns false', async () => {
    const res = fakeResponse({ writeReturns: false })
    const writer = new SSEWriter(res as never)
    let resolved = false
    const promise = writer.writeEvent({ event: 'stage', data: {} }).then(() => { resolved = true })
    await new Promise(r => setTimeout(r, 10))
    expect(resolved).toBe(false)
    res.emit('drain')
    await promise
    expect(resolved).toBe(true)
  })
})

describe('SSEWriter — closed detection and graceful termination', () => {
  it('reports closed after the underlying response emits close', async () => {
    const res = fakeResponse()
    const writer = new SSEWriter(res as never)
    expect(writer.closed).toBe(false)
    res.emit('close')
    expect(writer.closed).toBe(true)
  })

  it('stops writing once closed (no-op, never throws)', async () => {
    const res = fakeResponse()
    const writer = new SSEWriter(res as never)
    res.emit('close')
    await expect(writer.writeEvent({ event: 'x', data: {} })).resolves.toBeUndefined()
    expect(res.write).not.toHaveBeenCalled()
  })

  it('close() calls end() exactly once, even when called twice', async () => {
    const res = fakeResponse()
    const writer = new SSEWriter(res as never)
    await writer.close()
    await writer.close()
    expect(res.end).toHaveBeenCalledTimes(1)
  })

  it('reports closed as true after close()', async () => {
    const res = fakeResponse()
    const writer = new SSEWriter(res as never)
    await writer.close()
    expect(writer.closed).toBe(true)
  })
})
