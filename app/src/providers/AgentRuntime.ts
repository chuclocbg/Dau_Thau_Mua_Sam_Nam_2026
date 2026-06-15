/**
 * P6-10P: AgentRuntime — top-level orchestrator that wires together
 * ProviderManager, ConversationBuilder, ConversationMemory, ToolRegistry,
 * and ToolExecutor into a single agent execution surface.
 *
 * Public API:
 *   run()          — build conversation → chat() → append memory → result
 *   runStream()    — build conversation → stream() → yield chunks → append memory
 *   executeTool()  — resolve tool → execute → normalize
 *
 * Design rules (consistent with the rest of the provider layer):
 *   - Never throws uncaught exceptions; every failure is a result value
 *     (run/executeTool) or a stream 'error' + 'done' chunk (runStream).
 *   - Memory is appended only after a successful run or a fully-consumed stream.
 *   - ConversationBuilder is created per-call so each call is independent.
 *   - ToolExecutor can be injected or created from an injected ToolRegistry.
 *   - Defensive copies: usage object is shallow-copied from the provider response.
 *
 * Error codes:
 *   PROVIDER_ERROR     — ProviderManager.chat() / stream() returned an error
 *   CONVERSATION_ERROR — ConversationBuilder.buildConversation() failed
 *   TOOL_ERROR         — tool not found, invalid arguments, or handler threw
 *   MEMORY_ERROR       — ConversationMemory operation threw unexpectedly
 *   STREAM_ERROR       — unexpected exception during streaming
 *   UNKNOWN_ERROR      — catch-all for unexpected failures
 */

import { ProviderManager }                   from './ProviderManager';
import { ConversationBuilder }                from './ConversationBuilder';
import { ConversationMemory }                 from './ConversationMemory';
import { ToolRegistry }                       from './ToolRegistry';
import { ToolExecutor, type ToolExecutionOptions } from './ToolExecutor';
import type { StreamChunk }                   from './StreamingTypes';

// ─── Error types ──────────────────────────────────────────────────────────────

export type AgentRuntimeErrorCode =
  | 'PROVIDER_ERROR'      // provider chat/stream failure
  | 'CONVERSATION_ERROR'  // ConversationBuilder build failure
  | 'TOOL_ERROR'          // tool lookup / execution failure
  | 'MEMORY_ERROR'        // unexpected memory operation failure
  | 'STREAM_ERROR'        // unexpected exception during streaming
  | 'UNKNOWN_ERROR';      // catch-all

export interface AgentRuntimeError {
  code:    AgentRuntimeErrorCode;
  message: string;
  cause?:  unknown;
}

// ─── Result ───────────────────────────────────────────────────────────────────

export interface AgentRuntimeResult {
  /** True when the operation completed without error. */
  ok:            boolean;
  /**
   * Text content on success.
   *   run()         → provider's assistant reply
   *   executeTool() → String() of the tool return value
   */
  content?:      string;
  /**
   * Raw tool return value.  Present only for successful executeTool() calls.
   * Primitive values pass through; objects/arrays are shallow-copied by ToolExecutor.
   */
  toolResult?:   unknown;
  /** ProviderId of the provider that handled this run() call. */
  providerUsed?: string;
  /** Model name as reported by the provider (may be undefined). */
  model?:        string;
  /** Finish/stop reason as reported by the provider (may be undefined). */
  finishReason?: string;
  /** Token usage.  Present for run(); absent for executeTool(). */
  usage?: {
    inputTokens:  number;
    outputTokens: number;
    totalTokens:  number;
  };
  /** Error detail.  Present only when ok is false. */
  error?: AgentRuntimeError;
}

// ─── Options ──────────────────────────────────────────────────────────────────

export interface AgentRuntimeOptions {
  /** Unified LLM interface; must be pre-configured with at least one provider. */
  providerManager: ProviderManager;
  /**
   * Optional conversation memory.
   *   run() / runStream() prepend stored history before each provider call
   *   and append the new user message + assistant reply on success.
   */
  memory?: ConversationMemory;
  /**
   * Optional tool registry.  When provided (and toolExecutor is not), AgentRuntime
   * creates a ToolExecutor internally so executeTool() works out of the box.
   */
  toolRegistry?: ToolRegistry;
  /**
   * Optional pre-built ToolExecutor.  Takes precedence over toolRegistry.
   * When neither is provided, executeTool() returns TOOL_ERROR immediately.
   */
  toolExecutor?: ToolExecutor;
}

// ─── AgentRuntime ─────────────────────────────────────────────────────────────

export class AgentRuntime {
  private readonly manager:   ProviderManager;
  private readonly memory?:   ConversationMemory;
  private readonly toolExec?: ToolExecutor;

  constructor(options: AgentRuntimeOptions) {
    this.manager  = options.providerManager;
    this.memory   = options.memory;
    this.toolExec = options.toolExecutor
      ?? (options.toolRegistry ? new ToolExecutor(options.toolRegistry) : undefined);
  }

