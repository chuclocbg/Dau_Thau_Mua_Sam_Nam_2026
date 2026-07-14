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
as_of: 2026-07-13
status: CURRENT
owner_file: null   # owns: current_milestone_name, next_milestone_name, milestone_blockers
related: [../04_PROJECT_MEMORY/MILESTONE_HISTORY.md, CURRENT_RELEASE.md, NEXT_APPROVED_PHASE.md, SCHEMA.md]

current_milestone: "Phase X.18 - CI/CD Pipeline - FROZEN"
documentation_track_status: "CLOSED"
milestone_declared: 2026-07-14
milestone_evidence:
  scope: "Tooling-only milestone -- stands up a GitHub Actions CI pipeline enforcing the exact
         verification commands used at every prior milestone freeze (tsc --noEmit, the
         architecture guard suite, the full test suite), converting manual discipline into a
         tooling-enforced gate. Zero application capability added, zero runtime behavior
         changed. Two forks resolved up front in X18_ARCHITECTURE_DECISION.md, against direct
         repository evidence: (1) no PostgreSQL service container in CI -- the 3
         TEST_DATABASE_URL-gated tests remain optional/skipped in CI exactly as locally, since
         the marginal per-PR value of 3 already-live-verified (X.17) tests did not justify a
         new infrastructure-flakiness vector on every PR; (2) ESLint is informational only,
         never blocking -- 477 pre-existing errors across 178 files (re-counted fresh at
         decision time) made full blocking infeasible without an out-of-scope cleanup, and
         partial/diff-scoped gating was rejected (file-level diffing would unfairly block
         unrelated one-line changes to already-flagged files). Implementation steps: (1)
         .github/workflows/ci.yml (commit e0003d1) -- checkout, Node 24, npm ci, tsc, the
         architecture guard suite, the full test suite (--pool=forks), an informational lint
         step; triggers on PRs into develop/main and pushes to develop. LIVE VERIFICATION
         SURFACED A REAL DEFECT in this very file on its first run: 30 test files failed to
         resolve '../../generated/prisma/client.ts' -- app/generated/ is Prisma's codegen
         output, correctly untracked, and a fresh GitHub Actions checkout has none of it; the
         workflow never ran `prisma generate`. Not an implementation bug, not a Linux/Windows
         difference, not a flake -- fixed with one new step, `npx prisma generate` (commit
         289c3a5, needs no DATABASE_URL, does not reopen the no-Postgres-in-CI decision);
         re-run passed in full. (2) package.json's 'test' script changed from 'vitest run' to
         'vitest run --pool=forks' (commit f90d30d), protecting any local `npm test` from the
         jsdom-parallelism crash CURRENT_RELEASE.md already documents, verified locally across
         5 consecutive runs and live in CI. (3) Proof the gate blocks -- no artificial break was
         introduced; the real history above (e0003d1 failure -> 289c3a5 fix, passing ->
         f90d30d, passing) is itself stronger evidence than a manufactured one, since it is
         this project's own actual first CI-caught defect, demonstrating the gate blocks a
         real failure and passes real fixes, in both directions."
  scope_exclusion: "Named explicitly, not glossed over: (1) no PostgreSQL in CI -- addable
                    later as its own small, separately-scoped extension, not foreclosed. (2)
                    no blocking lint gate -- 477 pre-existing findings remain unaddressed and
                    non-blocking by design, merely visible in CI for the first time. (3) no
                    deployment automation -- this milestone verifies on PR/push only. (4) no
                    branch-protection configuration -- enforcing that this gate actually blocks
                    a merge (not just reports failure) is a GitHub repository *setting*, not a
                    file in this repository, and was not configured. None of X.16/X.17's own
                    named gaps (token revocation, replay protection,
                    routeAuthorization.ts/recovery-producer wiring, live-Postgres-in-CI) were
                    touched by or are affected by this milestone."
  files_added: "1 new workflow file (.github/workflows/ci.yml, extended once with the Prisma-
               generate fix) + 1 changed line (package.json's test script) + 1 new governance
               document (PHASE_X18_CICD_REPORT.md). Zero application source file changed. Zero
               test file changed. Zero new package.json dependency. Zero Prisma
               schema/migration change."
  full_suite_result: "553 test files, 14873 tests (14870 passed, 3 skipped -- X.10's
                      TEST_DATABASE_URL-gated tests, unaffected), 0 failures, confirmed live on
                      GitHub Actions at commit f90d30d (the final passing run) -- unchanged
                      from the X.17 freeze baseline; X.18 added zero test files. Locally,
                      npm test was run 5 consecutive times to verify the --pool=forks script
                      change is behavior-neutral: the same 2 already-documented, load-dependent
                      execSync('npx prisma validate') timing tests intermittently flaked under
                      this session's own repeated back-to-back full-suite load (unrelated to
                      this change, and not seen at all on the live, unloaded GitHub Actions
                      runner). tsc --noEmit clean, both locally and live in CI."
  ci_verification: "Live GitHub Actions history, re-queried directly via the public Actions API
                   at freeze time: run 29263895937 (commit e0003d1) -- FAILURE (the real
                   Prisma-generate defect); run 29265807366 (commit 289c3a5) -- SUCCESS; run
                   29294256329 (commit f90d30d) -- SUCCESS, confirmed as the latest run on
                   develop at freeze time. All three steps (tsc, architecture guards, full
                   suite) plus the informational lint step passed in full on both successful
                   runs."
  exit_criteria_met: "Every Acceptance Criterion in X18_SCOPING_REPORT.md §12 and
                      X18_ARCHITECTURE_DECISION.md §7 verified: .github/workflows/ci.yml exists
                      and triggers on PRs into develop/main and pushes to develop; tsc,
                      architecture guards, and the full test suite each run as distinct,
                      individually-reportable steps; Node 24 is pinned explicitly; the full
                      suite step uses --pool=forks; the workflow contains no Postgres service
                      container and no DATABASE_URL/TEST_DATABASE_URL step, and the 3 gated
                      tests report as skipped, not failed; the ESLint step is present,
                      continue-on-error, and does not block a clean-of-new-violations PR
                      despite 477 pre-existing findings; the gate's blocking behavior was
                      proven using real history rather than an artificial break;
                      PHASE_X18_CICD_REPORT.md states plainly which of the two named scope
                      decisions was chosen and why."
  frozen_interfaces_touched: "None. Zero application source file changed by this milestone.
                              src/identity/, src/api/, src/runtime/, src/persistence/,
                              prisma/schema.prisma, and every other Phase-X module are
                              byte-for-byte unchanged from the X.17 freeze -- confirmed by
                              git diff --stat across the entire milestone showing only
                              .github/workflows/ci.yml, package.json (1 line), and the
                              governance documents this milestone itself added."
  owner_file_for_numbers: CURRENT_RELEASE.md   # release tag, test counts — see there, not here
                          # NOTE: still not updated (unchanged since the X.15/X.16/X.17
                          # freezes) -- no new tag was cut this milestone either; its
                          # test-count fields now reflect the x14-frozen tag, stale by
                          # +7 files/+67 tests relative to this freeze's actual numbers above
                          # (identical gap carried since X.16, since neither X.17 nor X.18
                          # added new tests of their own).

