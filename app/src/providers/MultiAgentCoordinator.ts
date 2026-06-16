/**
 * P6-10V: MultiAgentCoordinator — registers named AgentDefinitions and
 * coordinates the execution of AgentTasks across them.
 *
 * Public API:
 *   registerAgent()  — store an AgentDefinition by id (CRUD)
 *   removeAgent()    — unregister by id (CRUD)
 *   getAgent()       — retrieve a defensive copy (CRUD)
 *   listAgents()     — list all definitions in insertion order (CRUD)
 *   executeTask()    — run a single AgentTask against its named agent
 *   executeTasks()   — run a batch of tasks respecting their dependency graph
 *   handoff()        — produce a new AgentTask whose prompt is prefixed with
 *                      the content produced by a prior task
 *
 * executeTasks dependency model (mirrors WorkflowEngine):
 *   - Task ids within a batch must be unique (DUPLICATE_TASK).
 *   - Every agentId must refer to a registered AgentDefinition (AGENT_NOT_FOUND).
 *   - Every dependsOn entry must refer to another task id in the same batch
 *     (TASK_NOT_FOUND).
 *   - The task dependency graph must be acyclic (CIRCULAR_DEPENDENCY).
 *   - Independent tasks (same wave) execute concurrently via Promise.all.
 *   - Dependent tasks automatically receive predecessor content via handoff.
 *
 * Error codes:
 *   AGENT_NOT_FOUND     — operation on an unregistered agent id
 *   TASK_NOT_FOUND      — dependsOn references a task id absent from the batch
 *   DUPLICATE_AGENT     — registerAgent with an already-registered id
 *   DUPLICATE_TASK      — two tasks in the same batch share an id
 *   INVALID_DEPENDENCY  — structural dependency problem (reserved; see TASK_NOT_FOUND)
 *   CIRCULAR_DEPENDENCY — dependency graph contains a cycle
 *   EXECUTION_FAILED    — agent runtime returned an error or has no runtime
 *   INVALID_INPUT       — malformed definition, empty id, or invalid argument
 *
 * Design rules (consistent with the rest of the provider layer):
 *   - Never throws — every failure is { ok: false, error }.
 *   - Defensive copies: registerAgent clones the input; getAgent and
 *     listAgents return independent copies.
 *   - The AgentExecution returned by executeTasks is an independent snapshot.
 *   - listAgents() never fails.
 */

import { AgentRuntime }      from './AgentRuntime';
import { ToolRegistry }      from './ToolRegistry';
import { ConversationMemory } from './ConversationMemory';

// ─── AgentDefinition ──────────────────────────────────────────────────────────

export interface AgentDefinition {
  /** Unique identifier within this coordinator. */
  id:           string;
  /** Human-readable label. */
  name:         string;
  /** Optional description. */
  description?: string;
  /** AgentRuntime used to execute tasks assigned to this agent. */
  runtime?:     AgentRuntime;
  /** Optional tool registry associated with this agent. */
  tools?:       ToolRegistry;
  /** Optional conversation memory associated with this agent. */
  memory?:      ConversationMemory;
}

// ─── AgentTask ────────────────────────────────────────────────────────────────

export interface AgentTask {
  /** Unique identifier within the current batch. */
  id:          string;
  /** Id of the registered AgentDefinition that will handle this task. */
  agentId:     string;
  /** Prompt sent to the agent's runtime. */
  prompt:      string;
  /** Ids of tasks (in the same batch) that must complete before this one runs. */
  dependsOn?:  string[];
}

// ─── AgentExecution ───────────────────────────────────────────────────────────

export interface AgentExecution {
  /** Unique id generated for this execution run. */
  executionId:    string;
  /** Unix-ms timestamp when execution started. */
  startedAt:      number;
  /** Unix-ms timestamp when execution ended (success or failure). */
  completedAt?:   number;
  /** Id of the task most recently started. */
  currentTask?:   string;
  /** Ids of tasks that completed successfully, in completion order. */
  completedTasks: string[];
  /** Lifecycle status of this execution. */
  status:         'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
}

// ─── AgentCoordinatorOptions ──────────────────────────────────────────────────

/** Per-execution options for executeTasks(). */
export interface AgentCoordinatorOptions {
  // Reserved for future options (e.g. timeout, continueOnError).
}

// ─── Error types ──────────────────────────────────────────────────────────────

export type AgentCoordinatorErrorCode =
  | 'AGENT_NOT_FOUND'      // operation on an unregistered agent id
  | 'TASK_NOT_FOUND'       // dependsOn references a task not in the batch
  | 'DUPLICATE_AGENT'      // registerAgent with an already-registered id
  | 'DUPLICATE_TASK'       // two tasks in one batch share the same id
  | 'INVALID_DEPENDENCY'   // structural dependency issue (reserved)
  | 'CIRCULAR_DEPENDENCY'  // dependency graph contains a cycle
  | 'EXECUTION_FAILED'     // runtime returned error or agent has no runtime
  | 'INVALID_INPUT';       // malformed definition or empty id

