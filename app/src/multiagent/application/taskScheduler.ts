import type { CoordinatorResult, WorkerTask } from '../domain/multiAgentTypes.ts'

// ── Task Scheduler — Phase X.8 ─────────────────────────────────────────────────
// Pure, deterministic task-decomposition support: validation (duplicate ids, missing
// dependencies, cycles) and topological wave grouping (Kahn's BFS). No I/O, no task
// execution, no reasoning-layer knowledge whatsoever — CoordinatorAgent is the only caller.
// Wave order is stable: within a wave, tasks appear in their original input order, and waves
// are produced in dependency order, so identical input always yields identical wave grouping —
// required for CoordinatorAgent's own deterministic-replay guarantee.

export function validateTasks(tasks: readonly WorkerTask[]): CoordinatorResult<void> {
  const ids = new Set<string>()
  for (const task of tasks) {
    if (ids.has(task.id)) {
      return { ok: false, error: { code: 'DUPLICATE_TASK', message: `Task id '${task.id}' appears more than once in the batch.` } }
    }
    ids.add(task.id)
  }
  for (const task of tasks) {
    for (const dep of task.dependsOn ?? []) {
      if (!ids.has(dep)) {
        return { ok: false, error: { code: 'MISSING_DEPENDENCY', message: `Task '${task.id}' depends on '${dep}', which is not in the batch.` } }
      }
    }
  }
  const cycle = findCycle(tasks)
  if (cycle !== null) {
    return { ok: false, error: { code: 'CIRCULAR_DEPENDENCY', message: `Circular dependency detected: ${cycle}.` } }
  }
  return { ok: true, value: undefined }
}

export function buildWaves(tasks: readonly WorkerTask[]): WorkerTask[][] {
  if (tasks.length === 0) return []

  const byId = new Map<string, WorkerTask>()
  const inDegree = new Map<string, number>()
  const dependents = new Map<string, string[]>()

  for (const task of tasks) {
    byId.set(task.id, task)
    inDegree.set(task.id, (task.dependsOn ?? []).length)
    dependents.set(task.id, [])
  }
  for (const task of tasks) {
    for (const dep of task.dependsOn ?? []) {
      dependents.get(dep)!.push(task.id)
    }
  }

  const waves: WorkerTask[][] = []
  let current = tasks.filter(task => (inDegree.get(task.id) ?? 0) === 0)

  while (current.length > 0) {
    waves.push([...current])
    const next: WorkerTask[] = []
    for (const task of current) {
      for (const dependentId of dependents.get(task.id) ?? []) {
        const newDegree = (inDegree.get(dependentId) ?? 1) - 1
        inDegree.set(dependentId, newDegree)
        if (newDegree === 0) next.push(byId.get(dependentId)!)
      }
    }
    current = next
  }
  return waves
}

function findCycle(tasks: readonly WorkerTask[]): string | null {
  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = new Map<string, number>()
  const deps = new Map<string, readonly string[]>()

  for (const task of tasks) {
    color.set(task.id, WHITE)
    deps.set(task.id, task.dependsOn ?? [])
  }

  const dfs = (id: string, path: string[]): string | null => {
    color.set(id, GRAY)
    for (const dep of deps.get(id) ?? []) {
      if (color.get(dep) === GRAY) {
        const idx = path.indexOf(dep)
        return (idx >= 0 ? path.slice(idx) : path).concat(dep).join(' -> ')
      }
      if (color.get(dep) === WHITE) {
        const found = dfs(dep, [...path, dep])
        if (found !== null) return found
      }
    }
    color.set(id, BLACK)
    return null
  }

  for (const task of tasks) {
    if (color.get(task.id) === WHITE) {
      const found = dfs(task.id, [task.id])
      if (found !== null) return found
    }
  }
  return null
}
