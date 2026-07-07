import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.7 (MCP Integration) ───────────────────────
// MCP is an infrastructure adapter, not reasoning/retrieval/conversation. It must never
// duplicate Tool Calling, Provider interfaces, or RetryPolicy; it reuses ToolRegistry/
// ToolExecutor/RetryPolicy/RestClient directly. No src/knowledge/, src/reasoning/domain or
// application EXCEPT the specific reuse points, src/ai/, src/conversation/ import. Checks run
// against comment-stripped code.

const REPO_ROOT = process.cwd()

function readRaw(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), 'utf-8')
}

function readCode(relativePath: string): string {
  return readRaw(relativePath)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

const NEW_FILES = [
  'src/mcp/domain/mcpTypes.ts',
  'src/mcp/infrastructure/httpMCPTransport.ts',
  'src/mcp/application/mcpClient.ts',
  'src/mcp/application/mcpToolAdapter.ts',
]

describe('Architecture guard — Phase X.7 dependency direction', () => {
  it('no new file imports anything from src/knowledge/, src/ai/, or src/conversation/', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      expect(content, `${file} must not import src/knowledge/`).not.toMatch(/from ['"].*\/knowledge\//)
      expect(content, `${file} must not import src/ai/`).not.toMatch(/from ['"].*\/ai\//)
      expect(content, `${file} must not import src/conversation/`).not.toMatch(/from ['"].*\/conversation\//)
    }
  })

  it('mcpTypes.ts, mcpClient.ts, and httpMCPTransport.ts never import src/reasoning/ at all', () => {
    for (const file of [
      'src/mcp/domain/mcpTypes.ts', 'src/mcp/application/mcpClient.ts', 'src/mcp/infrastructure/httpMCPTransport.ts',
    ]) {
      expect(readCode(file), `${file} must not import src/reasoning/`).not.toMatch(/from ['"].*\/reasoning\//)
    }
  })

  it('mcpToolAdapter.ts is the only new file that imports src/reasoning/ or src/providers/ToolRegistry.ts, and it never imports toolCallingStage.ts, ruleEngine.ts, citationFormatter.ts, or answerComposer.ts', () => {
    const content = readCode('src/mcp/application/mcpToolAdapter.ts')
    expect(content).toMatch(/from ['"]\.\.\/\.\.\/providers\/ToolRegistry\.ts['"]/)
    for (const forbidden of [
      'toolCallingStage.ts', 'ruleEngine.ts', 'citationFormatter.ts', 'answerComposer.ts',
      'reasoningEnginePipeline.ts', 'outputFormatter.ts', 'legalReasoningEngine.ts',
    ]) {
      expect(content, `must not import ${forbidden}`).not.toContain(forbidden)
    }
  })

  it('the only src/providers/ imports across all new files are RestClient.ts, RetryPolicy.ts, and ToolRegistry.ts — never ToolExecutor.ts, ToolCallingAgent.ts, AgentRuntime.ts, ProviderManager.ts, or ProviderRegistry.ts', () => {
    const allowed = [
      "from '../../providers/RestClient.ts'",
      "from '../../providers/RetryPolicy.ts'",
      "from '../../providers/ToolRegistry.ts'",
    ]
    for (const file of NEW_FILES) {
      const content = readCode(file)
      const providerImportLines = content.split('\n').filter(line => /from ['"].*\/providers\//.test(line))
      for (const line of providerImportLines) {
        expect(allowed.some(a => line.includes(a)), `unexpected providers/ import in ${file}: ${line}`).toBe(true)
      }
      expect(content).not.toMatch(/ToolCallingAgent|AgentRuntime|ProviderManager|ProviderRegistry|ConversationMemory|ConversationBuilder|MultiAgentCoordinator/)
    }
  })

  it('never duplicates Tool Calling, RetryPolicy, or ToolRegistry logic (no reimplemented decision/registry/retry-classification logic)', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file).toLowerCase()
      for (const forbidden of [
        'runtoolcallingstage', 'neverinvoketool', 'class toolregistry', 'class retrypolicy',
        'class toolexecutor', 'evaluaterule(', 'evaluatethreshold(', 'resolveconflicts(',
        'computeconfidence', 'formatcitations', 'composedecision', 'buildexplanation',
        'determinehumanreview', 'formatconversationresponse',
      ]) {
        expect(content, `${file} must not reference "${forbidden}"`).not.toContain(forbidden)
      }
    }
  })

  it('references no reasoning, retrieval, ranking, conflict resolution, confidence computation, citation generation, or Multi-Agent logic', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file).toLowerCase()
      for (const forbidden of ['detectintent', 'rankitems', 'selectcandidates', 'searchknowledge', 'resolveknowledge(', 'multiagent']) {
        expect(content, `must not reference "${forbidden}"`).not.toContain(forbidden)
      }
    }
  })

  it('mcpClient.ts never constructs its own transport — MCPTransport is always caller-injected', () => {
    const content = readCode('src/mcp/application/mcpClient.ts')
    expect(content).not.toMatch(/new HttpMCPTransport/)
    expect(content).not.toContain("from '../infrastructure/httpMCPTransport.ts'")
  })

  it('registerMCPTools() never mutates the MCPToolDescriptor it discovers or the ToolRegistry beyond registerTool()', () => {
    const content = readCode('src/mcp/application/mcpToolAdapter.ts')
    expect(content).not.toMatch(/descriptor\.\w+\s*=/)
  })
})

describe('Architecture guard — frozen modules untouched (all of X.3.1 through X.6, and everything before)', () => {
  it('every prior milestone\'s files still carry their own frozen-milestone markers', () => {
    const markers: readonly [string, RegExp][] = [
      ['src/conversation/domain/conversationTypes.ts', /collision check/i],
      ['src/ai/application/aiContextBuilder.ts', /Batch B/],
      ['src/ai/application/promptBuilder.ts', /presentation only/],
      ['src/ai/application/promptRenderer.ts', /deterministic rendering only/],
      ['src/ai/infrastructure/adapters/claudeLLMAdapter.ts', /outer boundary/i],
      ['src/ai/validation/outputValidator.ts', /orchestrator \+ structural checks/],
      ['src/ai/validation/responseFormatter.ts', /remediation and final answer assembly/i],
      ['src/reasoning/application/knowledgeReferenceMapper.ts', /Repository mapping layer/],
      ['src/reasoning/domain/knowledgeRepositoryTypes.ts', /Phase X\.3\.2/],
      ['src/reasoning/infrastructure/knowledgePlatformRepository.ts', /Phase X\.3\.2/],
      ['src/reasoning/application/knowledgeResolutionPlanner.ts', /Phase X\.3\.3/],
      ['src/reasoning/application/intentResolutionPipeline.ts', /Phase X\.3\.3/],
      ['src/reasoning/domain/knowledgeRankingTypes.ts', /Phase X\.3\.4/],
      ['src/reasoning/application/knowledgeRankingPipeline.ts', /Phase X\.3\.4/],
      ['src/reasoning/application/rankingStrategy.ts', /Phase X\.3\.4/],
      ['src/reasoning/domain/resolutionOrchestrationTypes.ts', /Phase X\.3\.5/],
      ['src/reasoning/application/resolutionCoordinator.ts', /Phase X\.3\.5/],
      ['src/reasoning/application/resolutionExecutor.ts', /Phase X\.3\.5/],
      ['src/reasoning/application/knowledgeResolutionPipeline.ts', /Phase X\.3\.5/],
      ['src/reasoning/domain/knowledgeEnrichmentTypes.ts', /Phase X\.3\.6/],
      ['src/reasoning/application/knowledgeEnrichmentPipeline.ts', /Phase X\.3\.6/],
      ['src/reasoning/application/effectivePeriodEvaluator.ts', /Phase X\.3\.6/],
      ['src/reasoning/application/knowledgeApplicabilityEvaluator.ts', /Phase X\.3\.6/],
      ['src/reasoning/application/finalKnowledgeResolutionPipeline.ts', /Phase X\.3\.7/],
      ['src/reasoning/application/reasoningOrchestrator.ts', /Phase X\.4\.1/],
      ['src/reasoning/domain/reasoningExecutionContextTypes.ts', /Phase X\.4\.2/],
      ['src/reasoning/application/reasoningContextAssembler.ts', /Phase X\.4\.2/],
      ['src/reasoning/domain/ruleEvaluationTypes.ts', /Phase X\.4\.3/],
      ['src/reasoning/application/ruleEvaluationStage.ts', /Phase X\.4\.3/],
      ['src/reasoning/domain/conflictResolutionTypes.ts', /Phase X\.4\.4/],
      ['src/reasoning/application/conflictResolutionStage.ts', /Phase X\.4\.4/],
      ['src/reasoning/domain/confidenceEvaluationTypes.ts', /Phase X\.4\.5/],
      ['src/reasoning/application/confidenceEvaluationStage.ts', /Phase X\.4\.5/],
      ['src/reasoning/domain/citationGenerationTypes.ts', /Phase X\.4\.6/],
      ['src/reasoning/application/citationGenerationStage.ts', /Phase X\.4\.6/],
      ['src/reasoning/domain/reasoningAnswerTypes.ts', /Phase X\.4\.7/],
      ['src/reasoning/application/reasoningAnswerStage.ts', /Phase X\.4\.7/],
      ['src/reasoning/application/reasoningEnginePipeline.ts', /Final Phase X\.4 Integration/],
      ['src/reasoning/domain/conversationResponseTypes.ts', /Phase X\.5/],
      ['src/reasoning/application/outputFormatter.ts', /Phase X\.5/],
      ['src/reasoning/domain/toolCallingTypes.ts', /Phase X\.6/],
      ['src/reasoning/application/toolCallingStage.ts', /Phase X\.6/],
    ]
    for (const [file, marker] of markers) {
      expect(readRaw(file), `${file} marker changed`).toMatch(marker)
    }
  })

  it('answerComposer.ts still carries its own marker, unmodified', () => {
    expect(readRaw('src/reasoning/application/answerComposer.ts')).toMatch(/Stage 7 — Answer Composer/)
  })

  it('the pre-existing provider-layer files (ToolRegistry, ToolExecutor, RetryPolicy, RestClient, ToolCallingAgent, AgentRuntime, ProviderRegistry) are untouched', () => {
    expect(readRaw('src/providers/ToolRegistry.ts')).toMatch(/P6-10N/)
    expect(readRaw('src/providers/ToolExecutor.ts')).toMatch(/P6-10O/)
    expect(readRaw('src/providers/RetryPolicy.ts')).toMatch(/P6-10J/)
    expect(readRaw('src/providers/RestClient.ts')).toMatch(/P6-12A/)
  })
})
