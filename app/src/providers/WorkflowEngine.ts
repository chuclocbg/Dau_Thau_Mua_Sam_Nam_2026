/**
 * P6-10T: WorkflowEngine — multi-step workflow orchestrator that integrates
 * Planner, AgentRuntime, SessionManager, MemoryStore, and ToolExecutor.
 *
 * Capabilities:
 *   registerWorkflow()  — register + validate a workflow definition (CRUD)
 *   removeWorkflow()    — unregister by id (CRUD)
 *   getWorkflow()       — retrieve a defensive copy (CRUD)
 *   listWorkflows()     — list all registered workflows (CRUD)
 *   executeWorkflow()   — run steps in topological order with optional integrations
 *
 * Dependency validation at registration time:
 *   - All dependsOn ids must refer to steps within the same workflow.
 *   - Cycles (including self-references) are rejected with CIRCULAR_DEPENDENCY.
 *   - Unknown dep references → INVALID_DEPENDENCY (caught before cycle check).
 *
 * Execution:
 *   - Steps are grouped into concurrent "waves" via Kahn's BFS topological sort.
 *   - Steps in the same wave have no inter-dependencies and run with Promise.all.
 *   - If any step fails (runtime returned ok:false or threw), EXECUTION_FAILED is
 *     returned immediately without processing later waves.
 *
 * Integration hooks (all optional, all no-ops when not supplied):
 *   agentRuntime   — called with step.prompt for each step
 *   planner        — createPlan / addStep (in topo order) / completeStep lifecycle
 *   sessionManager — IDLE→RUNNING on start; RUNNING→COMPLETED|ERROR on finish
 *   memoryStore    — saveMemory(executionId, summary) after successful completion
 *   toolExecutor   — accepted in options; available to consumers / sub-components
 *
 * Error codes:
 *   WORKFLOW_NOT_FOUND   — operation on an unknown workflow id
 *   DUPLICATE_WORKFLOW   — registerWorkflow with an already-registered id
 *   INVALID_DEPENDENCY   — step depends on an unknown step id
 *   CIRCULAR_DEPENDENCY  — dependency graph contains a cycle
 *   EXECUTION_FAILED     — step execution returned an error or threw unexpectedly
 *   INVALID_INPUT        — empty / whitespace-only id or malformed definition
 *
 * Design rules (consistent with the rest of the provider layer):
 *   - Never throws — all failures surface as { ok: false, error }.
 *   - Defensive copies: registerWorkflow clones the input; getWorkflow and
 *     listWorkflows return independent copies.
 *   - The WorkflowExecution returned by executeWorkflow is an independent copy.
 *   - listWorkflows() never fails.
 */

import { AgentRuntime }   from './AgentRuntime';
import { Planner }        from './Planner';
import { SessionManager } from './SessionManager';
import { MemoryStore }    from './MemoryStore';
import type { ToolExecutor } from './ToolExecutor';

// ─── WorkflowStep ─────────────────────────────────────────────────────────────

export interface WorkflowStep {
  /** Unique identifier within this workflow. */
  id:         string;
  /** Human-readable label. */
  title:      string;
  /** Prompt text sent to AgentRuntime when this step executes. */
  prompt:     string;
  /** Ids of steps that must complete before this step can start. */
  dependsOn?: string[];
  /** Hint: this step wants access to conversation memory. */
  useMemory?: boolean;
  /** Hint: this step may invoke tools via ToolExecutor. */
  useTools?:  boolean;
}

// ─── WorkflowDefinition ───────────────────────────────────────────────────────

export interface WorkflowDefinition {
  /** Unique identifier across the engine. */
  id:           string;
  /** Human-readable name; used as the Planner plan title. */
  name:         string;
  /** Optional description. */
  description?: string;
  /** Steps that make up this workflow (order does not imply execution order). */
  steps:        WorkflowStep[];
}

// ─── WorkflowExecution ────────────────────────────────────────────────────────

export interface WorkflowExecution {
  /** Id of the workflow that was executed. */
  workflowId:     string;
  /** Unique id generated for this execution run. */
  executionId:    string;
  /** Lifecycle status of this execution. */
  status:         'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  /** Unix-ms timestamp when execution started. */
  startedAt:      number;
  /** Unix-ms timestamp when execution ended (success or failure). */
  completedAt?:   number;
  /** Id of the step most recently started. */
  currentStep?:   string;
  /** Ids of steps that completed successfully, in completion order. */
  completedSteps: string[];
}

// ─── WorkflowOptions ──────────────────────────────────────────────────────────

