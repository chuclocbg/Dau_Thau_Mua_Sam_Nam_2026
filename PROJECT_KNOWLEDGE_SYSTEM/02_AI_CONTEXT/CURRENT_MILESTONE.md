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

current_milestone: "Phase X.9.3 - Production Hardening: Streaming/SSE/HTTP Cancellation - FROZEN"
documentation_track_status: "CLOSED"
milestone_declared: 2026-07-07
milestone_evidence:
  scope: "src/streaming/sseTypes.ts (SSEEvent/StreamWriter — a minimal, transport-agnostic
         abstraction); src/streaming/sseWriter.ts (SSEWriter — the one concrete StreamWriter:
         backpressure-safe SSE framing over a raw ServerResponse, awaits 'drain', idempotent
         graceful close()); src/streaming/streamRace.ts (raceSignalAndTimeout()/
         StreamAbortedError/StreamTimeoutError — the HTTP-layer cancellation/timeout boundary);
         src/cancellation/requestAbortSignal.ts (createAbortSignalForResponse() — client
         disconnect detection via Node's standard 'close before writableEnded' pattern, exposed
         as a native AbortSignal); src/http/reasoningStreamRoute.ts
         (registerReasoningStreamRoute() — POST /api/v1/reasoning/answer/stream, streaming the
         lifecycle of a single reasoning answer over SSE via the exact same real, frozen chain
         X.9.1's reasoningRoutes.ts already calls). DI-only additions to three files, per this
         milestone's explicit carve-out: appConfig.ts (+streamTimeoutMs), buildApplication.ts
         (+streamTimeoutMs on Application), httpServer.ts (+one call to
         registerReasoningStreamRoute())."
  scope_exclusion: "Zero reasoning, retrieval, ranking, conflict resolution, confidence
                    computation, citation generation, Tool Calling, MCP, or Multi-Agent logic
                    reimplemented anywhere — confirmed by architecture guard: sseTypes.ts/
                    sseWriter.ts/streamRace.ts/requestAbortSignal.ts import nothing beyond Node
                    builtins and their own types; reasoningStreamRoute.ts imports only
                    detectIntent()/formatConversationResponse()/runToolCallingStage() — never an
                    internal reasoning stage, MCP, or Multi-Agent module — and reuses
                    app.logger/app.metrics/app.tracer from Application rather than constructing
                    its own. SCOPE NOTE: only the single-question path is streamed. Streaming the
                    Multi-Agent batch path would require CoordinatorAgent to expose a per-task
                    progress callback, which its frozen X.8 implementation does not (run()
                    resolves only once every wave finishes) — adding one would mean modifying
                    the frozen src/multiagent/**, explicitly forbidden this milestone. Not built,
                    not fabricated. HONEST SCOPE NOTE on 'AbortSignal propagation': the frozen
                    reasoning/Tool Calling/MCP layers (ReasoningEnginePipeline.answer(),
                    ToolExecutor.execute(), MCPClient.callTool()) accept no AbortSignal parameter
                    of their own — adding one would mean modifying those frozen files. What this
                    milestone actually does, transparently: stop the HTTP handler itself from
                    waiting/writing further once the client disconnects or a timeout elapses
                    (raceSignalAndTimeout()), not true mid-flight cancellation of frozen
                    internals that have no such parameter. For this repository's in-memory,
                    deterministic reasoning path this is a correct, low-overhead bound rather
                    than a fabricated safety net; it would matter more once a real, slow,
                    network-backed MCP server is configured. TOOLING FINDING (verified by a
                    minimal reproduction against a bare Fastify instance, no Phase X code
                    involved): Fastify's inject() does not support reply.hijack() +
                    raw-response streaming — res.end(callback)'s callback never fires under the
                    simulated response, hanging forever. Every SSE-related test therefore binds
                    a real listening socket (port: 0) and uses real fetch() instead of inject() —
                    a genuine, verified tooling limitation, not a workaround for a defect in this
                    milestone's own code."
  files_added: "5 implementation files + 6 test files (35 new tests + 2 X.9.1/X.9.2 test files
               updated for the additive streamTimeoutMs field: SSE writer [event framing,
               backpressure via a fake ServerResponse, closed detection, idempotent graceful
               termination], client-disconnect detection [aborts before writableEnded, not
               after, idempotent], cancellation race [success/timeout/abort paths, abort-before-
               timeout precedence, listener cleanup], a true end-to-end integration test suite
               against a REAL LISTENING SOCKET with real fetch() [happy-path stage/result event
               sequence over the complete reasoning + Tool Calling chain, validation rejection,
               replay determinism, real metrics accumulation, and a real client-disconnect
               cancellation test using a deliberately delayed real answer to make the race
               deterministic], and an architecture guard); a real smoke test (actual process,
               actual socket, curl -N reading the live SSE stream) additionally verified genuine
               streaming, structured logging, and clean shutdown outside the test harness."
  full_suite_result: "510 test files, 14528 tests, 0 failures (pool=forks, full repo, no filter);
                      up from 505 files / 14492 tests at the X.9.2 freeze baseline"
  exit_criteria_met: "Unit tests prove SSE framing (event/data/id lines, blank-line terminator,
                      correct JSON-escaping of embedded newlines), backpressure (write() 
                      returning false is awaited via 'drain' before resolving), closed detection
                      and idempotent close(), client-disconnect detection (fires only when
                      'close' precedes writableEnded, never on normal completion, idempotent
                      across repeated events), and the cancellation race (resolves on success,
                      rejects with StreamTimeoutError on timeout, rejects with
                      StreamAbortedError immediately if already aborted or when aborted
                      mid-flight, abort takes precedence over a not-yet-elapsed timeout, no
                      dangling abort listener after a clean resolution). A true end-to-end
                      integration test — a real Application wired into a real Fastify instance
                      bound to a real listening socket, exercised with real fetch() — proves the
                      complete reasoning+formatting+Tool-Calling chain streams the correct stage
                      sequence (reasoning started, reasoning completed, formatting completed,
                      tool_calling completed) followed by a result event carrying a genuine
                      ToolAugmentedResponse; that a missing question is rejected with 400 before
                      any SSE framing begins; that two identical requests replay the same stage
                      sequence and result markdown; that real request/response counters
                      accumulate on the Application's own MetricsCollector
                      (sse_streams_total/sse_streams_completed_total); and that a real client
                      disconnect (AbortController aborting a real fetch() mid-flight against a
                      deliberately delayed real answer) is detected and recorded as
                      sse_streams_aborted_total without incrementing
                      sse_streams_completed_total. A real smoke test (actual process, actual
                      TCP socket, curl -N) additionally verified genuine incremental SSE
                      delivery and structured stream-lifecycle logging outside the test harness.
                      Architecture guard confirms the pure streaming/cancellation files import
                      nothing beyond Node builtins; that reasoningStreamRoute.ts imports only
                      top-level frozen entry points and reuses Application's own logger/
                      metrics/tracer; zero reimplemented RetryPolicy/ToolExecutor/ToolRegistry/
                      MCPClient/CoordinatorAgent/reasoning-stage logic anywhere; that the three
                      DI-touched frozen files still contain every prior construction/route/
                      validation line plus only the new X.9.3 additions; and that every prior
                      milestone's frozen-file marker (X.1 through X.9.2, plus restAdapter.ts and
                      the pre-existing provider files) is unchanged."
  frozen_interfaces_touched: "Three files touched, DI-only, per this milestone's explicit
                              carve-out: src/config/appConfig.ts (+streamTimeoutMs field/
                              validation, additive), src/bootstrap/buildApplication.ts
                              (+streamTimeoutMs on Application, a plain config value, additive),
                              src/server/httpServer.ts (+one registerReasoningStreamRoute()
                              call, additive). Verified by architecture guard that every one of
                              their pre-existing X.9.1/X.9.2 lines is still present, unchanged.
                              src/reasoning/**, src/knowledge/**, src/conversation/**,
                              src/providers/**, src/mcp/**, src/multiagent/**, src/health/**,
                              src/api/**, src/startup/**, src/server/main.ts, src/logging/**,
                              src/metrics/**, src/tracing/**, and src/middleware/** were not
                              modified at all — verified by git diff and architecture guard."
  owner_file_for_numbers: CURRENT_RELEASE.md   # release tag, test counts — see there, not here

next_active_milestone: "Phase X.9.4 (Batch D — Dockerfile/docker-compose/production config/
                        secrets loading/environment validation) or any other later milestone —
                        none authorized to begin without separate explicit approval"
next_milestone_status: "NOT AUTHORIZED. Phase X.9.3's exit criteria confirmed met and frozen this
                         session, per explicit instruction to stop and wait after every frozen
                         milestone. Batch C (Streaming/SSE/HTTP Cancellation) is complete: a
                         single-question reasoning answer can be streamed over SSE with genuine
                         backpressure handling, client-disconnect detection, and a timeout bound,
                         reusing the exact same real reasoning/formatting/Tool-Calling chain and
                         the X.9.2 logging/metrics/tracing already in place. Remaining
                         PRODUCTION_HARDENING_AUDIT.md findings not yet addressed: no Dockerfile/
                         production config for the app itself (Batch D), no deployment scripts/
                         operational runbook (Batch E). Also still open: no auth/permission layer
                         on the API routes, no rate limiting on the API routes, ToolRegistry is
                         empty by default (a deployment decision, not fabricated), no alerting,
                         Multi-Agent batch streaming was intentionally not built (CoordinatorAgent
                         has no progress-callback API — would require modifying the frozen
                         src/multiagent/**), true mid-flight cancellation of the frozen reasoning/
                         Tool Calling/MCP internals remains an HTTP-layer-only bound (those layers
                         accept no AbortSignal of their own), the missingEvidence-reconciliation
                         question, the superseded-item/decision gaps, and the still-open
                         ResolvedKnowledge extension decision all remain unresolved, carried
                         forward unchanged from earlier freezes."
next_milestone_blocker: "None technical. Requires its own explicit human authorization to
                         begin, separate from this freeze's own approval."

immediate_next_action: "None assigned as of this writing. Waiting for explicit human approval
                        to begin Phase X.9.4."

do_not:
  - "Do not begin Phase X.9.4 (or any later batch/milestone) without explicit approval."
  - "Do not modify any file under src/conversation/ (X.1, frozen), src/reasoning/{domain,
     application,infrastructure,testing}/ (X.2 Batch A + X.3.1 + X.3.2 + X.3.3 + X.3.4 + X.3.5 +
     X.3.6 + X.3.7 + Pre-X.3.8 API Cleanup + X.4.1 + X.4.2 + X.4.3 + X.4.4 + X.4.5 + X.4.6 +
     X.4.7 + Final X.4 Integration + X.5 + X.6, frozen), src/mcp/{domain,infrastructure,
     application}/ (X.7, frozen), src/multiagent/{domain,application}/ (X.8, frozen),
     src/health/, src/api/, src/startup/, src/server/main.ts (X.9.1, frozen),
     src/logging/, src/metrics/, src/tracing/, src/middleware/ (X.9.2, frozen),
     src/streaming/, src/http/, src/cancellation/ (X.9.3, frozen),
     src/ai/{domain,application,infrastructure}/ (X.2 Batch B, frozen), or src/ai/validation/
     (X.4, frozen) outside of a newly-approved milestone. src/config/appConfig.ts,
     src/bootstrap/buildApplication.ts, and src/server/httpServer.ts may be touched again ONLY
     for additive dependency-injection/wiring, exactly as X.9.2/X.9.3 themselves did — never a
     redesign of their existing logic."
  - "Do not modify src/reasoning/reasoningEngine.ts or src/reasoning/decisionModel.ts (Phase 15
     track), or any of the pre-existing src/providers/*.ts files (the unrelated 'P6' track,
     e.g. ToolCallingAgent.ts, AgentRuntime.ts, MultiAgentCoordinator.ts, ProviderManager.ts), or
     src/interface/restAdapter.ts (Phase 14, unrelated, pre-existing Fastify pattern) — none of
     these belong to Phase X. ToolRegistry.ts/ToolExecutor.ts/RetryPolicy.ts/RestClient.ts/
     MetricsCollector.ts are reused by X.6/X.7/X.8/X.9.1/X.9.2/X.9.3 but must remain unmodified."
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
     (14444 tests) — FROZEN"
  - "Phase X.9.2 (Production Hardening: Logging/Metrics/Tracing/Error Middleware — Batch B)
     implemented: structuredLogger.ts (createStructuredLogger() — level-filtered JSON/pretty
     stdout lines, .child() context; NOT built on the frozen, unused src/providers/Logger.ts,
     which has no output sink at all), requestContext.ts (generateRequestId()/
     resolveCorrelationId()), tracingTypes.ts + tracer.ts (an OpenTelemetry-shaped, vendor-free
     Tracer/Span abstraction; SimpleTracer; W3C traceparent parse/format — zero @opentelemetry
     dependency), requestMetrics.ts (recordRequestStart()/recordRequestCompletion() — genuinely
     reuses the existing, unmodified MetricsCollector), errorMapper.ts
     (mapErrorToHttpResponse() — HTTP exception mapping, production 5xx message redaction),
     requestLifecycleHooks.ts (registerRequestLifecycleHooks() — the one Fastify wiring point
     for timing/correlation/trace/logging/metrics/error-handling) — plus additive,
     DI-only wiring into three X.9.1 files (appConfig.ts +logFormat, buildApplication.ts
     +logger/metrics/tracer/nodeEnv, httpServer.ts +one hook-registration call), verified by
     architecture guard to have left every X.9.1 core line untouched — unit tests, a true
     end-to-end observability integration test suite via Fastify inject(), a real smoke test
     (actual process, actual socket, curl with a real x-correlation-id header) confirming
     structured logs/correlation echo/traceparent generation all work outside the test harness,
     architecture guard — full repo suite green (14492 tests) — FROZEN"
  - "Phase X.9.3 (Production Hardening: Streaming/SSE/HTTP Cancellation — Batch C) implemented:
     sseTypes.ts + sseWriter.ts (SSEEvent/StreamWriter abstraction; SSEWriter — backpressure-
     safe SSE framing over a raw ServerResponse, awaits 'drain', idempotent graceful close()),
     streamRace.ts (raceSignalAndTimeout()/StreamAbortedError/StreamTimeoutError — the
     HTTP-layer cancellation boundary, since the frozen reasoning/Tool Calling/MCP layers accept
     no AbortSignal of their own), requestAbortSignal.ts (createAbortSignalForResponse() —
     client-disconnect detection via Node's 'close before writableEnded' pattern),
     reasoningStreamRoute.ts (registerReasoningStreamRoute() — POST /api/v1/reasoning/answer/
     stream, streaming a single reasoning answer's lifecycle over SSE via the exact same real,
     frozen chain X.9.1's reasoningRoutes.ts already calls; reuses Application's own
     logger/metrics/tracer from X.9.2) — plus additive, DI-only wiring into three files
     (appConfig.ts +streamTimeoutMs, buildApplication.ts +streamTimeoutMs on Application,
     httpServer.ts +one route-registration call), verified by architecture guard to have left
     every prior core line untouched. TOOLING FINDING (verified by direct reproduction, no
     Phase X code involved): Fastify's inject() does not support reply.hijack() + raw-response
     streaming — every SSE test therefore binds a real listening socket and uses real fetch()
     instead. SCOPE NOTE: only the single-question path is streamed — Multi-Agent batch
     streaming was not built since CoordinatorAgent has no per-task progress callback and adding
     one would mean modifying the frozen src/multiagent/**. Unit tests, a true end-to-end
     integration test suite against a real listening socket (happy-path event sequence,
     validation, replay, metrics, and a real client-disconnect cancellation test), a real smoke
     test (actual process, actual socket, curl -N reading the live stream), architecture guard —
     full repo suite green (14528 tests) — FROZEN — you are here"
```

Full narrative version of this sequence, with the reasoning behind each step:
[`../04_PROJECT_MEMORY/TIMELINE.md`](../04_PROJECT_MEMORY/TIMELINE.md).
