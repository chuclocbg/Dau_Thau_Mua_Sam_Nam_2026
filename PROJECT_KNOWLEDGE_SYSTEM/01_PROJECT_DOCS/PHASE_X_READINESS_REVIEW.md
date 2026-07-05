# Phase X.1 Implementation Readiness Review

**Purpose:** A final, independent check of whether Phase X.1 (Conversation Core) is genuinely
ready to begin — performed before any Phase X source code is written.

**Audience:** Whoever is about to start implementing X.1.

**Dependencies:** [Phase X Execution Plan](PHASE_X_EXECUTION_PLAN.md), [AI Advisory Architecture](AI_ADVISORY_ARCHITECTURE.md).

**Status:** Review complete. Not an implementation artifact — no code, no architecture change,
no ADR resulted from this review.

**Related:** [`../02_AI_CONTEXT/FREEZE_STATUS.md`](../02_AI_CONTEXT/FREEZE_STATUS.md) · [`../02_AI_CONTEXT/ARCHITECTURE_CONSTRAINTS.md`](../02_AI_CONTEXT/ARCHITECTURE_CONSTRAINTS.md) · [`../02_AI_CONTEXT/NEXT_APPROVED_PHASE.md`](../02_AI_CONTEXT/NEXT_APPROVED_PHASE.md)

---

## Table of Contents

