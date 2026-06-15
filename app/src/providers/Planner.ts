/**
 * P6-10Q: Planner — ordered step manager with dependency tracking.
 *
 * Manages a mutable, ordered set of PlanSteps, each of which may declare
 * dependencies on earlier steps.  Designed to model agent work plans that
 * are built incrementally and executed step-by-step.
 *
 * Capabilities:
 *   createPlan()   — resets all state (steps + title); never fails.
 *   addStep()      — inserts a step; validates id uniqueness and dependencies.
 *   removeStep()   — deletes a step by id.
 *   completeStep() — marks a step as done; idempotent.
 *   getStep()      — returns a defensive copy of a step by id.
 *   listSteps()    — returns defensive copies of all steps in insertion order.
 *   clear()        — removes all steps without touching the plan title.
 *
 * Dependency semantics:
 *   A step may list ids in dependsOn[].  At addStep() time every listed id
 *   must already be registered.  Removal of a depended-on step is allowed
 *   (the caller is responsible for updating downstream steps).
 *
 * Error codes:
 *   DUPLICATE_STEP    — addStep() id already registered
 *   STEP_NOT_FOUND    — getStep / removeStep / completeStep with unknown id
 *   INVALID_DEPENDENCY — dependsOn contains an id not currently in the plan
 *   INVALID_INPUT      — empty / whitespace-only id or title
 *
 * Design rules (consistent with the rest of the provider layer):
 *   - Never throws — all failures surface as { ok: false, error }.
 *   - Defensive copies: every read returns an independent snapshot.
 *   - Registry is not modified on failure (atomic operations).
 *   - listSteps() and clear() never fail.
 */

// ─── PlanStep ─────────────────────────────────────────────────────────────────

export interface PlanStep {
  /** Unique identifier within the plan. */
  id:          string;
  /** Short human-readable label. */
  title:       string;
  /** Longer description of what the step does (defaults to ''). */
  description: string;
  /** Ids of steps that must be present before this step was added. */
  dependsOn:   string[];
  /** True once completeStep() has been called for this id. */
  completed:   boolean;
}

// ─── Error types ──────────────────────────────────────────────────────────────

export type PlannerErrorCode =
  | 'DUPLICATE_STEP'      // addStep() with an id already registered
  | 'STEP_NOT_FOUND'      // operation on an id not in the plan
  | 'INVALID_DEPENDENCY'  // dependsOn references an unregistered id
  | 'INVALID_INPUT';      // empty / whitespace-only id or title

export interface PlannerError {
  code:    PlannerErrorCode;
  message: string;
}

// ─── Result ───────────────────────────────────────────────────────────────────

export type PlanResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: PlannerError };

// ─── Options ──────────────────────────────────────────────────────────────────

export interface PlannerOptions {
  /** Optional human-readable label for the plan. */
  title?: string;
}

// ─── Planner ──────────────────────────────────────────────────────────────────

export class Planner {
  private title: string;
  private readonly store: Map<string, PlanStep>;

  constructor(options?: PlannerOptions) {
    this.title = options?.title ?? '';
    this.store  = new Map();
  }

  /**
   * Resets the plan: clears all steps and optionally sets a new title.
   * Never fails.
   */
  createPlan(title?: string): void {
    this.store.clear();
    if (title !== undefined) this.title = title;
  }

  /**
   * Adds a new step to the plan.
   *
   * Validates:
   *   - id must be a non-empty, non-whitespace string.
   *   - title must be a non-empty, non-whitespace string.
   *   - id must not already be registered (DUPLICATE_STEP).
   *   - every entry in dependsOn must already be registered (INVALID_DEPENDENCY).
   *
   * Returns a defensive copy of the stored step on success.
   * Does not modify the plan on any failure.
   */
  addStep(input: {
    id:           string;
    title:        string;
    description?: string;
    dependsOn?:   string[];
  }): PlanResult<PlanStep> {
    // ── Input validation ──────────────────────────────────────────────────────
    if (!input.id || !input.id.trim()) {
      return planErr('INVALID_INPUT', 'Step id must be a non-empty, non-whitespace string.');
    }
    if (!input.title || !input.title.trim()) {
      return planErr('INVALID_INPUT', 'Step title must be a non-empty, non-whitespace string.');
    }

    // ── Duplicate check ───────────────────────────────────────────────────────
    if (this.store.has(input.id)) {
      return planErr('DUPLICATE_STEP',
        `Step '${input.id}' is already in the plan; remove it first to replace.`);
    }

    // ── Dependency validation ─────────────────────────────────────────────────
    const deps = input.dependsOn ?? [];
    for (const dep of deps) {
      if (!this.store.has(dep)) {
        return planErr('INVALID_DEPENDENCY',
          `Dependency '${dep}' does not exist in the plan.`);
      }
    }

    // ── Store ─────────────────────────────────────────────────────────────────
    const step: PlanStep = {
      id:          input.id,
      title:       input.title,
      description: input.description ?? '',
      dependsOn:   [...deps],
      completed:   false,
    };
    this.store.set(input.id, step);
    return { ok: true, value: cloneStep(step) };
  }

  /**
   * Removes a step by id.
   *
   * Returns STEP_NOT_FOUND when the id is not registered.
   * Does not cascade: steps that listed this id in dependsOn are unchanged.
   */
  removeStep(id: string): PlanResult<true> {
    if (!this.store.has(id)) {
      return planErr('STEP_NOT_FOUND', `Step '${id}' is not in the plan.`);
    }
    this.store.delete(id);
    return { ok: true, value: true };
  }

  /**
   * Marks a step as completed.
   *
   * Idempotent: calling again on an already-completed step is fine.
   * Returns STEP_NOT_FOUND when the id is not registered.
   * Returns a defensive copy of the updated step on success.
   */
  completeStep(id: string): PlanResult<PlanStep> {
    const step = this.store.get(id);
    if (!step) {
      return planErr('STEP_NOT_FOUND', `Step '${id}' is not in the plan.`);
    }
    step.completed = true;
    return { ok: true, value: cloneStep(step) };
  }

  /**
   * Returns a defensive copy of the named step.
   *
   * Returns STEP_NOT_FOUND when the id is not registered.
   */
  getStep(id: string): PlanResult<PlanStep> {
    const step = this.store.get(id);
    if (!step) {
      return planErr('STEP_NOT_FOUND', `Step '${id}' is not in the plan.`);
    }
    return { ok: true, value: cloneStep(step) };
  }

  /**
   * Returns defensive copies of all steps in insertion order.
   * Returns an empty array when the plan has no steps.  Never fails.
   */
  listSteps(): PlanStep[] {
    return Array.from(this.store.values()).map(cloneStep);
  }

  /**
   * Removes all steps.  The plan title is preserved.
   * Never fails.
   */
  clear(): void {
    this.store.clear();
  }

  /** Returns the current plan title (may be empty string). */
  getTitle(): string {
    return this.title;
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function cloneStep(step: PlanStep): PlanStep {
  return {
    id:          step.id,
    title:       step.title,
    description: step.description,
    dependsOn:   [...step.dependsOn],
    completed:   step.completed,
  };
}

function planErr<T>(
  code:    PlannerErrorCode,
  message: string,
): PlanResult<T> {
  return { ok: false, error: { code, message } };
}
