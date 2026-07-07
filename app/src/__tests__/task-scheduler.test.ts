import { describe, it, expect } from 'vitest'
import { validateTasks, buildWaves } from '../multiagent/application/taskScheduler.ts'
import type { WorkerTask } from '../multiagent/domain/multiAgentTypes.ts'

function task(id: string, dependsOn?: readonly string[]): WorkerTask {
  return { id, dependsOn, execute: async () => id }
}

describe('validateTasks', () => {
  it('accepts an empty batch', () => {
    expect(validateTasks([])).toEqual({ ok: true, value: undefined })
  })

  it('accepts independent tasks with no dependencies', () => {
    expect(validateTasks([task('a'), task('b')])).toEqual({ ok: true, value: undefined })
  })

  it('rejects duplicate task ids', () => {
    const result = validateTasks([task('a'), task('a')])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DUPLICATE_TASK')
  })

  it('rejects a dependency referencing a task outside the batch', () => {
    const result = validateTasks([task('a', ['missing'])])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('MISSING_DEPENDENCY')
  })

  it('rejects a two-node cycle', () => {
    const result = validateTasks([task('a', ['b']), task('b', ['a'])])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CIRCULAR_DEPENDENCY')
  })

  it('rejects a self-dependency', () => {
    const result = validateTasks([task('a', ['a'])])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CIRCULAR_DEPENDENCY')
  })

  it('accepts a valid diamond dependency graph', () => {
    const result = validateTasks([task('a'), task('b', ['a']), task('c', ['a']), task('d', ['b', 'c'])])
    expect(result).toEqual({ ok: true, value: undefined })
  })
})

describe('buildWaves', () => {
  it('returns an empty array for an empty batch', () => {
    expect(buildWaves([])).toEqual([])
  })

  it('groups independent tasks into a single wave', () => {
    const waves = buildWaves([task('a'), task('b'), task('c')])
    expect(waves).toHaveLength(1)
    expect(waves[0]!.map(t => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('groups a linear chain into sequential single-task waves', () => {
    const waves = buildWaves([task('a'), task('b', ['a']), task('c', ['b'])])
    expect(waves.map(w => w.map(t => t.id))).toEqual([['a'], ['b'], ['c']])
  })

  it('groups a diamond graph into three waves: [a], [b,c], [d]', () => {
    const waves = buildWaves([task('a'), task('b', ['a']), task('c', ['a']), task('d', ['b', 'c'])])
    expect(waves.map(w => w.map(t => t.id))).toEqual([['a'], ['b', 'c'], ['d']])
  })

  it('is deterministic: identical input produces identical wave grouping every time', () => {
    const tasks = [task('a'), task('b', ['a']), task('c', ['a']), task('d', ['b', 'c'])]
    const first = buildWaves(tasks).map(w => w.map(t => t.id))
    const second = buildWaves(tasks).map(w => w.map(t => t.id))
    expect(first).toEqual(second)
  })

  it('preserves original input order within a wave', () => {
    const waves = buildWaves([task('z'), task('a'), task('m')])
    expect(waves[0]!.map(t => t.id)).toEqual(['z', 'a', 'm'])
  })
})
