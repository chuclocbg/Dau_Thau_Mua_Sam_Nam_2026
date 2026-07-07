import { RestClient } from '../../providers/RestClient.ts'
import type { MCPRequest, MCPResponse, MCPTransport } from '../domain/mcpTypes.ts'

// ── HTTP MCP Transport — Phase X.7 ─────────────────────────────────────────────
// The only concrete MCPTransport implementation this milestone ships. Targets the
// "Streamable HTTP" MCP transport (a single JSON-RPC-style POST endpoint) — the realistic
// default for a server-side/web environment. Genuinely reuses src/providers/RestClient.ts
// (already generic, provider-agnostic, unmodified) for the actual network call instead of
// writing a second fetch wrapper. Stdio-based MCP servers (spawned local subprocesses) are out
// of scope: this codebase has no process-spawning boundary today, and stdio's out-of-band
// framing is a materially different transport, not just a different endpoint — an honest,
// documented gap rather than a fabricated implementation. Callers needing stdio may implement
// MCPTransport themselves; MCPClient never assumes HTTP.

let requestCounter = 0

export class HttpMCPTransport implements MCPTransport {
  private readonly endpoint: string
  private readonly restClient: RestClient

  constructor(endpoint: string, restClient: RestClient = new RestClient()) {
    this.endpoint = endpoint
    this.restClient = restClient
  }

  // Stateless HTTP transport — nothing to establish ahead of the first request.
  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {}

  async request(req: MCPRequest): Promise<MCPResponse<unknown>> {
    requestCounter += 1
    const result = await this.restClient.post<MCPResponse<unknown>>(this.endpoint, {
      jsonrpc: '2.0',
      id: requestCounter,
      method: req.method,
      params: req.params ?? {},
    })

    if (!result.ok) {
      throw new Error(`MCP HTTP transport request failed: ${result.error.message}`)
    }
    return result.value.body
  }
}
