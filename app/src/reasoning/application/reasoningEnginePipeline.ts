import { buildFinalKnowledgeResolutionPipeline } from './finalKnowledgeResolutionPipeline.ts'
import { assembleReasoningContext } from './reasoningContextAssembler.ts'
import { evaluateRules } from './ruleEvaluationStage.ts'
import { resolveConflicts } from './conflictResolutionStage.ts'
import { evaluateConfidence } from './confidenceEvaluationStage.ts'
import { generateCitations } from './citationGenerationStage.ts'
import { composeAnswer } from './reasoningAnswerStage.ts'
import type { FinalKnowledgeResolutionPipeline } from './finalKnowledgeResolutionPipeline.ts'
import type { RankingPlanner } from './knowledgeRankingPipeline.ts'
import type { IKnowledgeRepository } from '../domain/knowledgeRepositoryTypes.ts'
import type { ReasoningIntent } from '../domain/reasoningTypes.ts'
import type { ReasoningAnswerResult } from '../domain/reasoningAnswerTypes.ts'

// ── ReasoningEnginePipeline — Final Phase X.4 Integration ──────────────────────
// The one public entry point for the complete, native Reasoning Engine built across
// X.4.1-X.4.7: ReasoningIntent -> Knowledge Resolution -> ReasoningExecutionContext ->
// RuleEvaluationResult -> ConflictResolutionResult -> ConfidenceEvaluationResult ->
// CitationGenerationResult -> ReasoningAnswerResult. Integrates only - zero new reasoning
// capability, zero redesign, zero architecture change. Every step below is an unmodified call
// to an already-frozen, already-tested public function/class from its own milestone; this file
// contributes no computation of its own beyond sequencing.
//
// DESIGN NOTE on "ReasoningOrchestrator" in the requested flow (ReasoningOrchestrator ->
// ReasoningExecutionContext -> ...): X.4.1's ReasoningOrchestrator wires
// FinalKnowledgeResolutionPipeline to legalReasoningEngine.reason() specifically - a different,
// still-valid, still-frozen path producing a ReasoningResult via Batch A's own pipeline.
// ReasoningResult does carry a resolvedKnowledge field, so ReasoningOrchestrator.answer()
// COULD technically be called and its .resolvedKnowledge extracted - but that would mean
// running the entire frozen legalReasoningEngine.reason() pipeline (conflict detection, rule
// evaluation, citation formatting, confidence scoring, decision composition) only to discard
// its result and recompute an equivalent answer via the native X.4.2-X.4.7 chain from the same
// resolved knowledge - wasted computation, not "integration only". This pipeline instead builds
// FinalKnowledgeResolutionPipeline directly (X.3.7) - the exact same resolution mechanism
// ReasoningOrchestrator's own constructor already builds internally - fulfilling the
// "ReasoningOrchestrator" step's actual ROLE (resolve knowledge for an intent) without its
// unrelated legalReasoningEngine.reason() side effect. ReasoningOrchestrator (X.4.1) itself is
// untouched and remains a separate, valid entry point for its own (Batch-A-backed) path.
//
// No new abstraction is introduced for the sequencing itself (no generic Coordinator/Executor
// layer) - PHASE_X3_FINAL_ARCHITECTURE_AUDIT.md's Finding F-1 already flagged that pattern as
// premature once, and a fixed, linear seven-step sequence needs nothing more than the plain
// method below, mirroring X.3.7's own successful precedent for the same kind of milestone.

export class ReasoningEnginePipeline {
  private readonly resolutionPipeline: FinalKnowledgeResolutionPipeline

  constructor(repository: IKnowledgeRepository, rankingPlanner?: RankingPlanner) {
    this.resolutionPipeline = buildFinalKnowledgeResolutionPipeline(repository, rankingPlanner)
  }

  async answer(intent: ReasoningIntent): Promise<ReasoningAnswerResult> {
    const { knowledge } = await this.resolutionPipeline.resolve(intent)
    const context = assembleReasoningContext(intent, knowledge)
    const ruleEvaluation = evaluateRules(context)
    const conflictResolution = resolveConflicts(context, ruleEvaluation)
    const confidenceEvaluation = evaluateConfidence(context, ruleEvaluation, conflictResolution)
    const citationGeneration = generateCitations(context, conflictResolution, confidenceEvaluation)
    return composeAnswer(context, conflictResolution, confidenceEvaluation, citationGeneration)
  }
}

export function buildReasoningEnginePipeline(
  repository: IKnowledgeRepository, rankingPlanner?: RankingPlanner,
): ReasoningEnginePipeline {
  return new ReasoningEnginePipeline(repository, rankingPlanner)
}
