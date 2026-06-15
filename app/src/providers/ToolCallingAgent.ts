/**
 * P6-10U: ToolCallingAgent — agentic tool-calling loop that detects tool
 * invocations in LLM responses, executes them via ToolExecutor, injects
 * the results back into the conversation, and repeats until the model
 * produces a final response with no further tool calls.
 *
 * Supported tool-call formats (detectToolCalls):
 *   OpenAI   — <tool_call>{"name":"…","arguments":{…}}</tool_call>
 *   Claude   — <tool_use><name>…</name><input>{…}</input></tool_use>
 *   Gemini   — {"functionCall":{"name":"…","args":{…}}}  (JSON in text)
 *   Generic  — {"tool":"…","arguments":{…}}              (JSON in text)
 *
 * Public API:
 *   detectToolCalls(content)   — extract ToolCall objects from any text
 *   executeToolCalls(calls)    — run calls through ToolExecutor; never rejects
 *   injectToolResults(results) — format results as a conversation turn
 *   run(userMessage, options)  — the full agentic loop; never rejects
 *
 * Loop behaviour (run):
 *   1. Call ProviderManager.chat() with the current message history.
 *   2. Detect tool calls in the response content.
 *   3. If none → final response; update memory; return ToolCallingResult.
 *   4. Execute each tool call; abort immediately on NO_TOOL or
 *      TOOL_EXECUTION_FAILED.
 *   5. Append the assistant turn + an injected-results user turn.
 *   6. Repeat from step 1.
 *   7. After maxIterations (default 10) → MAX_ITERATIONS_EXCEEDED.
 *
 * Metadata preservation:
 *   - usage is accumulated across all iterations.
 *   - providerUsed and model reflect the final iteration's response.
 *   - memory (when injected) is updated only after a successful final response.
 *   - toolCalls and toolResults accumulate across all iterations.
 *
 * Error codes:
 *   NO_TOOL                 — LLM referenced a tool not in the registry
 *   TOOL_EXECUTION_FAILED   — tool handler threw or rejected
 *   INVALID_TOOL_CALL       — LLM emitted a tool-call block that cannot be parsed
 *   MAX_ITERATIONS_EXCEEDED — loop hit the iteration limit
 *   PROVIDER_ERROR          — ProviderManager.chat() returned an error
 *   INVALID_INPUT           — empty / whitespace-only userMessage
 *
 * Design rules (consistent with the rest of the provider layer):
 *   - Never throws — every failure is { ok: false, error }.
 *   - detectToolCalls() returns [] on any un-parseable input.
 *   - Defensive copies: returned ToolCall / ToolCallResult objects are independent.
 */

import { ProviderManager, type ProviderManagerMessage } from './ProviderManager';
import { ToolExecutor }      from './ToolExecutor';
import { ToolRegistry }      from './ToolRegistry';
import { ConversationMemory } from './ConversationMemory';

// ─── ToolCall ─────────────────────────────────────────────────────────────────

/** Structured tool invocation extracted from LLM response text. */
export interface ToolCall {
  /** Registered tool name. */
  name:      string;
  /** Arguments parsed from the LLM response. */
  arguments: Record<string, unknown>;
}

// ─── ToolCallResult ───────────────────────────────────────────────────────────

/** Result of executing a single ToolCall via ToolExecutor. */
export interface ToolCallResult {
  /** The tool call that was executed. */
  call:       ToolCall;
  /** Handler return value on success. */
  result?:    unknown;
  /** Human-readable error message on failure. */
  error?:     string;
  /** Wall-clock execution time in milliseconds. */
  durationMs: number;
}

// ─── ToolCallOptions ──────────────────────────────────────────────────────────

/** Per-call options for run(). */
export interface ToolCallOptions {
  /** Maximum number of LLM→tool iterations. Defaults to 10. */
  maxIterations?: number;
  /** Optional system prompt forwarded to the provider on every iteration. */
  system?: string;
}

// ─── Error types ──────────────────────────────────────────────────────────────

export type ToolCallingErrorCode =
  | 'NO_TOOL'                // tool referenced by LLM is not in the registry
  | 'TOOL_EXECUTION_FAILED'  // tool handler threw or rejected
  | 'INVALID_TOOL_CALL'      // tool-call block present but unparseable
  | 'MAX_ITERATIONS_EXCEEDED'// iteration limit reached without a final response
  | 'PROVIDER_ERROR'         // ProviderManager.chat() returned an error
  | 'INVALID_INPUT';         // empty / whitespace-only userMessage

