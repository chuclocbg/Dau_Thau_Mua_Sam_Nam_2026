import { describe, it, expect } from 'vitest'
import { MCPClient } from '../mcp/application/mcpClient.ts'
import { registerMCPTools } from '../mcp/application/mcpToolAdapter.ts'
import type { MCPRequest, MCPResponse, MCPTransport } from '../mcp/domain/mcpTypes.ts'
import { ToolRegistry } from '../providers/ToolRegistry.ts'
import { ToolExecutor } from '../providers/ToolExecutor.ts'
import { runToolCallingStage } from '../reasoning/application/toolCallingStage.ts'
import type { ToolDecider } from '../reasoning/domain/toolCallingTypes.ts'
import { formatConversationResponse } from '../reasoning/application/outputFormatter.ts'
import { buildReasoningEnginePipeline } from '../reasoning/application/reasoningEnginePipeline.ts'
import { buildKnowledgePlatformRepository } from '../reasoning/infrastructure/knowledgePlatformRepository.ts'
import { detectIntent } from '../reasoning/application/intentDetector.ts'
import { DefaultKnowledgePlatform } from '../knowledge/platform/knowledgePlatform.ts'
import type { IKnowledgePlatform } from '../knowledge/platform/knowledgePlatform.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'
import { LegalProvider } from '../knowledge/providers/legal/legalProvider.ts'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'

// True end-to-end integration test for Phase X.7 — the complete chain:
// Question -> Reasoning -> Output Formatting -> Tool Calling -> MCP Adapter ->
// "External MCP Server" -> Normalized Tool Result -> Conversation Response.
//
// The "External MCP Server" is a fake, in-memory MCPTransport that speaks the exact
// tools/list and tools/call JSON-RPC-shaped protocol MCPClient expects — not a mock of
// MCPClient itself, a real implementation of the transport boundary. Everything downstream
// (MCPClient, registerMCPTools, a real ToolRegistry, a real ToolExecutor, runToolCallingStage,
// the real Reasoning Engine + Output Formatter against a real IKnowledgePlatform) is genuine.

function fakeMCPServer(): MCPTransport {
  return {
    connect: async () => {},
    disconnect: async () => {},
    request: async (req: MCPRequest): Promise<MCPResponse<unknown>> => {
      if (req.method === 'tools/list') {
        return {
          result: {
            tools: [{
              name: 'lookupDocumentSymbol', description: 'Looks up a legal document symbol by keyword',
              inputSchema: { keyword: { type: 'string', description: 'Search keyword' } },
              required: ['keyword'],
            }],
          },
        }
      }
      if (req.method === 'tools/call') {
        const params = req.params as { name: string; arguments: Record<string, unknown> }
        if (params.name === 'lookupDocumentSymbol') {
          return { result: { content: { keyword: params.arguments.keyword, symbol: '22/2023/QH15' } } }
        }
        return { error: { code: -32601, message: `Unknown tool: ${params.name}` } }
      }
      return { error: { code: -32601, message: `Unknown method: ${req.method}` } }
    },
  }
}

function itemInput(overrides: Partial<KnowledgeItem> = {}): Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    domain: 'legal', provider: 'legalProvider', type: 'LAW', title: 'Luật mẫu',
    summary: 'Quy định mẫu cho kiểm thử tích hợp.', keywords: ['tạm ứng'],
    legalBasis: [{ document: '22/2023/QH15', article: 'Điều 10' }],
    relatedItems: [], metadata: {}, confidence: 0.9, attachments: [],
    layer: 1, language: 'vi', isActive: true, version: '1',
    ...overrides,
  }
}

async function buildPlatformWithLegalProvider(): Promise<{ platform: IKnowledgePlatform; repos: KnowledgeRepositories }> {
  const repos = buildMemoryKnowledgeRepositories()
  const graph = new KnowledgeGraphService(repos.relations)
  const platform = new DefaultKnowledgePlatform(repos)
  platform.registerProvider(new LegalProvider(repos, graph))
  return { platform, repos }
}

