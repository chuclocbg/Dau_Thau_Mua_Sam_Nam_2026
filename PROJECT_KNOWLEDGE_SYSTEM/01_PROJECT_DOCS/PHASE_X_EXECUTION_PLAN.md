# Phase X Execution Plan

**Purpose:** The concrete, milestone-by-milestone execution plan for implementing Phase X —
produced before any Phase X source code is written. This document sequences and scopes the
already-approved architecture ([AI Advisory Architecture](AI_ADVISORY_ARCHITECTURE.md)); it
does not change that architecture.

**Audience:** Whoever implements Phase X, milestone by milestone.

**Dependencies:** [AI Advisory Architecture](AI_ADVISORY_ARCHITECTURE.md), [Phase X ADR Draft 001](PHASE_X_ADR_DRAFT_001.md),
[AIContext Schema](AI_CONTEXT_SCHEMA.md), [Golden Question Methodology](GOLDEN_QUESTION_METHODOLOGY.md),
[`../02_AI_CONTEXT/ARCHITECTURE_CONSTRAINTS.md`](../02_AI_CONTEXT/ARCHITECTURE_CONSTRAINTS.md).

**Status:** PLAN ONLY. No Phase X code exists. This document does not begin Phase X — it
prepares for it.

**Related:** [`../02_AI_CONTEXT/NEXT_APPROVED_PHASE.md`](../02_AI_CONTEXT/NEXT_APPROVED_PHASE.md) · [`../02_AI_CONTEXT/FREEZE_STATUS.md`](../02_AI_CONTEXT/FREEZE_STATUS.md) · [Development Guide](DEVELOPMENT_GUIDE.md)

---

## Table of Contents