export interface ToolCallingError {
  code:    ToolCallingErrorCode;
  message: string;
  cause?:  unknown;
}

// ─── ToolCallingResult ────────────────────────────────────────────────────────

/** Outcome of a complete run() call (including any tool-calling iterations). */
export interface ToolCallingResult {
  ok:           boolean;
  /** Final text content from the LLM (present on success). */
  content?:     string;
  /** All tool calls executed across every iteration. */
  toolCalls?:   ToolCall[];
  /** All tool results collected across every iteration. */
  toolResults?: ToolCallResult[];
  /** Number of LLM calls made (1 = no tool calls needed). */
  iterations?:  number;
  /** Provider id from the last iteration. */
  providerUsed?: string;
  /** Model name from the last iteration. */
  model?:        string;
  /** Token usage accumulated across all iterations. */
  usage?: {
    inputTokens:  number;
    outputTokens: number;
    totalTokens:  number;
  };
  error?: ToolCallingError;
}

// ─── ToolCallingAgent ─────────────────────────────────────────────────────────

/** Constructor options (not exported; callers use the class directly). */
interface ToolCallingAgentConfig {
  providerManager: ProviderManager;
  toolExecutor?:   ToolExecutor;
  toolRegistry?:   ToolRegistry;
  memory?:         ConversationMemory;
}

export class ToolCallingAgent {
  private readonly manager:  ProviderManager;
  private readonly toolExec?: ToolExecutor;
  private readonly memory?:  ConversationMemory;

  constructor(config: ToolCallingAgentConfig) {
    this.manager  = config.providerManager;
    this.memory   = config.memory;
    this.toolExec = config.toolExecutor
      ?? (config.toolRegistry ? new ToolExecutor(config.toolRegistry) : undefined);
  }

  // ─── detectToolCalls ────────────────────────────────────────────────────────

  /**
   * Extracts every tool call embedded in `content`, supporting four formats:
   *   OpenAI  — <tool_call> JSON </tool_call>
   *   Claude  — <tool_use><name>…</name><input>…</input></tool_use>
   *   Gemini  — top-level JSON with a "functionCall" key
   *   Generic — top-level JSON with a "tool" key
   *
   * Returns an empty array for any non-string input or when no calls are found.
   * Never throws.
   */
  detectToolCalls(content: string): ToolCall[] {
    if (typeof content !== 'string' || content.length === 0) return [];

    const calls: ToolCall[] = [];

    // Tag-based formats (operate on raw text via regex)
    calls.push(...detectOpenAI(content));
    calls.push(...detectClaude(content));

    // JSON-scanning formats (share one scan pass)
    const jsonObjects = findJsonObjects(content);
    calls.push(...detectGemini(jsonObjects));
    calls.push(...detectGenericJson(jsonObjects));

    // Return independent copies so caller cannot mutate internals
    return calls.map(cloneCall);
  }

  // ─── executeToolCalls ───────────────────────────────────────────────────────

  /**
   * Executes an array of ToolCalls via the configured ToolExecutor.
   *
   * When no ToolExecutor is configured, every call returns an error result.
   * Never rejects — all errors are encoded in ToolCallResult.error.
   */
  async executeToolCalls(calls: ToolCall[]): Promise<ToolCallResult[]> {
    if (calls.length === 0) return [];

    if (!this.toolExec) {
      return calls.map(call => ({
        call:       cloneCall(call),
        error:      'No ToolExecutor or ToolRegistry is configured in ToolCallingAgent.',
        durationMs: 0,
      }));
    }

    return Promise.all(
      calls.map(async call => {
        try {
          const r = await this.toolExec!.execute(call);
          if (r.ok) {
            return { call: cloneCall(call), result: r.result, durationMs: r.durationMs };
          }
          return {
            call:       cloneCall(call),
            error:      r.error!.message,
            durationMs: r.durationMs,
          };
        } catch (err) {
          return {
            call:       cloneCall(call),
            error:      `Unexpected error executing '${call.name}': ${String(err)}`,
            durationMs: 0,
          };
        }
      }),
    );
  }

  // ─── injectToolResults ──────────────────────────────────────────────────────

