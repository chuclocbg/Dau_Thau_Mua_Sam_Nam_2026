import type { ToolDefinition, ToolRegistry } from '../../providers/ToolRegistry.ts'
import type { MCPClient } from './mcpClient.ts'
import type { MCPClientResult } from '../domain/mcpTypes.ts'

// ── MCP Tool Adapter — Phase X.7 ───────────────────────────────────────────────
// The one composition point where MCP meets Tool Calling. Discovers remote tools via an
// MCPClient and registers each one as an ordinary ToolDefinition into the SAME, already-frozen
// ToolRegistry (src/providers/ToolRegistry.ts, Phase X.6, unmodified) that local tools use.
//
// This is deliberate: to ToolCallingStage/ToolExecutor, an MCP-backed tool is indistinguishable
// from a local one — both are just a { name, description, parameters, required, handler } value
// sitting in the registry. runToolCallingStage() and ToolExecutor.execute() need ZERO changes
// and ZERO MCP-awareness. A handler that forwards to MCPClient.callTool() and throws on failure
// is all ToolExecutor needs — its existing try/catch already normalizes a thrown Error into
// TOOL_EXECUTION_FAILED, exactly as it does for any other tool. This is how "MCP is simply
// another execution backend that Tool Calling may invoke" is satisfied without duplicating Tool
// Calling itself.
//
// Individual registration conflicts (a remote tool name colliding with an already-registered
// tool) are treated as a skip, not a hard failure — registerMCPTools() honestly reports only the
// names it actually registered, never fabricating success for a name it silently dropped.

export async function registerMCPTools(
  registry: ToolRegistry, client: MCPClient,
): Promise<MCPClientResult<string[]>> {
  const discovered = await client.listTools()
  if (!discovered.ok) return discovered

  const registered: string[] = []
  for (const descriptor of discovered.value) {
    const definition: ToolDefinition = {
      name: descriptor.name,
      description: descriptor.description,
      parameters: { ...descriptor.inputSchema },
      required: [...descriptor.required],
      handler: async (args: Record<string, unknown>) => {
        const result = await client.callTool(descriptor.name, args)
        if (!result.ok) throw new Error(result.error.message)
        return result.value
      },
    }
    const outcome = registry.registerTool(definition)
    if (outcome.ok) registered.push(descriptor.name)
  }
  return { ok: true, value: registered }
}
