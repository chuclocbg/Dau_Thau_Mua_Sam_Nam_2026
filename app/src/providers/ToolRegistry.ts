/**
 * P6-10N: ToolRegistry — registry for LLM function-calling tool definitions.
 *
 * Manages a set of named tools that can be exposed to LLM providers that
 * support function calling / tool use (OpenAI, Claude, Gemini).
 *
 * Each ToolDefinition carries:
 *   - JSON-Schema-style parameter declarations (name, type, description, enum)
 *   - A `required` list of mandatory parameter names
 *   - A synchronous or asynchronous `handler` that executes the tool
 *
 * ToolCall  — the structured call produced by an LLM when it selects a tool.
 * ToolResult — the value returned after the handler runs (or an error string).
 *
 * Error model:
 *   DUPLICATE_TOOL   — registerTool() with a name already in the registry
 *   TOOL_NOT_FOUND   — getTool() / unregisterTool() with an unknown name
 *
 * Design rules (consistent with the rest of the provider layer):
 *   - All public methods return ToolRegistryResult<T> or a primitive.
 *   - Never throws — every failure surfaces as { ok: false, error }.
 *   - Defensive copies: every read returns an independent snapshot.
 *     The handler function reference is shared (functions are immutable by nature).
 *   - hasTool() and listTools() never fail.
 */

// ─── Parameter schema ─────────────────────────────────────────────────────────

/** JSON-Schema-inspired parameter descriptor for a single tool argument. */
export interface ToolParameter {
  /** JSON-Schema primitive type. */
  type:         'string' | 'number' | 'boolean' | 'object' | 'array';
  /** Human-readable description sent to the LLM. */
  description?: string;
  /** Allowed values (rendered as an enum in the schema sent to the provider). */
  enum?:        unknown[];
}

// ─── ToolDefinition ───────────────────────────────────────────────────────────

/**
 * A complete tool definition that can be registered and called.
 *
 * `parameters` is a map from parameter name → its schema.
 * `required`   lists the names of parameters the LLM must always supply.
 * `handler`    is invoked with the parsed arguments when the tool is called.
 */
export interface ToolDefinition {
  /** Unique identifier.  Must be non-empty. */
  name:        string;
  /** Human-readable description surfaced to the LLM. */
  description: string;
  /** Map of argument name → schema. */
  parameters:  Record<string, ToolParameter>;
  /** Subset of parameter names that are required by the LLM contract. */
  required:    string[];
  /** Executes the tool; may be async. */
  handler:     (args: Record<string, unknown>) => unknown | Promise<unknown>;
}

// ─── ToolCall ─────────────────────────────────────────────────────────────────

/** Structured call emitted by an LLM when it chooses to invoke a tool. */
export interface ToolCall {
  /** Must match a registered ToolDefinition.name. */
  name:      string;
  /** Parsed arguments supplied by the LLM. */
  arguments: Record<string, unknown>;
}

// ─── ToolResult ───────────────────────────────────────────────────────────────

/** Value produced after a tool handler runs (or fails). */
export interface ToolResult {
  /** Name of the tool that was called. */
  name:    string;
  /** Return value of the handler on success (undefined when error is set). */
  result:  unknown;
  /** Human-readable error message when the handler threw or returned an error. */
  error?:  string;
}

// ─── Error types ──────────────────────────────────────────────────────────────

export type ToolRegistryErrorCode =
  | 'DUPLICATE_TOOL'  // registerTool() with an already-registered name
  | 'TOOL_NOT_FOUND'; // getTool() / unregisterTool() for an unknown name

export interface ToolRegistryError {
  code:    ToolRegistryErrorCode;
  message: string;
}

export type ToolRegistryResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: ToolRegistryError };

// ─── ToolRegistry ─────────────────────────────────────────────────────────────

export class ToolRegistry {
  private readonly store: Map<string, ToolDefinition> = new Map();

  /**
   * Registers a tool definition.
   *
   * Returns `{ ok: true, value: name }` on success.
   * Returns DUPLICATE_TOOL when a tool with the same name is already registered.
   * Does not modify the registry on failure.
   */
  registerTool(tool: ToolDefinition): ToolRegistryResult<string> {
    if (this.store.has(tool.name)) {
      return toolErr(
        'DUPLICATE_TOOL',
        `Tool '${tool.name}' is already registered; unregister it first to replace.`,
      );
    }
    this.store.set(tool.name, cloneTool(tool));
    return { ok: true, value: tool.name };
  }

  /**
   * Removes a tool from the registry.
   *
   * Returns `{ ok: true, value: true }` on success.
   * Returns TOOL_NOT_FOUND when the name is not registered.
   */
  unregisterTool(name: string): ToolRegistryResult<true> {
    if (!this.store.has(name)) {
      return toolErr('TOOL_NOT_FOUND', `Tool '${name}' is not registered.`);
    }
    this.store.delete(name);
    return { ok: true, value: true };
  }

  /**
   * Returns a defensive copy of the named tool definition.
   *
   * Returns TOOL_NOT_FOUND when the name is not registered.
   */
  getTool(name: string): ToolRegistryResult<ToolDefinition> {
    const tool = this.store.get(name);
    if (!tool) {
      return toolErr('TOOL_NOT_FOUND', `Tool '${name}' is not registered.`);
    }
    return { ok: true, value: cloneTool(tool) };
  }

  /**
   * Returns defensive copies of all registered tool definitions in insertion order.
   * Returns an empty array when the registry is empty.  Never fails.
   */
  listTools(): ToolDefinition[] {
    return Array.from(this.store.values()).map(cloneTool);
  }

  /**
   * Returns true when a tool with the given name is registered.
   * Never fails.
   */
  hasTool(name: string): boolean {
    return this.store.has(name);
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function cloneParam(p: ToolParameter): ToolParameter {
  const copy: ToolParameter = { type: p.type };
  if (p.description !== undefined) copy.description = p.description;
  if (p.enum        !== undefined) copy.enum        = [...p.enum];
  return copy;
}

function cloneParams(
  params: Record<string, ToolParameter>,
): Record<string, ToolParameter> {
  const result: Record<string, ToolParameter> = {};
  for (const [k, v] of Object.entries(params)) {
    result[k] = cloneParam(v);
  }
  return result;
}

function cloneTool(tool: ToolDefinition): ToolDefinition {
  return {
    name:        tool.name,
    description: tool.description,
    parameters:  cloneParams(tool.parameters),
    required:    [...tool.required],
    handler:     tool.handler,   // function reference — shared by design
  };
}

function toolErr<T>(
  code:    ToolRegistryErrorCode,
  message: string,
): ToolRegistryResult<T> {
  return { ok: false, error: { code, message } };
}