export interface WorkflowOptions {
  /** LLM agent; called with step.prompt for each step. */
  agentRuntime?:   AgentRuntime;
  /** Persistent memory store; receives a summary snapshot after completion. */
  memoryStore?:    MemoryStore;
  /** Tool executor; available to consumers and sub-components. */
  toolExecutor?:   ToolExecutor;
  /** Session lifecycle manager; tracks this execution as a session. */
  sessionManager?: SessionManager;
  /** Planner; mirrors the execution plan as PlanSteps. */
  planner?:        Planner;
}

// ─── Error types ──────────────────────────────────────────────────────────────

export type WorkflowErrorCode =
  | 'WORKFLOW_NOT_FOUND'   // operation on an unknown workflow id
  | 'DUPLICATE_WORKFLOW'   // registerWorkflow with an already-registered id
  | 'INVALID_DEPENDENCY'   // step depends on an unknown step id
  | 'CIRCULAR_DEPENDENCY'  // dependency graph contains a cycle
  | 'EXECUTION_FAILED'     // step execution returned an error or threw
  | 'INVALID_INPUT';       // malformed workflow definition or id

export interface WorkflowError {
  code:    WorkflowErrorCode;
  message: string;
  cause?:  unknown;
}

// ─── Result ───────────────────────────────────────────────────────────────────

export type WorkflowResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: WorkflowError };

// ─── WorkflowEngine ───────────────────────────────────────────────────────────

export class WorkflowEngine {
  private readonly store: Map<string, WorkflowDefinition> = new Map();

  /**
   * Registers a new workflow definition.
   *
   * Validates in order:
   *   1. id and name are non-empty strings, steps is an array.  → INVALID_INPUT
   *   2. id is not already registered.                          → DUPLICATE_WORKFLOW
   *   3. Step ids are unique within the workflow.               → INVALID_INPUT
   *   4. Every dependsOn entry refers to a step id in this
   *      workflow.  (Self-reference passes here; caught below.) → INVALID_DEPENDENCY
   *   5. The dependency graph is acyclic (DFS coloring).        → CIRCULAR_DEPENDENCY
   *
   * Returns the workflow id on success.
   */
  registerWorkflow(def: WorkflowDefinition): WorkflowResult<string> {
    // ── Structural validation ────────────────────────────────────────────
    if (!def?.id?.trim()) {
      return wfErr('INVALID_INPUT', 'Workflow id must be a non-empty string.');
    }
    if (!def?.name?.trim()) {
      return wfErr('INVALID_INPUT', 'Workflow name must be a non-empty string.');
    }
    if (!Array.isArray(def?.steps)) {
      return wfErr('INVALID_INPUT', 'Workflow steps must be an array.');
    }

    // ── Duplicate check ──────────────────────────────────────────────────
    if (this.store.has(def.id)) {
      return wfErr('DUPLICATE_WORKFLOW',
        `Workflow '${def.id}' is already registered.`);
    }

    // ── Step id uniqueness ───────────────────────────────────────────────
    const stepIds = new Set<string>();
    for (const step of def.steps) {
      if (!step?.id?.trim()) {
        return wfErr('INVALID_INPUT', 'Each step must have a non-empty id.');
      }
      if (stepIds.has(step.id)) {
        return wfErr('INVALID_INPUT',
          `Duplicate step id '${step.id}' in workflow '${def.id}'.`);
      }
      stepIds.add(step.id);
    }

    // ── Dependency reference check ───────────────────────────────────────
    for (const step of def.steps) {
      for (const dep of (step.dependsOn ?? [])) {
        if (!stepIds.has(dep)) {
          return wfErr('INVALID_DEPENDENCY',
            `Step '${step.id}' depends on unknown step '${dep}' in workflow '${def.id}'.`);
        }
      }
    }

    // ── Cycle detection ──────────────────────────────────────────────────
    const cycle = detectCycle(def.steps);
    if (cycle !== null) {
      return wfErr('CIRCULAR_DEPENDENCY',
        `Circular dependency detected in workflow '${def.id}': ${cycle}.`);
    }

    // ── Store a defensive copy ───────────────────────────────────────────
    this.store.set(def.id, cloneDefinition(def));
    return { ok: true, value: def.id };
  }

  /**
   * Unregisters the workflow with the given id.
   *
   * Returns WORKFLOW_NOT_FOUND if the id is not registered.
   */
  removeWorkflow(id: string): WorkflowResult<true> {
    if (!this.store.has(id)) {
      return wfErr('WORKFLOW_NOT_FOUND', `Workflow '${id}' is not registered.`);
    }
    this.store.delete(id);
    return { ok: true, value: true };
  }

