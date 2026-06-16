/**
 * P6-12F: Pipeline — sequential stage processor for sync and async transforms.
 *
 * A stage is a single-argument function that receives the current value and
 * returns a (possibly async) transformed value.  Stages are registered with
 * add() and executed in registration order by execute().  The output of each
 * stage becomes the input of the next; the final output is returned as the
 * pipeline result.
 *
 * Public API:
 *   add(stage)      — append a stage; returns { ok: true, value: index }
 *   remove(index)   — remove the stage at the given position
 *   execute(input)  — pass value through all stages sequentially
 *   size()          — number of registered stages; never fails
 *   clear()         — remove all stages without executing them; never fails
 *   list()          — defensive snapshot of stage metadata; never fails
 *
 * Error codes:
 *   INVALID_STAGE      — add() received a non-function argument
 *   INDEX_OUT_OF_RANGE — remove() index is negative, fractional, or >= size()
 *   STAGE_FAILED       — a stage threw or rejected during execute()
 *   PIPELINE_ERROR     — catch-all for unexpected failures
 *
 * Design rules (consistent with Scheduler and HttpInterceptor):
 *   - Never throws — errors surface as { ok: false, error }.
 *   - execute() is async; all other public methods are synchronous.
 *   - size(), clear(), and list() never fail.
 *   - execute() clones the input and the output of every stage before
 *     passing the value to the next stage, providing defensive isolation
 *     between stages.
 *   - execute() stops immediately when a stage throws or rejects; remaining
 *     stages do not run.
 *   - add() returns the insertion index so callers can remove the stage later
 *     via remove().  Note: indices shift after any remove() call.
 *   - list() returns a fresh array of PipelineStageEntry objects ({index}),
 *     reflecting current positions.  Mutations do not affect the pipeline.
 *   - SSR-compatible: no browser APIs, no timers, no DOM.
 */

// ─── Error types ──────────────────────────────────────────────────────────────

export type PipelineErrorCode =
  | 'INVALID_STAGE'       // add() received a non-function
  | 'INDEX_OUT_OF_RANGE'  // remove(index) out of bounds
  | 'STAGE_FAILED'        // a stage threw or rejected
  | 'PIPELINE_ERROR';     // catch-all

export interface PipelineError {
  code:    PipelineErrorCode;
  message: string;
}

export type PipelineResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: PipelineError };

// ─── Stage type ───────────────────────────────────────────────────────────────

/** A single-argument function (sync or async) that transforms a value. */
export type PipelineStage = (value: unknown) => unknown | Promise<unknown>;

// ─── Stage metadata (returned by list()) ─────────────────────────────────────

/** Read-only metadata about a registered stage returned by list(). */
export interface PipelineStageEntry {
  readonly index: number;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function pipeErr(
  code:    PipelineErrorCode,
  message: string,
): PipelineResult<never> {
  return { ok: false, error: { code, message } };
}

/**
 * Shallow-clones objects and arrays; returns primitives, null, and undefined
 * as-is.  Consistent with the rest of the provider layer.
 */
function cloneValue<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return [...value] as unknown as T;
  if (typeof value === 'object') return { ...(value as object) } as unknown as T;
  return value; // string, number, boolean, bigint, symbol, function
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export class Pipeline {
  private readonly stages: PipelineStage[] = [];

  // ── add ───────────────────────────────────────────────────────────────────

  /**
   * Appends `stage` to the end of the pipeline.
   * Returns { ok: true, value: index } where `index` is the zero-based
   * position at which the stage was inserted.
   * Returns INVALID_STAGE when `stage` is not a function.
   * Never throws.
   */
  add(stage: PipelineStage): PipelineResult<number> {
    if (typeof stage !== 'function') {
      return pipeErr(
        'INVALID_STAGE',
        `add() requires a callable function; received: ${typeof stage}.`,
      );
    }
    this.stages.push(stage);
    return { ok: true, value: this.stages.length - 1 };
  }

  // ── remove ────────────────────────────────────────────────────────────────

  /**
   * Removes the stage at position `index`.
   * Returns { ok: true } when the stage is found and removed.
   * Returns INDEX_OUT_OF_RANGE when `index` is negative, non-integer, or
   * greater than or equal to size().
   * Never throws.
   *
   * Note: removing a stage shifts all subsequent stage indices down by one.
   */
  remove(index: number): PipelineResult<void> {
    if (
      typeof index !== 'number' ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= this.stages.length
    ) {
      return pipeErr(
        'INDEX_OUT_OF_RANGE',
        `remove() index ${String(index)} is out of range; ` +
          `${this.stages.length} stage(s) registered.`,
      );
    }
    this.stages.splice(index, 1);
    return { ok: true, value: undefined };
  }

  // ── execute ───────────────────────────────────────────────────────────────

  /**
   * Passes `input` through all registered stages in order.
   *
   * The input is shallow-cloned before being given to stage 0.  The output of
   * each stage is shallow-cloned before being passed to the next stage.  The
   * final output is returned as { ok: true, value }.
   *
   * Returns { ok: true, value: clonedInput } immediately when no stages are
   * registered (identity pipeline).
   * Returns STAGE_FAILED when any stage throws or rejects; remaining stages
   * do not execute.
   * Never throws.
   */
  async execute(input: unknown): Promise<PipelineResult<unknown>> {
    let current: unknown = cloneValue(input);

    for (let i = 0; i < this.stages.length; i++) {
      try {
        const result = await this.stages[i](current);
        current = cloneValue(result);
      } catch (err) {
        return pipeErr(
          'STAGE_FAILED',
          `Stage ${i} threw: ${String(err)}.`,
        );
      }
    }

    return { ok: true, value: current };
  }

  // ── size ──────────────────────────────────────────────────────────────────

  /**
   * Returns the number of registered stages.
   * Never fails; returns 0 when the pipeline is empty.
   */
  size(): number {
    return this.stages.length;
  }

  // ── clear ─────────────────────────────────────────────────────────────────

  /**
   * Removes all registered stages without executing them.
   * Never fails.
   */
  clear(): void {
    this.stages.length = 0;
  }

  // ── list ──────────────────────────────────────────────────────────────────

  /**
   * Returns a defensive snapshot of registered-stage metadata in order.
   * Each element is a fresh { index } object; the array itself is fresh.
   * Mutations to the returned array or its items do not affect the pipeline.
   * Never fails; returns [] when the pipeline is empty.
   */
  list(): PipelineStageEntry[] {
    return this.stages.map((_, i) => ({ index: i }));
  }
}