  /**
   * Formats an array of ToolCallResults as a human-readable string suitable
   * for injection as a user-role conversation turn.
   *
   * Format per result:
   *   toolName({"arg":"val"}) → <json result>   (success)
   *   toolName({"arg":"val"}) → ERROR: <message> (failure)
   *
   * Never throws.
   */
  injectToolResults(results: ToolCallResult[]): string {
    if (results.length === 0) return 'Tool execution results: (none)';

    const lines = results.map(r => {
      const argsStr = safeStringify(r.call.arguments);
      if (r.error !== undefined) {
        return `${r.call.name}(${argsStr}) → ERROR: ${r.error}`;
      }
      return `${r.call.name}(${argsStr}) → ${safeStringify(r.result)}`;
    });

    return `Tool execution results:\n${lines.join('\n')}`;
  }

  // ─── run ────────────────────────────────────────────────────────────────────

  /**
   * Runs the full agentic tool-calling loop.
   *
   * Steps per iteration:
   *   1. Call ProviderManager.chat() with current history.
   *   2. Detect tool calls in response content.
   *   3a. No calls → update memory; return final ToolCallingResult.
   *   3b. Has calls → execute each; abort on any tool error.
   *   4. Append assistant turn + injected-results user turn.
   *   5. Repeat until maxIterations reached.
   *
   * Never rejects.
   */
  async run(
    userMessage: string,
    options?:    ToolCallOptions,
  ): Promise<ToolCallingResult> {
    try {
      // ── INVALID_INPUT guard ────────────────────────────────────────────────
      if (!userMessage?.trim()) {
        return tcFail({
          code:    'INVALID_INPUT',
          message: 'userMessage must be a non-empty, non-whitespace string.',
        });
      }

      const maxIter = options?.maxIterations ?? 10;
      const system  = options?.system;

      const messages: ProviderManagerMessage[] = [
        { role: 'user', content: userMessage },
      ];

      let iteration   = 0;
      const allCalls:   ToolCall[]       = [];
      const allResults: ToolCallResult[] = [];
      const totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
      let providerUsed: string | undefined;
      let modelName:    string | undefined;

      // ── Agentic loop ───────────────────────────────────────────────────────
      while (iteration < maxIter) {
        iteration++;

        // 1. Call LLM
        const chatResult = await this.manager.chat({ messages, system });
        if (!chatResult.ok) {
          return tcFail({
            code:    'PROVIDER_ERROR',
            message: chatResult.error.message,
            cause:   chatResult.error,
          });
        }

        const response = chatResult.value;
        providerUsed                 = response.providerId;
        modelName                    = response.model;
        totalUsage.inputTokens  += response.usage.inputTokens;
        totalUsage.outputTokens += response.usage.outputTokens;
        totalUsage.totalTokens  += response.usage.totalTokens;

        // 2. Detect tool calls
        const calls = this.detectToolCalls(response.content);

        // 3a. No tool calls → final response
        if (calls.length === 0) {
          if (this.memory) {
            this.memory.addUser(userMessage);
            this.memory.addAssistant(response.content);
          }
          return {
            ok:          true,
            content:     response.content,
            toolCalls:   [...allCalls],
            toolResults: [...allResults],
            iterations:  iteration,
            providerUsed,
            model:       modelName,
            usage:       { ...totalUsage },
          };
        }

        // 3b. Execute tool calls — abort immediately on any error
        for (const call of calls) {
          if (!this.toolExec) {
            return tcFail({
              code:    'NO_TOOL',
              message: `Tool '${call.name}' cannot be executed: no ToolExecutor configured.`,
            });
          }

          const execResult = await this.toolExec.execute(call);
          if (!execResult.ok) {
            const isNotFound = execResult.error!.code === 'TOOL_NOT_FOUND';
            return tcFail({
              code:    isNotFound ? 'NO_TOOL' : 'TOOL_EXECUTION_FAILED',
              message: execResult.error!.message,
              cause:   execResult.error,
            });
          }

          allCalls.push(cloneCall(call));
          allResults.push({
            call:       cloneCall(call),
            result:     execResult.result,
            durationMs: execResult.durationMs,
          });
        }

        // 4. Append turns and continue loop
        messages.push({ role: 'assistant', content: response.content });
        messages.push({
          role:    'user',
          content: this.injectToolResults(allResults.slice(allResults.length - calls.length)),
        });
      }

      // 5. Iteration limit exceeded
      return tcFail({
        code:    'MAX_ITERATIONS_EXCEEDED',
        message: `Tool-calling loop exceeded ${maxIter} iterations without reaching a final response.`,
      });

    } catch (err) {
      return tcFail({
        code:    'PROVIDER_ERROR',
        message: `Unexpected error in ToolCallingAgent.run(): ${String(err)}`,
        cause:   err,
      });
    }
  }
}

