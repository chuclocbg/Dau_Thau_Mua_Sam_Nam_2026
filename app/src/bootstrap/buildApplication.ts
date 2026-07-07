import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import { DefaultKnowledgePlatform } from '../knowledge/platform/knowledgePlatform.ts'
import { LegalProvider } from '../knowledge/providers/legal/legalProvider.ts'
import { buildKnowledgePlatformRepository } from '../reasoning/infrastructure/knowledgePlatformRepository.ts'
import { buildReasoningEnginePipeline } from '../reasoning/application/reasoningEnginePipeline.ts'
import type { ReasoningEnginePipeline } from '../reasoning/application/reasoningEnginePipeline.ts'
import type { IKnowledgeRepository } from '../reasoning/domain/knowledgeRepositoryTypes.ts'
import { ToolRegistry } from '../providers/ToolRegistry.ts'
import { ToolExecutor } from '../providers/ToolExecutor.ts'
import { CoordinatorAgent } from '../multiagent/application/coordinatorAgent.ts'
import type { MCPClient } from '../mcp/application/mcpClient.ts'
import type { AppConfig, NodeEnv } from '../config/appConfig.ts'
import { createStructuredLogger } from '../logging/structuredLogger.ts'
import type { StructuredLogger } from '../logging/structuredLogger.ts'
import { MetricsCollector } from '../providers/MetricsCollector.ts'
import { SimpleTracer } from '../tracing/tracer.ts'
import type { Tracer } from '../tracing/tracingTypes.ts'

// ── Application Bootstrap — Phase X.9.1 ────────────────────────────────────────
// The composition root: the ONE place that constructs the real, frozen X.3-X.8 components and
// wires them together via constructor injection. Never modifies any frozen file — only imports
// and calls their already-exported, already-tested public constructors/factories. No new
// reasoning/retrieval/Tool Calling/MCP/Multi-Agent logic is introduced here; this file only
// composes.
//
// TRANSPARENCY NOTE: buildMemoryKnowledgeRepositories()/DefaultKnowledgePlatform are the SAME
// real, memory-backed platform every X.3-X.8 integration test already calls "real" (as opposed
// to a hand-rolled fake) — it is the only IKnowledgePlatform implementation this repository has
// ever exercised end-to-end. Using it here is not a fake adapter; it is an honest limitation:
// data does not persist across process restarts. Swapping in the Prisma-backed persistence layer
// (implemented, but per .memory/repository-health.md never verified against a live database) is
// explicitly out of scope for this milestone — a future, separately-authorized migration, not a
// silent assumption.
//
// The ToolRegistry built here starts empty by design: which real tools (if any) should be
// registered is a deployment/product decision this milestone has no basis to invent (same
// reasoning already applied in X.6/X.7 — see toolCallingStage.ts's own neverInvokeTool default).
// An MCPClient is only constructed and connected when the caller explicitly supplies one via
// options — this bootstrap never fabricates a default MCP server endpoint.
//
// X.9.2 ADDITION (dependency-injection wiring, per that milestone's explicit carve-out to touch
// this frozen file only for DI): logger/metrics/tracer/nodeEnv are constructed here from the
// same AppConfig already passed in, and threaded through Application so
// server/httpServer.ts's request-lifecycle hooks can consume them — no reasoning/retrieval/
// Tool Calling/MCP/Multi-Agent logic added, only three more constructor calls.
//
// X.9.3 ADDITION (same DI-only carve-out): streamTimeoutMs is threaded through Application so
// src/http/reasoningStreamRoute.ts can bound each SSE stage without buildHttpServer()'s own
// signature changing — a plain config value, no new construction, no new logic.

export interface Application {
  readonly repository: IKnowledgeRepository
  readonly reasoningPipeline: ReasoningEnginePipeline
  readonly toolRegistry: ToolRegistry
  readonly toolExecutor: ToolExecutor
  readonly coordinator: CoordinatorAgent
  readonly mcpClient?: MCPClient
  readonly startedAt: number
  readonly logger: StructuredLogger
  readonly metrics: MetricsCollector
  readonly tracer: Tracer
  readonly nodeEnv: NodeEnv
  readonly streamTimeoutMs: number
}

export interface BuildApplicationOptions {
  readonly mcpClient?: MCPClient
}

export async function buildApplication(
  config: AppConfig, options: BuildApplicationOptions = {},
): Promise<Application> {
  const repos = buildMemoryKnowledgeRepositories()
  const graph = new KnowledgeGraphService(repos.relations)
  const platform = new DefaultKnowledgePlatform(repos)
  platform.registerProvider(new LegalProvider(repos, graph))

  const repository = buildKnowledgePlatformRepository(platform)
  const reasoningPipeline = buildReasoningEnginePipeline(repository)

  const toolRegistry = new ToolRegistry()
  const toolExecutor = new ToolExecutor(toolRegistry)
  const coordinator = new CoordinatorAgent()

  const logger = createStructuredLogger({ level: config.logLevel, format: config.logFormat })
  const metrics = new MetricsCollector()
  const tracer = new SimpleTracer()

  const application: Application = {
    repository, reasoningPipeline, toolRegistry, toolExecutor, coordinator,
    startedAt: Date.now(),
    logger, metrics, tracer, nodeEnv: config.nodeEnv, streamTimeoutMs: config.streamTimeoutMs,
    ...(options.mcpClient !== undefined ? { mcpClient: options.mcpClient } : {}),
  }
  return application
}
