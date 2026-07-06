import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Architecture guard for Phase X.4.2 (Reasoning Context Assembly) ───────────
// Per this milestone's rules: pure structural assembly/normalization only — zero reasoning,
// conflict resolution, confidence scoring, citation generation, explanation generation, answer
// generation, tool calling, MCP, or LLM calls. No src/knowledge/, src/ai/, src/mcp/, or
// src/conversation/ import. Checks run against comment-stripped code.

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
  'src/reasoning/domain/reasoningExecutionContextTypes.ts',
  'src/reasoning/application/reasoningContextAssembler.ts',
]

describe('Architecture guard — Phase X.4.2 dependency direction', () => {
  it('no new file imports anything from src/knowledge/, src/mcp/, src/ai/, or src/conversation/', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      expect(content, `${file} must not import src/knowledge/`).not.toMatch(/from ['"].*\/knowledge\//)
      expect(content, `${file} must not import src/mcp/`).not.toMatch(/from ['"].*\/mcp\//)
      expect(content, `${file} must not import src/ai/`).not.toMatch(/from ['"].*\/ai\//)
      expect(content, `${file} must not import src/conversation/`).not.toMatch(/from ['"].*\/conversation\//)
    }
  })

  it('no new file imports any earlier X.3/X.4 orchestration or retrieval module — consumes only ReasoningIntent/ResolvedKnowledge as plain values', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      for (const forbidden of [
        "from './finalKnowledgeResolutionPipeline.ts'", "from './knowledgeResolutionPipeline.ts'",
        "from './resolutionCoordinator.ts'", "from './resolutionExecutor.ts'",
        "from './intentResolutionPipeline.ts'", "from './knowledgeRankingPipeline.ts'",
        "from './reasoningOrchestrator.ts'", "from './legalReasoningEngine.ts'",
        "from '../infrastructure/knowledgePlatformRepository.ts'", 'IKnowledgePlatform',
        'IKnowledgeRepository',
      ]) {
        expect(content, `${file} must not import ${forbidden}`).not.toContain(forbidden)
      }
    }
  })

  it('references no MCP, Tool Calling, provider implementation, Anthropic/OpenAI, PromptBuilder/PromptRenderer, LLM adapter, or Output Validation', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file)
      expect(content).not.toMatch(/from ['"].*\/providers\//)
      expect(content).not.toMatch(/Anthropic|ClaudeProvider|OpenAI/)
      expect(content).not.toMatch(/promptBuilder|promptRenderer|PromptBuilder|PromptRenderer/i)
      expect(content).not.toMatch(/llmAdapter/i)
      expect(content).not.toMatch(/outputValidator/i)
    }
  })

  it('performs zero reasoning, conflict resolution, confidence scoring, citation/explanation/answer generation, ranking, or retrieval', () => {
    for (const file of NEW_FILES) {
      const content = readCode(file).toLowerCase()
      for (const forbidden of [
        'detectandresolveconflicts', 'resolveconflict', 'computeconfidence', 'composedecision',
        'answercomposer', 'formatcitations', 'citationformatter', 'buildexplanation',
        'evaluaterule', 'evaluatethreshold', 'detectexceptions', 'scoreitem', 'rankitems',
        'selectcandidates', 'searchknowledge', 'resolveknowledge(', 'detectintent',
      ]) {
        expect(content, `must not reference "${forbidden}"`).not.toContain(forbidden)
      }
    }
  })

  it('assembleReasoningContext deep-freezes its result — every returned array/object is non-extensible', () => {
    const content = readCode('src/reasoning/application/reasoningContextAssembler.ts')
    expect(content).toMatch(/Object\.freeze/)
    expect(content).toMatch(/deepFreeze/)
  })

  it('reasoningExecutionContextTypes.ts introduces no new item shape — reuses KnowledgeItemRef/RuleKnowledgeItemRef/ThresholdKnowledgeItemRef from reasoningTypes.ts', () => {
    const content = readCode('src/reasoning/domain/reasoningExecutionContextTypes.ts')
    expect(content).toMatch(/from ['"]\.\/reasoningTypes\.ts['"]/)
    expect(content).not.toMatch(/interface\s+Normalized/)
  })
})

describe('Architecture guard — frozen modules untouched (all of X.3.1 through X.4.1, and everything before)', () => {
  it('every prior milestone\'s files still carry their own frozen-milestone markers', () => {
    const markers: readonly [string, RegExp][] = [
      ['src/conversation/domain/conversationTypes.ts', /collision check/i],
      ['src/ai/application/aiContextBuilder.ts', /Batch B/],
      ['src/ai/application/promptBuilder.ts', /presentation only/],
      ['src/ai/application/promptRenderer.ts', /deterministic rendering only/],
      ['src/ai/infrastructure/adapters/claudeLLMAdapter.ts', /outer boundary/i],
      ['src/ai/validation/outputValidator.ts', /orchestrator \+ structural checks/],
      ['src/reasoning/application/knowledgeReferenceMapper.ts', /Repository mapping layer/],
      ['src/reasoning/domain/knowledgeRepositoryTypes.ts', /Phase X\.3\.2/],
      ['src/reasoning/infrastructure/knowledgePlatformRepository.ts', /Phase X\.3\.2/],
      ['src/reasoning/application/knowledgeResolutionPlanner.ts', /Phase X\.3\.3/],
      ['src/reasoning/application/intentResolutionPipeline.ts', /Phase X\.3\.3/],
      ['src/reasoning/domain/knowledgeRankingTypes.ts', /Phase X\.3\.4/],
      ['src/reasoning/application/knowledgeRankingPipeline.ts', /Phase X\.3\.4/],
      ['src/reasoning/domain/resolutionOrchestrationTypes.ts', /Phase X\.3\.5/],
      ['src/reasoning/application/resolutionCoordinator.ts', /Phase X\.3\.5/],
      ['src/reasoning/application/resolutionExecutor.ts', /Phase X\.3\.5/],
      ['src/reasoning/domain/knowledgeEnrichmentTypes.ts', /Phase X\.3\.6/],
      ['src/reasoning/application/knowledgeEnrichmentPipeline.ts', /Phase X\.3\.6/],
      ['src/reasoning/application/finalKnowledgeResolutionPipeline.ts', /Phase X\.3\.7/],
      ['src/reasoning/application/reasoningOrchestrator.ts', /Phase X\.4\.1/],
    ]
    for (const [file, marker] of markers) {
      expect(readRaw(file), `${file} marker changed`).toMatch(marker)
    }
  })

  it('legalReasoningEngine.ts still carries its Stage marker (pre-X.4 API cleanup, already frozen)', () => {
    expect(readRaw('src/reasoning/application/legalReasoningEngine.ts')).toMatch(/Stages 1, 3-7/)
  })
})
