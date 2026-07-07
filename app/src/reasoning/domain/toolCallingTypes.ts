import type { ToolCall } from '../../providers/ToolRegistry.ts'
import type { ConversationResponse } from './conversationResponseTypes.ts'
import type { ReasoningAnswerResult } from './reasoningAnswerTypes.ts'

// ── Tool Calling Types — Phase X.6 ─────────────────────────────────────────────
// NUMBERING NOTE: PHASE_X_EXECUTION_PLAN.md's own X.5 ("Tool Calling") is scoped around MCP
// (MCPGateway/IMCPTool/mcpToolRegistry) — this milestone explicitly treats "Tool Calling" and
// "MCP" as two separate things (MCP out of scope here). Same collision pattern already
// reconciled for X.4/X.5 (Output Formatting); recorded transparently, tracked under the user's
// own "Phase X.6 (Tool Calling)" label for this session.
//
// Reuses ToolCall (src/providers/ToolRegistry.ts — a pre-existing, unrelated "P6" provider-
// layer track, confirmed by direct inspection, not modified) as-is: { name, arguments }. Also
// reuses ToolExecutionResult/ToolExecutionOptions (src/providers/ToolExecutor.ts) and
// RetryOptions (src/providers/RetryPolicy.ts) directly at the application layer — see
// toolCallingStage.ts's own header note for what is reused vs. newly built.
//
// ToolInvocationDecision/NormalizedToolResult/ToolAugmentedResponse/ToolDecider are new: this
// milestone's own thin orchestration vocabulary. ToolAugmentedResponse wraps X.5's
// ConversationResponse (frozen, never modified) rather than extending it — "never bypass
// OutputFormatter" means composing its output, not reaching past or altering its type.

export interface ToolInvocationDecision {
  readonly shouldInvoke: boolean
  readonly call?: ToolCall
  readonly reason: string
}

export type ToolDecider = (
  response: ConversationResponse, answer: ReasoningAnswerResult,
) => ToolInvocationDecision

export interface NormalizedToolResult {
  readonly toolName: string
  readonly success: boolean
  readonly output?: unknown
  readonly errorMessage?: string
  readonly attempts: number
  readonly durationMs: number
}

export interface ToolAugmentedResponse {
  readonly response: ConversationResponse
  readonly toolInvoked: boolean
  readonly toolResults: readonly NormalizedToolResult[]
}