// ─── Format detectors ─────────────────────────────────────────────────────────

/** Detects OpenAI-style <tool_call>JSON</tool_call> blocks. */
function detectOpenAI(content: string): ToolCall[] {
  const calls: ToolCall[] = [];
  const re = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(content)) !== null) {
    try {
      const obj = JSON.parse(m[1].trim()) as Record<string, unknown>;
      if (typeof obj?.name === 'string') {
        calls.push({
          name:      obj.name,
          arguments: (obj.arguments as Record<string, unknown>) ?? {},
        });
      }
    } catch { /* malformed JSON — skip */ }
  }

  return calls;
}

/**
 * Detects Claude-style <tool_use> blocks:
 *   <tool_use><name>…</name><input>JSON</input></tool_use>
 */
function detectClaude(content: string): ToolCall[] {
  const calls: ToolCall[] = [];
  const re = /<tool_use>([\s\S]*?)<\/tool_use>/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(content)) !== null) {
    const block      = m[1];
    const nameMatch  = /<name>([\s\S]*?)<\/name>/.exec(block);
    const inputMatch = /<input>([\s\S]*?)<\/input>/.exec(block);

    if (!nameMatch) continue;

    let args: Record<string, unknown> = {};
    if (inputMatch) {
      try { args = JSON.parse(inputMatch[1].trim()) as Record<string, unknown>; }
      catch { /* malformed JSON — use empty args */ }
    }

    calls.push({ name: nameMatch[1].trim(), arguments: args });
  }

  return calls;
}

/** Detects Gemini-style {"functionCall":{"name":"…","args":{…}}} objects. */
function detectGemini(objects: unknown[]): ToolCall[] {
  const calls: ToolCall[] = [];

  for (const obj of objects) {
    const o  = obj as Record<string, unknown> | null;
    const fc = o?.functionCall as Record<string, unknown> | undefined;
    if (!fc || typeof fc.name !== 'string') continue;
    calls.push({
      name:      fc.name,
      arguments: (fc.args as Record<string, unknown>) ?? {},
    });
  }

  return calls;
}

/** Detects generic {"tool":"…","arguments":{…}} objects. */
function detectGenericJson(objects: unknown[]): ToolCall[] {
  const calls: ToolCall[] = [];

  for (const obj of objects) {
    const o = obj as Record<string, unknown> | null;
    // Must have "tool" string key; must NOT have "functionCall" (avoid double-detect)
    if (typeof o?.tool !== 'string' || 'functionCall' in (o ?? {})) continue;
    calls.push({
      name:      o.tool,
      arguments: (o.arguments as Record<string, unknown>) ?? {},
    });
  }

  return calls;
}

// ─── JSON scanner ─────────────────────────────────────────────────────────────

/**
 * Scans `content` for top-level balanced JSON objects `{…}`, handling nested
 * objects/arrays and string literals (including escaped characters) correctly.
 *
 * Returns every successfully-parsed object found in the text.
 * Never throws.
 */
function findJsonObjects(content: string): unknown[] {
  const results: unknown[] = [];
  let i = 0;

  outer: while (i < content.length) {
    if (content[i] !== '{') { i++; continue; }

    let depth    = 0;
    let inStr    = false;
    let escaped  = false;

    for (let j = i; j < content.length; j++) {
      const ch = content[j];

      if (escaped)    { escaped = false; }
      else if (inStr) {
        if (ch === '\\') escaped = true;
        else if (ch === '"') inStr = false;
      } else {
        if      (ch === '"') inStr = true;
        else if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            try { results.push(JSON.parse(content.slice(i, j + 1))); }
            catch { /* not valid JSON — skip */ }
            i = j + 1;
            continue outer;
          }
        }
      }
    }

    // Unmatched opening brace — no further objects possible
    break;
  }

  return results;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function cloneCall(call: ToolCall): ToolCall {
  return {
    name:      call.name,
    arguments: { ...call.arguments },
  };
}

function safeStringify(value: unknown): string {
  try { return JSON.stringify(value); }
  catch { return String(value); }
}

function tcFail(error: ToolCallingError): ToolCallingResult {
  return { ok: false, error };
}
