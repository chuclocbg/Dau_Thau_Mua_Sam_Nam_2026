# Milestone History

**Purpose:** Every past milestone, archived here **before** [`../02_AI_CONTEXT/CURRENT_MILESTONE.md`](../02_AI_CONTEXT/CURRENT_MILESTONE.md)
is overwritten for the next one. See that file's archival rule.

**Related:** [Timeline](TIMELINE.md) · [Release Timeline](RELEASE_TIMELINE.md)

## Milestone Log (most recent first)

### Phase X.9.3 — Production Hardening: Streaming/SSE/HTTP Cancellation — declared 2026-07-07 (CURRENT — see `../02_AI_CONTEXT/CURRENT_MILESTONE.md`)

Not yet archived — this is the live milestone. When superseded, its full summary moves here,
above this note, before `CURRENT_MILESTONE.md` is overwritten.

---

### Phase X.9.2 — Production Hardening: Logging/Metrics/Tracing/Error Middleware — declared 2026-07-07 (superseded by X.9.3)

**Evidence:** 505 test files, 14,492 tests, 0 failures at freeze time; architecture guard
confirmed no new logging/metrics/tracing/middleware file imports `src/reasoning/`/`src/knowledge/`/
`src/mcp/`/`src/multiagent/` at all, and that every prior milestone's frozen-file marker was
unchanged.

**Summary:** Implemented `structuredLogger.ts` (level-filtered JSON/pretty stdout lines,
`.child()` context — NOT built on the frozen, unused `src/providers/Logger.ts`, which has no
output sink at all), `requestContext.ts` (request/correlation ID resolution), `tracingTypes.ts` +
`tracer.ts` (an OpenTelemetry-shaped, vendor-free `Tracer`/`Span` abstraction plus W3C
`traceparent` propagation — zero `@opentelemetry` dependency), `requestMetrics.ts` (genuinely
reuses the existing `MetricsCollector`), `errorMapper.ts` (HTTP exception mapping, production
5xx redaction), and `requestLifecycleHooks.ts` (the one Fastify wiring point for
timing/correlation/trace/logging/metrics/error-handling). DI-only additions to
`appConfig.ts`/`buildApplication.ts`/`httpServer.ts`, verified to leave every X.9.1 core line
untouched. A real smoke test (actual process, actual socket, curl with a real
`x-correlation-id` header) confirmed structured logs/correlation echo/traceparent generation
all work outside the test harness.

---

### Phase X.9.1 — Production Hardening: HTTP Server & Bootstrap — declared 2026-07-07 (superseded by X.9.2)

**Evidence:** 498 test files, 14,444 tests, 0 failures at freeze time; architecture guard
confirmed config/health/server/startup never import `src/reasoning/`/`src/knowledge/`/`src/mcp/`/
`src/multiagent/` directly, that `buildApplication.ts` is the only composition point, and that
every prior milestone's frozen-file marker was unchanged.

**Summary:** Implemented `appConfig.ts` (`loadAppConfigFromEnv()`), `buildApplication.ts` (the
composition root — constructs a real memory-backed `IKnowledgePlatform` + `LegalProvider`,
`ReasoningEnginePipeline`, `ToolRegistry`/`ToolExecutor`, `CoordinatorAgent`), `healthCheck.ts`
(`checkLiveness()`/`checkReadiness()`/`checkHealth()`), `reasoningRoutes.ts` + `coordinatorRoutes.ts`
(`POST /api/v1/reasoning/answer` and `/reasoning/batch` — thin adapters over the real X.4-X.8
chain, mirroring the pre-existing `src/interface/restAdapter.ts` Fastify pattern),
`httpServer.ts` (`buildHttpServer()` — `/live`/`/ready`/`/health` + API routes, no `.listen()`
inside it), `main.ts` (the one file calling `.listen()`), `gracefulShutdown.ts` (SIGTERM/SIGINT).
A real smoke test (`npm run server`, curl over an actual socket) caught and fixed a genuine bug:
the initial entrypoint guard silently failed under `tsx` on this platform, so the server never
started; replaced with `pathToFileURL(process.argv[1]).href` and re-verified live.

---

### Phase X.8 — Multi-Agent Orchestration — declared 2026-07-07 (superseded by X.9.1)

**Evidence:** 493 test files, 14,406 tests, 0 failures at freeze time; architecture guard
confirmed `multiAgentTypes.ts`/`taskScheduler.ts`/`coordinatorAgent.ts` never import
`src/reasoning/`/`src/knowledge/`/`src/mcp/`/`src/ai/`/`src/conversation/` at all, and that every
prior milestone's frozen-file marker was unchanged.