export interface AgentCoordinatorError {
  code:    AgentCoordinatorErrorCode;
  message: string;
  cause?:  unknown;
}

// ─── Result ───────────────────────────────────────────────────────────────────

export type AgentCoordinatorResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: AgentCoordinatorError };

// ─── MultiAgentCoordinator ────────────────────────────────────────────────────

export class MultiAgentCoordinator {
  private readonly agents: Map<string, AgentDefinition> = new Map();

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  /**
   * Registers a new AgentDefinition.
   *
   * Validates in order:
   *   1. id and name are non-empty strings.   → INVALID_INPUT
   *   2. id is not already registered.        → DUPLICATE_AGENT
   *
   * Returns the agent id on success.
   */
  registerAgent(def: AgentDefinition): AgentCoordinatorResult<string> {
    if (!def?.id?.trim()) {
      return coordErr('INVALID_INPUT', 'Agent id must be a non-empty string.');
    }
    if (!def?.name?.trim()) {
      return coordErr('INVALID_INPUT', 'Agent name must be a non-empty string.');
    }
    if (this.agents.has(def.id)) {
      return coordErr('DUPLICATE_AGENT',
        `Agent '${def.id}' is already registered.`);
    }
    this.agents.set(def.id, cloneAgent(def));
    return { ok: true, value: def.id };
  }

  /**
   * Unregisters the agent with the given id.
   *
   * Returns AGENT_NOT_FOUND if the id is not registered.
   */
  removeAgent(id: string): AgentCoordinatorResult<true> {
    if (!this.agents.has(id)) {
      return coordErr('AGENT_NOT_FOUND',
        `Agent '${id}' is not registered.`);
    }
    this.agents.delete(id);
    return { ok: true, value: true };
  }

  /**
   * Returns a defensive copy of the registered AgentDefinition.
   *
   * Returns AGENT_NOT_FOUND if the id is not registered.
   */
  getAgent(id: string): AgentCoordinatorResult<AgentDefinition> {
    const def = this.agents.get(id);
    if (!def) {
      return coordErr('AGENT_NOT_FOUND',
        `Agent '${id}' is not registered.`);
    }
    return { ok: true, value: cloneAgent(def) };
  }

  /**
   * Returns defensive copies of all registered AgentDefinitions in insertion order.
   * Returns an empty array when nothing is registered.  Never fails.
   */
  listAgents(): AgentDefinition[] {
    return Array.from(this.agents.values()).map(cloneAgent);
  }

  // ─── Execution ──────────────────────────────────────────────────────────────

  /**
   * Executes a single AgentTask against its named agent.
   *
   * Validates:
   *   - task.prompt is non-empty.                             → INVALID_INPUT
   *   - task.agentId refers to a registered agent.           → AGENT_NOT_FOUND
   *   - the agent has a runtime configured.                  → EXECUTION_FAILED
   *   - runtime.run() returns ok:true.                       → EXECUTION_FAILED
   *
   * Returns the assistant content string on success.
   * Never rejects.
   */
  async executeTask(
    task:     AgentTask,
    _options?: AgentCoordinatorOptions,
  ): Promise<AgentCoordinatorResult<string>> {
    try {
      if (!task?.prompt?.trim()) {
        return coordErr('INVALID_INPUT',
          'Task prompt must be a non-empty string.');
      }

      const agentDef = this.agents.get(task.agentId);
      if (!agentDef) {
        return coordErr('AGENT_NOT_FOUND',
          `Agent '${task.agentId}' is not registered.`);
      }

      if (!agentDef.runtime) {
        return coordErr('EXECUTION_FAILED',
          `Agent '${task.agentId}' has no runtime configured.`);
      }

      const result = await agentDef.runtime.run(task.prompt);
      if (!result.ok) {
        return coordErr('EXECUTION_FAILED',
          `Task '${task.id}' failed: ${result.error!.message}`,
          result.error,
        );
      }

      return { ok: true, value: result.content ?? '' };

    } catch (err) {
      return coordErr('EXECUTION_FAILED',
        `Unexpected error executing task '${task?.id}': ${String(err)}`,
        err,
      );
    }
  }

