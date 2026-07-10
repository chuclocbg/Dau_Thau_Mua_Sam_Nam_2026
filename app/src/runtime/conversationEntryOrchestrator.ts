import { detectIntent } from '../reasoning/application/intentDetector.ts'
import { formatConversationResponse } from '../reasoning/application/outputFormatter.ts'
import { runToolCallingStage, neverInvokeTool } from '../reasoning/application/toolCallingStage.ts'
import type { ToolAugmentedResponse } from '../reasoning/domain/toolCallingTypes.ts'
import type { AdvisoryConversationMessage } from '../conversation/domain/conversationTypes.ts'
import { RuntimeSessionBuilder } from './runtimeSessionBuilder.ts'
import type { RuntimeContext } from './runtimeContext.ts'

// ── Conversation Entry Orchestration — Phase X.11 Application Runtime ─────────
// The one new entry point this milestone adds: given a question (and optionally an existing
// session), resolves/creates the session, runs the EXACT SAME frozen reasoning chain
// src/api/reasoningRoutes.ts (Phase X.9.1) already calls -- detectIntent() ->
// reasoningPipeline.answer() -> formatConversationResponse() -> runToolCallingStage() with the
// default neverInvokeTool decider -- then records and persists the turn. No reasoning/output/
// tool-calling logic of its own; this file only orchestrates session bookkeeping around calls
// that were already public and already frozen.
//
// Token counting mirrors src/ai/application/aiContextBuilder.ts's own private estimateTokens()
// (4 chars/token) rather than importing it: that function is not exported, and this milestone
// may not modify Phase X.2's frozen aiContextBuilder.ts just to export one two-line helper.
// Duplicating this specific, trivial arithmetic estimate is the smaller violation.

const CHARS_PER_TOKEN_ESTIMATE = 4

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE)
}

function buildMessage(role: AdvisoryConversationMessage['role'], content: string): AdvisoryConversationMessage {
  return {
    messageId: crypto.randomUUID(),
    role,
    content,
    timestamp: new Date().toISOString(),
    tokenCount: estimateTokens(content),
  }
}

export interface ConversationTurnRequest {
  /** Omit to start a new session. */
  readonly sessionId?: string
  readonly question: string
  readonly asOfDate?: string
}

export interface ConversationTurnResult {
  readonly sessionId: string
  readonly turnNumber: number
  readonly response: ToolAugmentedResponse
}

export async function runConversationTurn(
  runtime: RuntimeContext,
  request: ConversationTurnRequest,
): Promise<ConversationTurnResult> {
  const builder = new RuntimeSessionBuilder(runtime.sessionRepository)
  const resumed = request.sessionId ? await builder.resumeSession(request.sessionId) : null
  const session = resumed ?? (await builder.createSession())

  const intent = detectIntent({ question: request.question, asOfDate: request.asOfDate })
  const answer = await runtime.application.reasoningPipeline.answer(intent)
  const formatted = formatConversationResponse(answer)
  const augmented = await runToolCallingStage(formatted, answer, runtime.application.toolExecutor, { decider: neverInvokeTool })

  const userMessage = buildMessage('USER', request.question)
  const assistantMessage = buildMessage('ASSISTANT', formatted.markdown)
  session.recordTurn(userMessage, assistantMessage, intent.intentType)

  const persisted = await builder.persist(session)
  const turnNumber = persisted.history.messages.filter(m => m.role === 'USER').length

  return { sessionId: session.sessionId, turnNumber, response: augmented }
}