  /**
   * Returns a defensive copy of the registered workflow definition.
   *
   * Returns WORKFLOW_NOT_FOUND if the id is not registered.
   */
  getWorkflow(id: string): WorkflowResult<WorkflowDefinition> {
    const def = this.store.get(id);
    if (!def) {
      return wfErr('WORKFLOW_NOT_FOUND', `Workflow '${id}' is not registered.`);
    }
    return { ok: true, value: cloneDefinition(def) };
  }

  /**
   * Returns defensive copies of all registered workflow definitions in
   * insertion order.  Returns an empty array when nothing is registered.
   * Never fails.
   */
  listWorkflows(): WorkflowDefinition[] {
    return Array.from(this.store.values()).map(cloneDefinition);
  }

  /**
   * Executes the workflow with the given id.
   *
   * Steps are sorted into concurrent waves (Kahn's BFS topological sort).
   * All steps within a wave are dispatched simultaneously via Promise.all.
   *
   * Optional integrations (all no-ops when not supplied):
   *   agentRuntime   — run(step.prompt) called for each step
   *   planner        — mirrors steps as PlanSteps (in topo order); marks each complete
   *   sessionManager — IDLE→RUNNING on start; RUNNING→COMPLETED|ERROR on finish
   *   memoryStore    — saveMemory(executionId, summary) after completion
   *   toolExecutor   — stored in context; available for consumer use
   *
   * Returns WORKFLOW_NOT_FOUND if the id is not registered.
   * Returns EXECUTION_FAILED if a step's agentRuntime.run() returned ok:false or threw.
   * Returns a snapshot WorkflowExecution on success.
   *
   * Never rejects — all failures are wrapped in { ok: false, error }.
   */
  async executeWorkflow(
    id:       string,
    options?: WorkflowOptions,
  ): Promise<WorkflowResult<WorkflowExecution>> {
    try {
      const defResult = this.getWorkflow(id);
      if (!defResult.ok) return defResult;
      const def = defResult.value;

      const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const execution: WorkflowExecution = {
        workflowId:     id,
        executionId,
        status:         'RUNNING',
        startedAt:      Date.now(),
        completedSteps: [],
      };

      // ── SessionManager: create + start ──────────────────────────────
      if (options?.sessionManager) {
        options.sessionManager.createSession(executionId);
        options.sessionManager.startSession(executionId);
      }

      // ── Topological sort (reused for Planner setup + execution) ─────
      const waves = topologicalWaves(def.steps);

      // ── Planner: mirror the workflow as a plan (steps in topo order) ─
      if (options?.planner) {
        options.planner.createPlan(def.name);
        for (const wave of waves) {
          for (const step of wave) {
            options.planner.addStep({
              id:        step.id,
              title:     step.title,
              dependsOn: step.dependsOn ?? [],
            });
          }
        }
      }

      // ── Execute in topological waves ────────────────────────────────
      for (const wave of waves) {
        const waveResults = await Promise.all(
          wave.map(step => this.executeStep(step, execution, options)),
        );

        for (const stepResult of waveResults) {
          if (!stepResult.ok) {
            execution.status      = 'FAILED';
            execution.completedAt = Date.now();
            if (options?.sessionManager) {
              options.sessionManager.failSession(executionId);
            }
            return { ok: false, error: stepResult.error };
          }
        }
      }

      // ── Successful completion ───────────────────────────────────────
      execution.status      = 'COMPLETED';
      execution.completedAt = Date.now();

      if (options?.sessionManager) {
        options.sessionManager.completeSession(executionId);
      }

      if (options?.memoryStore) {
        options.memoryStore.saveMemory(executionId, [
          {
            role:    'assistant',
            content: `Workflow '${id}' completed. Steps: ${execution.completedSteps.join(', ')}.`,
          },
        ]);
      }

      return { ok: true, value: cloneExecution(execution) };

    } catch (err) {
      return wfErr(
        'EXECUTION_FAILED',
        `Unexpected error executing workflow '${id}': ${String(err)}`,
        err,
      );
    }
  }

  // ─── private helpers ──────────────────────────────────────────────────────