  /**
   * Executes a single-turn chat against the configured provider.
   *
   * Steps:
   *   1. Build conversation via ConversationBuilder (history injected from memory).
   *   2. Call ProviderManager.chat() with the assembled request.
   *   3. Append user message + assistant reply to memory on success.
   *   4. Return normalized AgentRuntimeResult.
   *
   * Never rejects — all failures are returned as { ok: false, error }.
   */
  async run(
    userMessage: string,
    options?: { system?: string },
  ): Promise<AgentRuntimeResult> {
    try {
      // ── 1. Build conversation ─────────────────────────────────────────────────
      const builder = new ConversationBuilder();
      if (options?.system) builder.setSystem(options.system);
      if (this.memory)     builder.injectHistory(this.memory);
      builder.setUserMessage(userMessage);

      const buildResult = builder.buildConversation();
      if (!buildResult.ok) {
        return agentFail({
          code:    'CONVERSATION_ERROR',
          message: buildResult.error.message,
        });
      }

      // ── 2. Chat ───────────────────────────────────────────────────────────────
      const chatResult = await this.manager.chat(buildResult.conversation.providerManagerRequest);
      if (!chatResult.ok) {
        return agentFail({
          code:    'PROVIDER_ERROR',
          message: chatResult.error.message,
          cause:   chatResult.error,
        });
      }

      // ── 3. Append memory ──────────────────────────────────────────────────────
      if (this.memory) {
        this.memory.addUser(userMessage);
        this.memory.addAssistant(chatResult.value.content);
      }

      // ── 4. Normalize result ───────────────────────────────────────────────────
      const { content, providerId, model, finishReason, usage } = chatResult.value;
      return {
        ok:           true,
        content,
        providerUsed: providerId,
        model,
        finishReason,
        usage:        { ...usage },
      };

    } catch (err) {
      return agentFail({
        code:    'UNKNOWN_ERROR',
        message: `Unexpected error in AgentRuntime.run(): ${String(err)}`,
        cause:   err,
      });
    }
  }

  /**
   * Streams a response from the configured provider.
   *
   * Steps:
   *   1. Build conversation via ConversationBuilder.
   *   2. Call ProviderManager.stream() and yield each chunk to the caller.
   *   3. After the final 'done' chunk, append user message + assistant reply to
   *      memory (only when no 'error' chunk was received).
   *
   * Never throws — streaming failures are yielded as error + done chunks.
   */
  async *runStream(
    userMessage: string,
    options?: { system?: string },
  ): AsyncGenerator<StreamChunk> {
    try {
      // ── 1. Build conversation ─────────────────────────────────────────────────
      const builder = new ConversationBuilder();
      if (options?.system) builder.setSystem(options.system);
      if (this.memory)     builder.injectHistory(this.memory);
      builder.setUserMessage(userMessage);

      const buildResult = builder.buildConversation();
      if (!buildResult.ok) {
        yield { event: 'error', error: { code: 'CONVERSATION_ERROR', message: buildResult.error.message } };
        yield { event: 'done' };
        return;
      }

      // ── 2. Stream ─────────────────────────────────────────────────────────────
      const stream = this.manager.stream(buildResult.conversation.providerManagerRequest);

      let hadError         = false;
      let assistantContent = '';

      // ── 3. Collect + yield chunks ─────────────────────────────────────────────
      for await (const chunk of stream) {
        if (chunk.event === 'error')   hadError         = true;
        if (chunk.event === 'message') assistantContent = chunk.content;
        yield chunk;
      }

      // ── 4. Append memory (success only) ───────────────────────────────────────
      if (!hadError && this.memory) {
        this.memory.addUser(userMessage);
        this.memory.addAssistant(assistantContent);
      }

    } catch (err) {
      yield {
        event: 'error',
        error: {
          code:    'STREAM_ERROR',
          message: `Unexpected error in AgentRuntime.runStream(): ${String(err)}`,
        },
      };
      yield { event: 'done' };
    }
  }

  /**
   * Executes a single tool call.
   *
   * Steps:
   *   1. Verify a ToolExecutor is available (returns TOOL_ERROR if not).
   *   2. Delegate to ToolExecutor.execute().
   *   3. Map ToolExecutionResult → AgentRuntimeResult.
   *
   * Never rejects — all failures are returned as { ok: false, error }.
   */
  async executeTool(
    call:     { name: string; arguments?: Record<string, unknown> },
    options?: ToolExecutionOptions,
  ): Promise<AgentRuntimeResult> {
    try {
      // ── 1. Verify executor ────────────────────────────────────────────────────
      if (!this.toolExec) {
        return agentFail({
          code:    'TOOL_ERROR',
          message: 'No ToolExecutor or ToolRegistry is configured in AgentRuntime. ' +
                   'Pass toolExecutor or toolRegistry in AgentRuntimeOptions.',
        });
      }

      // ── 2. Execute ────────────────────────────────────────────────────────────
      const execResult = await this.toolExec.execute(call, options);

      // ── 3. Normalize ──────────────────────────────────────────────────────────
      if (!execResult.ok) {
        return agentFail({
          code:    'TOOL_ERROR',
          message: execResult.error!.message,
          cause:   execResult.error,
        });
      }

      const raw = execResult.result;
      return {
        ok:         true,
        content:    raw === undefined ? '' : String(raw),
        toolResult: raw,
      };

    } catch (err) {
      return agentFail({
        code:    'UNKNOWN_ERROR',
        message: `Unexpected error in AgentRuntime.executeTool(): ${String(err)}`,
        cause:   err,
      });
    }
  }
}

// ─── Internal helper ──────────────────────────────────────────────────────────

function agentFail(error: AgentRuntimeError): AgentRuntimeResult {
  return { ok: false, error };
}