  /**
   * Executes a batch of AgentTasks respecting their dependency graph.
   *
   * Validation (all done before execution begins):
   *   - Each task id must be unique within the batch.        → DUPLICATE_TASK
   *   - Each task.agentId must be registered.                → AGENT_NOT_FOUND
   *   - Each dependsOn entry must refer to another task in
   *     the same batch.                                      → TASK_NOT_FOUND
   *   - The dependency graph must be acyclic.                → CIRCULAR_DEPENDENCY
   *
   * Execution:
   *   - Tasks are grouped into concurrent waves (Kahn's BFS topological sort).
   *   - All tasks within a wave execute concurrently via Promise.all.
   *   - Tasks with dependencies receive predecessor content prepended to their
   *     prompt (automatic handoff).
   *   - A single task failure aborts the execution immediately.
   *
   * Returns an AgentExecution snapshot on success.
   * Never rejects.
   */
  async executeTasks(
    tasks:    AgentTask[],
    _options?: AgentCoordinatorOptions,
  ): Promise<AgentCoordinatorResult<AgentExecution>> {
    try {
      // ── Null / non-array guard ─────────────────────────────────────────────
      if (tasks == null || !Array.isArray(tasks)) {
        return coordErr('INVALID_INPUT', 'tasks must be a non-null array.');
      }

      // ── Empty batch ────────────────────────────────────────────────────────
      if (tasks.length === 0) {
        const exec = buildExecution();
        exec.status      = 'COMPLETED';
        exec.completedAt = Date.now();
        return { ok: true, value: cloneExecution(exec) };
      }

      // ── Unique task ids ────────────────────────────────────────────────────
      const taskIds = new Set<string>();
      for (const t of tasks) {
        if (!t?.id?.trim()) {
          return coordErr('INVALID_INPUT', 'Each task must have a non-empty id.');
        }
        if (taskIds.has(t.id)) {
          return coordErr('DUPLICATE_TASK',
            `Task id '${t.id}' appears more than once in the batch.`);
        }
        taskIds.add(t.id);
      }

      // ── Agent existence ────────────────────────────────────────────────────
      for (const t of tasks) {
        if (!this.agents.has(t.agentId)) {
          return coordErr('AGENT_NOT_FOUND',
            `Task '${t.id}' references unregistered agent '${t.agentId}'.`);
        }
      }

      // ── Dependency reference check ─────────────────────────────────────────
      for (const t of tasks) {
        for (const dep of (t.dependsOn ?? [])) {
          if (!taskIds.has(dep)) {
            return coordErr('TASK_NOT_FOUND',
              `Task '${t.id}' depends on '${dep}' which is not in the batch.`);
          }
        }
      }

      // ── Cycle detection ────────────────────────────────────────────────────
      const cycle = detectCycle(tasks);
      if (cycle !== null) {
        return coordErr('CIRCULAR_DEPENDENCY',
          `Circular dependency detected in task batch: ${cycle}.`);
      }

      // ── Build execution tracking object ────────────────────────────────────
      const exec = buildExecution();

      // ── Execute in topological waves ───────────────────────────────────────
      const taskResults = new Map<string, string>(); // taskId → content
      const waves       = topologicalWaves(tasks);

      for (const wave of waves) {
        const waveResults = await Promise.all(
          wave.map(task => this.runTaskWithHandoff(task, taskResults, exec)),
        );

        for (const wr of waveResults) {
          if (!wr.ok) {
            exec.status      = 'FAILED';
            exec.completedAt = Date.now();
            return { ok: false, error: wr.error };
          }
        }
      }

      // ── Success ────────────────────────────────────────────────────────────
      exec.status      = 'COMPLETED';
      exec.completedAt = Date.now();
      return { ok: true, value: cloneExecution(exec) };

    } catch (err) {
      return coordErr('EXECUTION_FAILED',
        `Unexpected error in executeTasks: ${String(err)}`,
        err,
      );
    }
  }

  /**
   * Produces a new AgentTask whose prompt is prefixed with the content produced
   * by a prior task.  The original task is not mutated.
   *
   * The resulting prompt format:
   *   "Previous result:\n<fromContent>\n\nTask:\n<toTask.prompt>"
   *
   * Never throws.
   */
  handoff(fromContent: string, toTask: AgentTask): AgentTask {
    try {
      return {
        id:        toTask.id,
        agentId:   toTask.agentId,
        prompt:    `Previous result:\n${fromContent}\n\nTask:\n${toTask.prompt}`,
        dependsOn: toTask.dependsOn ? [...toTask.dependsOn] : undefined,
      };
    } catch {
      // If toTask is somehow malformed, return it unchanged
      return toTask;
    }
  }

  // ─── private ────────────────────────────────────────────────────────────────

