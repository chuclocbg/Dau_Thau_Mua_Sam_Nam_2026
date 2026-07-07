import { describe, it, expect, vi } from 'vitest'
import { CoordinatorAgent } from '../multiagent/application/coordinatorAgent.ts'
import { RetryPolicy } from '../providers/RetryPolicy.ts'
import type { WorkerTask } from '../multiagent/domain/multiAgentTypes.ts'

function task(id: string, execute: WorkerTask['execute'], dependsOn?: readonly string[]): WorkerTask {
  return { id, dependsOn, execute }
}

describe('CoordinatorAgent — task decomposition validation', () => {
  it('rejects the whole run when validation fails, without executing anything', async () => {
    let executed = false
    const coordinator = new CoordinatorAgent()
    const result = await coordinator.run([
      task('a', async () => { executed = true; return 'x' }, ['missing']),
    ])
    expect(result.ok).toBe(false)
    expect(executed).toBe(false)
  })
})

describe('CoordinatorAgent — parallel scheduling and result aggregation', () => {
  it('runs independent tasks and aggregates all outcomes as COMPLETED', async () => {
    const coordinator = new CoordinatorAgent()
    const result = await coordinator.run([
      task('a', async () => 1),
      task('b', async () => 2),
      task('c', async () => 3),
    ])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.status).toBe('COMPLETED')
      expect(result.value.outcomes).toHaveLength(3)
      expect(result.value.outcomes.every(o => o.status === 'COMPLETED')).toBe(true)
      expect(result.value.outcomes.map(o => o.value).sort()).toEqual([1, 2, 3])
    }
  })

  it('runs independent tasks genuinely concurrently (same wave overlaps in time)', async () => {
    const order: string[] = []
    const coordinator = new CoordinatorAgent()
    await coordinator.run([
      task('a', async () => { order.push('a-start'); await new Promise(r => setTimeout(r, 20)); order.push('a-end'); return 'a' }),
      task('b', async () => { order.push('b-start'); await new Promise(r => setTimeout(r, 5)); order.push('b-end'); return 'b' }),
    ])
    expect(order.indexOf('b-end')).toBeLessThan(order.indexOf('a-end'))
    expect(order.indexOf('b-start')).toBeLessThan(order.indexOf('a-end'))
  })
})

describe('CoordinatorAgent — dependency tracking', () => {
  it('passes a dependency\'s completed value to the dependent task', async () => {
    const coordinator = new CoordinatorAgent()
    const result = await coordinator.run([
      task('a', async () => 10),
      task('b', async (deps) => (deps.get('a') as number) + 1, ['a']),
    ])
    expect(result.ok).toBe(true)
    if (result.ok) {
      const b = result.value.outcomes.find(o => o.taskId === 'b')!
      expect(b.value).toBe(11)
    }
  })

  it('schedules a diamond graph in the correct wave order', async () => {
    const startOrder: string[] = []
    const coordinator = new CoordinatorAgent()
    await coordinator.run([
      task('a', async () => { startOrder.push('a'); return 'a' }),
      task('b', async () => { startOrder.push('b'); return 'b' }, ['a']),
      task('c', async () => { startOrder.push('c'); return 'c' }, ['a']),
      task('d', async () => { startOrder.push('d'); return 'd' }, ['b', 'c']),
    ])
    expect(startOrder[0]).toBe('a')
    expect(startOrder[3]).toBe('d')
    expect(new Set(startOrder.slice(1, 3))).toEqual(new Set(['b', 'c']))
  })
})

describe('CoordinatorAgent — failure handling (fail-fast)', () => {
  it('marks the run FAILED and does not schedule later waves after a failure', async () => {
    let dExecuted = false
    const coordinator = new CoordinatorAgent()
    const result = await coordinator.run([
      task('a', async () => { throw new Error('boom') }),
      task('b', async () => { dExecuted = true; return 'b' }, ['a']),
    ], { retry: { maxAttempts: 1 } })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.status).toBe('FAILED')
      expect(result.value.outcomes.find(o => o.taskId === 'a')!.status).toBe('FAILED')
    }
    expect(dExecuted).toBe(false)
  })
})

