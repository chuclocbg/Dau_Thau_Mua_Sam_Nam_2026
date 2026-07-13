import type { AuthenticationContext } from './authenticationContext.ts'
import { evaluateAuthorization } from './authorizationEvaluator.ts'
import type { AuthorizationDecision } from '../domain/identityTypes.ts'

// ── MCP Authorization Hooks — Phase X.14 ───────────────────────────────────────
// A pure authorization check a caller can run before MCPClient.callTool() (Phase X.7, frozen) --
// never wired into mcpClient.ts itself. mcpToolAdapter.ts (X.7) already registers every
// discovered MCP tool into the SAME ToolRegistry local tools use, so withToolAuthorization()
// (toolAuthorization.ts) already gates MCP-sourced tool calls made through the normal
// runToolCallingStage() path with zero special-casing. This hook exists for the narrower case
// of a caller invoking MCPClient.callTool() directly (bypassing the ToolDecider path entirely,
// e.g. a future MCP-specific route or admin action) -- named per-tool, since MCP tool access is
// naturally finer-grained than the local tool registry's single 'tool' resource.

export function authorizeMcpToolCall(auth: AuthenticationContext, toolName: string): AuthorizationDecision {
  return evaluateAuthorization(auth.principal.id, auth.permissions, {
    resource: `mcp:${toolName}`, action: 'invoke', scope: 'OWN',
  })
}