next_active_milestone: "None currently proposed. Phase X.18 (CI/CD Pipeline) is now COMPLETE --
                        every pull request into develop/main and every push to develop is now
                        automatically verified (tsc, architecture guards, full suite), with
                        lint visible but non-blocking. Candidates named in
                        POST_X14_ARCHITECTURE_AUDIT.md's original roadmap, still open: X.19
                        (Exactly-Once Recovery + Optimistic Locking, touches currently-frozen
                        X.11 persist-path code, needs its own explicit scoping), X.20
                        (Knowledge Platform Persistence Migration, need-driven only, not
                        currently justified). None of X.16/X.17's own named gaps (token
                        revocation, replay protection,
                        routeAuthorization.ts/recovery-producer wiring, live-Postgres-in-CI)
                        were touched by or are affected by this milestone -- all remain open."
next_milestone_status: "NOT AUTHORIZED — no specific next milestone is proposed. Per explicit
                         instruction, work stops here; Phase X.19 does not begin automatically."
next_milestone_blocker: "N/A — no next milestone proposed. All gaps named at the X.16/X.17
                         freezes remain open and are carried forward unchanged (X.18 did not
                         touch them): no server-side token revocation, no replay protection,
                         routeAuthorization.ts unwired, recovery-producer wiring unwired, no
                         PostgreSQL in CI, no blocking lint gate, no branch-protection
                         configuration. None is silently claimed as solved. Beginning any new
                         work requires its own explicit human authorization and scoping."

immediate_next_action: "None. Waiting for explicit human direction on what (if anything) comes
                        after Phase X.18."