1. [Scope Validation](#1-scope-validation)
2. [Frozen Architecture Validation](#2-frozen-architecture-validation)
3. [Dependency Validation](#3-dependency-validation)
4. [Repository Impact](#4-repository-impact)
5. [Test Readiness](#5-test-readiness)
6. [Git Strategy](#6-git-strategy)
7. [Risks](#7-risks)
8. [GO / NO-GO Decision](#8-go--no-go-decision)

---

## 1. Scope Validation

**Does X.1 stay within its approved scope?** Yes. Per [Phase X Execution Plan §X.1](PHASE_X_EXECUTION_PLAN.md#x1--conversation-core),
the scope is exactly `ConversationContext`, `SessionState`, `ConversationHistory`,
`ConversationMemory` — pure state management, no LLM, no reasoning, no Knowledge Platform call.
Every proposed file (`conversationTypes.ts`, `conversationContext.ts`, `sessionState.ts`,
`conversationMemory.ts`, `memorySessionRepository.ts`) serves this scope directly.

**Hidden scope creep found — two items requiring an explicit decision before coding starts:**

1. **`ToolCalls`** was named as one of the 5 Conversation Engine components in
   [AI Advisory Architecture §4](AI_ADVISORY_ARCHITECTURE.md#4-conversation-engine), but is
   **not** in X.1's file list in the Execution Plan. This is not an oversight to silently
   resolve either way — it needs a stated decision: build `SessionState.toolCalls` now as an
   always-empty placeholder field, or add it additively when X.5 (Tool Calling) lands.
   **Recommendation: defer it.** An optional field added later is a non-breaking, additive
   change (consistent with the `AIContext` additive-field discipline already established) —
   building it now would be speculative scope for a capability that may never ship (X.5 is
   itself gated behind proven need).
2. **`ConversationHistory`'s message shape.** The original design describes conversation
   messages using `AIContextMessage` (`{ messageId, role, content, timestamp, tokenCount,
   contextId? }`) — but that type belongs to `src/ai/domain/aiTypes.ts`, which is X.2's scope
   and does not exist yet. X.1 cannot import a type from a module that hasn't been built.
   **This is a real dependency-ordering issue, not just a naming detail.** X.1 must define its
   own local message type (e.g., `ConversationMessage`) with the same shape; X.2, when built,
   either reuses it directly or maps it into `AIContextMessage`. The dependency direction must
   be **X.2 depends on X.1's types, never the reverse** — this should be stated explicitly in
   X.1's own type definitions (a one-line comment is sufficient), not left implicit.

Neither item blocks X.1 — both are resolvable by a documented choice made at implementation
time, not by new design work.

## 2. Frozen Architecture Validation

**Every frozen interface X.1 depends on:**

| Interface | Frozen since | How X.1 uses it |
|---|---|---|
| `IBaseRepository<T>` (`src/shared/repository/IBaseRepository.ts`) | Phase H.5 | `memorySessionRepository.ts` implements it, following the exact convention every other module's memory repository already uses |

**That is the only frozen interface X.1 touches.** X.1 does not call `IKnowledgePlatform`, any
of the 16 Knowledge Platform providers, or any of the 13 business/3 infrastructure modules.

**Confirmed: none require modification.** `IBaseRepository` is a generic interface; X.1
implements it for a new entity type (`ConversationSession`), exactly as every prior module has
done for its own entities. Zero changes to the interface itself.

## 3. Dependency Validation

**Required modules:**
- `src/shared/repository/IBaseRepository.ts` (frozen, imported only)

**Optional modules (referenced by field shape, not by import):**
- `src/storage/` — `SessionState.attachmentRefs` stores opaque Storage-module reference IDs
  (`string[]`) but X.1 never calls Storage module code directly.
- Future `AdvisorProfile` (X.2+) — `SessionState.advisorHistory` stores advisor ID strings, not
  the `AdvisorProfile` type itself — no import needed.

**Deferred modules (explicitly zero dependency, confirmed by design):**
- `src/knowledge/` (Knowledge Platform, frozen) — correctly deferred to X.3.
- `src/reasoning/`, `src/ai/`, `src/mcp/` — do not exist yet; X.1 must not anticipate their
  shapes beyond the message-type note in §1.

## 4. Repository Impact

**Exact folders expected to change:**
```
src/conversation/                — new, all of X.1's implementation
src/__tests__/                   — new test files only (conversation-*.test.ts), following
                                    the established naming convention, in the correct
                                    directory (NOT src/tests/, a different pre-existing folder)
```

**Exact folders that MUST remain untouched:**
```
src/legal/, src/masterdata/, src/procurement/, src/approval/, src/contract/, src/acceptance/,
src/shared/, src/payment/, src/auth/, src/storage/, src/notification/, src/knowledge/
  — all 13 business + 3 infrastructure modules + the Knowledge Platform, per
    ../02_AI_CONTEXT/FREEZE_STATUS.md, exhaustive and non-negotiable

src/agents/, src/orchestrator/, src/memory/, src/capabilities/
  — the pre-existing, unrelated commit track. Not "frozen" in the Phase N sense, but explicitly
    out of scope and never audited as part of this project's own work — do not touch, do not
    assume stable, do not import from.
```

## 5. Test Readiness

**Existing tests available:** None specific to Conversation Core — this is greenfield. The
*pattern* to follow is abundant (every other module's `memory<Module>Repositories.test.ts`
provides a template for `memorySessionRepository.ts`'s own tests).

**Missing tests:** Everything — session lifecycle transitions (create/active/idle/archive),
`ConversationMemory` pruning under token pressure, the 2-most-recent-turn floor. All expected
to be net-new, consistent with a milestone that hasn't started.

**Recommended first test:** The simplest possible starting point — a test proving
`ConversationContext` and `SessionState` can be constructed with valid initial state, with zero
repository, zero persistence, and zero external dependency involved. This validates the type
definitions compile and behave correctly before any stateful logic is written.

## 6. Git Strategy

**Suggested commit sequence** (mirrors the Execution Plan, restated as the concrete first
sequence): `conversationTypes.ts` → `conversationContext.ts` → `sessionState.ts` →
`conversationMemory.ts` → `memorySessionRepository.ts` — 5 commits, each gated by
`tsc --noEmit` and `vitest run --pool=forks` per [Development Guide](DEVELOPMENT_GUIDE.md).

**Suggested freeze point:** After all 5 commits pass and an architecture test confirms
`src/conversation/` imports nothing from `src/knowledge/`, `src/reasoning/`, `src/ai/`, or
`src/mcp/` — a test that trivially passes today (none of those modules exist yet) but should be
added now as a standing regression guard for when they do.

**Suggested release tag:** **None, for X.1 alone.** Consistent with how Phase N was tagged only
once fully frozen at 16/16 providers (not after each batch), a Phase X release tag should wait
until at minimum X.1–X.4 are complete and integrated into one working single-advisor flow.
Tagging X.1 alone would create a tag implying more readiness than a pure state-management
module actually represents.

## 7. Risks

**Technical:** The `ConversationHistory`/message-type ordering issue (§1) — low severity, easily
resolved, but must be a stated decision in code, not silent.

**Architectural:** The `ToolCalls` scope-boundary question (§1) — same profile: low severity,
resolved by deferring per the recommendation above, but worth a one-line comment in
`sessionState.ts` explaining the deliberate omission so a future X.5 implementer doesn't
mistake it for an oversight.

**Schedule:** X.1 itself has no schedule risk (fully unblocked). The one real schedule risk
sits just past X.1's boundary: X.2 is blocked on ADR-DRAFT-X01's formal ratification into
`app/.memory/decision-index.md`, an action outside this system's scope. If X.1 completes
quickly with no plan for who performs that ratification, work could stall at the X.1→X.2
boundary. **Recommendation: schedule the ADR-DRAFT-X01 ratification to happen during X.1's
implementation window, not after it.**

## 8. GO / NO-GO Decision

## GO

X.1 has zero blocking dependencies, touches exactly one frozen interface (`IBaseRepository`,
via implementation only, never modification), and both findings in this review (message-type
ordering, `ToolCalls` deferral) are resolved by a documented implementation choice, not new
design work or a schedule delay.

**The safest first implementation task:** create `src/conversation/domain/conversationTypes.ts`
containing only the type definitions (`ConversationContext`, `SessionState`,
`ConversationMessage` — per §1's resolution — and the `ConversationSession` shape
`memorySessionRepository.ts` will later persist), with a single test asserting these types
compile and a valid `ConversationContext` object can be constructed. This requires no
repository, no persistence, no external dependency, and no decision beyond what this review
has already resolved — the lowest-risk possible starting point for the whole of Phase X.

No source code was written. No documentation was modified. No ADR was created.
