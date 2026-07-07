import { describe, it, expect, vi } from 'vitest'
import { createShutdownHandler } from '../startup/gracefulShutdown.ts'

describe('createShutdownHandler', () => {
  it('closes the server, runs onShutdown, then exits 0', async () => {
    const close = vi.fn().mockResolvedValue(undefined)
    const onShutdown = vi.fn().mockResolvedValue(undefined)
    const exit = vi.fn()
    const handler = createShutdownHandler({ server: { close }, onShutdown, timeoutMs: 1000, exit })

    await handler('SIGTERM')

    expect(close).toHaveBeenCalledTimes(1)
    expect(onShutdown).toHaveBeenCalledTimes(1)
    expect(exit).toHaveBeenCalledWith(0)
  })

  it('exits 1 when server.close() rejects', async () => {
    const close = vi.fn().mockRejectedValue(new Error('boom'))
    const exit = vi.fn()
    const handler = createShutdownHandler({ server: { close }, timeoutMs: 1000, exit })

    await handler('SIGINT')

    expect(exit).toHaveBeenCalledWith(1)
  })

  it('ignores a second concurrent shutdown signal', async () => {
    const close = vi.fn().mockResolvedValue(undefined)
    const exit = vi.fn()
    const handler = createShutdownHandler({ server: { close }, timeoutMs: 1000, exit })

    await Promise.all([handler('SIGTERM'), handler('SIGTERM')])

    expect(close).toHaveBeenCalledTimes(1)
    expect(exit).toHaveBeenCalledTimes(1)
  })

  it('force-exits with code 1 if close() hangs past timeoutMs', async () => {
    vi.useFakeTimers()
    const close = vi.fn(() => new Promise(() => { /* never resolves */ }))
    const exit = vi.fn()
    const handler = createShutdownHandler({ server: { close }, timeoutMs: 50, exit })

    const promise = handler('SIGTERM')
    await vi.advanceTimersByTimeAsync(60)
    await promise

    expect(exit).toHaveBeenCalledWith(1)
    vi.useRealTimers()
  })

  it('works without an onShutdown callback', async () => {
    const close = vi.fn().mockResolvedValue(undefined)
    const exit = vi.fn()
    const handler = createShutdownHandler({ server: { close }, timeoutMs: 1000, exit })

    await handler('SIGTERM')
    expect(exit).toHaveBeenCalledWith(0)
  })
})