do_not:
  - "Do not begin any new phase or milestone without explicit approval and explicit scoping —
     there is no pre-agreed 'next batch' after X.9.5."
  - "CORRECTION (X.11): src/conversation/ was previously listed below as fully 'frozen' — that
     was accurate through X.10 but is now superseded. X.11's own governing instruction listed
     only X.3-X.10 as frozen, deliberately excluding X.1/X.2, and X.11 used that opening to add
     two small, additive methods to SessionStateManager and one to AdvisoryConversationMemory
     (rehydration support). Going forward: src/conversation/'s EXISTING methods/behavior
     (recordActivity, transitionTo, isDueForIdle/isDueForArchive, pruneToTokenBudget,
     groupIntoTurns, the ConversationContextManager class, conversationTypes.ts's shapes,
     memorySessionRepository.ts) must not be modified or redesigned outside a newly-approved
     milestone; further ADDITIVE extensions (new methods, zero existing lines changed) remain
     permissible on the same reasoning X.11 used, but must be verified by an architecture guard
     the same way X.11's was. Do not modify src/reasoning/{domain,
     application,infrastructure,testing}/ (X.2 Batch A + X.3.1 + X.3.2 + X.3.3 + X.3.4 + X.3.5 +
     X.3.6 + X.3.7 + Pre-X.3.8 API Cleanup + X.4.1 + X.4.2 + X.4.3 + X.4.4 + X.4.5 + X.4.6 +
     X.4.7 + Final X.4 Integration + X.5 + X.6, frozen), src/mcp/{domain,infrastructure,
     application}/ (X.7, frozen), src/multiagent/{domain,application}/ (X.8, frozen),
     src/health/, src/api/, src/startup/gracefulShutdown.ts, src/server/main.ts (X.9.1, frozen),
     src/logging/, src/metrics/, src/tracing/, src/middleware/ (X.9.2, frozen),
     src/streaming/, src/http/, src/cancellation/ (X.9.3, frozen),
     src/config/configProfiles.ts, src/config/environmentValidator.ts,
     src/startup/loadEnvironmentSecrets.ts, src/startup/configDiagnostics.ts, Dockerfile,
     docker-compose.yml, scripts/start-prod.sh, scripts/start-dev.sh,
     scripts/validateEnvironment.ts (X.9.4, frozen), src/startup/waitForReady.ts,
     src/startup/smokeChecks.ts, scripts/waitForReady.ts, scripts/smokeTest.ts,
     deployment/deploy.sh, deployment/rollback.sh (X.9.5, frozen), or
     src/ai/{domain,application,infrastructure}/ (X.2 Batch B, frozen), or src/ai/validation/
     (X.4, frozen) outside of a newly-approved milestone. src/config/appConfig.ts,
     src/bootstrap/buildApplication.ts, and src/server/httpServer.ts may be touched again ONLY
     for additive dependency-injection/wiring, exactly as X.9.2/X.9.3 themselves did — never a
     redesign of their existing logic. docker-compose.yml/docs/infrastructure.md/the docs/ files
     added this milestone may be extended again additively but existing content must never be
     replaced or redesigned."
  - "Do not modify src/reasoning/reasoningEngine.ts or src/reasoning/decisionModel.ts (Phase 15
     track), or any of the pre-existing src/providers/*.ts files (the unrelated 'P6' track,
     e.g. ToolCallingAgent.ts, AgentRuntime.ts, MultiAgentCoordinator.ts, ProviderManager.ts), or
     src/interface/restAdapter.ts (Phase 14, unrelated, pre-existing Fastify pattern) — none of
     these belong to Phase X. ToolRegistry.ts/ToolExecutor.ts/RetryPolicy.ts/RestClient.ts/
     MetricsCollector.ts are reused by X.6/X.7/X.8/X.9.1/X.9.2/X.9.3/X.9.5 but must remain
     unmodified. dotenv (already a dependency) is reused by X.9.4; do not add any new package."
  - "Do not claim Phase M1 (Prisma) is 'verified against a live database' — X.10 added
     connectivity/readiness/transaction/test-DB-bootstrap infrastructure, but Docker/Postgres
     remain unavailable in this environment, so none of it has actually run against a real
     database yet (the 3 TEST_DATABASE_URL-gated integration tests still skip). Do not claim
     Docker images/containers are 'verified' — Docker is unavailable in this environment across
     X.9.4, X.9.5, and X.10; only the underlying scripts/config/CLI tools were verified for
     real, never an actual container build/run. Do not claim this server is safe for untrusted
     traffic — no authentication/authorization layer exists; docs/PRODUCTION_READINESS.md
     states this explicitly and it must not be softened in any future summary without a real
     auth milestone actually being built first."
  - "Do not create a second Prisma schema, a second PrismaClient singleton, duplicate
     repositories, or duplicate migrations. Do not modify any of the 82 pre-X.11 models,
     src/persistence/prismaClient.ts, src/shared/repository/IBaseRepository.ts, or any of the
     11 pre-X.11 prisma*Repositories.ts/prismaMasterData.ts files (Phase M1, canonical, predates
     Phase X, reused unmodified by X.10/X.11) outside of a newly-approved milestone. New models
     may still be appended additively (X.11 added ConversationSession this way) but no existing
     model may be altered. Do not modify src/persistence/prismaTransaction.ts,
     src/persistence/databaseConnectivity.ts, src/persistence/testDatabaseBootstrap.ts, or
     prisma/seed.ts (X.10, frozen) outside of a newly-approved milestone."
  - "Do not modify src/runtime/ (conversationSession.ts, runtimeSessionBuilder.ts,
     runtimeContext.ts, conversationEntryOrchestrator.ts, sessionAttachments.ts),
     src/conversation/infrastructure/prismaSessionRepository.ts, or the ConversationSession
     Prisma model (X.11, frozen) outside of a newly-approved milestone.
     UPDATE (X.12): runConversationTurn() IS now registered as an HTTP route —
     POST /api/v1/conversation/turn, via src/api/conversationRoutes.ts + two additive lines in
     src/server/httpServer.ts (X.12, frozen). Do not modify conversationRoutes.ts or that
     httpServer.ts wiring outside of a newly-approved milestone. Do not add a second HTTP route
     over runConversationTurn(), a second RuntimeContext construction inside buildHttpServer(),
     or any authentication/authorization to this route without a newly-approved milestone — none
     of the routes on this server have an auth layer yet (see docs/PRODUCTION_READINESS.md,
     X.9.5), and adding one only to this route would be an inconsistent, undocumented partial
     fix."
  - "Do not modify src/runtime/recovery/ (recoveryTypes.ts, memoryRecoveryRepository.ts,
     prismaRecoveryRepository.ts, recoverableConversationTurn.ts,
     conversationRecoveryCoordinator.ts, runtimeRecoveryManager.ts), scripts/recoveryScan.ts, or
     the ConversationRecoveryMarker Prisma model (X.13, frozen) outside of a newly-approved
     milestone. Do not wire runStartupRecoveryScan() into src/server/main.ts's boot sequence, or
     runRecoverableConversationTurn() into src/api/conversationRoutes.ts's write path, without a
     newly-approved milestone — X.13 explicitly built these as complete, tested, but
     NOT-yet-wired-into-production capabilities (see PHASE_X13_RECOVERY_REPORT.md's Honest
     Limitations section). Do not claim recovery provides exactly-once replay semantics or
     concurrent-scan-safe idempotency — neither is true; both are named, open gaps, not solved
     by this milestone."
  - "Do not modify src/identity/ (identityTypes.ts, permissionResolver.ts,
     authorizationEvaluator.ts, authenticationContext.ts, runtimeAuthorization.ts,
     toolAuthorization.ts, mcpAuthorization.ts, routeAuthorization.ts,
     sessionIdentityRepository.ts, prismaSessionIdentityRepository.ts), or the
     SessionIdentityBinding Prisma model (X.14, frozen) outside of a newly-approved milestone.
     Do not import anything from src/auth/ into src/identity/, or vice versa — the central
     design decision of X.14 was that src/auth/ is procurement business logic and src/identity/
     is generic Runtime infrastructure; merging them would undo that separation. Do not wire
     runAuthorizedConversationTurn() into src/api/conversationRoutes.ts's write path, or
     buildRouteAuthorizationHook() into src/server/httpServer.ts, without a newly-approved
     milestone — X.14 explicitly built these as complete, tested, but NOT-yet-wired-into-
     production capabilities. Do not claim any route or the Runtime write path is actually
     protected by authorization today — none is; this milestone built the infrastructure, not
     the wiring. Do not claim real credential verification exists — buildUserContext() shapes a
     Principal from a caller-supplied id, it never authenticates a password/token/session."
  - "UPDATE (X.15): the two entries directly above are superseded in part. runAuthorizedConversationTurn()
     IS now wired into src/api/conversationRoutes.ts's write path (calling it instead of
     runConversationTurn() directly, authorized:false -> HTTP 403), and src/server/httpServer.ts
     now constructs an ISessionIdentityRepository and passes it through — both via
     src/api/httpPrincipalResolver.ts (new file, X.15), which reads an unverified x-client-id
     header and is NOT real credential verification (that gap remains fully open, named
     explicitly, carried to a future X.16). Do not modify
     src/api/httpPrincipalResolver.ts, or the conversationRoutes.ts/httpServer.ts wiring
     established by X.15, outside of a newly-approved milestone. Do not wire
     runRecoverableConversationTurn() (X.13) into conversationRoutes.ts, or
     buildRouteAuthorizationHook()/routeAuthorization.ts (X.14) into httpServer.ts, without a
     newly-approved milestone — X.15 deliberately deferred both (see
     ADR_X15_ARCHITECTURE_DECISION.md's Decision and Rejected Alternatives). Do not modify
     deployment/deploy.sh's X.15 recovery-scan step (the `npx tsx scripts/recoveryScan.ts` line)
     outside of a newly-approved milestone. Do not modify the three governance-exception literal
     corrections in x12-http-entry-architecture.test.ts (GX-001),
     x13-recovery-architecture-guard.test.ts (GX-002), or x14-identity-architecture-guard.test.ts
     (GX-003) outside of a newly-approved milestone — each is formally documented in
     ADR_X15_ARCHITECTURE_DECISION.md's Governance Exceptions section; any future milestone that
     needs to extend conversationRoutes.ts/httpServer.ts again (X.16 is already known to) should
     follow that section's forward-looking guard-writing guidance (presence-check style, not
     exact-substring) to avoid repeating the same class of break."
  - "UPDATE (X.16): src/api/httpPrincipalResolver.ts's trust model changed from 'x-client-id
     always trusted directly' to 'x-client-id trusted directly only when
     CREDENTIAL_SIGNING_SECRET is unset; otherwise must be a token verifyToken() accepts' --
     via Path B (resolvePrincipalFromRequest()'s own exported signature is UNCHANGED; it reads
     the secret itself via loadAppConfigFromEnv() rather than receiving it as a parameter,
     specifically so registerConversationRoutes()/httpServer.ts's call sites never needed to
     change again). Do not modify src/api/credentialToken.ts, src/api/httpPrincipalResolver.ts,
     the credentialSigningSecret field in src/config/appConfig.ts, or
     scripts/issueCredentialToken.ts outside of a newly-approved milestone. Do not thread the
     signing secret through registerConversationRoutes()'s parameters or
     src/bootstrap/buildApplication.ts's Application interface without a newly-approved
     milestone and an explicit decision to accept the resulting GX-005 (a second
     exact-argument-count break in x12-http-entry-architecture.test.ts's GX-001-fixed literal)
     -- Path B was chosen specifically to avoid this. Do not claim server-side token revocation
     exists -- it does not; a signed token is trusted until its own expiresAt with no blocklist.
     Do not claim this closes routeAuthorization.ts's (X.14) unwired state -- it does not; that
     remains a distinct, separately-deferred capability. Do not modify the GX-004 literal in
     x15-authorization-wiring-architecture.test.ts (src/api/'s five-file array) outside of a
     newly-approved milestone that adds another authorized src/api/ file."
  - "UPDATE (X.17): Docker/Postgres has now been verified live in this development environment
     -- do not claim this means CI/CD verification (X.18) or production-load verification
     exists; neither does. app/.env now exists locally (git-ignored, correctly never
     committed) -- do not assume a fresh checkout has it; the copy-from-template step
     (docker-compose.yml's own documented instruction) is still required on any new checkout or
     environment. Zero application source or test file was modified by X.17 -- there is
     nothing new to protect in the do_not sense beyond what X.16's own entry above already
     covers. Do not claim X.16's named gaps (token revocation, replay protection,
     routeAuthorization.ts/recovery-producer wiring) are affected by or resolved by X.17 -- none
     of them are; X.17's scope was persistence-layer live verification only."
  - "UPDATE (X.18): every PR into develop/main and every push to develop is now automatically
     verified by .github/workflows/ci.yml (tsc, architecture guards, full suite, informational
     lint). Do not modify .github/workflows/ci.yml or package.json's 'test' script outside of a
     newly-approved milestone. Do not add a PostgreSQL service container to the CI workflow, or
     make the ESLint step blocking, without a newly-approved milestone and an explicit decision
     -- both were deliberately declined in X18_ARCHITECTURE_DECISION.md; the 477 pre-existing
     ESLint findings remain unaddressed. Do not claim this gate is enforced by GitHub branch
     protection -- that is a repository *setting*, not configured by this milestone; the gate
     reports failure but nothing yet prevents a failing PR from being merged by an operator who
     chooses to. Do not claim the 3 TEST_DATABASE_URL-gated tests run in CI -- they remain
     skipped there by design. Do not claim any of X.16/X.17's own named gaps (token revocation,
     replay protection, routeAuthorization.ts/recovery-producer wiring) are affected by or
     resolved by X.18 -- none of them are; X.18's scope was CI/CD tooling only."

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
     full repo suite green (14528 tests) — FROZEN"
  - "Phase X.9.4 (Production Hardening: Docker/Production Configuration/Secrets — Batch D)
     implemented: Dockerfile (repo root, two-stage deps -> runtime build, runs the server via
     tsx — no new backend bundler, non-root user, HEALTHCHECK against /live), .dockerignore,
     .gitattributes (forces LF for *.sh/Dockerfile); docker-compose.yml extended additively with
     opt-in app/app-dev Compose-profile services on the SAME dtmsn_internal network (Phase M0
     default behavior unchanged); configProfiles.ts (resolveProfile()/applyProfileDefaults() —
     an env-var overlay, not a second parser), environmentValidator.ts (genuinely delegates to
     the real, unmodified loadAppConfigFromEnv()), loadEnvironmentSecrets.ts (thin wrapper
     around the already-installed, previously-unused dotenv), configDiagnostics.ts (redacted
     config summary); scripts/validateEnvironment.ts, start-prod.sh, start-dev.sh. USER-DIRECTED
     MID-MILESTONE CORRECTION: repository inspection found an existing docker-compose.yml and
     scripts/ convention; the plan was corrected to reuse/extend them (Compose profiles on the
     same file) rather than introduce docker-compose.dev.yml/prod.yml or a new docker/
     directory, per explicit instruction. Zero packages installed, package.json untouched, ZERO
     frozen files modified — not even under the DI carve-out X.9.2/X.9.3 used. HONEST
     VERIFICATION LIMITATION: Docker unavailable in this environment (re-confirmed) — the
     'production Docker build'/'container smoke test' items could not be literally executed;
     what WAS verified for real: YAML syntax, the full test suite, the validation CLI running
     live across dev/prod/invalid scenarios, and scripts/start-prod.sh itself executed
     end-to-end (validated environment, started the real server, answered a real HTTP request) —
     found and fixed a real bug this way (dotenv's own stdout banner polluting structured logs,
     fixed via its documented quiet:true option). Unit tests, architecture guard (zero
     frozen-file modification, additive-only Docker/Compose structure) — full repo suite green
     (14560 tests) — FROZEN"
  - "Phase X.9.5 (Production Hardening: Deployment/Operations/Production Readiness — Batch E)
     implemented: waitForReady.ts (polls a URL until ready, genuinely reuses RetryPolicy),
     smokeChecks.ts (6 black-box HTTP checks against a real deployment — /live, /ready, /health,
     the three reasoning/coordinator/streaming endpoints — imports nothing from src/ at all),
     scripts/waitForReady.ts + scripts/smokeTest.ts (CLI wrappers), deployment/deploy.sh +
     deployment/rollback.sh (validate -> build/deploy -> wait-for-ready -> smoke-test; stateless
     server means rollback is just 'redeploy a previous ref'), docs/RUNBOOK.md,
     docs/DISASTER_RECOVERY.md (makes the server's statelessness explicit — RPO/RTO reduce to
     redeploy time), docs/RELEASE_CHECKLIST.md, and docs/PRODUCTION_READINESS.md — the final
     Phase X.9 capstone, explicitly requested: Architecture readiness 8.5 -> 9/10, Production
     readiness 3 -> 7/10, every one of PRODUCTION_HARDENING_AUDIT.md's 20 original findings
     re-assessed as resolved/clarified/still-open, with authentication/authorization named
     explicitly as the single most consequential remaining gap, not softened. SELF-CAUGHT FIX:
     the architecture guard's own first run caught that rollback.sh was missing the same
     fail-fast environment validation deploy.sh already had — fixed for real consistency, not
     just to pass the test. ZERO frozen files modified — matches X.9.4's strictest-yet record.
     Docker still unavailable in this environment; what WAS verified for real: both new CLI
     scripts run live against a real server (all 6 smoke checks PASS; the negative case
     correctly reports failure with exit code 1). Unit tests, a true end-to-end integration
     test suite against a real listening socket, architecture guard — full repo suite green
     (14587 tests) — FROZEN — Phase X.9 (Production Hardening, Batches A-E) is now COMPLETE"
  - "Phase X.10 (Business Foundation: Prisma & Persistence) implemented: inspection before any
     code was written found a substantially complete, pre-existing 'Phase M1 Production Prisma
     Layer' (schema, client provider, repository interfaces/implementations, migration
     infrastructure) already covering most of the milestone's original request. USER-DIRECTED
     CORRECTION: an explicit instruction reframed the milestone as verify-and-document rather
     than greenfield build — treat the existing layer as canonical, do not duplicate, add only
     genuinely-missing infrastructure. Built: prismaTransaction.ts (withTransaction() — reuses
     getPrismaClient().$transaction() and Prisma's own Prisma.TransactionClient type),
     databaseConnectivity.ts (verifyDatabaseConnection()/waitForDatabaseReady() — reuses the
     existing RetryPolicy for backoff, same class already proven for this role in X.9.5's
     waitForReady.ts), testDatabaseBootstrap.ts (TEST_DATABASE_URL-based client factory,
     deliberately separate from the getPrismaClient() singleton), prisma/seed.ts (a real,
     runnable entrypoint seeding nothing, per CLAUDE.md's Demo Data Principles). One additive
     line to prisma.config.ts (migrations.seed registration) — the only pre-existing file
     touched. Unit tests, a real `prisma validate` migration test, TEST_DATABASE_URL-gated
     integration tests (honestly skipped — Docker/Postgres unavailable in this environment),
     architecture guard confirming zero duplication of the Phase M1 layer and zero frozen-file
     modification — full repo suite green (522 files, 14610 tests, 3 skipped, 0 failures) —
     FROZEN"
  - "Phase X.11 (Application Runtime) implemented: confirmed X.3-X.10 frozen (X.1/X.2
     deliberately excluded from that list by this milestone's own instruction). Inspection found
     src/api/reasoningRoutes.ts (X.9.1) entirely stateless (no session concept), Phase X.1's
     SessionStateManager/AdvisoryConversationMemory fully implementing lifecycle/pruning but with
     no rehydration path, and the pre-existing Storage module's module-agnostic
     AttachmentReference infrastructure as the correct reuse target for attachments. Built:
     src/conversation/infrastructure/prismaSessionRepository.ts (Conversation persistence, same
     ISessionRepository interface MemorySessionRepository already satisfies), a new additive
     ConversationSession Prisma model (sessionState/history as JSON, mirroring
     AdvisoryConversationSession's shape exactly), src/runtime/conversationSession.ts (the
     Runtime aggregate — tracks repoId and sessionId as deliberately distinct identifiers,
     matching ISessionRepository's own pre-existing design), runtimeSessionBuilder.ts
     (create/resume/persist, reuses findBySessionId() and the existing idle/archive lifecycle
     checks), runtimeContext.ts (buildRuntimeContext() — mirrors buildApplication()'s own
     composition-root pattern, composes Application wholesale), sessionAttachments.ts (reuses
     buildAttachmentReference() with moduleType='CONVERSATION_SESSION'),
     conversationEntryOrchestrator.ts (runConversationTurn() — calls the exact same frozen
     detectIntent -> reasoningPipeline.answer -> formatConversationResponse ->
     runToolCallingStage chain reasoningRoutes.ts already calls). Two small, additive extensions
     to Phase X.1 (SessionStateManager.fromState()/.addAttachmentRef(),
     AdvisoryConversationMemory.fromHistory()) — zero existing lines changed, authorized since
     X.1 was not in this milestone's own frozen list. HTTP wiring deliberately left out of scope
     (not among the eight listed deliverables). Unit tests, a real-Application integration +
     replay test suite (proves a second runConversationTurn() call resumes the same session,
     deterministically), architecture guard confirming zero frozen-file modification and
     additive-only X.1 extensions — full repo suite green (529 files, 14663 tests, 3 skipped, 0
     failures) — FROZEN"
  - "Phase X.12 (Conversation HTTP Entry Verification) implemented: per its own explicit
     instruction, inspected src/api/**, src/server/**, src/bootstrap/**, src/conversation/**,
     src/runtime/**, src/reasoning/** before assuming anything was missing (src/output/** and
     src/toolcalling/** confirmed not to exist). Found reasoningRoutes.ts (X.9.1) reaches 4 of 5
     required steps but is entirely stateless; a repo-wide grep confirmed runConversationTurn()/
     RuntimeSessionBuilder/RuntimeContext were referenced nowhere in src/api/, src/server/, or
     src/bootstrap/ before this milestone. Determination: NO complete HTTP entry existed. Built
     the smallest compatible HTTP composition root: src/api/conversationRoutes.ts (new file,
     POST /api/v1/conversation/turn, a pure request/response mapper importing ONLY
     runConversationTurn()/RuntimeContext, never the orchestrator's own internal dependencies)
     plus two additive lines in src/server/httpServer.ts (constructs one RuntimeContext,
     registers the new route — the same 'wiring only' DI carve-out X.9.2/X.9.3 already used on
     that file). Zero duplication: no second orchestration layer, no second RuntimeContext type,
     no second ConversationSession, no redesign of reasoningRoutes.ts/coordinatorRoutes.ts (both
     byte-for-byte unmodified, still work unchanged side by side with the new route). A real
     end-to-end HTTP integration test suite (Fastify inject(), not just in-process calls) proves
     a second HTTP call with the same sessionId genuinely resumes the session over real HTTP.
     PHASE_X12_HTTP_ENTRY_REPORT.md documents the full dependency graph as verified.
     Architecture guard confirming zero frozen-file modification (every src/runtime/ file, both
     pre-existing X.9.1 routes) and additive-only httpServer.ts wiring (counted, not just
     presence-checked) — full repo suite green (531 files, 14679 tests, 3 skipped, 0 failures) —
     FROZEN"
  - "Phase X.13 (Conversation Persistence Recovery & Crash Resilience) implemented: no carve-out
     this milestone (unlike every prior X.9.2-X.9.5/X.10/X.11 'wiring only' exception) -- zero
     frozen files touched, verified. Inspected conversationEntryOrchestrator.ts (X.11) and
     confirmed a crash mid-turn leaves no corrupted session but also no record a turn was
     attempted (session persist happens in one atomic call at the very end); inspected main.ts/
     gracefulShutdown.ts (X.9.1) and confirmed no carve-out exists to wire a startup scan into
     the real boot sequence. Built entirely under a new src/runtime/recovery/ subdirectory
     (invisible to X.11's own 'src/runtime/ has exactly 5 files' guard, which only lists direct
     children): recoveryTypes.ts (RecoveryMarker, isUnfinished() -- transport-agnostic
     unfinished-turn/stream detection, since no streaming conversation endpoint exists yet),
     memory/prismaRecoveryRepository.ts (IRecoveryRepository, findPending() as the recovery
     queue itself, no separate queue structure), recoverableConversationTurn.ts (the producer --
     wraps runConversationTurn() with PENDING->COMPLETED/FAILED marker bookkeeping, never
     reimplementing it), conversationRecoveryCoordinator.ts (recoverMarker() -- pending-session
     restoration IS runConversationTurn()'s own existing resume-or-create logic invoked again;
     restorePendingMarker() gives idempotent recovery execution), runtimeRecoveryManager.ts
     (runStartupRecoveryScan() -- drains the queue sequentially, delegates each marker to the
     coordinator, zero per-marker logic of its own). One new, additive
     ConversationRecoveryMarker Prisma model. scripts/recoveryScan.ts (CLI entrypoint, mirrors
     the waitForReady.ts/smokeTest.ts/seed.ts conventions exactly; verified live in this
     environment: fails cleanly with the real DATABASE_URL-missing error). TWO HONEST
     LIMITATIONS named explicitly, not glossed over: at-least-once (not exactly-once) replay
     across a crash boundary (true exactly-once needs runConversationTurn()'s session persist
     and the marker completion to share one transaction -- not achievable without modifying
     either, both frozen), and idempotency verified only for the realistic sequential-scan case,
     not concurrent scans (no optimistic-locking primitive exists on IBaseRepository, a
     pre-existing gap). DELIBERATE WIRING GAP: not invoked from main.ts's boot sequence or from
     conversationRoutes.ts's write path -- a complete, tested, but not-yet-production-wired
     capability, left for a future, separately-authorized milestone. Simulated-crash integration
     tests (new-session, existing-session-resumed, multi-marker) plus deterministic replay
     verification (same input replayed twice yields identical output; a recovered turn matches
     an uninterrupted one exactly) -- full repo suite green (537 files, 14726 tests, 3 skipped,
     0 failures) — FROZEN"
  - "Phase X.14 (Authentication, Authorization & Identity Infrastructure) implemented: inspected
     src/auth/ (Phase M1) in full before any code was written and found it to be procurement
     business logic (STANDARD_RESOURCES includes PACKAGE/CONTRACT/PAYMENT/SUPPLIER,
     PermissionConditions.maxValue is 'for procurement guards', ApprovalHierarchy/DelegationGrant
     tie to procurement approval and legal-basis requirements) rather than generic
     infrastructure -- reused the DESIGN (wildcard resource/action matching, OWN/ALL-equivalent
     scope hierarchy) without importing the business-coupled CODE, verified by the architecture
     guard that src/identity/ imports nothing from src/auth/. Built src/identity/ (10 files):
     identityTypes.ts (Principal, Claims, Role, Permission, AuthorizationDecision),
     permissionResolver.ts (4 deterministic built-in roles -- ANONYMOUS/USER/SERVICE/SYSTEM, not
     a persisted admin-editable system), authorizationEvaluator.ts, authenticationContext.ts (the
     4 identity factory functions), runtimeAuthorization.ts (wraps runConversationTurn(), X.11
     frozen, with authorization + session identity binding -- cross-session access requires ALL
     scope), toolAuthorization.ts (a ToolDecider higher-order wrapper composed as the `decider`
     option to runToolCallingStage(), X.6 frozen, zero modification), mcpAuthorization.ts (a pure
     pre-check for MCPClient.callTool(), X.7 frozen, never wraps it), routeAuthorization.ts (a
     standalone Fastify preHandler-hook builder, proven via a real Fastify instance, not the
     frozen server), sessionIdentityRepository.ts + prismaSessionIdentityRepository.ts
     (SessionIdentityBinding -- a parallel bookkeeping table alongside ConversationSession, X.11,
     mirroring X.13's ConversationRecoveryMarker pattern). One new, additive
     SessionIdentityBinding Prisma model -- no Role/Permission table, since roles/permissions are
     deterministic constants. DELIBERATE SCOPE BOUNDARIES named explicitly: not wired into
     production traffic (no route requires authorization yet), no real credential verification
     (buildUserContext() shapes a Principal, never authenticates one), minimal default MCP
     permissions (SYSTEM only). INVESTIGATION: the full-suite run first reported 3 failures, all
     execSync('npx prisma validate') migration tests (X.10/X.13/X.14) timing out under vitest's
     5000ms default against a real ~2.8s CLI spawn under 546-file parallel contention; 3
     consecutive full-suite reruns (3 -> 2 -> 0 failures, varying file each time) confirmed a
     load-timing flake, not a regression, matching the identical X.9.5-freeze precedent;
     classified pre-existing unrelated issue; fixed by extending ONLY X.14's own migration test's
     timeout to 15000ms (X.10/X.13's identical, frozen tests were not touched). Full repo suite
     green (546 files, 14803 tests, 3 skipped, 0 failures on the confirming rerun) — FROZEN"
  - "Phase X.15 (Authorization & Recovery Wiring) implemented: recovered from an interrupted
     prior session via full repository-state reconstruction (no reliance on conversation
     memory) -- PHASE_X15_IMPLEMENTATION_PLAN.md and ADR_X15_ARCHITECTURE_DECISION.md already
     existed, Step 1 (src/api/httpPrincipalResolver.ts) already committed, Steps 2-4 already
     written but uncommitted. Wired X.14's runAuthorizedConversationTurn() into
     conversationRoutes.ts's write path (authorized:false -> HTTP 403), wired an
     ISessionIdentityRepository into httpServer.ts, wired X.13's recovery SCAN (not producer)
     into deployment/deploy.sh -- zero new business logic beyond one small,
     explicitly-non-cryptographic request-to-Principal bridge (x-client-id header). MID-
     IMPLEMENTATION GOVERNANCE FINDING: the conversationRoutes.ts/httpServer.ts signature changes
     broke literal content assertions in three already-frozen architecture guards spanning three
     prior milestones (X.12, X.13, X.14) -- one root cause (an authoring-style inconsistency
     between two guard lineages; zero layering/dependency-boundary violation in any of them).
     Resolved via a formal, pre-approved Governance Exceptions process
     (X15_GOVERNANCE_IMPACT_ASSESSMENT.md's Recommendation B): GX-001 (X.12 guard), GX-002 (X.13
     guard), GX-003 (X.14 guard), each a minimal literal correction or narrowing to the
     assertion's own already-stated intent, all three formally recorded in
     ADR_X15_ARCHITECTURE_DECISION.md's revised Governance Exceptions section before any guard
     file was touched. Deliberately NOT done: recovery-producer wiring (composing it with
     authorization would require modifying a frozen file or duplicating security-sensitive
     logic, both rejected) and real credential verification (x-client-id is documented,
     explicitly, as unverified and not a credential). New dedicated X.15 architecture guard +
     real-server (not throwaway) integration test suite. Full repo suite green (549 files, 14829
     tests, 3 skipped, 0 failures across 2 consecutive confirming reruns after a first run's 2
     failures were investigated and traced to the identical, pre-existing X.10/X.13
     `execSync('npx prisma validate')` timing flake already accepted at the X.14 freeze) — FROZEN"
  - "Phase X.16 (Credential Verification) implemented: replaced httpPrincipalResolver.ts's
     unverified x-client-id signal with a real, stdlib-only HMAC bearer-token mechanism --
     X16_PROTOCOL_DECISION.md evaluated bearer-token/JWT/session-token/OIDC against ten
     dimensions each, chose stdlib-only HMAC (Option A): zero new runtime dependency, matching
     this project's 15-phase minimal-dependency discipline. Built src/api/credentialToken.ts
     (signToken()/verifyToken(), node:crypto HMAC-SHA256, timingSafeEqual() constant-time
     comparison, mandatory enforced expiry). MID-IMPLEMENTATION GOVERNANCE FINDING: adding this
     one file to src/api/ immediately broke x15-authorization-wiring-architecture.test.ts's own
     exhaustive src/api/ file-count assertion (a frozen X.15 guard) -- same class of problem as
     GX-001/002/003 (an exhaustive-snapshot assertion over something this project's convention
     treats as additively extensible) but a distinct trigger (X.16, not X.15's own wiring) and
     shape (file-count enumeration, not a call-site literal). Resolved as GX-004, formally
     documented in ADR_X15_ARCHITECTURE_DECISION.md's Governance Exceptions section -- one
     filename appended, exact array-equality preserved. A SECOND design fork was surfaced and
     resolved explicitly before implementation: wiring the signing secret into
     httpPrincipalResolver.ts could either thread it through registerConversationRoutes()'s
     parameters (mirroring X.15's own sessionIdentityRepository precedent, but requiring a
     second, foreseeable break in x12-http-entry-architecture.test.ts's GX-001-fixed literal --
     a new GX-005 -- and touching the frozen src/bootstrap/buildApplication.ts) or have
     resolvePrincipalFromRequest() read the secret itself via loadAppConfigFromEnv(), keeping
     its exact original one-parameter signature and every existing call site unchanged (Path
     B). Path B was chosen, explicitly to avoid GX-005 and any frozen-file touch -- zero new
     governance exceptions beyond GX-004 for the entire milestone. Added
     scripts/issueCredentialToken.ts (a thin CLI wrapper, not a new HTTP endpoint, which would
     need its own access control to avoid becoming a mint-any-identity hole) closing the
     issuance gap the protocol decision itself named as unscoped. New dedicated X.16
     architecture guard (13 tests) + real-server (not throwaway) integration test suite (6
     tests) proving valid/expired/tampered/absent-token behavior end to end. Full repo suite
     green (553 files, 14870 tests, 3 skipped, 0 failures, clean on the first run) — FROZEN"
  - "Phase X.17 (Docker/Postgres Live Verification) implemented: verification-only milestone,
     zero application source or test file modified. Docker Desktop installed/started outside
     this session; root-cause diagnosis performed before any implementation step -- the initial
     docker compose up failure (PostgreSQL continuously restarting) traced to a missing
     app/.env file (only .env.example/.env.template existed), resolved by copying the template
     per docker-compose.yml's own already-documented instruction; docker-compose.yml,
     prisma.config.ts, and prisma/schema.prisma all read in full and confirmed correct, no
     repository defect found. All 4 existing migrations applied live via prisma migrate deploy
     -- the first-ever live application of this repository's entire migration history. The 3
     previously-skipped TEST_DATABASE_URL-gated tests in x10-prisma-integration.test.ts passed
     for real against the live container (DATABASE_URL needed alongside TEST_DATABASE_URL,
     since withTransaction() deliberately uses the production singleton, not the test client,
     per testDatabaseBootstrap.ts's own design -- not a defect). Re-running the full suite with
     both variables globally exported surfaced 37 failures, all confirmed as by-design 'throws
     when DATABASE_URL is unset' tests, not a regression -- the default (unset) mode reproduced
     the exact pre-existing baseline. A real server process (not inject(), not a throwaway
     instance) was smoke-tested via scripts/waitForReady.ts (ready on first attempt) and
     scripts/smokeTest.ts (6/6 PASS) against the live, database-backed server. Zero defects
     found -- the conditional defect-fix step was not needed. Closes the single largest,
     longest-standing 'implemented but never run for real' gap on the platform, 8 phases deep
     (X.9.4 through X.16). Full repo suite green (553 files, 14870 tests, 3 skipped, 0 failures
     on the 3rd of 3 consecutive confirming runs -- the identical pre-existing
     execSync('npx prisma validate') timing flake first diagnosed at the X.14 freeze) — FROZEN"
  - "Phase X.18 (CI/CD Pipeline) implemented: tooling-only milestone, zero application source or
     test file modified. Added .github/workflows/ci.yml (checkout, Node 24, npm ci, tsc, the
     architecture guard suite, the full test suite via --pool=forks, an informational lint
     step), per two forks resolved up front in X18_ARCHITECTURE_DECISION.md against direct
     repository evidence: no PostgreSQL service container in CI (the 3 gated tests remain
     optional there, matching local default behavior), and ESLint informational-only, never
     blocking (477 pre-existing errors across 178 files ruled out full blocking; partial
     diff-scoped gating rejected as unfairly punishing unrelated one-line changes to
     already-flagged files). LIVE VERIFICATION CAUGHT A REAL DEFECT in the workflow's own first
     run: 30 test files failed to resolve the Prisma-generated client, since app/generated/ is
     correctly untracked and a fresh GitHub Actions checkout has none of it -- fixed with one
     new step, `npx prisma generate` (needs no DATABASE_URL, does not reopen the
     no-Postgres-in-CI decision). Also changed package.json's 'test' script to default to
     --pool=forks, protecting any local `npm test` from the jsdom-parallelism crash
     CURRENT_RELEASE.md already documents. Proved the gate blocks using real history rather than
     an artificial break -- the workflow's own first real failure, followed by its own real fix
     passing, followed by a second independent change also passing, is stronger evidence than a
     manufactured one would have been. Full repo suite green live in CI (553 files, 14870 tests,
     3 skipped, 0 failures) at the final passing commit — FROZEN — you are here"
```

Full narrative version of this sequence, with the reasoning behind each step:
[`../04_PROJECT_MEMORY/TIMELINE.md`](../04_PROJECT_MEMORY/TIMELINE.md).
