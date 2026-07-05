# Phase X.2 Implementation Strategy

**Purpose:** Describes **how** Phase X.2 (Reasoning Engine) will be built — sequencing, gating,
rollback, and failure handling. It does not restate **what** X.2 contains; that is already fixed
by [PHASE_X_EXECUTION_PLAN.md](PHASE_X_EXECUTION_PLAN.md)'s X.2 section (objective, scope, file
list, frozen interfaces, exit criteria). This document assumes that scope as given and does not
change it.

**Inputs this strategy is built from:** [PHASE_X_EXECUTION_PLAN.md](PHASE_X_EXECUTION_PLAN.md)
(X.2 scope/files/exit criteria), [PHASE_X1_POST_IMPLEMENTATION_REVIEW.md](PHASE_X1_POST_IMPLEMENTATION_REVIEW.md)
(the rehydration/composition gap X.2 will hit immediately), [AI_CONTEXT_SCHEMA.md](AI_CONTEXT_SCHEMA.md).

**Status:** Strategy only. Phase X.2 is **not authorized** by this document. No X.2 code exists.

**Does not modify code. Does not modify any other document. Does not create an ADR.**

---

## 1. Recommended Implementation Order

Deterministic-first, external-dependency-last. Each stage is provable in isolation before the
next stage depends on it, and the single non-deterministic, network-dependent piece (the live
Claude API call) is pushed to the very end so every earlier failure is cheap, local, and
instant to diagnose:

1. `src/reasoning/domain/reasoningTypes.ts` — pure types.
2. `src/reasoning/domain/intentPatternRegistry.ts` — static data, no logic.
3. `src/reasoning/application/intentDetector.ts` — pure function over the registry.
4. `src/reasoning/testing/mockKnowledgeFixtures.ts` — hand-built fixtures, needed by every stage from here on.
5. `src/reasoning/application/ruleEngine.ts` — deterministic, fixture-driven.
6. `src/reasoning/application/evidenceCollector.ts` — deterministic, fixture-driven.
7. `src/reasoning/application/citationFormatter.ts` — pure formatting.
8. `src/reasoning/application/answerComposer.ts` — deterministic composition, no LLM yet.
9. `src/reasoning/application/legalReasoningEngine.ts` — orchestrates 1–8, still fixture-only.
10. `src/ai/domain/aiTypes.ts` — `AIContext`, per AI_CONTEXT_SCHEMA.md, `Object.freeze()`-enforced.
11. `src/ai/application/tokenBudgetManager.ts` — pure, testable without an LLM.
12. `src/ai/application/aiContextBuilder.ts` — first point that reads X.1's
    `AdvisoryConversationHistory` (read-only).
13. `src/ai/application/promptBuilder.ts` / `promptRenderer.ts` — deterministic string assembly.
14. `src/ai/infrastructure/modelCapabilityRegistry.ts` / `modelSelector.ts` — static data + pure selection.
15. `src/ai/infrastructure/adapters/claudeLLMAdapter.ts` — **the only external-dependency file** in X.2.

Steps 1–14 require zero network access and zero API keys. Step 15 is the sole point where a real
external system enters the picture — everything before it is proven, so if step 15 fails, the
cause is isolated to exactly one file.

## 2. Internal Build Sequence

Build and green-test each numbered item above **before** starting the next — mirrors X.1's
one-task-at-a-time discipline (`tsc --noEmit` + targeted `vitest run` after every file). Two
internal batches, matching the execution plan's stated commit strategy:

- **Batch A (items 1–9):** the reasoning pipeline, provable entirely against
  `mockKnowledgeFixtures.ts` with no `AIContext`, no prompt, no LLM involved at all.
