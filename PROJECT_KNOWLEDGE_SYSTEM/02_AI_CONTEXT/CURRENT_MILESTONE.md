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
as_of: 2026-07-06
status: CURRENT
owner_file: null   # owns: current_milestone_name, next_milestone_name, milestone_blockers
related: [../04_PROJECT_MEMORY/MILESTONE_HISTORY.md, CURRENT_RELEASE.md, NEXT_APPROVED_PHASE.md, SCHEMA.md]

current_milestone: "Phase X.4.1 - Reasoning Engine Wiring: Batch A (Reasoning Orchestrator) -
                    FROZEN"
documentation_track_status: "CLOSED"
milestone_declared: 2026-07-06
milestone_evidence:
  scope: "src/reasoning/application/reasoningOrchestrator.ts (ReasoningOrchestrator,
         buildReasoningOrchestrator() — coordinates X.3.7's FinalKnowledgeResolutionPipeline and
         Batch A's LegalReasoningEngine into ReasoningIntent -> Knowledge Resolution ->
         ReasoningResult; constructs both via their existing build*() factories only,
         dependency-injects IKnowledgeRepository + optional ILegalReasoningEngine/
         RankingPlanner)."
  scope_exclusion: "This is Batch A only — the orchestrator, nothing more. Zero business logic:
                    no ranking, no retrieval, no answer generation, no citation formatting, no
                    conflict resolution, no confidence scoring, no PromptBuilder/PromptRenderer/
                    LLM adapter/Output Validation/MCP/Tool Calling/Multi-Agent/Conversation Core/
                    Knowledge Platform changes — confirmed absent by architecture guard.
                    'Invoke KnowledgeResolutionPipeline' interpreted as X.3.7's
                    FinalKnowledgeResolutionPipeline specifically (documented inline), since
                    X.3.5's narrower class alone would skip X.3.6's enrichment. Deliberately
                    returns ReasoningResult only, not EnrichmentResult's diagnostics alongside
                    it — the missingEvidence reconciliation question
                    (PHASE_X3_FINAL_ARCHITECTURE_AUDIT.md Finding F-2) remains open and
                    undecided; answering it here would exceed 'zero additional
                    responsibilities'. EnrichmentResult itself is unchanged and still available
                    to any caller resolving knowledge directly."
  files_added: "1 implementation file + 3 test files (17 tests: 6 unit/DI, 3 real-platform
               end-to-end integration, 8 architecture guard)"
  full_suite_result: "453 test files, 14096 tests, 0 failures (pool=forks, full repo, no filter);
                      up from 450 files / 14079 tests at the Pre-X.3.8 API Cleanup baseline"
  exit_criteria_met: "Dependency-injection tests prove call order (resolve before reason), that
                      the same intent instance reaches both calls, and genuine DI of both the
                      repository and the engine. A real-platform end-to-end integration test
                      (mirroring X.3.2's own proven pattern) exercises the first full chain from
                      a raw question string through a real intent detector, a real
                      memory-backed IKnowledgePlatform + LegalProvider, and a real
                      LegalReasoningEngine — not fakes at any layer — including that temporal
                      filtering still excludes a not-yet-effective item end-to-end. Architecture
                      guard confirms zero src/knowledge/, src/ai/, src/mcp/, or
                      src/conversation/ import; that the orchestrator's only production
                      dependencies are finalKnowledgeResolutionPipeline.ts and
                      legalReasoningEngine.ts; zero MCP/PromptBuilder/LLM adapter/
                      OutputValidator reference; zero ranking/retrieval/citation/conflict/
                      confidence-scoring logic; and that every prior milestone's frozen-file
                      markers (X.3.1 through X.3.7, plus the pre-X.4 cleanup) are unchanged."
  frozen_interfaces_touched: "None. FinalKnowledgeResolutionPipeline (X.3.7)/LegalReasoningEngine
                              (Batch A, post-cleanup) consumed only via their existing public
                              build*()/resolve()/reason() surface — verified by git diff and
                              architecture guard."
  tooling_note: "tsc --noEmit against the root tsconfig.json checks zero files (solution-style
                'files': [] + references) — has been a no-op for every tsc invocation across
                this entire X.3/X.4 track. Running against tsconfig.app.json directly surfaces a
                pre-existing, repo-wide 'erasableSyntaxOnly' violation on every constructor using
                parameter-property shorthand, confirmed present since X.3.2's first class (git
                show against the pre-X.3 baseline tag) — predates this session entirely, not
                introduced by any Phase X milestone. This orchestrator follows the same existing
                convention as every other X.3.x class. The real verification gate for this
                repository has always been the Vitest suite (transpiles via esbuild, ignores
                this flag), not this specific tsc invocation. Not fixed here — would touch
                multiple frozen files, out of this milestone's scope."
  owner_file_for_numbers: CURRENT_RELEASE.md   # release tag, test counts — see there, not here

next_active_milestone: "Phase X.4.2 (Reasoning Engine Wiring — Batch B, or whatever comes next)
                        or any other later milestone"
next_milestone_status: "NOT AUTHORIZED. Phase X.4.1's exit criteria confirmed met and frozen
                         this session. The missingEvidence-reconciliation question
                         (ResolutionDiagnostics vs. ReasoningResult.missingEvidence,
                         PHASE_X3_FINAL_ARCHITECTURE_AUDIT.md Finding F-2) remains open and
                         should shape whatever X.4.2 (or a real caller/API-shape milestone)
                         turns out to need. The still-open decision on extending
                         ResolvedKnowledge for checklists/cases/bestpractice/risk also remains
                         unresolved."
next_milestone_blocker: "None technical. Requires its own explicit human authorization to
                         begin, separate from X.4.1's own approval."

immediate_next_action: "None assigned as of this writing. Waiting for explicit human approval
                        to begin Phase X.4.2 (or any other later milestone)."

do_not:
  - "Do not begin Phase X.4.2, Tool Calling, MCP, or Multi-Agent without explicit approval."
  - "Do not modify any file under src/conversation/ (X.1, frozen), src/reasoning/{domain,
     application,infrastructure,testing}/ (X.2 Batch A + X.3.1 + X.3.2 + X.3.3 + X.3.4 + X.3.5 +
     X.3.6 + X.3.7 + Pre-X.3.8 API Cleanup + X.4.1, frozen), src/ai/{domain,application,
     infrastructure}/ (X.2 Batch B, frozen), or src/ai/validation/ (X.4, frozen) outside of a
     newly-approved milestone."
  - "Do not modify src/reasoning/reasoningEngine.ts or src/reasoning/decisionModel.ts (Phase 15
     track), or any of the 32 pre-existing flat src/ai/*.ts files (the unrelated '8-G' track,
     e.g. llmBridge.ts) — none of these belong to Phase X."
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
     fakes), architecture guard — full repo suite green (14096 tests) — FROZEN — you are here"
```

Full narrative version of this sequence, with the reasoning behind each step:
[`../04_PROJECT_MEMORY/TIMELINE.md`](../04_PROJECT_MEMORY/TIMELINE.md).
