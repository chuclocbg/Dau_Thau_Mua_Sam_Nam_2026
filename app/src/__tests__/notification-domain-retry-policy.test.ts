import { describe, it, expect } from 'vitest'
import { shouldRetry, computeNextRetryDelay, computeNextRetryAt } from '../notification/domain/retryPolicy.ts'
import { DEFAULT_RETRY_POLICY } from '../notification/types/notificationTypes.ts'
import type { RetryPolicy } from '../notification/types/notificationTypes.ts'

const policy: RetryPolicy = { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 10_000, backoffMultiplier: 2 }

describe('shouldRetry', () => {
  it('allows retry below maxAttempts', () => {
    expect(shouldRetry(1, policy)).toBe(true)
    expect(shouldRetry(2, policy)).toBe(true)
  })

  it('disallows retry at or above maxAttempts', () => {
    expect(shouldRetry(3, policy)).toBe(false)
    expect(shouldRetry(4, policy)).toBe(false)
  })

  it('uses DEFAULT_RETRY_POLICY.maxAttempts of 5', () => {
    expect(shouldRetry(5, DEFAULT_RETRY_POLICY)).toBe(false)
    expect(shouldRetry(4, DEFAULT_RETRY_POLICY)).toBe(true)
  })
})

describe('computeNextRetryDelay', () => {
  it('computes exponential backoff for attempt 1', () => {
    expect(computeNextRetryDelay(1, policy)).toBe(1000)
  })

  it('computes exponential backoff for attempt 2', () => {
    expect(computeNextRetryDelay(2, policy)).toBe(2000)
  })

  it('computes exponential backoff for attempt 3', () => {
    expect(computeNextRetryDelay(3, policy)).toBe(4000)
  })

  it('caps delay at maxDelayMs', () => {
    expect(computeNextRetryDelay(10, policy)).toBe(10_000)
  })

  it('handles attempt 0 as base delay', () => {
    expect(computeNextRetryDelay(0, policy)).toBe(1000)
  })
})

describe('computeNextRetryAt', () => {
  it('adds the computed delay to the given time', () => {
    const next = computeNextRetryAt('2026-01-01T00:00:00.000Z', 1, policy)
    expect(next).toBe('2026-01-01T00:00:01.000Z')
  })

  it('reflects larger delay for later attempts', () => {
    const next = computeNextRetryAt('2026-01-01T00:00:00.000Z', 2, policy)
    expect(next).toBe('2026-01-01T00:00:02.000Z')
  })
})