- **Batch B (items 10–15):** the AIContext/Prompt/LLM path, which consumes Batch A's output
  (`legalReasoningEngine`'s result) as an already-proven input.

Batch A must be fully green before Batch B begins. This is the same "prove the upstream stage in
isolation before the downstream stage depends on it" principle used throughout Phase N.

## 3. Integration Sequence with the Frozen Knowledge Platform

**None in X.2.** This is the most important sequencing decision in the whole milestone, already
fixed by the execution plan: X.2 runs entirely against `mockKnowledgeFixtures.ts`.
`IKnowledgePlatform` is not imported, not called, not referenced anywhere in X.2 code. The
architecture guard test introduced in X.1 (`conversation-architecture.test.ts`) checked
`src/conversation/`'s isolation; X.2 needs its own equivalent guard —
`reasoning-architecture.test.ts` — asserting `src/reasoning/` and `src/ai/` import nothing from
`src/knowledge/`. This test should be added in Batch A, item 4 or 5, not deferred to the end,
so it catches an accidental early import rather than discovering one at freeze time.

Wiring to the real Knowledge Platform is entirely X.3's job (`knowledgeResolver.ts` replacing
`mockKnowledgeFixtures.ts`). X.2 must be built so that swap is the *only* change X.3 needs to
make — i.e., `legalReasoningEngine.ts` should depend on an evidence-shaped input, not directly
on the fixture file's internals, so X.3 can substitute a real resolver behind the same shape.

## 4. Integration Sequence with Conversation Core (X.1)

X.1 is **consumed, never modified.** The first (and only) touch point is `aiContextBuilder.ts`
(item 12), which reads an `AdvisoryConversationHistory` to populate `AIContext`'s conversation
history field per AI_CONTEXT_SCHEMA.md.

[PHASE_X1_POST_IMPLEMENTATION_REVIEW.md](PHASE_X1_POST_IMPLEMENTATION_REVIEW.md) §2/§10 flagged
that X.1 has no way to rehydrate a manager from a persisted `AdvisoryConversationSession` — only
fresh construction. X.2 will hit this immediately at item 12. The strategy here is explicit:

- **Do not** go back and add rehydration methods to X.1's files (`sessionState.ts`,
  `conversationContext.ts`, `conversationMemory.ts`) — X.1 is frozen and none of its existing
  signatures need to change.
- **Do** build the read path as X.2-side code: `aiContextBuilder.ts` takes an already-loaded
  `AdvisoryConversationSession` (obtained via `ISessionRepository.findBySessionId()`, which
  already exists and already works) and reads its `.history.messages` directly — no manager
  rehydration is actually required for a *read-only* consumer. Rehydration is only needed if X.2
  needs to keep *mutating* a live `AdvisoryConversationMemory`/`SessionStateManager`, which it
  does not: X.2 answers one question per call and returns a result, it does not own the session
  lifecycle. Session mutation (recording activity, advancing the turn) stays a caller
  responsibility, outside X.2's file list.
- This resolves the review's flagged gap without adding any new API surface to X.1 or expanding
  X.2's already-approved file list.

## 5. Test Strategy

- **Per-stage unit tests** for every item in Batch A (deterministic, no fixtures needed beyond
  `mockKnowledgeFixtures.ts`) — same density as X.1's per-component test files.
- **One fixture-driven, no-LLM integration test** proving `legalReasoningEngine`'s full pipeline
  wiring (intent → rules → evidence → contradiction → citation → answer) produces a correctly
  structured, correctly cited result — see §12 "first end-to-end test" below.
- **`AIContext` schema test** — every field from AI_CONTEXT_SCHEMA.md present,
  `Object.freeze()` enforced (attempting to mutate throws or silently no-ops per the schema's
  own contract, not per an invented one).
- **Contradiction-detection and confidence-scoring tests** against hand-crafted conflicting-rule
  fixtures — adversarial by design, not just happy-path.
