import { RetryPolicy } from '../../providers/RetryPolicy.ts'
import type { RetryOptions } from '../../providers/RetryPolicy.ts'
import type {
  MCPClientErrorCode, MCPClientResult, MCPConnectionStatus,
  MCPToolDescriptor, MCPTransport,
} from '../domain/mcpTypes.ts'

// ── MCP Client — Phase X.7 ─────────────────────────────────────────────────────
// Connection lifecycle, capability discovery, and tool execution against an injected
// MCPTransport. Never performs reasoning, retrieval, ranking, conflict resolution, confidence
// computation, citation generation, or formatting — purely an external-system adapter.
//
// Reuses src/providers/RetryPolicy.ts directly (constructor + .sleep()) for transport-level
// retry, exactly as toolCallingStage.ts (Phase X.6) reused it for tool-execution retry — with
// its own small, MCP-transport-specific retryable-error-code set, since RetryPolicy's own
// isTransient()/isNonRetryable() classify a different (LLM-provider) vocabulary, and X.6's own
// tool-execution vocabulary doesn't apply to a transport failure either. Never duplicates
// RetryPolicy's own logic — only its timing mechanism.
//
// Never constructs an HttpMCPTransport itself — the transport is always caller-injected,
// consistent with WebSocketClient's factory-injection precedent elsewhere in src/providers/.

const RETRYABLE_MCP_ERROR_CODES = new Set<MCPClientErrorCode>(['TIMEOUT', 'TRANSPORT_ERROR'])

class MCPTimeoutError extends Error {
  constructor() { super('MCP_TIMEOUT') }
}

function mcpErr(code: MCPClientErrorCode, message: string, cause?: unknown): MCPClientResult<never> {
  return { ok: false, error: { code, message, cause } }
}

async function raceTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timerId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => reject(new MCPTimeoutError()), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    clearTimeout(timerId)
  }
}

export interface MCPClientOptions {
  readonly requestTimeoutMs?: number
  readonly retry?: RetryOptions
}

export class MCPClient {
  private readonly transport: MCPTransport
  private readonly requestTimeoutMs: number | undefined
  private readonly retryOptions: RetryOptions | undefined
  private status: MCPConnectionStatus = 'DISCONNECTED'

  constructor(transport: MCPTransport, options: MCPClientOptions = {}) {
    this.transport = transport
    this.requestTimeoutMs = options.requestTimeoutMs
    this.retryOptions = options.retry
  }

  getStatus(): MCPConnectionStatus {
    return this.status
  }

  async connect(): Promise<MCPClientResult<void>> {
    if (this.status === 'CONNECTED') {
      return mcpErr('CONNECTION_FAILED', 'Already connected.')
    }
    try {
      await this.transport.connect()
      this.status = 'CONNECTED'
      return { ok: true, value: undefined }
    } catch (err) {
      return mcpErr('CONNECTION_FAILED', `Failed to connect to MCP server: ${String(err)}`, err)
    }
  }

  async disconnect(): Promise<MCPClientResult<void>> {
    if (this.status === 'DISCONNECTED') {
      return mcpErr('NOT_CONNECTED', 'Already disconnected.')
    }
    try {
      await this.transport.disconnect()
      this.status = 'DISCONNECTED'
      return { ok: true, value: undefined }
    } catch (err) {
      return mcpErr('UNKNOWN_ERROR', `Failed to disconnect cleanly: ${String(err)}`, err)
    }
  }

  async listTools(): Promise<MCPClientResult<MCPToolDescriptor[]>> {
    if (this.status !== 'CONNECTED') {
      return mcpErr('NOT_CONNECTED', 'Cannot list tools: not connected. Call connect() first.')
    }
    const result = await this.requestWithRetry({ method: 'tools/list' })
    if (!result.ok) return result

    const raw = result.value as { tools?: unknown }
    if (!Array.isArray(raw?.tools)) {
      return mcpErr('PROTOCOL_ERROR', "MCP server's tools/list response is missing a 'tools' array.")
    }
    return { ok: true, value: raw.tools as MCPToolDescriptor[] }
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<MCPClientResult<unknown>> {
    if (this.status !== 'CONNECTED') {
      return mcpErr('NOT_CONNECTED', 'Cannot call tool: not connected. Call connect() first.')
    }
    const result = await this.requestWithRetry({ method: 'tools/call', params: { name, arguments: args } })
    if (!result.ok) return result

    const raw = result.value as { isError?: boolean; content?: unknown }
    if (raw?.isError === true) {
      return mcpErr('TOOL_CALL_FAILED', `MCP tool '${name}' reported an error result.`)
    }
    return { ok: true, value: raw?.content }
  }

  private async requestWithRetry(
    req: { method: string; params?: Record<string, unknown> },
  ): Promise<MCPClientResult<unknown>> {
    const policy = new RetryPolicy(this.retryOptions)
    let lastFailure: MCPClientResult<never> | undefined

    for (let attempt = 0; attempt < policy.maxAttempts; attempt++) {
      const outcome = await this.attemptRequest(req)
      if (outcome.ok) return outcome
      lastFailure = outcome
      if (!RETRYABLE_MCP_ERROR_CODES.has(outcome.error.code)) return outcome
      if (attempt < policy.maxAttempts - 1) await policy.sleep(attempt)
    }
    return lastFailure!
  }

  private async attemptRequest(
    req: { method: string; params?: Record<string, unknown> },
  ): Promise<MCPClientResult<unknown>> {
    try {
      const rawPromise = this.transport.request(req)
      const response = this.requestTimeoutMs !== undefined
        ? await raceTimeout(rawPromise, this.requestTimeoutMs)
        : await rawPromise

      if (response.error !== undefined) {
        return mcpErr('PROTOCOL_ERROR', response.error.message)
      }
      return { ok: true, value: response.result }
    } catch (err) {
      if (err instanceof MCPTimeoutError) {
        return mcpErr('TIMEOUT', `MCP request '${req.method}' exceeded the ${this.requestTimeoutMs} ms timeout.`)
      }
      return mcpErr('TRANSPORT_ERROR', `MCP transport request '${req.method}' failed: ${String(err)}`, err)
    }
  }
}
