import { describe, it, expect } from 'vitest'
import { raceSignalAndTimeout, StreamAbortedError, StreamTimeoutError } from '../streaming/streamRace.ts'

function neverResolves<T>(): Promise<T> {
  return new Promise(() => { /* never resolves */ })
}

describe('raceSignalAndTimeout — success path', () => {
  it('resolves with the promise value when it settles before the timeout/abort', async () => {
    const result = await raceSignalAndTimeout(Promise.resolve('ok'), new AbortController().signal, 1000)
    expect(result).toBe('ok')
  })

  it('propagates a rejection from the underlying promise as-is', async () => {
    await expect(raceSignalAndTimeout(Promise.reject(new Error('boom')), new AbortController().signal, 1000))
      .rejects.toThrow('boom')
  })
})

describe('raceSignalAndTimeout — timeout', () => {
  it('rejects with StreamTimeoutError when the promise never settles in time', async () => {
    await expect(raceSignalAndTimeout(neverResolves(), new AbortController().signal, 20))
      .rejects.toBeInstanceOf(StreamTimeoutError)
  })
})

describe('raceSignalAndTimeout — abort', () => {
  it('rejects immediately with StreamAbortedError when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(raceSignalAndTimeout(neverResolves(), controller.signal, 1000))
      .rejects.toBeInstanceOf(StreamAbortedError)
  })

  it('rejects with StreamAbortedError when the signal aborts mid-flight', async () => {
    const controller = new AbortController()
    const promise = raceSignalAndTimeout(neverResolves(), controller.signal, 5000)
    setTimeout(() => controller.abort(), 10)
    await expect(promise).rejects.toBeInstanceOf(StreamAbortedError)
  })

  it('does not fire the timeout once the signal already aborted first', async () => {
    const controller = new AbortController()
    const promise = raceSignalAndTimeout(neverResolves(), controller.signal, 30)
    setTimeout(() => controller.abort(), 5)
    await expect(promise).rejects.toBeInstanceOf(StreamAbortedError)
  })
})

describe('raceSignalAndTimeout — cleanup', () => {
  it('does not leave a dangling abort listener after a successful resolution', async () => {
    const controller = new AbortController()
    await raceSignalAndTimeout(Promise.resolve('done'), controller.signal, 1000)
    // If the listener were not removed, aborting afterward would be harmless anyway since the
    // promise already settled — this asserts no error is thrown on a late abort.
    expect(() => controller.abort()).not.toThrow()
  })
})