  private async executeStep(
    step:      WorkflowStep,
    execution: WorkflowExecution,
    options?:  WorkflowOptions,
  ): Promise<WorkflowResult<string>> {
    try {
      execution.currentStep = step.id;

      if (options?.agentRuntime) {
        const result = await options.agentRuntime.run(step.prompt);
        if (!result.ok) {
          return wfErr(
            'EXECUTION_FAILED',
            `Step '${step.id}' failed: ${result.error!.message}`,
            result.error,
          );
        }
      }

      execution.completedSteps.push(step.id);

      if (options?.planner) {
        options.planner.completeStep(step.id);
      }

      return { ok: true, value: step.id };

    } catch (err) {
      return wfErr(
        'EXECUTION_FAILED',
        `Step '${step.id}' threw an unexpected error: ${String(err)}`,
        err,
      );
    }
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Groups steps into execution waves using Kahn's BFS topological sort.
 * All steps within a wave have their dependencies satisfied by prior waves
 * and can therefore run concurrently.
 *
 * Precondition: the steps array is guaranteed cycle-free (validated at
 * registerWorkflow time), so this will always process every step.
 */
function topologicalWaves(steps: WorkflowStep[]): WorkflowStep[][] {
  if (steps.length === 0) return [];

  const stepById   = new Map<string, WorkflowStep>();
  const inDegree   = new Map<string, number>();
  const dependents = new Map<string, string[]>(); // id → ids of steps that depend on it

  for (const step of steps) {
    stepById.set(step.id, step);
    inDegree.set(step.id, (step.dependsOn ?? []).length);
    dependents.set(step.id, []);
  }
  for (const step of steps) {
    for (const dep of (step.dependsOn ?? [])) {
      dependents.get(dep)!.push(step.id);
    }
  }

  const waves: WorkflowStep[][] = [];
  let current = steps.filter(s => (inDegree.get(s.id) ?? 0) === 0);

  while (current.length > 0) {
    waves.push([...current]);
    const next: WorkflowStep[] = [];
    for (const step of current) {
      for (const dependentId of (dependents.get(step.id) ?? [])) {
        const newDeg = (inDegree.get(dependentId) ?? 1) - 1;
        inDegree.set(dependentId, newDeg);
        if (newDeg === 0) {
          next.push(stepById.get(dependentId)!);
        }
      }
    }
    current = next;
  }

  return waves;
}

/**
 * Returns a human-readable cycle description (e.g. "A → B → A") when the
 * step dependency graph has a cycle, or null if the graph is acyclic.
 *
 * Uses DFS tri-color marking: WHITE (0) = unvisited, GRAY (1) = on current
 * path, BLACK (2) = fully explored.  Traverses in the direction of dependsOn
 * edges (step → its prerequisites), so a GRAY node reached from itself means
 * step A is a transitive dependency of step A.
 */
function detectCycle(steps: WorkflowStep[]): string | null {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const deps  = new Map<string, string[]>();

  for (const step of steps) {
    color.set(step.id, WHITE);
    deps.set(step.id, step.dependsOn ?? []);
  }

  const dfs = (id: string, path: string[]): string | null => {
    color.set(id, GRAY);
    for (const dep of (deps.get(id) ?? [])) {
      if (color.get(dep) === GRAY) {
        const idx   = path.indexOf(dep);
        const cycle = (idx >= 0 ? path.slice(idx) : path).concat(dep);
        return cycle.join(' → ');
      }
      if (color.get(dep) === WHITE) {
        const found = dfs(dep, [...path, dep]);
        if (found !== null) return found;
      }
    }
    color.set(id, BLACK);
    return null;
  };

  for (const step of steps) {
    if (color.get(step.id) === WHITE) {
      const found = dfs(step.id, [step.id]);
      if (found !== null) return found;
    }
  }

  return null;
}

function cloneStep(step: WorkflowStep): WorkflowStep {
  const copy: WorkflowStep = {
    id:     step.id,
    title:  step.title,
    prompt: step.prompt,
  };
  if (step.dependsOn !== undefined) copy.dependsOn = [...step.dependsOn];
  if (step.useMemory !== undefined) copy.useMemory  = step.useMemory;
  if (step.useTools  !== undefined) copy.useTools   = step.useTools;
  return copy;
}

function cloneDefinition(def: WorkflowDefinition): WorkflowDefinition {
  const copy: WorkflowDefinition = {
    id:    def.id,
    name:  def.name,
    steps: def.steps.map(cloneStep),
  };
  if (def.description !== undefined) copy.description = def.description;
  return copy;
}

function cloneExecution(exec: WorkflowExecution): WorkflowExecution {
  const copy: WorkflowExecution = {
    workflowId:     exec.workflowId,
    executionId:    exec.executionId,
    status:         exec.status,
    startedAt:      exec.startedAt,
    completedSteps: [...exec.completedSteps],
  };
  if (exec.completedAt !== undefined) copy.completedAt = exec.completedAt;
  if (exec.currentStep !== undefined) copy.currentStep = exec.currentStep;
  return copy;
}

function wfErr<T>(
  code:    WorkflowErrorCode,
  message: string,
  cause?:  unknown,
): WorkflowResult<T> {
  const error: WorkflowError = { code, message };
  if (cause !== undefined) error.cause = cause;
  return { ok: false, error };
}
