import { ToolExecutor } from '../../providers/ToolExecutor.ts'
import { RetryPolicy } from '../../providers/RetryPolicy.ts'
import type { ToolExecutionResult } from '../../providers/ToolExecutor.ts'
import type { RetryOptions } from '../../providers/RetryPolicy.ts'
import type { ToolCall } from '../../providers/ToolRegistry.ts'
import type {
  NormalizedToolResult, ToolAugmentedResponse, ToolDecider,
} from '../domain/toolCallingTypes.ts'
import type { ConversationResponse } from '../domain/conversationResponseTypes.ts'
import type { ReasoningAnswerResult } from '../domain/reasoningAnswerTypes.ts'

// ── Tool Calling Stage — Phase X.6 ─────────────────────────────────────────────
// Reasoning -> Output Formatting -> Tool Calling -> Conversation Response. Consumes X.5's
// ConversationResponse (and the ReasoningAnswerResult it was built from) and produces only a
// ToolAugmentedResponse. Never performs reasoning, retrieval, ranking, conflict resolution,
// confidence computation, or citation generation — all of that is already complete by the time
// a response reaches this stage. Never regenerates or bypasses ConversationResponse; wraps it.
//
// TRANSPARENCY NOTE on "existing tool abstractions" / "previous ToolCalling experiments" (per
// this milestone's instruction to inspect the repository, not trust documentation):
// src/providers/ToolCallingAgent.ts and src/providers/AgentRuntime.ts already exist, but both
// are part of a pre-existing, unrelated "P6" provider-layer track built around an actual LLM
// call loop (ProviderManager.chat(), detecting tool-call syntax embedded in raw LLM response
// text, its own ConversationMemory). None of that applies to Phase X's deterministic,
// non-LLM-driven reasoning pipeline — reusing them would mean introducing an LLM call, which is
// explicitly out of scope ("LLM Adapter"). They are not imported here.
//
// What IS genuinely reused, per "reuse existing provider interfaces whenever possible, prefer
// composition": src/providers/ToolRegistry.ts and src/providers/ToolExecutor.ts — both fully
// generic (no LLM/provider coupling at all) and already implement tool registration, parameter
// validation, invocation, and timeout handling exactly as this milestone's own "Tool registry /
// Parameter mapping / Invocation / Timeout handling / Tool result normalization"
// responsibilities require. Neither is modified; ToolExecutor is constructor-injected here, and
// tool REGISTRATION itself (which real tools exist) is entirely the caller's concern — this
// milestone never constructs a ToolRegistry or registers a tool of its own.
//
// src/providers/RetryPolicy.ts is partially reused: its RetryOptions shape and its .sleep()
// exponential-backoff-with-jitter timing are reused directly (constructed here, called here) —
// but its own isTransient()/isNonRetryable() classify a DIFFERENT vocabulary of error codes
// (NETWORK_ERROR/RATE_LIMITED/etc., for LLM provider failures) that does not match
// ToolExecutor's own error codes (TOOL_NOT_FOUND/INVALID_ARGUMENTS/TOOL_EXECUTION_FAILED/
// TIMEOUT/UNKNOWN_ERROR) at all. This file supplies its own, small, tool-execution-specific
// retry-worthiness classification (RETRYABLE_TOOL_ERROR_CODES) rather than misapplying
// RetryPolicy's provider-specific one — reusing the mechanism, not fabricating a false parity
// with a different domain's error codes.
//
// "Tool selection" (which tool, if any, applies to a given response) is inherently a
// domain/product decision this project has no basis to invent yet — no real tool exists for
// Vietnamese public procurement legal reasoning today. The decision itself is dependency-
// injected via ToolDecider; the default (neverInvokeTool) always declines, honestly reflecting
// that no such tool exists, never fabricating a trigger rule.

const RETRYABLE_TOOL_ERROR_CODES = new Set(['TIMEOUT', 'TOOL_EXECUTION_FAILED', 'UNKNOWN_ERROR'])

export const neverInvokeTool: ToolDecider = (): { shouldInvoke: false; reason: string } => ({
  shouldInvoke: false,
  reason: 'No tool trigger is configured for this domain; the default decider never invokes a tool.',
})

function normalizeResult(result: ToolExecutionResult, attempts: number): NormalizedToolResult {
  return {
    toolName: result.toolName,
    success: result.ok,
    output: result.ok ? result.result : undefined,
    errorMessage: result.ok ? undefined : result.error?.message,
    attempts,
    durationMs: result.durationMs,
  }
}

async function executeWithRetry(
  executor: ToolExecutor, call: ToolCall, retryOptions: RetryOptions | undefined, timeoutMs: number | undefined,
): Promise<NormalizedToolResult> {
  const policy = new RetryPolicy(retryOptions)
  let lastResult: ToolExecutionResult | undefined

  for (let attempt = 0; attempt < policy.maxAttempts; attempt++) {
    lastResult = await executor.execute(call, timeoutMs !== undefined ? { timeoutMs } : undefined)
    if (lastResult.ok || !RETRYABLE_TOOL_ERROR_CODES.has(lastResult.error!.code)) {
      return normalizeResult(lastResult, attempt + 1)
    }
    if (attempt < policy.maxAttempts - 1) await policy.sleep(attempt)
  }
  return normalizeResult(lastResult!, policy.maxAttempts)
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key])
    }
    Object.freeze(value)
  }
  return value
}

export interface ToolCallingStageOptions {
  readonly decider?: ToolDecider
  readonly retry?: RetryOptions
  readonly timeoutMs?: number
}

export async function runToolCallingStage(
  response: ConversationResponse,
  answer: ReasoningAnswerResult,
  executor: ToolExecutor,
  options: ToolCallingStageOptions = {},
): Promise<ToolAugmentedResponse> {
  const decider = options.decider ?? neverInvokeTool
  const decision = decider(response, answer)

  if (!decision.shouldInvoke || decision.call === undefined) {
    return deepFreeze({ response, toolInvoked: false, toolResults: [] })
  }

  const result = await executeWithRetry(executor, decision.call, options.retry, options.timeoutMs)
  return deepFreeze({ response, toolInvoked: true, toolResults: [result] })
}
