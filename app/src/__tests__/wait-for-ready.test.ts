import { describe, it, expect, vi } from 'vitest'
import { waitForReady } from '../startup/waitForReady.ts'
import { RetryPolicy } from '../providers/RetryPolicy.ts'

function fakeResponse(status: number): Response {
  return { ok: status >= 200 && status < 300, status } as Response
}

describe('waitForReady — success path', () => {
  it('resolves ready:true on the first successful fetch', async () => {
    const fetchFn = vi.fn().mockResolvedValue(fakeResponse(200))
    const result = await waitForReady('http://x/ready', { fetchFn })
    expect(result).toEqual({ ready: true, attempts: 1, lastStatus: 200 })
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('retries until success within the retry budget', async () => {
    let calls = 0
    const fetchFn = vi.fn(async () => { calls++; return fakeResponse(calls < 3 ? 503 : 200) })
    const result = await waitForReady('http://x/ready', { fetchFn, retry: { maxAttempts: 5, retryDelayMs: 0 } })
    expect(result.ready).toBe(true)
    expect(result.attempts).toBe(3)
    expect(calls).toBe(3)
  })
})

describe('waitForReady — exhausted retry budget', () => {
  it('reports ready:false with the last status after exhausting all attempts', async () => {
    const fetchFn = vi.fn().mockResolvedValue(fakeResponse(503))
    const result = await waitForReady('http://x/ready', { fetchFn, retry: { maxAttempts: 3, retryDelayMs: 0 } })
    expect(result).toEqual({ ready: false, attempts: 3, lastStatus: 503 })
    expect(fetchFn).toHaveBeenCalledTimes(3)
  })

  it('reports the last network error when every attempt throws', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    const result = await waitForReady('http://x/ready', { fetchFn, retry: { maxAttempts: 2, retryDelayMs: 0 } })
    expect(result.ready).toBe(false)
    expect(result.attempts).toBe(2)
    expect(result.lastError).toContain('ECONNREFUSED')
  })
})

describe('waitForReady — genuine RetryPolicy reuse (parity)', () => {
  it('delegates backoff timing to RetryPolicy.prototype.sleep(), not a reimplemented loop', async () => {
    const sleepSpy = vi.spyOn(RetryPolicy.prototype, 'sleep')
    const fetchFn = vi.fn().mockResolvedValue(fakeResponse(503))
    await waitForReady('http://x/ready', { fetchFn, retry: { maxAttempts: 3, retryDelayMs: 0 } })
    expect(sleepSpy).toHaveBeenCalledTimes(2)
    expect(sleepSpy).toHaveBeenNthCalledWith(1, 0)
    expect(sleepSpy).toHaveBeenNthCalledWith(2, 1)
    sleepSpy.mockRestore()
  })
})
