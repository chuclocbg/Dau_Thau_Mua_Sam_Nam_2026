import type { RetryOptions } from '../../providers/RetryPolicy.ts'

// ── Multi-Agent Types — Phase X.8 ──────────────────────────────────────────────
// Question -> Coordinator Agent -> [existing frozen chain: Reasoning Engine -> Output
// Formatting -> Tool Calling (MCP folded in one layer down, per X.7) ] -> Conversation Response.
//
// ARCHITECTURE NOTE on the diagram order given for this milestone ("Reasoning Engine -> Tool
// Calling -> MCP -> Output Formatting"): the REAL, already-frozen pipeline order established in
// X.5/X.6/X.7 is Reasoning -> Output Formatting -> Tool Calling (MCP-sourced tools are already
// folded into whatever ToolExecutor/ToolRegistry a caller injects, one layer below Tool
// Calling — there is no separate top-level MCP step to sequence). Per this milestone's own "do
// not trust documentation over code" rule and "no architectural redesign," reasoningWorkerAdapter.ts
// preserves the real, frozen call order rather than reordering already-frozen stages to match
// the diagram's prose — reordering would require modifying frozen milestones, which is
// explicitly forbidden. Recorded transparently, not silently changed.
//
// GOVERNANCE NOTE: REJECTED_DESIGNS.md's "Rejected: Multi-LLM-Agent Conversations" already
// decided against multiple independent LLM agents talking to each other, favoring "deterministic
// upstream orchestration with exactly one LLM synthesis call." This milestone's own explicit
// rule ("Agents NEVER perform reasoning independently. Reasoning remains centralized.") is the
// same decision restated — so a WorkerTask here is a deterministic, opaque async callback the
// CoordinatorAgent schedules/retries/times-out without any awareness of what it does; the ONLY
// concrete worker this milestone provides (reasoningWorkerAdapter.ts's buildReasoningWorkerTask())
// deterministically calls the single, already-centralized ReasoningEnginePipeline — it never
// invents a second reasoning path or an LLM-to-LLM hop.
//
// TRANSPARENCY NOTE: src/providers/MultiAgentCoordinator.ts (pre-existing, unrelated 'P6' track,
// P6-10V) already implements agent registration + topological task scheduling, but its
// AgentTask/AgentDefinition model requires an AgentRuntime.run(prompt) — an actual LLM call via
// ProviderManager, and therefore literal independent reasoning per agent. That is exactly what
// this milestone forbids, so it is not imported or reused; CoordinatorAgent/taskScheduler.ts are
// new, deterministic, LLM-free orchestration code written for this milestone specifically. This
// is not a duplication of "reasoning/retrieval/Tool Calling/MCP/formatting" (the things this
// milestone is explicitly told never to duplicate) — task scheduling/dependency-tracking is this
// milestone's own deliverable, and no reasoning-layer logic is reimplemented anywhere in it.
//
// WorkerTask deliberately reuses RetryOptions (src/providers/RetryPolicy.ts) rather than
// declaring a parallel options shape.

export interface WorkerTask {
  readonly id: string
  readonly dependsOn?: readonly string[]
  readonly execute: (dependencyResults: ReadonlyMap<string, unknown>, signal?: AbortSignal) => Promise<unknown>
}

export type WorkerStatus = 'COMPLETED' | 'FAILED' | 'CANCELLED'

export interface WorkerOutcome {
  readonly taskId: string
  readonly status: WorkerStatus
  readonly value?: unknown
  readonly errorMessage?: string
  readonly attempts: number
  readonly durationMs: number
}

export type CoordinatorErrorCode = 'DUPLICATE_TASK' | 'MISSING_DEPENDENCY' | 'CIRCULAR_DEPENDENCY'

export interface CoordinatorError {
  readonly code: CoordinatorErrorCode
  readonly message: string
}

export type CoordinatorResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: CoordinatorError }

export type CoordinationRunStatus = 'COMPLETED' | 'FAILED' | 'CANCELLED'

export interface CoordinationRun {
  readonly runId: string
  readonly status: CoordinationRunStatus
  readonly outcomes: readonly WorkerOutcome[]
  readonly startedAt: string
  readonly completedAt: string
}

export interface CoordinatorOptions {
  readonly taskTimeoutMs?: number
  readonly retry?: RetryOptions
  readonly signal?: AbortSignal
}
