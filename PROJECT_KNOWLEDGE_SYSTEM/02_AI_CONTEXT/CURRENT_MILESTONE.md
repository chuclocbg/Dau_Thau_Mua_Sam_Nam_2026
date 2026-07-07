# Current Milestone

*Machine-readable. The single most time-sensitive file in this folder — check it is not stale
before trusting anything else in this session.*

> **ARCHIVAL RULE — read before editing this file:** before overwriting this file's content
> for a new milestone, append the outgoing milestone's full summary to
> [`../04_PROJECT_MEMORY/MILESTONE_HISTORY.md`](../04_PROJECT_MEMORY/MILESTONE_HISTORY.md)
> first. This file holds only the *current* milestone — history lives in Project Memory, never
> here. This rule exists because keeping "current-only" files current-only, with history moved
> out before overwrite, is the one discipline that prevents this folder from silently losing
> the past or bloating into an unusable historical log.

## Machine Context

```yaml
as_of: 2026-07-07
status: CURRENT
owner_file: null   # owns: current_milestone_name, next_milestone_name, milestone_blockers
related: [../04_PROJECT_MEMORY/MILESTONE_HISTORY.md, CURRENT_RELEASE.md, NEXT_APPROVED_PHASE.md, SCHEMA.md]

current_milestone: "Phase X.9.1 - Production Hardening: HTTP Server & Bootstrap - FROZEN"
documentation_track_status: "CLOSED"
milestone_declared: 2026-07-07
milestone_evidence:
  scope: "src/config/appConfig.ts (loadAppConfigFromEnv() — PORT/HOST/NODE_ENV/LOG_LEVEL/
         SHUTDOWN_TIMEOUT_MS, never-throw, deliberately separate from frozen src/providers/env.ts);
         src/bootstrap/buildApplication.ts (the composition root — constructs, never modifies, a
         real memory-backed IKnowledgePlatform + LegalProvider, ReasoningEnginePipeline,
         ToolRegistry/ToolExecutor, CoordinatorAgent, and an optional caller-supplied MCPClient);
         src/health/healthCheck.ts (checkLiveness()/checkReadiness()/checkHealth() — pure
         functions over an already-built Application); src/api/reasoningRoutes.ts +
         coordinatorRoutes.ts (POST /api/v1/reasoning/answer and /reasoning/batch — thin HTTP
         adapters over the real X.4-X.8 chain); src/server/httpServer.ts (buildHttpServer() — a
         pure Fastify-instance builder with /live, /ready, /health, and the API routes, no
         .listen() call inside it, mirroring src/interface/restAdapter.ts's own established
         pattern); src/server/main.ts (the one file that calls server.listen(), guarded by an
         import.meta.url entrypoint check); src/startup/gracefulShutdown.ts
         (createShutdownHandler()/registerGracefulShutdown() — SIGTERM/SIGINT close the listener
         and disconnect an optional MCPClient, racing a hard timeout)."
  scope_exclusion: "Zero reasoning, retrieval, ranking, conflict resolution, confidence
                    computation, citation generation, Tool Calling, MCP, or Multi-Agent logic
                    reimplemented anywhere — confirmed by architecture guard: config/health/
                    server/startup files never import src/reasoning/, src/knowledge/, src/mcp/,
                    or src/multiagent/ directly; buildApplication.ts is the only composition
                    point; the API layer imports only top-level, already-frozen entry points
                    (detectIntent, formatConversationResponse, runToolCallingStage,
                    buildReasoningWorkerTask, CoordinatorAgent.run), never an internal reasoning
                    stage. TRANSPARENCY FINDING: a real, working Fastify HTTP adapter already
                    existed before this milestone — src/interface/restAdapter.ts ('Phase 14'),
                    wiring an older, unrelated set of governance services to real routes — but
                    grep confirmed `.listen(` was called nowhere in the repository, and
                    package.json had no start script; PRODUCTION_HARDENING_AUDIT.md's own
                    findings #1/#2/#9 (later renumbered) are the direct basis for this
                    milestone's scope. buildHttpServer() deliberately mirrors restAdapter.ts's
                    thin-handler pattern rather than inventing a new one. A real smoke test
                    (`npm run server`, curl against a real socket) caught and fixed a genuine bug:
                    the initial string-comparison entrypoint guard silently failed under tsx on
                    this platform, so main() never ran and no server ever started; replaced with
                    pathToFileURL(process.argv[1]).href and re-verified live — a real
                    POST /api/v1/reasoning/answer returned a genuine ConversationResponse over an
                    actual network socket."
  files_added: "8 implementation files + 6 test files (38 tests: app-config validation, graceful-
               shutdown unit tests including a force-exit-on-timeout case, health-check unit
               tests, a true end-to-end HTTP integration test suite exercising a real
               Application — real memory-backed IKnowledgePlatform + LegalProvider, complete
               ReasoningEnginePipeline, real ToolExecutor, real CoordinatorAgent — via Fastify's
               own inject(), covering liveness/readiness/health, a real answer through the
               complete reasoning + Tool Calling chain, a real batch through the complete
               Multi-Agent chain, request validation, and deterministic replay, plus an
               architecture guard); 1 package.json script added ('server')"
  full_suite_result: "498 test files, 14444 tests, 0 failures (pool=forks, full repo, no filter);
                      up from 493 files / 14406 tests at the X.8 freeze baseline"
  exit_criteria_met: "Unit tests prove config validation (defaults, overrides, and rejection of
                      invalid PORT/NODE_ENV/LOG_LEVEL/SHUTDOWN_TIMEOUT_MS, never throwing on
                      garbage input), graceful shutdown (close+onShutdown+exit ordering,
                      concurrent-signal dedup, timeout force-exit via a race rather than a
                      sequential await so the handler's own promise always settles, tolerance for
                      a missing onShutdown callback), and health/readiness/liveness (liveness
                      always ok; readiness true with no MCP client configured, true/false
                      matching a configured MCP client's real CONNECTED/DISCONNECTED status —
                      never a fabricated check against a dependency that doesn't exist). A true
                      end-to-end integration test exercises the complete chain — a real
                      Application wired into a real Fastify instance via inject() — for
                      liveness/readiness/health, a real question answered through the complete
                      Reasoning Engine + Output Formatting + Tool Calling stack, a real batch of
                      questions coordinated through the complete Multi-Agent stack, request
                      validation rejection, and deterministic replay (identical markdown for an
                      identical question asked twice). A real smoke test (actual process,
                      actual TCP socket, actual curl requests) additionally verified the server
                      genuinely runs outside the test harness — not just via inject() — and
                      shuts down cleanly. Architecture guard confirms config/health/server/
                      startup files never import src/reasoning/, src/knowledge/, src/mcp/, or
                      src/multiagent/ directly; that buildApplication.ts is the only file
                      constructing (never modifying) the frozen X.3-X.8 components; that
                      reasoningRoutes.ts/coordinatorRoutes.ts import only top-level frozen entry
                      points, never an internal stage (ruleEvaluationStage/
                      conflictResolutionStage/confidenceEvaluationStage/citationGenerationStage/
                      reasoningAnswerStage/ruleEngine/legalReasoningEngine/citationFormatter/
                      answerComposer/finalKnowledgeResolutionPipeline/mcpClient/mcpToolAdapter);
                      zero reimplemented reasoning/ranking/conflict/confidence/citation/answer-
                      composition/Tool-Calling/MCP/Multi-Agent logic anywhere; that main.ts is
                      the only file calling .listen(); and that every prior milestone's
                      frozen-file marker (X.1 through X.8, plus restAdapter.ts and the
                      pre-existing ToolExecutor/ToolRegistry/RetryPolicy provider files) is
                      unchanged."
  frozen_interfaces_touched: "None. src/reasoning/**, src/knowledge/**, src/conversation/**,
                              src/providers/**, src/mcp/**, and src/multiagent/** were not
                              modified — verified by git diff and architecture guard.
                              buildApplication.ts and the API routes only CONSTRUCT/CALL
                              already-frozen, already-exported public functions/constructors;
                              nothing in this milestone edited a frozen file's contents."
  owner_file_for_numbers: CURRENT_RELEASE.md   # release tag, test counts — see there, not here

next_active_milestone: "Phase X.9.2 (Batch B — Logging/Metrics/Tracing/Error middleware) or any
                        other later milestone — none authorized to begin without separate
                        explicit approval"
next_milestone_status: "NOT AUTHORIZED. Phase X.9.1's exit criteria confirmed met and frozen this
                         session, per explicit instruction to stop and wait after every frozen
                         milestone. Batch A (HTTP Server & Bootstrap) is complete: a real,
                         runnable HTTP server now exists with health/readiness/liveness and two
                         real API routes over the real X.4-X.8 chain. Remaining PRODUCTION_
                         HARDENING_AUDIT.md findings not yet addressed: no structured
                         logging/metrics/tracing on the request path (Batch B), no streaming/SSE/
                         cancellation-through-the-HTTP-layer (Batch C), no Dockerfile/production
                         config for the app itself (Batch D), no deployment scripts/operational
                         runbook (Batch E). Also still open: no auth/permission layer on the new
                         API routes (correctly deferred per the audit's own sequencing — there
                         was nothing to protect until this milestone built the entry point; now
                         that it exists, this becomes the natural next co-requirement), no rate
                         limiting on the API routes, ToolRegistry is empty by default (no real
                         tools registered — a deployment decision, not fabricated), the
                         missingEvidence-reconciliation question, the superseded-item/decision
                         gaps, and the still-open ResolvedKnowledge extension decision all remain
                         unresolved, carried forward unchanged from earlier freezes."
next_milestone_blocker: "None technical. Requires its own explicit human authorization to
                         begin, separate from this freeze's own approval."

immediate_next_action: "None assigned as of this writing. Waiting for explicit human approval
                        to begin Phase X.9.2."

do_not:
  - "Do not begin Phase X.9.2 (or any later batch/milestone) without explicit approval."
  - "Do not modify any file under src/conversation/ (X.1, frozen), src/reasoning/{domain,
     application,infrastructure,testing}/ (X.2 Batch A + X.3.1 + X.3.2 + X.3.3 + X.3.4 + X.3.5 +
     X.3.6 + X.3.7 + Pre-X.3.8 API Cleanup + X.4.1 + X.4.2 + X.4.3 + X.4.4 + X.4.5 + X.4.6 +
     X.4.7 + Final X.4 Integration + X.5 + X.6, frozen), src/mcp/{domain,infrastructure,
     application}/ (X.7, frozen), src/multiagent/{domain,application}/ (X.8, frozen),
     src/config/, src/bootstrap/, src/health/, src/server/, src/api/, src/startup/ (X.9.1,
     frozen), src/ai/{domain,application,infrastructure}/ (X.2 Batch B, frozen), or
     src/ai/validation/ (X.4, frozen) outside of a newly-approved milestone."
  - "Do not modify src/reasoning/reasoningEngine.ts or src/reasoning/decisionModel.ts (Phase 15
     track), or any of the pre-existing src/providers/*.ts files (the unrelated 'P6' track,
     e.g. ToolCallingAgent.ts, AgentRuntime.ts, MultiAgentCoordinator.ts, ProviderManager.ts), or
     src/interface/restAdapter.ts (Phase 14, unrelated, pre-existing Fastify pattern) — none of
     these belong to Phase X. ToolRegistry.ts/ToolExecutor.ts/RetryPolicy.ts/RestClient.ts are
     reused by X.6/X.7/X.8/X.9.1 but must remain unmodified."
  - "Do not claim Phase M1 (Prisma) is 'verified' — it is implemented, unverified against a
     live database."

historical_sequence_to_reach_here:
  - "Phase A-M1: business modules + infrastructure, built and frozen incrementally"
  - "Phase N: Knowledge Platform, built in 4 controlled batches (Stage 1+2, Batch 1-4),
     frozen at 16/16 providers"
  - "Release Candidate audit performed (architecture, freeze verification, Knowledge Platform
     deep review, tech debt register, roadmap review, AI readiness) — GO WITH NOTES"
  - "Release Preparation: 227 uncommitted files organized into 17 logical commits + 1
     unplanned addendum, tagged v1.0-knowledge-platform"
  - "Final release audit (tag integrity, git fsck, diff scope, Commit 18 reachability) — passed
     5 of 6 checks; one FAIL (diff scope includes 37 pre-existing unrelated commits, not a
     defect, just a scope clarification) — recommendation was still to push"
  - "Pushed to origin/develop + tag pushed"
  - "Phase X Architecture Review performed (9-part deep audit)"
  - "Phase X Architecture Design produced (13-part design, accepted)"
  - "Phase X Implementation Blueprint produced (ADR drafts, phase breakdown, golden question
     strategy, testing strategy, AI safety design, MCP/multi-agent readiness)"
  - "PROJECT_KNOWLEDGE_SYSTEM v1.0 created, audited (Documentation QA Audit), released, tagged
     knowledge-system-v1.0, pushed"
  - "Zero-Knowledge Validation performed (new-architect simulation, PKS-only source of truth) —
     found ADR-X01 and AIContext schema retrievable only in chat history, not in PKS"
  - "Documentation Completion Sprint: ADR-DRAFT-X01 formalized, AIContext schema + Golden
     Question methodology persisted, SCHEMA.md ownership registry completed, all 15 Knowledge
     Base folders given explicit Ownership/Update Policy — released as v1.1, tagged
     knowledge-system-v1.1, pushed"
  - "Final governance classification: ADR-X02-X07, Golden Question datasets, Knowledge Base
     population, domain legal content, FAQ population, and ontology population confirmed
     intentionally deferred and non-blocking for Phase X.1 — DOCUMENTATION TRACK CLOSED"
  - "PHASE_X_EXECUTION_PLAN.md produced (7-milestone breakdown, X.1-X.7)"
  - "PHASE_X_READINESS_REVIEW.md produced — GO decision, safest-first-task identified as
     conversationTypes.ts"
  - "Phase X.1 (Conversation Core) implemented: conversationTypes, ConversationContextManager,
     SessionStateManager, AdvisoryConversationMemory, MemorySessionRepository, architecture
     guard test — full repo suite green (13760 tests) — FROZEN"
  - "PHASE_X1_POST_IMPLEMENTATION_REVIEW.md produced — score 7.9/10, no redesign needed,
     two additive follow-ups recommended for X.2 (composition/rehydration helpers)"
  - "PHASE_X2_IMPLEMENTATION_STRATEGY.md produced — deterministic-first internal build
     sequence (Batch A / Batch B split), Checkpoint A identified as a safe, freeze-able
     stopping point short of LLM integration"
  - "Phase X.2 Batch A (Reasoning Pipeline Core) implemented: reasoningTypes,
     intentPatternRegistry, intentDetector, ruleEngine, evidenceCollector, citationFormatter,
     answerComposer, legalReasoningEngine (incl. Stage 3), mockKnowledgeFixtures, architecture
     guard test — full repo suite green (13809 tests) — FROZEN"
  - "Phase X.2 Batch B architecture gate review performed before implementation — GO with 5
     non-blocking recommendations, including a real correction (Finding A) to the previously-
     stated AIContextBuilder integration design"
  - "Phase X.2 Batch B (AIContext/Prompt/LLM Adapter path) implemented: aiTypes, AIContextBuilder,
     PromptBuilder, PromptRenderer, ModelCapabilityRegistry, ModelSelector, ClaudeLLMAdapter
     (wraps existing src/providers/ClaudeProvider.ts), architecture guard suite — full repo
     suite green (13855 tests) — FROZEN"
  - "Phase X.4 (Output Validation) implemented: validationTypes, CitationValidator,
     ConfidenceValidator, LegalConsistencyValidator, OutputValidator, ResponseFormatter,
     ValidationPipeline, architecture guard suite — 100% adversarial-fixture catch rate — full
     repo suite green (13913 tests) — FROZEN"
  - "PHASE_X3_READINESS_REVIEW.md produced — NO-GO, sole blocker: ADR-DRAFT-X01 not yet
     ratified; three additional integration-shape gaps found and documented"
  - "ADR-X01_FINAL.md produced (critical re-review, not a rubber stamp): reconfirmed the
     original searchKnowledge()/resolveX() split, closed 3 new gaps found this pass (a real
     temporal-filtering gap in searchKnowledge(), plus 2 field-shape mappings) — GO recommended"
  - "ADR-X01_FINAL ratified 2026-07-05 as ADR-022 in app/.memory/decision-index.md; original
     draft PHASE_X_ADR_DRAFT_001.md marked SUPERSEDED; X.3's one named blocker cleared —
     governance action only, does not itself authorize starting X.3"
  - "PHASE_X3_ARCHITECTURE_REVIEW.md produced: found ADR-022's 'searchKnowledge() results never
     PRIMARY_BASIS' guarantee holds by construction (legalReasoningEngine.ts's candidate set
     reads only legalItems/schoolPolicyItems — a new caseItems field is never seen), zero
     frozen-code changes needed for it"
  - "Phase X.3.1 (Knowledge Resolution: Pure Mapping) implemented: knowledgeReferenceTypes,
     toLegalBasisRef(), toKnowledgeItemRef(), architecture guard — full repo suite green
     (13928 tests) — FROZEN"
  - "Phase X.3.2 (Knowledge Resolution: Retrieval & Wiring) implemented:
     IKnowledgeRepository, KnowledgePlatformRepository (the sole IKnowledgePlatform importer),
     architecture guard — proven against a real memory-backed platform + LegalProvider, not
     just fixtures — full repo suite green (13943 tests) — FROZEN"
  - "Phase X.3.3 (Knowledge Resolution: Intent-Driven Orchestration) implemented:
     knowledgeResolutionPlanner, resolveKnowledgeWarnings, IntentResolutionPipeline (depends
     only on IKnowledgeRepository, never the concrete adapter), architecture guard — full repo
     suite green (13971 tests) — FROZEN"
  - "Phase X.3.4 (Knowledge Resolution: Knowledge Ranking & Selection) implemented:
     rankingStrategy (5 per-item criteria), candidateSelector (deterministic sort + itemId
     tie-break), rankingPlanner (per-intent weights), KnowledgeRankingPipeline (consumes only
     the ResolvedKnowledge value, never X.3.2/X.3.3 modules), architecture guard — full repo
     suite green (14011 tests) — FROZEN"
  - "Phase X.3.5 (Knowledge Resolution: Orchestration Wiring) implemented:
     resolutionOrchestrationTypes (RankedKnowledge, ResolutionExecutor), resolutionExecutor
     (thin adapters for IntentResolutionPipeline/KnowledgeRankingPipeline), ResolutionCoordinator
     (sequences intent-retrieval then ranking, no branching), KnowledgeResolutionPipeline (public
     composition root, composes X.3.3/X.3.4 via their existing build*() factories only) —
     zero modification to X.3.1-X.3.4, zero new reasoning logic, architecture guard — full repo
     suite green (14026 tests) — FROZEN"
  - "Phase X.3.6 (Knowledge Resolution: Remaining Gaps / Deterministic Enrichment) implemented:
     knowledgeEnrichmentTypes (diagnostic shapes), resolutionMetadataNormalizer
     (readMetadataString), effectivePeriodEvaluator (independent CURRENT/NOT_YET_EFFECTIVE/
     EXPIRED classification), ruleMetadataParser + thresholdMetadataParser (ADR-022 Decision 5 —
     JSON metadata parsing into RuleKnowledgeItemRef/ThresholdKnowledgeItemRef, critical
     MissingEvidence on failure, never throws), knowledgeApplicabilityEvaluator (final per-item
     verdict), resolutionDiagnostics (aggregation), knowledgeEnrichmentPipeline (enrichKnowledge()
     — pure composition, standalone from X.3.5) — zero modification to X.3.1-X.3.5, zero LLM/
     answer generation, architecture guard — full repo suite green (14067 tests) — FROZEN"
  - "Phase X.3.7 (Knowledge Resolution: Final Wiring) implemented:
     finalKnowledgeResolutionPipeline (FinalKnowledgeResolutionPipeline,
     buildFinalKnowledgeResolutionPipeline() — composes X.3.5's KnowledgeResolutionPipeline
     [already Intent Resolution -> Retrieval -> Ranking] piped into X.3.6's enrichKnowledge(),
     zero adapter code needed, resolutionCoordinator.ts/resolutionExecutor.ts deliberately not
     touched) — zero modification to X.3.1-X.3.6, end-to-end tests proving the full 4-stage
     deterministic chain plus a regression test proving X.3.5's own pipeline is unchanged,
     architecture guard — full repo suite green (14079 tests) — FROZEN — Phase X.3 (Knowledge
     Resolution) is now a complete, standalone, deterministic pipeline"
  - "PHASE_X3_FINAL_ARCHITECTURE_AUDIT.md produced: no redesign recommended, 8.1/10 average
     across 18 categories, six findings (F-1 unreused ResolutionExecutor/Coordinator
     abstraction, F-2 missingEvidence reconciliation gap, F-3 rule/threshold parser
     duplication, F-4 a stray switch statement inconsistent with the project's own Map-lookup
     convention, F-5 three-deep type aliasing, F-6 uncached per-item metadata parsing) logged
     for awareness, none blocking"
  - "PHASE_X4_IMPLEMENTATION_PLAN_FINAL.md produced: renamed the still-unbuilt 'reasoning-engine
     wiring' milestone to Phase X.3.8 (X.4 already means Output Validation, built and frozen);
     recommended one milestone, one new composition file, no split; identified the double-
     detectIntent() call as the one concrete integration risk"
  - "PHASE_X4_API_REVIEW.md produced: re-examined the double-detectIntent() finding first-
     principles rather than accepting it as permanent debt — grepped and confirmed reason() had
     exactly one caller anywhere in the repo (its own test file), making this the cheapest
     possible moment to fix the signature; recommended the small, compatible redesign this
     cleanup implements"
  - "Pre-X.3.8 API Cleanup implemented: reasoningTypes.ts's ILegalReasoningEngine.reason() and
     legalReasoningEngine.ts's implementation changed to accept intent: ReasoningIntent instead
     of question: ReasoningQuestion, removing the internal detectIntent() call entirely (reused
     the existing ReasoningIntent type, no new ResolvedIntent/DTO); legal-reasoning-engine.test.ts
     updated mechanically at 7 call sites, zero assertion changes; one incidental fix
     (question.outputFormat had no ReasoningIntent equivalent — reason() now always composes
     the default DECISION-format explanation) — full repo suite green at the identical
     450/14079 count as the X.3.7 baseline — FROZEN"
  - "Phase X.4.1 (Reasoning Engine Wiring: Batch A) implemented: reasoningOrchestrator.ts
     (ReasoningOrchestrator, buildReasoningOrchestrator() — coordinates X.3.7's
     FinalKnowledgeResolutionPipeline and Batch A's LegalReasoningEngine, zero business logic of
     its own) — dependency-injection tests, a real-platform end-to-end integration test (first
     full chain from raw question to ReasoningResult against a real IKnowledgePlatform, not
     fakes), architecture guard — full repo suite green (14096 tests) — FROZEN"
  - "Phase X.4.2 (Reasoning Engine Wiring: Reasoning Context Assembly) implemented:
     reasoningExecutionContextTypes.ts (ReasoningExecutionContext, renamed from the requested
     'ReasoningContext' to avoid shadowing the existing frozen type), reasoningContextAssembler.ts
     (assembleReasoningContext() — stable deduplication + deep freeze, zero reasoning/conflict/
     confidence/citation/answer-generation logic, stands alone, not yet wired into
     ReasoningOrchestrator/LegalReasoningEngine) — unit/immutability/determinism tests,
     real-platform end-to-end integration test, architecture guard — full repo suite green
     (14120 tests) — FROZEN"
  - "Phase X.4.3 (Reasoning Engine Wiring: Reasoning Rule Evaluation) implemented:
     ruleEvaluationTypes.ts (KnowledgeItemEvaluation, RuleEvaluationResult — reuses
     EffectivePeriodStatus/ApplicabilityStatus/LegalRuleResult/LegalThresholdResult),
     ruleEvaluationStage.ts (evaluateRules() — reuses ruleEngine.ts's evaluateRule()/
     evaluateThreshold(), effectivePeriodEvaluator.ts's evaluateEffectivePeriod(),
     knowledgeApplicabilityEvaluator.ts's evaluateApplicability(), and rankingStrategy.ts's
     legalHierarchyScore(), all already-exported from earlier frozen milestones — zero
     reimplemented business logic) — unit tests, real-platform end-to-end integration test,
     architecture guard — full repo suite green (14144 tests) — FROZEN"
  - "Phase X.4.4 (Reasoning Engine Wiring: Reasoning Conflict Resolution) implemented:
     conflictResolutionTypes.ts (RejectedCandidateEntry, ConflictResolutionResult — reuses
     DetectedConflict/ConflictingItem/ConflictResolution), conflictResolutionStage.ts
     (resolveConflicts() — a from-scratch, byte-for-byte-verified re-expression of
     legalReasoningEngine.ts's private, non-exported 4-tier cascade, since no public component
     exists to reuse for it; reuses X.4.3's applicability determination and X.3.4's
     legalHierarchyScore() directly for the two pieces that ARE public) — unit tests, parity
     tests proving identical outcomes to the real frozen cascade across all 4 tiers,
     real-platform end-to-end integration test, architecture guard — full repo suite green
     (14173 tests) — FROZEN"
  - "Phase X.4.5 (Reasoning Engine Wiring: Reasoning Confidence Scoring) implemented:
     confidenceEvaluationTypes.ts (EvidenceWeightSummary, ConfidenceEvaluationResult — reuses
     ConfidenceComponents), confidenceEvaluationStage.ts (evaluateConfidence() — reuses
     answerComposer.ts's own exported computeConfidence() directly, unlike X.4.4's conflict
     cascade this milestone genuinely had a public scorer to reuse; independently derives its
     required appliedDocuments/primaryItemConfidences input via role-assignment bookkeeping
     mirroring legalReasoningEngine.ts's own private algorithm) — unit tests, parity tests
     proving identical confidence scores to the real frozen engine across 5 scenarios,
     real-platform end-to-end integration test, architecture guard — full repo suite green
     (14201 tests) — FROZEN"
  - "Phase X.4.6 (Reasoning Engine Wiring: Reasoning Citation Generation) implemented:
     citationGenerationTypes.ts (CitationGenerationResult — reuses FormattedCitation),
     citationGenerationStage.ts (generateCitations() — reuses citationFormatter.ts's own
     exported formatCitations() directly, unlike X.4.4's conflict cascade this milestone
     genuinely had a public builder to reuse; independently derives its required
     AppliedArticle[] input from X.4.5's supportingEvidence/rejectedEvidence and X.4.4's
     conflicts; documented, intentional divergence for superseded items since this milestone's
     input list has no temporal-validity signal) — unit tests, parity tests proving identical
     citation sets to the real frozen engine across 4 scenarios, real-platform end-to-end
     integration test, architecture guard — full repo suite green (14229 tests) — FROZEN"
  - "Phase X.4.7 (Reasoning Engine Wiring: Reasoning Answer Composition) implemented:
     reasoningAnswerTypes.ts (ReasoningAnswerResult — reuses ConfidenceComponents/
     DetectedConflict/FormattedCitation), reasoningAnswerStage.ts (composeAnswer() — reuses
     answerComposer.ts's own exported composeDecision() directly; groups X.4.6's citations into
     primaryCitations/supportingCitations/disputedCitations sections; passes X.4.5's confidence
     and X.4.4's conflicts through unchanged; documented, intentional gap: decision is always
     null since RuleEvaluationResult is not one of this milestone's stated inputs) — unit
     tests, parity tests proving equivalence plus the documented decision-gap divergence,
     real-platform end-to-end integration test, architecture guard — full repo suite green
     (14257 tests) — FROZEN"
  - "Final X.4 Integration implemented: reasoningEnginePipeline.ts (ReasoningEnginePipeline,
     buildReasoningEnginePipeline() — the one public entry point for the complete Reasoning
     Engine, wiring X.3.7's FinalKnowledgeResolutionPipeline through X.4.2-X.4.7's stage
     functions in fixed order; deliberately builds FinalKnowledgeResolutionPipeline directly
     rather than routing through ReasoningOrchestrator/legalReasoningEngine.reason() to avoid
     wasted computation) — true end-to-end integration tests against a real IKnowledgePlatform,
     deterministic replay tests, architecture guard (dependency graph, step ordering,
     frozen-file verification) — full repo suite green (14272 tests) — full X.4-track diff
     scope re-verified (41 files added, 4635 insertions, zero existing lines modified since the
     pre-X.4 baseline) — FROZEN — Phase X.4 (Reasoning Engine Wiring) is now COMPLETE"
  - "Phase X.5 (Output Formatting) implemented: conversationResponseTypes.ts
     (ConversationResponse, ResponseSection, FormattingOptions — reuses ConfidenceLabel),
     outputFormatter.ts (formatConversationResponse() — a pure presentation function; reuses
     answerComposer.ts's buildExplanation()/determineHumanReview() directly, both never called
     by the native pipeline before now; found by direct inspection that 'the existing Output
     Formatter' — src/ai/validation/responseFormatter.ts — is unrelated, operating on the OLD
     LLM-text-validation path, not reusable for ReasoningAnswerResult) — unit tests, parity
     tests proving reuse fidelity, true end-to-end integration + replay tests through the
     complete ReasoningEnginePipeline against a real IKnowledgePlatform, architecture guard —
     full repo suite green (14303 tests) — FROZEN"
  - "Phase X.6 (Tool Calling) implemented: toolCallingTypes.ts (ToolInvocationDecision,
     ToolDecider, NormalizedToolResult, ToolAugmentedResponse — reuses ToolCall from the
     pre-existing, unrelated 'P6' src/providers/ToolRegistry.ts as-is), toolCallingStage.ts
     (runToolCallingStage(), neverInvokeTool — reuses src/providers/ToolExecutor.ts's
     ToolExecutor.execute() [constructor-injected] and src/providers/RetryPolicy.ts's
     RetryPolicy constructor + .sleep() timing directly; supplies its own tool-execution-
     specific retryable-error-code set since RetryPolicy's own isTransient()/isNonRetryable()
     classify a different, LLM-provider-specific vocabulary; found by direct inspection that
     src/providers/ToolCallingAgent.ts/AgentRuntime.ts are NOT reusable — both require an actual
     LLM call via ProviderManager.chat(), out of scope) — unit tests, parity tests proving
     genuine delegation to ToolExecutor.execute()/RetryPolicy.sleep() rather than
     reimplementation, real-platform end-to-end integration tests (real ToolRegistry/
     ToolExecutor with an actual registered tool, through the complete ReasoningEnginePipeline +
     formatConversationResponse()), architecture guard — full repo suite green (14333 tests) —
     FROZEN"
  - "Phase X.7 (MCP Integration) implemented: mcpTypes.ts (MCPToolDescriptor, MCPRequest,
     MCPResponse<T>, MCPClientError(Code), MCPClientResult<T>, MCPTransport — reuses
     ToolParameter for inputSchema as-is), httpMCPTransport.ts (HttpMCPTransport — the one
     concrete MCPTransport shipped, reuses src/providers/RestClient.ts's post() for the network
     call), mcpClient.ts (MCPClient — connection lifecycle, capability discovery, tool
     execution; reuses RetryPolicy's constructor + .sleep() directly with its own MCP-transport-
     specific retryable-code set), mcpToolAdapter.ts (registerMCPTools() — the single
     composition point: discovers remote tools and registers each as an ordinary ToolDefinition
     into the SAME, already-frozen src/providers/ToolRegistry.ts that local tools use, so
     ToolExecutor/ToolCallingStage need zero MCP-awareness and zero changes; found by direct
     inspection that PHASE_X_EXECUTION_PLAN.md's own pre-planned MCPToolRegistry/MCPGateway
     design, drafted before Phase X.6 existed, would have duplicated Tool Calling/ToolRegistry —
     not built; the src/mcp/ directory reservation was honored, the internal design was not) —
     unit tests, parity tests proving genuine delegation to RetryPolicy.sleep()/RestClient.post()
     rather than reimplementation, a true end-to-end integration test against a fake-but-
     protocol-faithful in-memory MCP server through a real ToolRegistry/ToolExecutor/
     ToolCallingStage/ReasoningEnginePipeline/OutputFormatter, architecture guard — full repo
     suite green (14366 tests) — FROZEN"
  - "Phase X.8 (Multi-Agent Orchestration) implemented: multiAgentTypes.ts (WorkerTask,
     WorkerOutcome, CoordinationRun, CoordinatorOptions/Result/Error — reuses RetryOptions),
     taskScheduler.ts (validateTasks(), buildWaves() — pure, deterministic duplicate-id/missing-
     dependency/cycle validation and Kahn's-BFS wave grouping), coordinatorAgent.ts
     (CoordinatorAgent.run() — parallel wave scheduling, dependency-result aggregation, per-task
     timeout, AbortSignal cancellation, fail-fast on first failure; reuses RetryPolicy's
     constructor + .sleep() directly; found by direct inspection that the pre-existing, unrelated
     src/providers/MultiAgentCoordinator.ts requires an LLM call via AgentRuntime.run(prompt) —
     literal independent reasoning per agent, exactly what this milestone's own rule forbids — so
     it is not reused; new, deterministic, LLM-free scheduling code was written instead, matching
     REJECTED_DESIGNS.md's own prior 'Rejected: Multi-LLM-Agent Conversations' decision),
     reasoningWorkerAdapter.ts (buildReasoningWorkerTask() — the single composition point:
     wraps the real, frozen chain ReasoningEnginePipeline.answer() ->
     formatConversationResponse() -> runToolCallingStage() into one WorkerTask, proving 'agents
     never perform reasoning independently') — unit tests (decomposition validation, parallel
     scheduling, dependency tracking, fail-fast, timeout, cancellation, retry orchestration with
     a RetryPolicy.sleep() parity assertion, deterministic replay), a true end-to-end integration
     test dispatching real reasoning-engine workers in parallel through the complete
     ReasoningEnginePipeline/OutputFormatter/Tool Calling stack, architecture guard — full repo
     suite green (14406 tests) — FROZEN"
  - "PRODUCTION_HARDENING_AUDIT.md produced (Phase X.9 audit, no code changes): architecture
     readiness 8.5/10, production readiness 3/10 — the X.3-X.8 stack was well-built but wired
     into nothing (zero real callers outside its own tests); found a real, working but never-
     started Fastify adapter (restAdapter.ts, 'Phase 14'), zero logging/metrics/tracing, a
     hardcoded /health stub with no socket behind it, and no deployment target — 20 prioritized
     findings, none fabricated."
  - "Phase X.9.1 (Production Hardening: HTTP Server & Bootstrap — Batch A) implemented:
     appConfig.ts (loadAppConfigFromEnv() — server-level config, separate from the frozen
     LLM-only env.ts), buildApplication.ts (the composition root — constructs, never modifies, a
     real memory-backed IKnowledgePlatform + LegalProvider, ReasoningEnginePipeline, ToolRegistry/
     ToolExecutor, CoordinatorAgent), healthCheck.ts (checkLiveness()/checkReadiness()/
     checkHealth() — readiness honest about having no external dependency to probe for the
     in-memory reasoning path, checking a real MCPClient's status only when one is configured),
     reasoningRoutes.ts + coordinatorRoutes.ts (POST /api/v1/reasoning/answer and /reasoning/batch
     — thin adapters over the real X.4-X.8 chain, mirroring restAdapter.ts's own established
     pattern), httpServer.ts (buildHttpServer() — pure Fastify builder, /live /ready /health, no
     .listen() inside it), main.ts (the one file calling .listen(), guarded by an
     import.meta.url entrypoint check), gracefulShutdown.ts (SIGTERM/SIGINT close the listener +
     disconnect an optional MCPClient, racing a hard timeout) — unit tests, a true end-to-end
     integration test suite against a real Application via Fastify inject(), a real smoke test
     (actual process, actual socket, actual curl requests) that caught and fixed a genuine
     entrypoint-detection bug before freeze, architecture guard — full repo suite green
     (14444 tests) — FROZEN — you are here"
```

Full narrative version of this sequence, with the reasoning behind each step:
[`../04_PROJECT_MEMORY/TIMELINE.md`](../04_PROJECT_MEMORY/TIMELINE.md).
