import { RetryPolicy } from '../../providers/RetryPolicy.ts'
import { validateTasks, buildWaves } from './taskScheduler.ts'
import type {
  CoordinationRun, CoordinatorOptions, CoordinatorResult, WorkerOutcome, WorkerTask,
} from '../domain/multiAgentTypes.ts'

// ── Coordinator Agent — Phase X.8 ──────────────────────────────────────────────
// Task decomposition (accepts an already-decomposed WorkerTask[] — decomposition itself is the
// caller's concern, e.g. reasoningWorkerAdapter.ts turning N questions into N WorkerTasks),
// parallel scheduling, dependency tracking, result aggregation, timeout handling, cancellation,
// retry orchestration, and per-task lifecycle status. Nothing else: this file has ZERO
// knowledge of reasoning, retrieval, Tool Calling, MCP, or formatting — every WorkerTask is an
// opaque async callback. Reuses RetryPolicy's constructor + .sleep() directly (never
// reimplemented) for uniform per-task retry, since a WorkerTask is a black box to the
// coordinator — there is no per-task error-code vocabulary to classify against, unlike
// ToolExecutor/MCPClient's own domains, so every failure is uniformly retryable up to
// maxAttempts.
//
// Fail-fast semantics: a task failure aborts scheduling of any wave not yet started (mirrors
// the same choice already made by the pre-existing, unrelated MultiAgentCoordinator.ts, applied
// here to a fundamentally different, LLM-free execution model). Tasks already dispatched in the
// same wave as a failure are allowed to finish; their own outcomes are recorded regardless.
//
// Cancellation uses the native platform AbortSignal — not a new repo-specific abstraction.

class CoordinatorTimeoutError extends Error {
  constructor() { super('COORDINATOR_TASK_TIMEOUT') }
}

async function raceTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timerId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => reject(new CoordinatorTimeoutError()), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    clearTimeout(timerId)
  }
}

function isAborted(signal: AbortSignal | undefined): boolean {
  return signal !== undefined && signal.aborted
}

function generateRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export class CoordinatorAgent {
  async run(tasks: readonly WorkerTask[], options: CoordinatorOptions = {}): Promise<CoordinatorResult<CoordinationRun>> {
    const validation = validateTasks(tasks)
    if (!validation.ok) return validation

    const startedAt = new Date().toISOString()
    const dependencyResults = new Map<string, unknown>()
    const outcomes: WorkerOutcome[] = []
    const waves = buildWaves(tasks)
    let cancelled = false

    const signal = options.signal
    for (const wave of waves) {
      if (isAborted(signal)) { cancelled = true; break }

      const waveOutcomes = await Promise.all(
        wave.map(task => this.runTaskWithPolicy(task, dependencyResults, options)),
      )
      for (const outcome of waveOutcomes) {
        outcomes.push(outcome)
        if (outcome.status === 'COMPLETED') dependencyResults.set(outcome.taskId, outcome.value)
      }

      if (waveOutcomes.some(o => o.status === 'CANCELLED')) { cancelled = true; break }
      if (waveOutcomes.some(o => o.status === 'FAILED')) break
      if (isAborted(signal)) { cancelled = true; break }
    }

    const anyFailed = outcomes.some(o => o.status === 'FAILED')
    const status: CoordinationRun['status'] = cancelled ? 'CANCELLED' : anyFailed ? 'FAILED' : 'COMPLETED'

    return {
      ok: true,
      value: {
        runId: generateRunId(),
        status,
        outcomes,
        startedAt,
        completedAt: new Date().toISOString(),
      },
    }
  }

  private async runTaskWithPolicy(
    task: WorkerTask, dependencyResults: ReadonlyMap<string, unknown>, options: CoordinatorOptions,
  ): Promise<WorkerOutcome> {
    const start = Date.now()
    const signal = options.signal
    if (isAborted(signal)) {
      return { taskId: task.id, status: 'CANCELLED', attempts: 0, durationMs: Date.now() - start }
    }

    const policy = new RetryPolicy(options.retry)
    let lastErrorMessage: string | undefined

    for (let attempt = 0; attempt < policy.maxAttempts; attempt++) {
      if (isAborted(signal)) {
        return { taskId: task.id, status: 'CANCELLED', attempts: attempt, durationMs: Date.now() - start }
      }
      try {
        const rawPromise = task.execute(dependencyResults, options.signal)
        const value = options.taskTimeoutMs !== undefined
          ? await raceTimeout(rawPromise, options.taskTimeoutMs)
          : await rawPromise
        return { taskId: task.id, status: 'COMPLETED', value, attempts: attempt + 1, durationMs: Date.now() - start }
      } catch (err) {
        lastErrorMessage = err instanceof CoordinatorTimeoutError
          ? `Task '${task.id}' exceeded the ${options.taskTimeoutMs} ms timeout.`
          : `Task '${task.id}' failed: ${String(err)}`
        if (attempt < policy.maxAttempts - 1) await policy.sleep(attempt)
      }
    }
    return { taskId: task.id, status: 'FAILED', errorMessage: lastErrorMessage, attempts: policy.maxAttempts, durationMs: Date.now() - start }
  }
}
