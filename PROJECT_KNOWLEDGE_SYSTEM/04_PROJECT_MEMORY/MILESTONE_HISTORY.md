# Milestone History

**Purpose:** Every past milestone, archived here **before** [`../02_AI_CONTEXT/CURRENT_MILESTONE.md`](../02_AI_CONTEXT/CURRENT_MILESTONE.md)
is overwritten for the next one. See that file's archival rule.

**Related:** [Timeline](TIMELINE.md) · [Release Timeline](RELEASE_TIMELINE.md)

## Milestone Log (most recent first)

### Phase X.3.2 — Knowledge Resolution: Retrieval & Wiring — declared 2026-07-05 (CURRENT — see `../02_AI_CONTEXT/CURRENT_MILESTONE.md`)

Not yet archived — this is the live milestone. When superseded, its full summary moves here,
above this note, before `CURRENT_MILESTONE.md` is overwritten.

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