  private async runTaskWithHandoff(
    task:        AgentTask,
    taskResults: Map<string, string>,
    exec:        AgentExecution,
  ): Promise<AgentCoordinatorResult<string>> {
    try {
      exec.currentTask = task.id;

      // Build effective prompt: prepend predecessor results (handoff)
      let prompt = task.prompt;
      if (task.dependsOn && task.dependsOn.length > 0) {
        const parts: string[] = [];
        for (const depId of task.dependsOn) {
          const depContent = taskResults.get(depId);
          if (depContent !== undefined) {
            parts.push(`Result from '${depId}':\n${depContent}`);
          }
        }
        if (parts.length > 0) {
          prompt = `${parts.join('\n\n')}\n\nTask:\n${task.prompt}`;
        }
      }

      // Get agent
      const agentDef = this.agents.get(task.agentId);
      if (!agentDef || !agentDef.runtime) {
        return coordErr('EXECUTION_FAILED',
          agentDef
            ? `Agent '${task.agentId}' has no runtime configured.`
            : `Agent '${task.agentId}' is not registered.`,
        );
      }

      // Run
      const result = await agentDef.runtime.run(prompt);
      if (!result.ok) {
        return coordErr('EXECUTION_FAILED',
          `Task '${task.id}' failed: ${result.error!.message}`,
          result.error,
        );
      }

      const content = result.content ?? '';
      taskResults.set(task.id, content);
      exec.completedTasks.push(task.id);

      return { ok: true, value: content };

    } catch (err) {
      return coordErr('EXECUTION_FAILED',
        `Task '${task.id}' threw unexpectedly: ${String(err)}`,
        err,
      );
    }
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Groups tasks into execution waves using Kahn's BFS topological sort.
 * All tasks within a wave have their dependencies satisfied and can run
 * concurrently.
 *
 * Precondition: the task list is guaranteed cycle-free.
 */
function topologicalWaves(tasks: AgentTask[]): AgentTask[][] {
  if (tasks.length === 0) return [];

  const taskById   = new Map<string, AgentTask>();
  const inDegree   = new Map<string, number>();
  const dependents = new Map<string, string[]>(); // id → ids of tasks that depend on it

  for (const t of tasks) {
    taskById.set(t.id, t);
    inDegree.set(t.id, (t.dependsOn ?? []).length);
    dependents.set(t.id, []);
  }
  for (const t of tasks) {
    for (const dep of (t.dependsOn ?? [])) {
      dependents.get(dep)!.push(t.id);
    }
  }

  const waves: AgentTask[][] = [];
  let current = tasks.filter(t => (inDegree.get(t.id) ?? 0) === 0);

  while (current.length > 0) {
    waves.push([...current]);
    const next: AgentTask[] = [];
    for (const t of current) {
      for (const depId of (dependents.get(t.id) ?? [])) {
        const newDeg = (inDegree.get(depId) ?? 1) - 1;
        inDegree.set(depId, newDeg);
        if (newDeg === 0) next.push(taskById.get(depId)!);
      }
    }
    current = next;
  }

  return waves;
}

/**
 * Returns a human-readable cycle description (e.g. "A → B → A") if the
 * task dependency graph contains a cycle, or null if it is acyclic.
 * Uses DFS tri-color marking (WHITE/GRAY/BLACK).
 */
function detectCycle(tasks: AgentTask[]): string | null {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const deps  = new Map<string, string[]>();

  for (const t of tasks) {
    color.set(t.id, WHITE);
    deps.set(t.id, t.dependsOn ?? []);
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

  for (const t of tasks) {
    if (color.get(t.id) === WHITE) {
      const found = dfs(t.id, [t.id]);
      if (found !== null) return found;
    }
  }

  return null;
}

function buildExecution(): AgentExecution {
  return {
    executionId:    `exec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    startedAt:      Date.now(),
    status:         'RUNNING',
    completedTasks: [],
  };
}

function cloneExecution(exec: AgentExecution): AgentExecution {
  const copy: AgentExecution = {
    executionId:    exec.executionId,
    startedAt:      exec.startedAt,
    status:         exec.status,
    completedTasks: [...exec.completedTasks],
  };
  if (exec.completedAt !== undefined) copy.completedAt = exec.completedAt;
  if (exec.currentTask !== undefined) copy.currentTask  = exec.currentTask;
  return copy;
}

/**
 * Defensive shallow-clone of an AgentDefinition.
 * runtime, tools, and memory are shared by reference (objects with identity).
 */
function cloneAgent(def: AgentDefinition): AgentDefinition {
  const copy: AgentDefinition = {
    id:   def.id,
    name: def.name,
  };
  if (def.description !== undefined) copy.description = def.description;
  if (def.runtime     !== undefined) copy.runtime     = def.runtime;
  if (def.tools       !== undefined) copy.tools       = def.tools;
  if (def.memory      !== undefined) copy.memory      = def.memory;
  return copy;
}

function coordErr<T>(
  code:    AgentCoordinatorErrorCode,
  message: string,
  cause?:  unknown,
): AgentCoordinatorResult<T> {
  const error: AgentCoordinatorError = { code, message };
  if (cause !== undefined) error.cause = cause;
  return { ok: false, error };
}