- **Exactly one live-API integration test** (the plan's named mandatory test): PRIMARY legal
  basis survives maximum token-budget compression at every model tier. This test is the only one
  in X.2 requiring network access and a real API key — isolate it (e.g., a distinct test file,
  skippable via an environment-variable guard) so the rest of the suite stays deterministic and
  runnable offline, consistent with X.1's "zero external dependencies" exit criterion carrying
  forward as the *default* posture even though X.2 as a whole can no longer claim it fully.
- **Architecture guard test** (§3) added early, not at the end.

## 6. Rollback Strategy

Same additive-only posture as X.1: X.2 introduces two new directories (`src/reasoning/`,
`src/ai/`), never modifies an existing frozen file. Two rollback granularities:

- **Batch-level rollback:** if Batch B (AIContext/Prompt/LLM) reveals a fundamental problem,
  revert Batch B's commits only. Batch A (the reasoning pipeline, fixture-proven) remains valid
  and reusable — it has no dependency on Batch B.
- **Item-level rollback:** if the live-API test (item 15) proves the compression-survival
  property fails at some model tier, that failure is isolated to `claudeLLMAdapter.ts` /
  `modelSelector.ts` — items 1–14 do not need to be touched or reverted while that is fixed.
- **Worst case:** if X.2 as a whole needs to be abandoned or substantially reworked, rollback is
  a full revert to the `phase-x.1-conversation-core` tag — X.1 remains fully valid regardless of
  how X.2 resolves, per the execution plan's existing rollback strategy.

## 7. Freeze Checkpoints

Two internal checkpoints, plus the milestone freeze — do not wait for the final freeze to
validate intermediate state:

- **Checkpoint A (end of Batch A):** reasoning pipeline fully green against
  `mockKnowledgeFixtures.ts`, architecture guard passing, full repository suite green. This is a
  safe pause point — if Batch B is delayed or blocked, Checkpoint A can be committed and left as
  a stable base without violating any exit criterion prematurely (the milestone isn't frozen yet,
  but nothing is left broken).
- **Checkpoint B (end of Batch B, pre-live-API):** `AIContext` schema implemented and
  `Object.freeze()`-enforced, prompt/model-selection path deterministic and tested, everything
  except the live-API test green.
- **Milestone freeze:** declared only once the live-API test passes at every model tier, the
  mocked-fixture end-to-end test passes, and the full repository suite (X.1's 13,760 tests plus
  X.2's own) shows zero regressions — matching the execution plan's stated freeze condition
  exactly. No partial freeze — the live-API test is not optional for declaring X.2 frozen.

## 8. Commit Strategy

One commit per file/stage, full `tsc --noEmit` + relevant `vitest run --pool=forks` gate before
each, mirroring X.1's discipline exactly:

- Items 1–9 (Batch A): up to 9 commits, reasoning-pipeline-stage granularity.
- Item added in §3 (architecture guard): its own commit, placed early in Batch A's sequence.
- Items 10–14 (Batch B, deterministic): up to 5 commits.
- Item 15 (`claudeLLMAdapter.ts` + the live-API test): its own final commit, run separately since
  it is the only commit requiring network access — do not bundle it with a deterministic item.
- A final docs commit (execution-plan-referenced status update) is out of scope for this
  strategy document to pre-authorize; it follows whatever governance step is used to declare the
  freeze, same as X.1's pattern.

## 9. Failure Scenarios

- **Missing/invalid Claude API key in dev or CI:** the live-API test must fail loudly and
  distinctly from a logic failure (e.g., a distinguishable error/skip), never silently pass or
  silently no-op. It must not block the rest of the suite from running.
- **LLM response non-determinism causing flaky assertions:** mitigated structurally — the
  mocked-fixture wiring test (§12) never touches a real LLM, so pipeline-wiring correctness is
  never subject to LLM variance. The live-API test asserts one narrow, structural property
  (citation survival under compression), not a broad match against LLM prose.
- **Token-budget compression silently drops the PRIMARY citation:** this is the named exit
  criterion itself — a failure here blocks freeze outright, by design, no partial credit.
- **`ModelSelector` falls back to a lower-quality model silently:** every fallback event must be
  observable in test output (even a `console.warn`, full structured logging is X.7's job) —
  silent fallback is treated as a test failure, not an acceptable degradation.
- **Contradiction detector false-negative/false-positive:** caught only by hand-crafted
  adversarial fixtures with known-correct expected outcomes — this is why that fixture set is a
  required test artifact, not an afterthought.
- **Accidental `src/knowledge/` import creeping into `src/reasoning/` or `src/ai/`:** caught
  immediately by the architecture guard test added early in Batch A (§3), not discovered at
  freeze time.
- **Accidental edit to a `src/conversation/` file while wiring §4's integration:** prevented by
  policy (X.2 only reads via the existing `ISessionRepository.findBySessionId()`, never edits
  X.1 source) and is checkable via `git diff` scope before each commit, same discipline as X.1.
- **Live-API test cost/rate-limit pressure:** run it sparingly — once per verification pass, not
  on every local `tsc`/lint loop — and keep it to the single mandatory assertion rather than a
  battery of live calls; broader live-model regression testing is explicitly X.7's job (Golden
  Question harness), not X.2's.

## 10. Performance Validation Strategy

X.2 does not carry a performance SLA — that is X.7's exit criterion. What X.2 must do:

- The compression-survival test should exercise **every model tier**, not just one, since the
  exit criterion explicitly says "at every model tier" — this is a correctness check with a
  performance-adjacent shape (behavior under a resource constraint), not a load test.
- Record the live-API call's wall-clock latency in test output as an informational baseline for
  X.7 to later turn into an actual SLA — do not assert a hard latency bound in X.2, since no SLA
  has been defined yet.
- Do **not** build caching, batching, or rate limiting as a shortcut to make the live-API test
  fast or cheap — that is explicitly X.7 scope (`knowledgeResolverCache.ts`, `rateLimiter.ts`).
  Building it early inside X.2 would quietly start X.7 without its own freeze checkpoint.

## 11. What Absolutely Must NOT Be Implemented in X.2

- No import of, or call to, anything under `src/knowledge/`, including `IKnowledgePlatform` —
  that is X.3's exclusive concern, structurally enforced by the architecture guard test (§3).
- No MCP / tool-calling code (`src/mcp/`) — X.5, contingent on a separate approval event.
- No multi-agent orchestration (`src/reasoning/orchestration/`) — X.6, contingent on X.5 first.
- No caching, rate limiting, cost tracking, or observability infrastructure — all X.7, per §10.
- No modification of any file under `src/conversation/` — X.1 is frozen; consumption only.
- No ADR-DRAFT-X01 ratification work — that is a prerequisite gate for X.3, not X.2's concern,
  since X.2 never calls `IKnowledgePlatform` and therefore never needs it.
- No Golden Question dataset population — already classified as an intentionally deferred,
  non-blocking future deliverable (per the prior documentation governance decision); X.2's own
  fixture sets (mocked knowledge, adversarial contradiction cases) are a separate, smaller,
  in-scope artifact and should not be conflated with the Golden Question corpus.
- No production hardening beyond `ILLMAdapter`'s basic contract (no custom retry/backoff layer,
  no circuit breaker) — that is X.7's job.

## 12. Exit Criteria

Restated here only to anchor how they will be verified (already fixed by the execution plan, not
redefined by this document):

- Mocked-fixture, no-LLM pipeline test green (the first end-to-end test, below).
- Live-Claude integration test green: PRIMARY legal basis survives maximum token-budget
  compression at every model tier (the milestone's one named mandatory test).
- `AIContext` implemented exactly per AI_CONTEXT_SCHEMA.md, `Object.freeze()`-enforced.
- Architecture guard test (`src/reasoning/`, `src/ai/` import nothing from `src/knowledge/`)
  passing.
- Full repository suite green, zero regressions against X.1's 13,760-test baseline.
- No file under `src/conversation/` modified — verified by `git diff` scope check before freeze,
  same as X.1's own freeze-checkpoint discipline.

---

## Explicitly Identified Starting Points

**Smallest first coding task:** `src/reasoning/domain/reasoningTypes.ts` — pure types only, no
logic, no imports beyond nothing (a self-contained domain file), one construction test. Exact
mirror of X.1's own safest-first-task pattern (`conversationTypes.ts`).

**First integration task:** `aiContextBuilder.ts` reading an already-loaded
`AdvisoryConversationSession.history.messages` (via the existing, unmodified
`ISessionRepository.findBySessionId()`) to populate `AIContext`'s conversation-history field.
This is the first and only point X.2 touches X.1, and it requires no new API surface on either
side (§4) — a pure read, no rehydration, no mutation.

**First end-to-end test:** a fixture-driven, no-LLM test of `legalReasoningEngine.ts`'s full
pipeline — a hand-crafted mocked-knowledge question runs through intent detection → rule
evaluation → evidence collection → contradiction detection → citation formatting → answer
composition, using `mockKnowledgeFixtures.ts` and a stub `ILLMAdapter` (a canned response, not a
real Claude call) — proving the pipeline's wiring is correct before the one live-API test (§12)
is ever run. This ordering means the very first end-to-end proof point requires no network
access, no API key, and no non-determinism.

---

## Would This Strategy Change If X.1 Had Been Designed Differently?

Not asked by this document's brief, but worth one line for continuity: this strategy only works
cleanly because X.1's domain types are immutable, read-only-friendly value objects (§4) — had
X.1 exposed only mutable, encapsulated managers with no way to read a plain snapshot, X.2's first
integration task would have needed new X.1-side read methods instead of reusing
`findBySessionId()`. It doesn't, so it doesn't.
