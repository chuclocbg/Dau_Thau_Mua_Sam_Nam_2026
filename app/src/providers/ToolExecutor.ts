/**
 * P6-10O: ToolExecutor — executes tool calls against a ToolRegistry.
 *
 * Responsibilities:
 *   1. Resolve the named tool from the injected ToolRegistry.
 *   2. Validate that every required parameter is present in the arguments.
 *   3. Execute the handler (sync or async) with an optional wall-clock timeout.
 *   4. Normalise the result into ToolExecutionResult with durationMs metadata.
 *   5. Never let an exception escape execute() — every failure is a result value.
 *
 * Error codes:
 *   TOOL_NOT_FOUND        — name not in registry
 *   INVALID_ARGUMENTS     — a required parameter key is absent from arguments
 *   TOOL_EXECUTION_FAILED — handler threw or rejected
 *   TIMEOUT               — execution exceeded options.timeoutMs
 *   UNKNOWN_ERROR         — catch-all for unexpected failures
 *
 * Design rules (consistent with the rest of the provider layer):
 *   - ToolRegistry is constructor-injected; ToolExecutor itself holds no tool state.
 *   - execute() is always async — sync handlers are wrapped in Promise.resolve().
 *   - durationMs is measured from just before handler invocation to completion.
 *   - Timeout is implemented via Promise.race; the timer is always cleared.
 *   - Arguments default to {} when omitted — still validated against required[].
 *   - result in ToolExecutionResult is a structural copy when the value is a
 *     plain object or array; primitive/function values are returned as-is.
 */

import { ToolRegistry } from './ToolRegistry';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToolExecutionErrorCode =
  | 'TOOL_NOT_FOUND'         // name not registered
  | 'INVALID_ARGUMENTS'      // required parameter key absent
  | 'TOOL_EXECUTION_FAILED'  // handler threw or rejected
  | 'TIMEOUT'                // exceeded options.timeoutMs
  | 'UNKNOWN_ERROR';         // catch-all

export interface ToolExecutionError {
  code:     ToolExecutionErrorCode;
  message:  string;
  /** Original thrown value when code is TOOL_EXECUTION_FAILED or UNKNOWN_ERROR. */
  cause?:   unknown;
}

export interface ToolExecutionResult {
  /** True when the handler completed without error and within any timeout. */
  ok:         boolean;
  /** Name of the tool that was called. */
  toolName:   string;
  /**
   * Handler return value.  Present (and possibly undefined) only when ok is true.
   * Primitive values are returned as-is; plain objects/arrays are shallow-copied.
   */
  result?:    unknown;
  /** Error detail.  Present only when ok is false. */
  error?:     ToolExecutionError;
  /** Wall-clock time from handler start to completion (or failure) in milliseconds. */
  durationMs: number;
}

export interface ToolExecutionOptions {
  /**
   * Maximum ms to wait for the handler to resolve.
   * When exceeded the result carries code TIMEOUT.
   * Omit (or pass undefined) for no timeout.
   */
  timeoutMs?: number;
}

// ─── ToolExecutor ─────────────────────────────────────────────────────────────

export class ToolExecutor {
  private readonly registry: ToolRegistry;

  constructor(registry: ToolRegistry) {
    this.registry = registry;
  }

  /**
   * Executes a tool call.
   *
   * @param call     - { name, arguments? }
   * @param options  - optional { timeoutMs }
   * @returns        Promise<ToolExecutionResult> — never rejects.
   */
  async execute(
    call:     { name: string; arguments?: Record<string, unknown> },
    options?: ToolExecutionOptions,
  ): Promise<ToolExecutionResult> {
    const toolName = call.name;

    // ── 1. Resolve tool ───────────────────────────────────────────────────────
    const toolResult = this.registry.getTool(toolName);
    if (!toolResult.ok) {
      return failResult(toolName, 0, {
        code:    'TOOL_NOT_FOUND',
        message: `Tool '${toolName}' is not registered.`,
      });
    }
    const tool = toolResult.value;

    // ── 2. Validate required arguments ────────────────────────────────────────
    const args: Record<string, unknown> = call.arguments ?? {};
    const missingKeys = tool.required.filter(
      key => !Object.prototype.hasOwnProperty.call(args, key),
    );
    if (missingKeys.length > 0) {
      return failResult(toolName, 0, {
        code:    'INVALID_ARGUMENTS',
        message: `Tool '${toolName}' is missing required argument(s): ${missingKeys.join(', ')}.`,
      });
    }

    // ── 3. Execute handler with optional timeout ───────────────────────────────
    const start = Date.now();

    try {
      // Wrap sync throws before they can escape the outer try block.
      let rawPromise: Promise<unknown>;
      try {
        rawPromise = Promise.resolve(tool.handler(args));
      } catch (syncErr) {
        throw new HandlerError(syncErr);
      }

      // Wrap async rejections so both code paths reach the catch block as HandlerError.
      const safePromise: Promise<unknown> = rawPromise.then(
        v => v,
        e => Promise.reject(new HandlerError(e)),
      );

      const rawResult = options?.timeoutMs !== undefined
        ? await raceTimeout(safePromise, options.timeoutMs)
        : await safePromise;

      const durationMs = Date.now() - start;
      return {
        ok:         true,
        toolName,
        result:     shallowCopy(rawResult),
        durationMs,
      };
    } catch (err) {
      const durationMs = Date.now() - start;

      if (err instanceof TimeoutError) {
        return failResult(toolName, durationMs, {
          code:    'TIMEOUT',
          message: `Tool '${toolName}' exceeded the ${options!.timeoutMs} ms timeout.`,
        });
      }

      // Distinguish handler throws from unexpected executor failures.
      const isHandlerError = err instanceof HandlerError;

      return failResult(toolName, durationMs, {
        code:    isHandlerError ? 'TOOL_EXECUTION_FAILED' : 'UNKNOWN_ERROR',
        message: isHandlerError
          ? `Tool '${toolName}' handler threw: ${String((err as HandlerError).cause)}`
          : `Unexpected error executing tool '${toolName}': ${String(err)}`,
        cause: isHandlerError ? (err as HandlerError).cause : err,
      });
    }
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

class TimeoutError extends Error {
  constructor() { super('TIMEOUT'); }
}

class HandlerError extends Error {
  cause: unknown;
  constructor(cause: unknown) {
    super('HANDLER_ERROR');
    this.cause = cause;
  }
}

/**
 * Races `safePromise` (already wrapped so rejections arrive as HandlerError)
 * against a TimeoutError sentinel.
 * Always clears the timer — no dangling timeouts.
 */
async function raceTimeout<T>(safePromise: Promise<T>, timeoutMs: number): Promise<T> {
  let timerId: ReturnType<typeof setTimeout> | undefined;

  const timeoutP = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => reject(new TimeoutError()), timeoutMs);
  });

  try {
    return await Promise.race([safePromise, timeoutP]);
  } finally {
    clearTimeout(timerId);
  }
}

function failResult(
  toolName:   string,
  durationMs: number,
  error:      ToolExecutionError,
): ToolExecutionResult {
  return { ok: false, toolName, error, durationMs };
}

/**
 * Shallow-copies plain objects and arrays so callers cannot mutate the
 * executor's internal state through the returned result.
 * Primitive values and non-plain objects (class instances, functions) pass through.
 */
function shallowCopy(value: unknown): unknown {
  if (Array.isArray(value))                              return [...value];
  if (value !== null && typeof value === 'object')       return { ...value as object };
  return value;
}
