import type { ToolParameter } from '../../providers/ToolRegistry.ts'

// ── MCP Types — Phase X.7 ──────────────────────────────────────────────────────
// MCP is an infrastructure adapter, not a reasoning/retrieval/conversation concern.
// Question -> Reasoning -> Output Formatting -> Tool Calling -> MCP Adapter ->
// External MCP Server -> Normalized Tool Result -> Conversation Response.
//
// NAMING/SCOPE RECONCILIATION NOTE (per this milestone's "do not trust documentation" rule):
// PHASE_X_EXECUTION_PLAN.md's own "X.5 — Tool Calling" section already reserves
// src/mcp/domain/mcpTypes.ts, but for a DIFFERENT design (IMCPTool/MCPExecutionContext/
// MCPToolResult feeding a from-scratch MCPToolRegistry + MCPGateway mirroring
// ProviderRegistry, plus an authPermissionBridge.ts delegating to src/auth/). That design
// predates Phase X.6 (Tool Calling), which did not exist when the plan was drafted — it had no
// ToolRegistry/ToolExecutor/RetryPolicy application-layer stage to reuse yet, so it planned to
// build its own registry/gateway pair from scratch. This milestone's own live instructions are
// explicit and take priority: never duplicate Tool Calling, never duplicate Provider interfaces,
// never duplicate RetryPolicy; reuse ToolExecutor/ToolRegistry/RetryPolicy whenever possible.
// Building a parallel MCPToolRegistry/MCPGateway would violate that directly. Instead: MCP
// discovers remote tools and registers each one as an ordinary ToolDefinition (see
// mcpToolAdapter.ts) into the SAME, already-frozen ToolRegistry that local tools use — so
// ToolCallingStage and ToolExecutor need zero changes and zero MCP-awareness at all. Auth/
// permission enforcement (authPermissionBridge.ts) is out of scope here per this milestone's own
// "out of scope: Production Hardening" — noted as still-open future work, not fabricated as
// already handled. This reservation of the src/mcp/ directory path is honored; the internal
// design is not, and that divergence is recorded transparently rather than silently overwritten.
//
// TRANSPARENCY NOTE on REJECTED_DESIGNS.md's "Rejected: Building MCP and Multi-Agent Now": that
// entry rejected MCP on TIMING grounds only ("no production usage data exists yet... build ahead
// of proven need"), not on the design itself ("both remain fully designed and ready to build
// once genuinely needed"). This milestone is being explicitly authorized now by direct
// instruction, which is the stated resolution path for that deferral — not a reversal of it.
//
// MCPToolDescriptor's inputSchema deliberately reuses ToolParameter's shape (not a new,
// parallel schema type) so mcpToolAdapter.ts can map it into ToolDefinition.parameters with zero
// lossy conversion.

export interface MCPToolDescriptor {
  readonly name: string
  readonly description: string
  readonly inputSchema: Readonly<Record<string, ToolParameter>>
  readonly required: readonly string[]
}

export interface MCPRequest {
  readonly method: string
  readonly params?: Readonly<Record<string, unknown>>
}

export interface MCPProtocolError {
  readonly code: number
  readonly message: string
}

export interface MCPResponse<T> {
  readonly result?: T
  readonly error?: MCPProtocolError
}

export type MCPClientErrorCode =
  | 'CONNECTION_FAILED'
  | 'NOT_CONNECTED'
  | 'TRANSPORT_ERROR'
  | 'TIMEOUT'
  | 'PROTOCOL_ERROR'
  | 'TOOL_CALL_FAILED'
  | 'UNKNOWN_ERROR'

export interface MCPClientError {
  readonly code: MCPClientErrorCode
  readonly message: string
  readonly cause?: unknown
}

export type MCPClientResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: MCPClientError }

export type MCPConnectionStatus = 'DISCONNECTED' | 'CONNECTED'

/**
 * Transport abstraction — injectable, matching the DI convention already established by
 * WebSocketTransport/RestClientFetch in src/providers/. connect()/disconnect() may throw;
 * MCPClient is the only caller and always catches. Never implemented by reasoning/application
 * code directly — only mcpClient.ts constructs against this interface.
 */
export interface MCPTransport {
  connect(): Promise<void>
  disconnect(): Promise<void>
  request(req: MCPRequest): Promise<MCPResponse<unknown>>
}