describe('CoordinatorAgent — timeout handling', () => {
  it('marks a hanging task FAILED via taskTimeoutMs', async () => {
    const coordinator = new CoordinatorAgent()
    const result = await coordinator.run([
      task('slow', () => new Promise(() => { /* never resolves */ })),
    ], { taskTimeoutMs: 10, retry: { maxAttempts: 1 } })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.outcomes[0]!.status).toBe('FAILED')
      expect(result.value.outcomes[0]!.errorMessage).toMatch(/timeout/i)
    }
  })
})

describe('CoordinatorAgent — cancellation', () => {
  it('marks all tasks CANCELLED when the signal is already aborted before run()', async () => {
    const controller = new AbortController()
    controller.abort()
    const coordinator = new CoordinatorAgent()
    const result = await coordinator.run([task('a', async () => 'a')], { signal: controller.signal })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.status).toBe('CANCELLED')
  })

  it('stops scheduling further waves once the signal aborts mid-run', async () => {
    const controller = new AbortController()
    let bExecuted = false
    const coordinator = new CoordinatorAgent()
    const result = await coordinator.run([
      task('a', async () => { controller.abort(); return 'a' }),
      task('b', async () => { bExecuted = true; return 'b' }, ['a']),
    ], { signal: controller.signal })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.status).toBe('CANCELLED')
    expect(bExecuted).toBe(false)
  })
})

describe('CoordinatorAgent — retry orchestration', () => {
  it('retries a failing task up to maxAttempts, then marks it FAILED', async () => {
    let calls = 0
    const coordinator = new CoordinatorAgent()
    const result = await coordinator.run([
      task('flaky', async () => { calls++; throw new Error('boom') }),
    ], { retry: { maxAttempts: 3, retryDelayMs: 0 } })
    expect(calls).toBe(3)
    if (result.ok) expect(result.value.outcomes[0]!.status).toBe('FAILED')
  })

  it('stops retrying as soon as the task succeeds', async () => {
    let calls = 0
    const coordinator = new CoordinatorAgent()
    const result = await coordinator.run([
      task('flaky', async () => { calls++; if (calls < 2) throw new Error('boom'); return 'ok' }),
    ], { retry: { maxAttempts: 5, retryDelayMs: 0 } })
    expect(calls).toBe(2)
    if (result.ok) {
      expect(result.value.outcomes[0]!.status).toBe('COMPLETED')
      expect(result.value.outcomes[0]!.attempts).toBe(2)
    }
  })

  it('delegates backoff timing to RetryPolicy.prototype.sleep() (not reimplemented)', async () => {
    const sleepSpy = vi.spyOn(RetryPolicy.prototype, 'sleep')
    const coordinator = new CoordinatorAgent()
    await coordinator.run([
      task('flaky', async () => { throw new Error('boom') }),
    ], { retry: { maxAttempts: 3, retryDelayMs: 0 } })
    expect(sleepSpy).toHaveBeenCalledTimes(2)
    expect(sleepSpy).toHaveBeenNthCalledWith(1, 0)
    expect(sleepSpy).toHaveBeenNthCalledWith(2, 1)
    sleepSpy.mockRestore()
  })
})

describe('CoordinatorAgent — deterministic replay', () => {
  it('running the same task batch twice produces identical outcomes (aside from runId/timestamps)', async () => {
    const coordinator = new CoordinatorAgent()
    const build = (): WorkerTask[] => [
      { id: 'a', execute: async () => 1 },
      { id: 'b', dependsOn: ['a'], execute: async (deps) => (deps.get('a') as number) * 2 },
    ]
    const first = await coordinator.run(build())
    const second = await coordinator.run(build())
    expect(first.ok && second.ok).toBe(true)
    if (first.ok && second.ok) {
      expect(first.value.status).toBe(second.value.status)
      expect(first.value.outcomes.map(o => ({ taskId: o.taskId, status: o.status, value: o.value, attempts: o.attempts })))
        .toEqual(second.value.outcomes.map(o => ({ taskId: o.taskId, status: o.status, value: o.value, attempts: o.attempts })))
    }
  })
})