**Summary:** Implemented `multiAgentTypes.ts` (`WorkerTask`, `WorkerOutcome`, `CoordinationRun` —
reused `RetryOptions`), `taskScheduler.ts` (`validateTasks()`, `buildWaves()` — deterministic
Kahn's-BFS wave grouping), `coordinatorAgent.ts` (`CoordinatorAgent.run()` — parallel scheduling,
dependency tracking, fail-fast, timeout, `AbortSignal` cancellation; reused `RetryPolicy`
directly), and `reasoningWorkerAdapter.ts` (`buildReasoningWorkerTask()` — the single composition
point wrapping the real, frozen `ReasoningEnginePipeline.answer()` -> `formatConversationResponse()`
-> `runToolCallingStage()` chain into one `WorkerTask`). Found by direct inspection that the
pre-existing `src/providers/MultiAgentCoordinator.ts` requires an LLM call via
`AgentRuntime.run(prompt)` — literal independent reasoning per agent, exactly what this
milestone's own rule forbids — so new, deterministic, LLM-free scheduling code was written
instead, consistent with `REJECTED_DESIGNS.md`'s own prior "Rejected: Multi-LLM-Agent
Conversations" decision. A true end-to-end integration test dispatched real reasoning-engine
workers in parallel through the complete `ReasoningEnginePipeline`/`OutputFormatter`/Tool Calling
stack.

---

### Phase X.7 — MCP Integration — declared 2026-07-07 (superseded by X.8)

**Evidence:** 489 test files, 14,366 tests, 0 failures at freeze time; architecture guard
confirmed zero `src/knowledge/`/`src/ai/`/`src/conversation/` import, that
`mcpTypes.ts`/`mcpClient.ts`/`httpMCPTransport.ts` never import `src/reasoning/` at all, and
that every prior milestone's frozen-file marker was unchanged.

**Summary:** Implemented `mcpTypes.ts` (`MCPToolDescriptor`, `MCPRequest`, `MCPResponse<T>`,
`MCPClientError(Code)`, `MCPClientResult<T>`, `MCPTransport` — reused `ToolParameter` for
`inputSchema` as-is), `httpMCPTransport.ts` (`HttpMCPTransport` — reused `RestClient.post()` for
the network call), `mcpClient.ts` (`MCPClient` — connection lifecycle, capability discovery,
tool execution; reused `RetryPolicy`'s constructor + `.sleep()` with its own MCP-transport-
specific retryable-code set), and `mcpToolAdapter.ts` (`registerMCPTools()` — the single
composition point: discovers remote tools and registers each as an ordinary `ToolDefinition`
into the SAME, already-frozen `ToolRegistry` that local tools use, so `ToolExecutor`/
`ToolCallingStage` needed zero MCP-awareness and zero changes). Found by direct inspection that
`PHASE_X_EXECUTION_PLAN.md`'s own pre-planned `MCPToolRegistry`/`MCPGateway` design, drafted
before Phase X.6 existed, would have duplicated Tool Calling/`ToolRegistry` — not built; the
`src/mcp/` directory reservation was honored, the internal design was not. A true end-to-end
integration test proved discovery + invocation through a fake-but-protocol-faithful in-memory MCP
server, a real `ToolRegistry`/`ToolExecutor`, the complete `ReasoningEnginePipeline`, and the real
Output Formatter.

---

### Phase X.6 — Tool Calling — declared 2026-07-07 (superseded by X.7)

**Evidence:** 485 test files, 14,333 tests, 0 failures at freeze time; architecture guard
confirmed zero `src/knowledge/`/`src/mcp/`/`src/conversation/`/`src/ai/` import, that the only
`src/providers/` imports were `ToolExecutor.ts`/`ToolRegistry.ts`/`RetryPolicy.ts`, and that
every prior milestone's frozen-file marker was unchanged.

**Summary:** Implemented `toolCallingTypes.ts` (`ToolInvocationDecision`, `ToolDecider`,
`NormalizedToolResult`, `ToolAugmentedResponse` — reused `ToolCall` from the pre-existing
`src/providers/ToolRegistry.ts` as-is) and `toolCallingStage.ts` (`runToolCallingStage()`,
`neverInvokeTool` — reused `src/providers/ToolExecutor.ts`'s `ToolExecutor.execute()`
[constructor-injected] and `src/providers/RetryPolicy.ts`'s constructor + `.sleep()` timing
directly, with a new tool-execution-specific retryable-error-code set since `RetryPolicy`'s own
`isTransient()`/`isNonRetryable()` classify a different, LLM-provider vocabulary). Found by
direct inspection that `src/providers/ToolCallingAgent.ts`/`AgentRuntime.ts` are NOT reusable —
both require an actual LLM call via `ProviderManager.chat()`, out of scope. Parity tests proved
genuine delegation to `ToolExecutor.execute()`/`RetryPolicy.sleep()` rather than
reimplementation. A true end-to-end integration test proved a real `ToolRegistry`/`ToolExecutor`
with an actual registered tool, invoked through the complete chain — real intent detector, real
`IKnowledgePlatform`, complete `ReasoningEnginePipeline`, real Output Formatter.

