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

current_milestone: "Phase X.3.4 - Knowledge Resolution: Knowledge Ranking & Selection - FROZEN"
documentation_track_status: "CLOSED"
milestone_declared: 2026-07-06
milestone_evidence:
  scope: "src/reasoning/domain/knowledgeRankingTypes.ts (RankingWeights, RankingPlan,
         RankedItem); src/reasoning/application/rankingStrategy.ts (5 pure per-item scoring
         functions + scoreItem() composite); src/reasoning/application/candidateSelector.ts
         (rankItems(), selectCandidates() — deterministic sort with itemId tie-break, generic
         over KnowledgeItemRef subtypes); src/reasoning/application/rankingPlanner.ts
         (planRanking() — data-driven weights+cap per intent, AUTHORITY_CHECK overridden);
         src/reasoning/application/knowledgeRankingPipeline.ts (KnowledgeRankingPipeline,
         buildKnowledgeRankingPipeline() — depends only on rankingPlanner.ts/
         candidateSelector.ts/reasoningTypes.ts, never X.3.2/X.3.3/src/knowledge/)."
  scope_exclusion: "This is X.3.4 only. Ranking never compares two items to each other for
                    contradiction (conflict resolution stays legalReasoningEngine.ts's job,
                    frozen, untouched) and never decides which item backs a passing rule
                    (evidence collection stays evidenceCollector.ts's job, frozen, untouched).
                    No citation generation, answer composition, prompt construction, LLM
                    interaction, or validation — confirmed absent by architecture guard.
                    relevance uses KnowledgeItemRef.confidence as the only available proxy
                    (X.3.2 does not preserve KnowledgeResult's own relevance score); repository/
                    source priority uses domain as the only available proxy (KnowledgeItemRef
                    carries no separate source identifier) — both documented as deliberate,
                    non-fabricated mappings to the data that actually exists."
  files_added: "5 implementation files + 5 test files (40 tests)"
  full_suite_result: "436 test files, 14011 tests, 0 failures (pool=forks, full repo, no filter);
                      up from 431 files / 13971 tests at the X.3.3 baseline"
  exit_criteria_met: "Ranking-strategy tests prove each of the 5 criteria functions is
                      monotonic and bounded correctly. Deterministic-ordering and tie-break
                      tests prove rankItems() never depends on input array order — ties are
                      always broken by itemId ascending, verified from both directions of
                      input order. Pipeline tests prove independent per-bucket ranking/trimming,
                      that conflicting items are both kept (never merged/resolved), and genuine
                      dependency injection of a custom planner. Architecture guard (6 tests)
                      confirms zero import of the X.3.2/X.3.3 modules and zero citation/
                      conflict/evidence-formatting/answer/LLM/validation logic."
  frozen_interfaces_touched: "None. ResolvedKnowledge/ReasoningIntent/KnowledgeItemRef (Batch A)
                              consumed read-only; IKnowledgeRepository/IntentResolutionPipeline
                              (X.3.2/X.3.3) not imported at all — verified by git diff and
                              architecture guard."
  owner_file_for_numbers: CURRENT_RELEASE.md   # release tag, test counts — see there, not here

next_active_milestone: "Phase X.3.5 - Knowledge Resolution: remaining gaps (or any other later
                        milestone)"
next_milestone_status: "NOT AUTHORIZED. X.3.4's exit criteria confirmed met and frozen this
                         session. Phase X.3 as a whole is NOT complete — X.3.1/X.3.2/X.3.3/X.3.4
                         are its first four sub-milestones. Remaining: wiring
                         KnowledgeRankingPipeline between IntentResolutionPipeline and
                         legalReasoningEngine.reason() (no orchestration glue exists yet tying
                         all of X.3's sub-milestones into one call chain), ADR-022 Decision 5's
                         rule/threshold metadata parsing, and the still-open decision on
                         extending ResolvedKnowledge for checklists/cases/bestpractice/risk."
next_milestone_blocker: "None purely technical for ranking itself. The ResolvedKnowledge-
                         extension decision (carried over from X.3.3) still requires explicit
                         human authorization to un-freeze Reasoning Pipeline Core, separate from
                         ordinary milestone approval."

immediate_next_action: "None assigned as of this writing. Waiting for explicit human approval
                        to begin Phase X.3.5 (or any other later milestone)."

do_not:
  - "Do not begin X.3.5, Tool Calling, MCP, or Multi-Agent without explicit approval."
  - "Do not modify any file under src/conversation/ (X.1, frozen), src/reasoning/{domain,
     application,infrastructure,testing}/ (X.2 Batch A + X.3.1 + X.3.2 + X.3.3 + X.3.4, frozen),
     src/ai/{domain,application,infrastructure}/ (X.2 Batch B, frozen), or src/ai/validation/
     (X.4, frozen) outside of a newly-approved milestone."
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
     suite green (14011 tests) — FROZEN — you are here"
```

Full narrative version of this sequence, with the reasoning behind each step:
[`../04_PROJECT_MEMORY/TIMELINE.md`](../04_PROJECT_MEMORY/TIMELINE.md).
