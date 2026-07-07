import { formatConversationResponse } from '../../reasoning/application/outputFormatter.ts'
import { runToolCallingStage } from '../../reasoning/application/toolCallingStage.ts'
import type { ReasoningEnginePipeline } from '../../reasoning/application/reasoningEnginePipeline.ts'
import type { ReasoningIntent } from '../../reasoning/domain/reasoningTypes.ts'
import type { FormattingOptions } from '../../reasoning/domain/conversationResponseTypes.ts'
import type { ToolAugmentedResponse, ToolDecider } from '../../reasoning/domain/toolCallingTypes.ts'
import type { ToolExecutor } from '../../providers/ToolExecutor.ts'
import type { RetryOptions } from '../../providers/RetryPolicy.ts'
import type { WorkerTask } from '../domain/multiAgentTypes.ts'

// ── Reasoning Worker Adapter — Phase X.8 ───────────────────────────────────────
// The ONE file in src/multiagent/ that touches the reasoning layer, exactly mirroring
// mcpToolAdapter.ts's role as the single composition point in Phase X.7. Wraps the real, frozen
// chain — ReasoningEnginePipeline.answer() -> formatConversationResponse() ->
// runToolCallingStage() — into a single WorkerTask.execute() callback. Zero new reasoning
// capability: every step here is an unmodified call to an already-frozen, already-tested public
// function. CoordinatorAgent never imports this file or anything it depends on; the wiring only
// runs in the direction Coordinator -> WorkerTask -> (this adapter) -> reasoning pipeline, never
// the reverse.
//
// "Agents never perform reasoning independently, reasoning remains centralized": this adapter
// is the proof — every WorkerTask it builds calls the SAME shared ReasoningEnginePipeline
// instance the caller injects, never a per-task or per-agent copy of the reasoning logic.

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key])
    }
    Object.freeze(value)
  }
  return value
}

export interface ReasoningWorkerOptions {
  readonly formatting?: FormattingOptions
  readonly executor?: ToolExecutor
  readonly decider?: ToolDecider
  readonly toolRetry?: RetryOptions
  readonly toolTimeoutMs?: number
}

export function buildReasoningWorkerTask(
  id: string,
  intent: ReasoningIntent,
  pipeline: ReasoningEnginePipeline,
  options: ReasoningWorkerOptions = {},
  dependsOn?: readonly string[],
): WorkerTask {
  return {
    id,
    dependsOn,
    execute: async (): Promise<ToolAugmentedResponse> => {
      const answer = await pipeline.answer(intent)
      const response = formatConversationResponse(answer, options.formatting)

      if (options.executor === undefined) {
        return deepFreeze({ response, toolInvoked: false, toolResults: [] })
      }
      return runToolCallingStage(response, answer, options.executor, {
        decider: options.decider, retry: options.toolRetry, timeoutMs: options.toolTimeoutMs,
      })
    },
  }
}