---

### Phase X.5 — Output Formatting — declared 2026-07-07 (superseded by X.6)

**Evidence:** 481 test files, 14,303 tests, 0 failures at freeze time; architecture guard
confirmed zero `src/knowledge/`/`src/mcp/`/`src/conversation/`/`src/ai/` import (critically
including `src/ai/validation/`, the existing but unrelated formatter) and that every prior
milestone's frozen-file marker was unchanged.

**Summary:** Implemented `conversationResponseTypes.ts` (`ConversationResponse`,
`ResponseSection`, `FormattingOptions` — reused `ConfidenceLabel`) and `outputFormatter.ts`
(`formatConversationResponse()` — a pure presentation function consuming X.4.7's
`ReasoningAnswerResult`; reused `answerComposer.ts`'s `buildExplanation()`/
`determineHumanReview()` directly, both never called by the native pipeline before now). Found
by direct inspection that "the existing Output Formatter"
(`src/ai/validation/responseFormatter.ts`'s `formatFinalAnswer()`) is unrelated — it operates on
the OLD `LLMOutput`/`AIValidationResult`/`AIContext` LLM-text-validation path, not reusable for
`ReasoningAnswerResult`. Parity tests proved the decision section body is byte-for-byte
`buildExplanation().summary` and warnings are exactly `determineHumanReview()`'s reason string
split for display. A true end-to-end integration test proved the complete chain — real intent
detector, real memory-backed `IKnowledgePlatform` + `LegalProvider`, complete
`ReasoningEnginePipeline`, `formatConversationResponse()` — for an uncontested question, a real
hierarchy conflict, and an empty platform; deterministic replay confirmed.

---

### Phase X.4 — Reasoning Engine Wiring: COMPLETE (Final Integration) — declared 2026-07-06 (superseded by X.5)

**Evidence:** 477 test files, 14,272 tests, 0 failures at freeze time; full X.4-track diff-scope
check from the pre-X.4 baseline (commit `4bcbf47`): 41 files added, 4,635 insertions, zero
existing lines modified.

**Summary:** Phase X.4 (X.4.1 through X.4.7 plus the Final Integration) built a complete,
native, deterministic Reasoning Engine — `ReasoningEnginePipeline` (the one public entry point)
wires X.3.7's `FinalKnowledgeResolutionPipeline` through X.4.2's `assembleReasoningContext()`,
X.4.3's `evaluateRules()`, X.4.4's `resolveConflicts()`, X.4.5's `evaluateConfidence()`, X.4.6's
`generateCitations()`, and X.4.7's `composeAnswer()` — proven end-to-end against a real
Knowledge Platform, with deterministic replay verified. `ReasoningOrchestrator` (X.4.1,
Batch-A-backed) and `ReasoningEnginePipeline` (native, X.4.2-X.4.7-backed) coexist as two
separate, valid entry points. Three carried-forward open questions remain: the
missingEvidence-reconciliation question, the superseded-item/decision gaps (both requiring
`RuleEvaluationResult` as a stated input to close), and the still-open `ResolvedKnowledge`
extension decision for checklists/cases/bestpractice/risk.

---

### Phase X.4.7 — Reasoning Engine Wiring: Reasoning Answer Composition — declared 2026-07-06 (superseded by the Final X.4 Integration)

**Evidence:** 475 test files, 14,257 tests, 0 failures at freeze time; architecture guard
confirmed zero `src/knowledge/`/`src/ai/`/`src/mcp/`/`src/conversation/` import and that every
prior milestone's frozen-file marker was unchanged.

**Summary:** Implemented `reasoningAnswerTypes.ts` (`ReasoningAnswerResult` — reused
`ConfidenceComponents`/`DetectedConflict`/`FormattedCitation`) and `reasoningAnswerStage.ts`
(`composeAnswer()` — reused `answerComposer.ts`'s own exported `composeDecision()` directly;
grouped X.4.6's citations into `primaryCitations`/`supportingCitations`/`disputedCitations`
sections; passed X.4.5's confidence and X.4.4's conflicts through unchanged). Documented,
intentional gap: `decision` always `null` since `RuleEvaluationResult` was not one of this
milestone's stated inputs — confirmed by a dedicated parity test proving the real engine
produces a real decision once genuine rule results exist.

---

### Phase X.4.6 — Reasoning Engine Wiring: Reasoning Citation Generation — declared 2026-07-06 (superseded by X.4.7)

**Evidence:** 471 test files, 14,229 tests, 0 failures at freeze time; architecture guard
confirmed zero `src/knowledge/`/`src/ai/`/`src/mcp/`/`src/conversation/` import and that every
prior milestone's frozen-file marker was unchanged.

**Summary:** Implemented `citationGenerationTypes.ts` (`CitationGenerationResult` — reused
`FormattedCitation`) and `citationGenerationStage.ts` (`generateCitations()` — reused
`citationFormatter.ts`'s own exported `formatCitations()` directly; independently derived its
required `AppliedArticle[]` input from X.4.5's `supportingEvidence`/`rejectedEvidence` and
X.4.4's `conflicts`). Documented, intentional divergence for superseded items since that
milestone's input list had no temporal-validity signal. Parity tests proved identical citation
sets to the real frozen engine across 4 scenarios.

---

### Phase X.4.5 — Reasoning Engine Wiring: Reasoning Confidence Scoring — declared 2026-07-06 (superseded by X.4.6)

**Evidence:** 467 test files, 14,201 tests, 0 failures at freeze time; architecture guard
confirmed zero `src/knowledge/`/`src/ai/`/`src/mcp/`/`src/conversation/` import and that every
prior milestone's frozen-file marker was unchanged.

**Summary:** Implemented `confidenceEvaluationTypes.ts` (`EvidenceWeightSummary`,
`ConfidenceEvaluationResult` — reused `ConfidenceComponents`) and `confidenceEvaluationStage.ts`
(`evaluateConfidence()` — reused `answerComposer.ts`'s exported `computeConfidence()` directly;
independently derived its required `appliedDocuments`/`primaryItemConfidences` input via
role-assignment bookkeeping mirroring `legalReasoningEngine.ts`'s own private algorithm). Parity
tests proved identical confidence scores to the real frozen engine across 5 scenarios, all
passing on first run.

---

### Phase X.4.4 — Reasoning Engine Wiring: Reasoning Conflict Resolution — declared 2026-07-06 (superseded by X.4.5)

**Evidence:** 463 test files, 14,173 tests, 0 failures at freeze time; architecture guard
confirmed zero `src/knowledge/`/`src/ai/`/`src/mcp/`/`src/conversation/` import and that every
prior milestone's frozen-file marker was unchanged.

**Summary:** Implemented `conflictResolutionTypes.ts` (`RejectedCandidateEntry`,
`ConflictResolutionResult` — reused `DetectedConflict`/`ConflictingItem`/`ConflictResolution`)
and `conflictResolutionStage.ts` (`resolveConflicts()` — a from-scratch, byte-for-byte-verified
re-expression of `legalReasoningEngine.ts`'s private, non-exported 4-tier cascade, since no
public component existed to reuse for it; reused X.4.3's applicability determination and X.3.4's
`legalHierarchyScore()` directly for the two pieces that were public). Parity tests proved
identical outcomes to the real frozen cascade across all four tiers.

---

### Phase X.4.3 — Reasoning Engine Wiring: Reasoning Rule Evaluation — declared 2026-07-06 (superseded by X.4.4)

**Evidence:** 459 test files, 14,144 tests, 0 failures at freeze time; architecture guard
confirmed zero `src/knowledge/`/`src/ai/`/`src/mcp/`/`src/conversation/` import and that every
prior milestone's frozen-file marker was unchanged.

**Summary:** Implemented `ruleEvaluationTypes.ts` (`KnowledgeItemEvaluation`,
`RuleEvaluationResult` — reused `EffectivePeriodStatus`/`ApplicabilityStatus`/`LegalRuleResult`/
`LegalThresholdResult`) and `ruleEvaluationStage.ts` (`evaluateRules()` — reused `ruleEngine.ts`'s
`evaluateRule()`/`evaluateThreshold()`, `effectivePeriodEvaluator.ts`'s
`evaluateEffectivePeriod()`, `knowledgeApplicabilityEvaluator.ts`'s `evaluateApplicability()`,
and `rankingStrategy.ts`'s `legalHierarchyScore()`, all already-exported from earlier frozen
milestones — zero reimplemented business logic). Stands alone, not yet wired into
`ReasoningOrchestrator`/`LegalReasoningEngine`.

---

### Phase X.4.2 — Reasoning Engine Wiring: Reasoning Context Assembly — declared 2026-07-06 (superseded by X.4.3)

**Evidence:** 456 test files, 14,120 tests, 0 failures at freeze time; architecture guard
confirmed zero `src/knowledge/`/`src/ai/`/`src/mcp/`/`src/conversation/` import and that every
prior milestone's frozen-file marker was unchanged.

**Summary:** Implemented `reasoningExecutionContextTypes.ts` (`ReasoningExecutionContext` —
renamed from the requested "ReasoningContext" to avoid shadowing the existing frozen type) and
`reasoningContextAssembler.ts` (`assembleReasoningContext()` — stable deduplication + deep
freeze, zero reasoning/conflict/confidence/citation/answer-generation logic). Stands alone, not
yet wired into `ReasoningOrchestrator`/`LegalReasoningEngine`. A real-platform end-to-end
integration test proved genuine freeze against real platform data.

---

### Phase X.4.1 — Reasoning Engine Wiring: Batch A (Reasoning Orchestrator) — declared 2026-07-06 (superseded by X.4.2)

**Evidence:** 453 test files, 14,096 tests, 0 failures at freeze time; architecture guard
confirmed zero `src/knowledge/`/`src/ai/`/`src/mcp/`/`src/conversation/` import and that every
prior milestone's frozen-file marker was unchanged.

**Summary:** Implemented `reasoningOrchestrator.ts` (`ReasoningOrchestrator`,
`buildReasoningOrchestrator()`) — coordinates X.3.7's `FinalKnowledgeResolutionPipeline` and
Batch A's `LegalReasoningEngine` (post pre-X.4-cleanup) into `ReasoningIntent` → Knowledge
Resolution → `ReasoningResult`. Zero business logic of its own. A real-platform end-to-end
integration test proved the first full chain from a raw question to `ReasoningResult` against a
real `IKnowledgePlatform`, not fakes at any layer.

---

### Pre-X.3.8 API Cleanup — LegalReasoningEngine.reason() accepts ReasoningIntent — declared 2026-07-06 (superseded by Phase X.4.1)

**Evidence:** 450 test files, 14,079 tests, 0 failures at freeze time — identical count to the
X.3.7 baseline, since this was a pure signature/wiring refactor with no new tests.

**Summary:** `ILegalReasoningEngine.reason()`'s first parameter changed from `ReasoningQuestion`
to the existing `ReasoningIntent` type (reused, no new `ResolvedIntent`/DTO), removing the
internal `detectIntent(question)` call from `LegalReasoningEngine`. Grepped first: `reason()` had
exactly one caller anywhere in the repo (its own test file, 7 mechanically-updated call sites,
zero assertion changes) — confirmed the cheapest possible moment to make this change. One
incidental fix: `question.outputFormat` had no `ReasoningIntent` equivalent, so `reason()` now
always composes the default DECISION-format explanation (`explain(result, format)` remains the
supported way to get a different format).

---

### Phase X.3.7 — Knowledge Resolution: Final Wiring — declared 2026-07-06 (superseded by the Pre-X.3.8 API Cleanup)

**Evidence:** 450 test files, 14,079 tests, 0 failures at freeze time; architecture guard
confirmed zero `src/knowledge/` import, that the final pipeline's only cross-milestone
dependencies are `knowledgeResolutionPipeline.ts`/`knowledgeEnrichmentPipeline.ts`, and that
every prior milestone's frozen-file markers (X.3.1 through X.3.6) were unchanged.

**Summary:** Implemented `finalKnowledgeResolutionPipeline.ts`
(`FinalKnowledgeResolutionPipeline`, `buildFinalKnowledgeResolutionPipeline()`) — composed X.3.5's
`KnowledgeResolutionPipeline` (already Intent Resolution → Retrieval → Ranking) piped into X.3.6's
`enrichKnowledge()`, with zero adapter code. Declared Phase X.3 (Knowledge Resolution) complete as
a standalone, deterministic pipeline. Followed by `PHASE_X3_FINAL_ARCHITECTURE_AUDIT.md` (no
redesign recommended, 8.1/10 average across 18 categories, six findings F-1–F-6 logged for
awareness), `PHASE_X4_IMPLEMENTATION_PLAN_FINAL.md` (planned the still-unbuilt reasoning-engine
wiring, recommending it be tracked as Phase X.3.8, not X.4 — X.4 already means Output Validation),
and `PHASE_X4_API_REVIEW.md` (found `legalReasoningEngine.reason()`'s internal `detectIntent()`
call would force any future orchestrator to detect intent twice — cheap to fix now since
`reason()` had exactly one caller anywhere in the repo, its own test file; recommended the small,
compatible redesign this cleanup implements).

---

### Phase X.3.6 — Knowledge Resolution: Remaining Gaps (Deterministic Enrichment) — declared 2026-07-06 (superseded by X.3.7)

**Evidence:** 448 test files, 14,067 tests, 0 failures at freeze time; architecture guard
confirmed zero `src/knowledge/` import, zero reference to any X.3.2–X.3.5 module, zero MCP/
provider/LLM/PromptBuilder/validation/citation/conflict-resolution reference, and that every
prior milestone's frozen-file markers (X.3.1 through X.3.5) were unchanged.

**Summary:** Implemented `knowledgeEnrichmentTypes.ts` (additive diagnostic shapes),
`resolutionMetadataNormalizer.ts` (`readMetadataString()`), `effectivePeriodEvaluator.ts`
(independent CURRENT/NOT_YET_EFFECTIVE/EXPIRED classification), `ruleMetadataParser.ts` +
`thresholdMetadataParser.ts` (ADR-022 Decision 5 — JSON metadata parsing into
`RuleKnowledgeItemRef`/`ThresholdKnowledgeItemRef`, critical `MissingEvidence` on failure, never
throws), `knowledgeApplicabilityEvaluator.ts` (final per-item verdict), `resolutionDiagnostics.ts`
(aggregation), and `knowledgeEnrichmentPipeline.ts` (`enrichKnowledge()` — the pure composition
function, standalone from X.3.5). Populated `ruleItems`/`thresholdItems`, always empty since
X.3.3. Zero modification to X.3.1–X.3.5.

---

### Phase X.3.5 — Knowledge Resolution: Orchestration Wiring — declared 2026-07-06 (superseded by X.3.6)

**Evidence:** 440 test files, 14,026 tests, 0 failures at freeze time; architecture guard
confirmed zero `src/knowledge/` import, zero MCP/provider/LLM/PromptBuilder reference, and that
every prior milestone's frozen-file markers (X.3.1 through X.3.4) were unchanged.

**Summary:** Implemented `resolutionOrchestrationTypes.ts` (`RankedKnowledge` alias,
`ResolutionExecutor<TInput,TOutput>`), `resolutionExecutor.ts` (thin adapters wrapping
`IntentResolutionPipeline.resolve()`/`KnowledgeRankingPipeline.rank()`), `ResolutionCoordinator`
(sequences intent-retrieval then ranking, no branching), and `KnowledgeResolutionPipeline` (the
public composition root, composing X.3.3/X.3.4 via their existing `build*()` factories only).
Proved the full Intent Resolution → Retrieval → Ranking → `RankedKnowledge` chain against a fake
repository, including that ranking genuinely re-orders/trims results rather than passing
retrieval through unchanged. Zero modification to X.3.1–X.3.4.

---

### Phase X.3.4 — Knowledge Resolution: Knowledge Ranking & Selection — declared 2026-07-06 (superseded by X.3.5)

**Evidence:** 436 test files, 14,011 tests, 0 failures at freeze time; architecture guard (6
tests) confirmed zero import of the X.3.2/X.3.3 modules and zero citation/conflict/evidence-
formatting/answer/LLM/validation logic.

**Summary:** Implemented `rankingStrategy.ts` (5 independent per-item scoring criteria:
domain priority, legal hierarchy, relevance-as-confidence, freshness decay, document
authority-by-layer), `candidateSelector.ts` (`rankItems()`/`selectCandidates()` — deterministic
sort with itemId tie-break, generic over `KnowledgeItemRef` subtypes to avoid unsafe casts),
`rankingPlanner.ts` (data-driven per-intent weights, `AUTHORITY_CHECK` overridden), and
`KnowledgeRankingPipeline` (depends only on `rankingPlanner.ts`/`candidateSelector.ts`/
`reasoningTypes.ts` — never X.3.2/X.3.3/`src/knowledge/`). Proved ranking never resolves
conflicts (contradictory items are both kept, ordered by score, never merged/removed) and
genuine dependency injection of a custom planner.

---

### Phase X.3.3 — Knowledge Resolution: Intent-Driven Orchestration — declared 2026-07-06 (superseded by X.3.4)

**Evidence:** 431 test files, 13,971 tests, 0 failures at freeze time; architecture guard (6
tests) confirmed the interface-only dependency and zero ranking/scoring/confidence/citation/
conflict logic.

**Summary:** Implemented `knowledgeResolutionPlanner.ts` (`planKnowledgeResolution()` — data-
driven domain selection per intent), `resolveKnowledgeWarnings.ts` (`buildEffectivePeriodWarnings()`
— corrected mid-implementation to produce plain strings, matching `ResolvedKnowledge.warnings`'s
actual `readonly string[]` type, not the richer `ReasoningWarning` object initially assumed), and
`intentResolutionPipeline.ts` (`IntentResolutionPipeline`, depending only on
`IKnowledgeRepository`, never the concrete adapter). Found and documented that `checklists`/
`cases`/`bestpractice`/`risk` domains have no destination field on the frozen `ResolvedKnowledge`
— the planner intentionally only requests `legal`/`procurement`/`school`.

---

### Phase X.3.2 — Knowledge Resolution: Retrieval & Wiring — declared 2026-07-05 (superseded by X.3.3)

**Evidence:** 427 test files, 13,943 tests, 0 failures at freeze time; architecture guard (7
tests) confirmed the interface/adapter import boundary and zero MCP/provider/Anthropic/
PromptBuilder references.

**Summary:** Implemented `IKnowledgeRepository` (pure interface) and `KnowledgePlatformRepository`
(the sole file permitted to import `IKnowledgePlatform`, via constructor dependency injection).
Proven against a real memory-backed `IKnowledgePlatform` + `LegalProvider` (Phase N's own
integration-test pattern), not just fixtures — confirming real `KnowledgeItem`/`LegalBasis`
objects satisfy X.3.1's `KnowledgeReference` shapes with zero cast needed.

---

### Phase X.3.1 — Knowledge Resolution: Pure Mapping — declared 2026-07-05 (superseded by X.3.2)

**Evidence:** 425 test files, 13,928 tests, 0 failures at freeze time; architecture guard (4
tests) confirmed zero imports from Knowledge Platform/MCP/financial/conversation/providers.

**Summary:** Implemented `KnowledgeReference`/`KnowledgeReferenceLegalBasis`/
`KnowledgeReferenceEffectivePeriod` (a structural mirror of the real `KnowledgeItem`/
`LegalBasis`, defined independently) and `toLegalBasisRef()`/`toKnowledgeItemRef()` (ADR-022
Decisions 3-4) — pure mapping, zero repository queries. Confirmed in X.3.2 that the structural-
typing bet paid off: real `KnowledgeItem`/`LegalBasis` objects satisfy these shapes with zero
cast needed.

---

### Phase X.4 — Output Validation — declared 2026-07-05 (superseded by Phase X.3.1)

**Evidence:** 423 test files, 13,913 tests, 0 failures at freeze time; 100% adversarial-fixture
catch rate (hallucinated citation, numeric drift, decision contradiction, truncated response,
forbidden pattern, malformed output), zero exceptions.

**Summary:** Implemented `CitationValidator`, `ConfidenceValidator`, `LegalConsistencyValidator`,
`OutputValidator` (orchestrator + structural checks), `ResponseFormatter`, `ValidationPipeline`.
Requested as "Phase X.3" but numbered X.4 per `PHASE_X_EXECUTION_PLAN.md`'s consistent numbering
(X.3 is Knowledge Resolution, blocked at the time on ADR ratification) — reconciled
transparently in `CURRENT_MILESTONE.md`, not treated as a blocker. Two real bugs found and
fixed: JS's ASCII-only `\W` shredding Vietnamese diacritic words in keyword extraction, and
`NUMERIC_INCONSISTENCY` (HIGH severity) never triggering any human-review flag at all. Tagged
`phase-x.4-output-validation`. Followed by: `PHASE_X3_READINESS_REVIEW.md` (NO-GO, sole blocker
ADR-DRAFT-X01 unratified) → `ADR-X01_FINAL.md` (critical re-review, closed 3 new gaps, GO) →
ratified 2026-07-05 as ADR-022 → `PHASE_X3_ARCHITECTURE_REVIEW.md` (clarified that ADR-022's
"never PRIMARY_BASIS" guarantee for `searchKnowledge()`-sourced items holds by construction,
zero touches to frozen `legalReasoningEngine.ts` needed) → Phase X.3.1 authorized.

---

### Phase X.2 Batch B — AIContext/Prompt/LLM Adapter path — declared 2026-07-05 (superseded by Phase X.4)

**Evidence:** 416 test files, 13,855 tests, 0 failures at freeze time; architecture guard suite
(12 tests) confirmed dependency direction, no provider leakage, and isolation from the
pre-existing 32 flat `src/ai/*.ts` files.

**Summary:** Implemented `AIContext` (deep-frozen, per `AI_CONTEXT_SCHEMA.md`), `AIContextBuilder`,
`PromptBuilder` (presentation only), `PromptRenderer` (deterministic, provider-agnostic),
`ModelCapabilityRegistry`, `ModelSelector` (provider-independent), and `ClaudeLLMAdapter`
(wraps the existing `src/providers/ClaudeProvider.ts`). An architecture gate review performed
before implementation returned GO with 5 non-blocking recommendations; Finding A
(`AIContextBuilder` must not call a repository directly, per Constraint C-05) was applied
directly in the code. Tagged `phase-x.2-batch-b-ai-context-prompt`.

---

### Phase X.2 Batch A — Reasoning Pipeline Core — declared 2026-07-05 (superseded by Batch B)

**Evidence:** 409 test files, 13,809 tests, 0 failures at freeze time; architecture guard test
confirmed no import from `src/knowledge/`, `src/ai/`, `src/mcp/` and no modification of the
pre-existing, unrelated `src/reasoning/{reasoningEngine,decisionModel}.ts` (Phase 15 track).

**Summary:** Implemented the deterministic reasoning pipeline — intent detection, applicable
law/hierarchy/4-tier conflict resolution/supersession (Stage 3, folded into
`legalReasoningEngine.ts`), rule/threshold evaluation and exception detection (Stage 4), evidence
collection (Stage 5), citation formatting (Stage 6), confidence scoring/human-review
determination/decision composition (Stage 7) — all provable against `mockKnowledgeFixtures.ts`
with zero LLM calls, zero network calls. `Legal`-prefixed only where a real collision was found
(`LegalReasoningStep`, `LegalRuleResult`, `LegalThresholdResult`, `LegalPipelineStage`) per the
grep-first, not defensive, naming rule. An architecture gate review (before Batch B) returned GO
with five non-blocking recommendations, one of which (Finding A: AIContextBuilder must not call
`ISessionRepository` itself) was applied directly in Batch B's `aiContextBuilder.ts`. Tagged
`phase-x.2-batch-a-reasoning-core`.

---

### Phase X.1 — Conversation Core — declared 2026-07-05 (superseded by Phase X.2 Batch A)

**Evidence:** 401 test files, 13,760 tests, 0 failures at freeze time; architecture guard test
confirmed no import from `src/knowledge/`, `src/reasoning/`, `src/ai/`, `src/mcp/`.

**Summary:** Implemented session-scoped conversation state — `AdvisoryConversationContext`,
`AdvisorySessionState` (`CREATED`→`ACTIVE`→`IDLE`→`ARCHIVED`), `AdvisoryConversationHistory`,
`AdvisoryConversationMemory` (token-budget pruning, 2-most-recent-turn floor), and
`MemorySessionRepository` implementing the frozen `IBaseRepository<T>`. Zero LLM, zero reasoning,
zero Knowledge Platform dependency, per its own stated scope. `Advisory`-prefixed to avoid four
real naming collisions with pre-existing, unrelated tracks (`src/providers/`, `src/workspace/`,
`src/components/SessionPanel.tsx`). A post-implementation review (`PHASE_X1_POST_IMPLEMENTATION_REVIEW.md`)
found the design sufficiently stable to build on as-is (score 7.9/10) — no redesign needed before
Phase X.2, only additive follow-ups (composition/rehydration helpers, deferred to be built
X.2-side without touching any X.1 file). Tagged `phase-x.1-conversation-core`.

---

### PROJECT_KNOWLEDGE_SYSTEM v1.1 COMPLETE — declared 2026-07-05 (superseded by Phase X.1)

**Evidence:** Release Candidate audit PASSED (GO WITH NOTES); zero-knowledge validation
re-performed after the Documentation Completion Sprint, overall maturity 7 → 8.

**Summary:** Documentation Completion Sprint persisted ADR-DRAFT-X01, the AIContext schema, and
the Golden Question methodology into `PROJECT_KNOWLEDGE_SYSTEM`, completed the `SCHEMA.md`
ownership registry, and gave all 15 Knowledge Base folders an explicit Ownership/Update Policy —
released as v1.1, tagged `knowledge-system-v1.1`, pushed. A final governance decision then
classified ADR-X02–X07, Golden Question datasets, Knowledge Base population, domain legal
content, FAQ population, and ontology population as intentionally deferred, non-blocking future
deliverables — closing the Documentation Track and clearing Phase X.1 (Conversation Core) to
begin with no documentation blockers.

---

*No prior milestones are recorded here because Knowledge Platform v1.0 is the first formally
declared milestone in this project's history — prior phases (A through M1) were tracked as
phase completions (see [Timeline](TIMELINE.md)) rather than named milestones. Future entries
should follow the format: milestone name, declaration date, evidence (test counts, audit
result), and a one-paragraph summary of what changed and why it was declared complete.*