describe('MCP end-to-end: Question -> Reasoning -> Output Formatting -> Tool Calling -> MCP Adapter -> Conversation Response', () => {
  it('discovers a remote MCP tool, registers it into a real ToolRegistry, and invokes it through the real Tool Calling stage', async () => {
    const { platform, repos } = await buildPlatformWithLegalProvider()
    await repos.items.create(itemInput({ effectivePeriod: { startDate: '2025-03-15' } }))

    const repository = buildKnowledgePlatformRepository(platform)
    const engine = buildReasoningEnginePipeline(repository)
    const intent = detectIntent({ question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: '2026-07-06' })
    const answer = await engine.answer(intent)
    const response = formatConversationResponse(answer)

    const mcpClient = new MCPClient(fakeMCPServer())
    await mcpClient.connect()
    const registry = new ToolRegistry()
    const registration = await registerMCPTools(registry, mcpClient)
    expect(registration.ok).toBe(true)
    if (registration.ok) expect(registration.value).toEqual(['lookupDocumentSymbol'])

    const executor = new ToolExecutor(registry)
    const decider: ToolDecider = () => ({
      shouldInvoke: true,
      call: { name: 'lookupDocumentSymbol', arguments: { keyword: 'tạm ứng' } },
      reason: 'verification lookup via MCP',
    })
    const result = await runToolCallingStage(response, answer, executor, { decider })

    expect(result.toolInvoked).toBe(true)
    expect(result.toolResults[0]!.success).toBe(true)
    expect(result.toolResults[0]!.output).toEqual({ keyword: 'tạm ứng', symbol: '22/2023/QH15' })
    expect(result.response.markdown).toBe(response.markdown)
    expect(Object.isFrozen(result)).toBe(true)
  })

  it('normalizes an MCP tool-call error through the same TOOL_EXECUTION_FAILED path as any local tool', async () => {
    const { platform } = await buildPlatformWithLegalProvider()
    const repository = buildKnowledgePlatformRepository(platform)
    const engine = buildReasoningEnginePipeline(repository)
    const intent = detectIntent({ question: 'Câu hỏi bất kỳ', asOfDate: '2026-07-06' })
    const answer = await engine.answer(intent)
    const response = formatConversationResponse(answer)

    const mcpClient = new MCPClient(fakeMCPServer())
    await mcpClient.connect()
    const registry = new ToolRegistry()
    await registerMCPTools(registry, mcpClient)
    const executor = new ToolExecutor(registry)

    const decider: ToolDecider = () => ({
      shouldInvoke: true,
      call: { name: 'lookupDocumentSymbol', arguments: {} }, // missing required 'keyword'
      reason: 'malformed call',
    })
    const result = await runToolCallingStage(response, answer, executor, { decider, retry: { maxAttempts: 1 } })

    expect(result.toolResults[0]!.success).toBe(false)
    expect(result.toolResults[0]!.errorMessage).toMatch(/keyword/)
  })

  it('declines gracefully (default decider) when no MCP tool trigger is configured', async () => {
    const { platform, repos } = await buildPlatformWithLegalProvider()
    await repos.items.create(itemInput({ effectivePeriod: { startDate: '2025-03-15' } }))
    const repository = buildKnowledgePlatformRepository(platform)
    const engine = buildReasoningEnginePipeline(repository)
    const intent = detectIntent({ question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: '2026-07-06' })
    const answer = await engine.answer(intent)
    const response = formatConversationResponse(answer)

    const mcpClient = new MCPClient(fakeMCPServer())
    await mcpClient.connect()
    const registry = new ToolRegistry()
    await registerMCPTools(registry, mcpClient)
    const executor = new ToolExecutor(registry)

    const result = await runToolCallingStage(response, answer, executor)
    expect(result.toolInvoked).toBe(false)
    expect(result.response).toEqual(response)
  })
})