1. [A Note on This Plan's Milestone Numbering](#a-note-on-this-plans-milestone-numbering)
2. [X.1 — Conversation Core](#x1--conversation-core)
3. [X.2 — Reasoning Engine](#x2--reasoning-engine)
4. [X.3 — Knowledge Resolution](#x3--knowledge-resolution)
5. [X.4 — Output Validation](#x4--output-validation)
6. [X.5 — Tool Calling](#x5--tool-calling)
7. [X.6 — Multi-Agent](#x6--multi-agent)
8. [X.7 — Performance & Production Hardening](#x7--performance--production-hardening)
9. [Implementation Risks](#implementation-risks)
10. [Rollback Strategy](#rollback-strategy)
11. [Technical Debt Intentionally Deferred](#technical-debt-intentionally-deferred)

---

## A Note on This Plan's Milestone Numbering

This 7-milestone breakdown (X.1–X.7) is an **execution-sequencing view**, not a new
architecture. It reorganizes the same components already specified in
[AI Advisory Architecture](AI_ADVISORY_ARCHITECTURE.md) into a leaner delivery structure.
Two sequencing decisions are made explicit here because they aren't obvious from the milestone
names alone:

- **X.2 (Reasoning Engine) is built and fully tested against mocked `KnowledgeContext`/
  `KnowledgeItem` fixtures — not the real, frozen Knowledge Platform.** X.3 (Knowledge
  Resolution) is what wires the already-proven reasoning logic to the real
  `IKnowledgePlatform`. This ordering means the frozen platform is never touched until the
  reasoning logic calling it has already been validated in isolation — the safest possible
  sequencing for code that must interact with frozen, unmodifiable interfaces.
- **The AIContext Builder, Prompt Engine, and LLM Adapters (previously separate milestones in
  the original 10-part breakdown) are absorbed into X.2's scope**, since they form one
  continuous path from reasoning result to LLM call. X.4 (Output Validation) begins exactly
  where the LLM's response comes back.

## X.1 — Conversation Core

**Objective:** Session-scoped conversation state management — no LLM, no reasoning, no
Knowledge Platform dependency.

**Scope:** `ConversationContext`, `SessionState`, `ConversationHistory`, `ConversationMemory`
(token-budget pruning), per [AI Advisory Architecture §4](AI_ADVISORY_ARCHITECTURE.md).

**Files expected to change (all new):**
```
src/conversation/domain/conversationTypes.ts
src/conversation/application/conversationContext.ts
src/conversation/application/sessionState.ts
src/conversation/application/conversationMemory.ts
src/conversation/infrastructure/memorySessionRepository.ts   (memory-first, per project convention)
```

**Frozen interfaces that must remain untouched:** None directly — this milestone has zero
dependency on any frozen module. (General rule still applies: nothing in `app/src/` outside
`src/conversation/` may be modified.)

**Exit criteria:** Session lifecycle (create → active → idle → archive) fully tested;
`ConversationMemory` pruning verified to keep the 2-most-recent-turn floor under maximum
pressure; zero external dependencies required to run the test suite.

**Test requirements:** Unit tests only — deterministic, no mocked services needed. Architecture
test confirming `src/conversation/` imports nothing from `src/knowledge/` or `src/reasoning/`.

**Expected git commit strategy:** One commit per component (`conversationTypes`,
`conversationContext`, `sessionState`, `conversationMemory`, `memorySessionRepository`), mirroring
Phase N's one-module-per-commit discipline — 4-5 commits, each independently green.

**Freeze checkpoint:** Declared once all tests pass and no code outside `src/conversation/` was
touched. Can be built and frozen **now** — no blocker, no ratification pending.

## X.2 — Reasoning Engine

**Objective:** The 10-stage reasoning pipeline plus the AIContext/Prompt/LLM path, proven
end-to-end using mocked knowledge inputs — a fully working single-advisor answer, without
touching the real Knowledge Platform.

**Scope:** Intent Detection → Question Classification → Reasoning Chain → Rule Evaluation →
Evidence Ranking → Contradiction Detection → Citation Formatting → Answer Synthesis →
Self-Critique → `AIContextBuilder` → `PromptBuilder`/`PromptRenderer` → `ILLMAdapter`
(`ClaudeLLMAdapter` first, per the existing recommendation).

**Files expected to change (all new):**
```
src/reasoning/domain/reasoningTypes.ts
src/reasoning/domain/intentPatternRegistry.ts
src/reasoning/application/intentDetector.ts
src/reasoning/application/reasoningEngine.ts
src/reasoning/application/ruleEngine.ts
src/reasoning/application/evidenceCollector.ts
src/reasoning/application/citationFormatter.ts
src/reasoning/application/answerComposer.ts
src/reasoning/application/legalReasoningEngine.ts   (orchestrates all stages)
src/reasoning/testing/mockKnowledgeFixtures.ts       (X.2-only — deleted or superseded at X.3)
src/ai/domain/aiTypes.ts                             (AIContext, per AI_CONTEXT_SCHEMA.md)
src/ai/application/aiContextBuilder.ts
src/ai/application/tokenBudgetManager.ts
src/ai/application/promptBuilder.ts
src/ai/application/promptRenderer.ts
src/ai/infrastructure/adapters/claudeLLMAdapter.ts
src/ai/infrastructure/modelCapabilityRegistry.ts
src/ai/infrastructure/modelSelector.ts
```

**Frozen interfaces that must remain untouched:** None yet directly called — `knowledgeResolver.ts`
does not exist until X.3, so nothing in `src/knowledge/` is imported here. `src/conversation/`
(X.1) is consumed, not modified.

**Exit criteria:** A hand-crafted mocked-knowledge question produces a correctly-cited,
correctly-confidence-scored answer through a real (sandboxed) Claude API call. The
`AIContext` schema (per [AI_CONTEXT_SCHEMA.md](AI_CONTEXT_SCHEMA.md)) is implemented exactly as
specified, `Object.freeze()`-enforced. The single mandatory test: **PRIMARY legal basis
survives maximum token-budget compression at every model tier.**

**Test requirements:** Unit tests per stage (deterministic). Integration test for the full
pipeline against fixtures. One live-API integration test (the first milestone requiring a real
external dependency). Contradiction-detection and confidence-scoring tests against hand-crafted
conflicting-rule fixtures.

**Expected git commit strategy:** Reasoning pipeline stages as one batch of commits (mirrors
Phase N's provider-batch pattern); AIContext/Prompt/LLM-Adapter path as a second batch. Full
`vitest run --pool=forks` gate before each commit, per [Development Guide](DEVELOPMENT_GUIDE.md).

**Freeze checkpoint:** Declared once the mocked-fixture end-to-end test and the live-Claude
integration test both pass, and the compression test holds at every model tier. **Does not
require** ADR-DRAFT-X01 ratification (that's X.3's concern) — X.2 never calls
`IKnowledgePlatform`.

## X.3 — Knowledge Resolution

**Objective:** Wire the already-proven X.2 reasoning pipeline to the real, frozen Knowledge
Platform, replacing mocked fixtures with `KnowledgeResolver`.

**Scope:** `KnowledgeResolver` — the **only** file permitted to call `IKnowledgePlatform`
(Constraint C-06) — implementing [ADR-DRAFT-X01](PHASE_X_ADR_DRAFT_001.md)'s resolution
(`searchKnowledge()` for text+limit needs, `resolveX(context, asOfDate)` for rule-based needs).

**Files expected to change (all new):**
```
src/reasoning/application/knowledgeResolver.ts
src/reasoning/integration/reasoningIntegration.ts   (the one bridge file allowed to import
                                                       src/legal/, src/procurement/, etc. if
                                                       any non-Knowledge-Platform context is needed)
```
*(`src/reasoning/testing/mockKnowledgeFixtures.ts` from X.2 is retired — real resolution
replaces it; X.2's other files are otherwise untouched.)*

**Frozen interfaces that must remain untouched:** `IKnowledgePlatform` and all 16 providers
(Phase N, frozen) — **read-only consumption via `searchKnowledge()`/`resolveX()` only, zero
modification, zero new methods added.** This is the single highest-stakes boundary in the
entire Phase X plan.

**Exit criteria:** ADR-DRAFT-X01 formally ratified into `app/.memory/decision-index.md` (a
prerequisite, not a deliverable of this milestone — see
[`../02_AI_CONTEXT/NEXT_APPROVED_PHASE.md`](../02_AI_CONTEXT/NEXT_APPROVED_PHASE.md)). A real
question resolves correctly against the actual (memory-backed) Knowledge Platform. The
architecture test asserting "only `knowledgeResolver.ts` imports `src/knowledge/`" passes.

**Test requirements:** Integration test against a real (memory-backed) `IKnowledgePlatform`
instance — the exact pattern already proven in Phase N's own integration test suites. A
regression test proving `searchKnowledge()` is called with the correct domain filter and limit
for every intent type needing ranked retrieval (per ADR-DRAFT-X01's consequence). Architecture
test enforcing the sole-caller rule.

**Expected git commit strategy:** One commit for `knowledgeResolver.ts` + its tests, one commit
for the architecture-enforcement test/tooling, one commit removing the retired mock fixtures.

**Freeze checkpoint:** Declared once `KnowledgeResolver` is the sole caller of
`IKnowledgePlatform` (structurally enforced, not just conventionally true) and the full
repository suite (Phase A-N's 13,721+ tests plus X.1-X.3's own) passes with zero regressions.

## X.4 — Output Validation

**Objective:** The governed boundary between raw LLM output and what a user ever sees.

**Scope:** `OutputValidator`'s 6 checks — citation integrity, numeric consistency, decision
contradiction, language compliance, response completeness, forbidden-pattern detection.

**Files expected to change (all new):**
```
src/ai/validation/outputValidator.ts
src/ai/validation/citationIntegrityCheck.ts
src/ai/validation/numericConsistencyCheck.ts
src/ai/validation/decisionContradictionCheck.ts
src/ai/validation/languageComplianceCheck.ts
src/ai/validation/completenessCheck.ts
src/ai/validation/forbiddenPatternCheck.ts
```

**Frozen interfaces that must remain untouched:** `AIContext` (frozen at the end of X.2) —
`OutputValidator` reads it, never mutates it. No Knowledge Platform or Conversation Core files
touched.

**Exit criteria:** **100% catch rate, zero exceptions**, against a hand-crafted adversarial
fixture set (hallucinated citations, numeric drift, decision contradictions, truncated
responses, forbidden-pattern violations) before this milestone may freeze — no partial credit,
per the original AI safety design.

**Test requirements:** The adversarial fixture suite is the primary artifact of this milestone
— it should be built *as* the test requirement, not as an afterthought. Golden Question fixtures
(per [Golden Question Methodology](GOLDEN_QUESTION_METHODOLOGY.md)) begin here as a
regression check that validation doesn't over-trigger on legitimate answers.

**Expected git commit strategy:** One commit per check (6 commits), each accompanied by its own
adversarial fixture subset, then one integration commit wiring all 6 into `OutputValidator`'s
combined result.

**Freeze checkpoint:** Declared only after the adversarial suite hits 100% catch rate. This is
the one milestone in the entire plan where "good enough" is explicitly not an acceptable
freeze bar.

## X.5 — Tool Calling

**Objective:** Registration-only external tool invocation, gated behind proven production need
(per the already-accepted decision, [Rejected Designs](../04_PROJECT_MEMORY/REJECTED_DESIGNS.md)).

**Scope:** `MCPGateway`, `MCPToolRegistry`, `IMCPTool`, permission/timeout/retry, mirroring
`ProviderRegistry`'s proven pattern.

**Files expected to change (all new, only if/when this milestone is explicitly authorized):**
```
src/mcp/domain/mcpTypes.ts             (IMCPTool, MCPExecutionContext, MCPToolResult)
src/mcp/application/mcpToolRegistry.ts
src/mcp/application/mcpGateway.ts
src/mcp/integration/authPermissionBridge.ts   (delegates to the existing, frozen src/auth/)
```
*(Deliberately not `src/agents/` — that directory already holds 55 pre-existing, unrelated
files from a different commit track; a new, distinctly-named `src/mcp/` avoids repeating a
known naming collision.)*

**Frozen interfaces that must remain untouched:** `src/auth/authorizationService.ts` (consumed
via `IPermissionChecker`, never modified) — permissions delegate to the existing frozen Auth
module, no parallel permission system.

**Exit criteria:** First 1-2 real tools registered and invoked successfully with correct
permission enforcement, timeout, and retry behavior — matching the exact pattern already proven
by `ProviderRegistry`.

**Test requirements:** Permission-check tests (allow/deny), timeout tests, retry-policy tests
(reusing the `RetryPolicy` shape already specified for `ILLMAdapter`). Duplicate-`toolId`
rejection test (same discipline as `ProviderRegistry`'s duplicate-domain rejection).

**Expected git commit strategy:** Registry + Gateway as one commit, first real tool as a
second, mirroring how Knowledge Platform's Stage 1 (core) preceded its first real providers.

**Freeze checkpoint:** **Not authorized to begin until X.1-X.4 are in production and real usage
data justifies it** — this milestone's freeze checkpoint is contingent on an explicit human
approval event, not a technical completion criterion alone.

## X.6 — Multi-Agent

**Objective:** Deterministic multi-step orchestration for genuinely multi-domain questions,
gated behind proven need from X.5.

**Scope:** Coordinator → Planner → Retriever → Researcher → Reviewer → Critic → Formatter, with
**exactly one LLM call** for final synthesis regardless of sub-question count (Constraint C-08,
non-negotiable).

**Files expected to change (all new, only if/when this milestone is explicitly authorized):**
```
src/reasoning/orchestration/coordinator.ts
src/reasoning/orchestration/planner.ts
src/reasoning/orchestration/researcher.ts
src/reasoning/orchestration/reviewer.ts
src/reasoning/orchestration/critic.ts
```
*(Placed under `src/reasoning/orchestration/`, not `src/agents/`, for the same naming-collision
reason as X.5. `Retriever` and `Formatter` are not new files — they reuse `knowledgeResolver.ts`
and the existing `ResponseFormatter` respectively, per the accepted design.)*

**Frozen interfaces that must remain untouched:** Everything already frozen through X.4,
unchanged. `AIContext`, `IKnowledgePlatform`, and the single-LLM-call constraint are the three
non-negotiable boundaries this milestone must never cross.

**Exit criteria:** One genuinely multi-domain question (Executive-Advisor-shaped) resolved
correctly end-to-end with the same citation/validation guarantees as the single-advisor flow —
proving the multi-agent path doesn't weaken any safety property already established.

**Test requirements:** A test proving exactly one LLM call occurs regardless of sub-question
count (the single most important test in this milestone). Cross-sub-question contradiction
tests (distinct from within-chain contradiction detection in X.2).

**Expected git commit strategy:** One commit per orchestration role, then one integration
commit proving the full sequence against a real multi-domain golden question.

**Freeze checkpoint:** **Not authorized to begin until X.5's tool-calling reveals a genuine
decomposition need** — same contingent-on-approval pattern as X.5, per the accepted "gated
behind proven need" decision.

## X.7 — Performance & Production Hardening

**Objective:** Everything deferred as "acceptable for correctness-first development, not
acceptable for production" across every prior milestone — consolidated into one explicit
hardening pass rather than left as scattered, easy-to-forget follow-ups.

**Scope:** Caching (`KnowledgeResolver`-scoped, never bypassing it), Knowledge Platform
indexing readiness (coordinating with Phase N.5 if it hasn't landed yet), rate limiting on LLM
calls, per-session/per-day cost caps, load testing, observability (logging/tracing/metrics —
scored 2/10 repo-wide per the original architecture review, never yet addressed), and a
formal Golden Question evaluation harness running on every release.

**Files expected to change (all new):**
```
src/ai/infrastructure/rateLimiter.ts
src/ai/infrastructure/costTracker.ts
src/reasoning/application/knowledgeResolverCache.ts   (sits behind KnowledgeResolver, never beside it)
src/observability/reasoningTracing.ts
tests/performance/reasoningLoadTest.ts
tests/golden-questions/                                (populated per Golden Question Methodology)
```

**Frozen interfaces that must remain untouched:** All of them — this milestone is purely
additive hardening around already-frozen X.1-X.6 boundaries; if a "hardening" change requires
touching a frozen interface, that is a signal the change belongs in a new ADR, not this
milestone.

**Exit criteria:** A defined latency/cost/throughput SLA is met under load test; the Golden
Question harness runs on every release with a defined pass-rate threshold; cost caps prevent
runaway spend (tested by simulating a cap breach, not just asserting the code exists).

**Test requirements:** Load tests (new category for this repository — none exist elsewhere).
Golden Question regression suite, populated per domain (per
[Golden Question Methodology](GOLDEN_QUESTION_METHODOLOGY.md)). Cost-cap breach simulation.

**Expected git commit strategy:** One commit per hardening concern (caching, rate limiting,
cost tracking, observability, load tests, golden questions) — deliberately granular, since each
is independently valuable and independently revertible.

**Freeze checkpoint:** Declared once every prior milestone's known "acceptable for now, not for
production" gap (see [Implementation Risks](#implementation-risks) below) is either closed here
or explicitly re-deferred with a stated reason — this milestone is the last checkpoint before
Phase X can be called production-ready as a whole.

---

## Implementation Risks

**Critical:** Frozen `IKnowledgePlatform` accidentally modified during X.3 — mitigated by the
architecture test enforcing sole-caller status and by X.2's mocked-fixture sequencing keeping
the platform untouched until X.3 explicitly. Hallucinated citation reaching a user — mitigated
by X.4's 100%-catch-rate freeze bar, no partial credit accepted. ADR-DRAFT-X01 not ratified
before X.3 begins — mitigated by stating it as an explicit exit-criterion prerequisite, not an
assumption.

**High:** Token-budget compression silently dropping a PRIMARY citation — mitigated by the one
named mandatory test in X.2. `ModelSelector` fallback silently picking a lower-quality model —
mitigate by logging every fallback event loudly (X.7 observability). X.6 built before X.5
reveals genuine need — mitigated by the explicit contingent-on-approval freeze checkpoints on
both X.5 and X.6.

**Medium:** Naming collisions with the pre-existing `src/agents/`/`src/legal/`/`src/knowledge/`
tracks — mitigated by the explicit `src/mcp/` and `src/reasoning/orchestration/` naming choices
in X.5/X.6, chosen specifically to avoid repeating a known collision pattern. Cost overrun
before X.7's caps exist — mitigated by keeping X.7's cost-cap work as early in that milestone
as practical, not saved for last.

## Rollback Strategy

Every Phase X milestone is **purely additive** — new directories (`src/conversation/`,
`src/reasoning/`, `src/ai/`, `src/mcp/`), never a modification to any existing frozen file.
This gives an unusually clean rollback story:

- **Per-milestone rollback:** delete or `git revert` the commits for that milestone's new
  directory. No frozen code was ever touched, so there is nothing to "undo" elsewhere.
- **Per-freeze-checkpoint rollback point:** each milestone's freeze checkpoint is a natural git
  tag candidate (mirroring `knowledge-system-v1.0`/`v1.1`'s pattern) — rolling back to the prior
  milestone's tag is always safe and always leaves a fully working, tested state behind.
- **Worst case:** if X.3 (Knowledge Resolution) reveals a fundamental problem with
  ADR-DRAFT-X01's approach, rollback is reverting to the end of X.2's freeze checkpoint — X.1
  and X.2 remain fully valid and reusable regardless of how X.3 resolves.

## Technical Debt Intentionally Deferred

Carried forward from the existing review cycle, restated here in execution-plan context rather
than re-derived:

- Full itemized Phase X risk register (top-30/top-50) — not persisted as a standalone
  artifact; this plan's own Implementation Risks section is the current operative version.
- ADR-X02 through ADR-X07 — remain condensed summaries in
  [`../04_PROJECT_MEMORY/DECISION_HISTORY.md`](../04_PROJECT_MEMORY/DECISION_HISTORY.md) and
  [`REJECTED_DESIGNS.md`](../04_PROJECT_MEMORY/REJECTED_DESIGNS.md) — per the prior governance
  decision, explicitly non-blocking for X.1, and now also confirmed non-blocking for X.2-X.4
  (none of their subject matter — AIContext contract, ConversationContext lifecycle,
  KnowledgeResolver interaction, human review threshold, confidence model, citation model — is
  a stated gate on any exit criterion above; each is already reflected in this plan's scope
  descriptions even without a formal ADR file).
- Knowledge Platform indexing (Phase N.5) — X.7 coordinates with it if available but does not
  block on it; `KnowledgeResolver`'s own caching (X.7) is designed to mask unindexed-repository
  latency in the interim.
- The 470-problem repo-wide ESLint gap — unchanged, not a Phase X concern specifically.
