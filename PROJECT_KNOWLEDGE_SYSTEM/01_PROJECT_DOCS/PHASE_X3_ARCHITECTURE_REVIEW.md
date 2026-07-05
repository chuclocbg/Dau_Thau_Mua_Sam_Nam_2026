# Phase X.3 (Knowledge Resolution) — Architecture Review

**Purpose:** Complete architecture review before any X.3 code is written, per ADR-022's
ratification and this project's readiness-review discipline. Produces the five requested
deliverables: Architecture Review, Dependency Diagram, Suggested Interfaces, Risk Analysis,
First Coding Task.

**Status:** Review only. No X.3 code exists. Does not authorize starting implementation.

**Read for this review:** `ADR-022` (`app/.memory/decisions/ADR-022-knowledge-resolution-strategy.md`),
`CURRENT_MILESTONE.md`, `NEXT_APPROVED_PHASE.md`, `PHASE_X_EXECUTION_PLAN.md`,
`AI_CONTEXT_SCHEMA.md`, `ARCHITECTURE_CONSTRAINTS.md`, `DEPENDENCY_RULES.md` — plus direct
inspection of `legalReasoningEngine.ts` (frozen) performed for this review, which surfaced one
clarification ADR-022 itself didn't spell out (§1.6 below).

---

## Architecture Review

### 1. Knowledge Resolution Pipeline

`knowledgeResolver.ts` sits between Stage 1 (`intentDetector.ts`, frozen) and Stage 3+ (folded
into `legalReasoningEngine.ts`, frozen). Its job: take a `ReasoningIntent` and produce a
`ResolvedKnowledge` by calling `IKnowledgePlatform`, per the intent-driven resolution strategy
already documented in `app/knowledge/reasoning/pipeline.md` Stage 2 ("ALL intents — always
resolve: `resolveLegalBasis` + `resolveContext`"; additional calls per intent type). This
strategy table is data, not new design — X.3's job is to implement it against the real,
frozen interface (per ADR-022), not to redesign it.

### 2. Temporal Filtering

Confirmed by direct inspection (ADR-022 §Problem Statement, point 2): the rule-based path
(`resolveLegalBasis`, `resolveSchoolPolicy`, `resolveChecklist`, `resolveContext`, etc., all
`(context, asOfDate)`) correctly filters via `Retriever.resolveApplicableDocuments` →
`isEffectiveOn(item, asOfDate)`. The text-query path (`searchKnowledge`) does **not** — it filters
only on `isActive`. This is not a bug to fix in X.3 (fixing it would mean modifying the frozen
platform); it's a behavioral fact `knowledgeResolver.ts` must design around, per ADR-022 Decision
2.

### 3. EffectivePeriod Strategy

Per ADR-022 Decision 4: `KnowledgeItem.effectivePeriod` is optional; when absent,
`knowledgeResolver.ts` falls back to `item.createdAt.slice(0, 10)` as `KnowledgeItemRef.effectiveFrom`
and emits a `LOW`-severity entry into `ResolvedKnowledge.warnings` naming the item. A real,
recorded fact, never a fabricated date — consistent with this project's no-fabrication principle.

### 4. Knowledge Ranking

Two independent ranking mechanisms already exist and neither needs new code in X.3:
- **Rule-based path:** no ranking — `Retriever.resolveApplicableDocuments` returns everything
  effective and applicable; `legalReasoningEngine.ts`'s own hierarchy sort (by `authorityLevel`,
  frozen, Batch A) handles ordering downstream.
- **Text-query path:** `QueryRouter` → `ResultRanker.rank(results, limit)` already ranks by
  relevance and truncates to `limit` before `searchKnowledge()` ever returns. `knowledgeResolver.ts`
  should preserve this order when mapping into `ResolvedKnowledge`, not re-sort it.

### 5. Citation Generation

Out of X.3's scope entirely — `citationFormatter.ts` (Batch A, frozen, Stage 6) already handles
this, unchanged. X.3's only responsibility toward citation quality is ensuring
`LegalBasisRef.documentSymbol`/`.article`/`.clause`/`.point` are populated correctly (ADR-022
Decision 3's `document`→`documentSymbol` mapping) so the existing formatter has correct input.

### 6. Evidence Selection

Also unchanged — `evidenceCollector.ts` (Batch A, frozen, Stage 5) and `answerComposer.ts`'s
`promoteToPrimary()` logic already determine which applied articles back a passing rule/
threshold, by matching `LegalRuleResult.legalBasis`/`LegalThresholdResult.legalBasis` against
`AppliedArticle.documentSymbol`/`.article`. X.3 supplies correctly-shaped data; it does not
change how that data is selected or promoted.

### 1.6 — A Clarification ADR-022 Itself Didn't Spell Out (found this review)

ADR-022 Decision 2 says `searchKnowledge()`-sourced items are "mapped into
`ResolvedKnowledge.caseItems`" and are "never eligible for `AppliedRole = 'PRIMARY_BASIS'`." Direct
inspection of `legalReasoningEngine.ts` (frozen) this review found: **`ResolvedKnowledge` has no
`caseItems` field today**, and the file's role-assignment/conflict logic (`legalReasoningEngine.ts:195`)
builds its entire candidate set from exactly two fields — `resolvedKnowledge.legalItems` and
`.schoolPolicyItems`. Nothing else is read.

This means ADR-022's "never `PRIMARY_BASIS`" guarantee does not require *any* new enforcement code
inside the frozen pipeline — it holds **by construction**, simply by adding `caseItems` as a new,
additive field that the frozen `legalReasoningEngine.ts` never reads. `searchKnowledge()`-sourced
items placed there cannot reach `AppliedRole` at all under today's frozen code, let alone
`PRIMARY_BASIS`. **This is good news, not a gap**: it means X.3 can implement ADR-022's Decision 2
with zero touches to `legalReasoningEngine.ts`, confirming the "no frozen module changes" promise
holds even for this specific decision. Recommendation: treat `caseItems` as informational-only
output for this milestone — a later milestone (or a small additive follow-up) can wire it into
`ReasoningResult`/explainability if a real consumer need appears; X.3 itself doesn't need to build
that wiring to satisfy its own exit criteria.

### 7. Conflict Resolution

Unchanged — the 4-tier cascade (`legalReasoningEngine.ts`, frozen, Batch A) is complete and
tested. X.3's only relationship to it: real `KnowledgeItem` records must carry the same
`metadata['conflictDimension']`/`metadata['conflictValue']`/`metadata['scope']` tags Batch A's
mock fixtures used for the cascade to find real conflicts. **Nothing in the real corpus populates
these tags yet** (corpus population is a separately deferred milestone) — see Risk Analysis.

### 8. Repository Interfaces

`IKnowledgePlatform` (frozen) already exposes everything needed (§ADR-022 Context) — no new
platform interface required. `knowledgeResolver.ts` itself should be a **plain async function**,
not a stateful class — `legalReasoningEngine.reason(question, resolvedKnowledge)` already takes
`ResolvedKnowledge` as a parameter, so nothing needs to "inject" a resolver instance. See
Suggested Interfaces for the proposed shape.

### 9. Performance

No caching belongs in X.3 (that's X.7's `knowledgeResolverCache.ts`, explicitly "sits behind
`KnowledgeResolver`, never beside it"). The one real X.3-scoped performance discipline:
`knowledgeResolver.ts` must call only the domain-specific `resolveX()`/`searchKnowledge()` calls
the given intent type actually needs (per `pipeline.md`'s Stage 2 table), never a blanket
`resolveContext()` (which queries every registered domain in parallel) for every question
regardless of relevance.

### 10. Future MCP Compatibility

Per Constraint C-06 ("Only `KnowledgeResolver` may call `IKnowledgePlatform`"), any future MCP
tool (X.5, gated behind proven need) needing knowledge search must call through
`knowledgeResolver.ts`, never `IKnowledgePlatform` directly. X.3 doesn't need to build anything
for this — the constraint already structurally prevents the alternative.

### 11. Future Multi-Agent Compatibility

Per the pre-existing multi-agent design (`app/knowledge/decisions/`): "Retriever... reuse[s]
`knowledgeResolver.ts`" directly in a future Coordinator/Planner/Retriever/Researcher/Reviewer/
Critic flow. This is exactly why `knowledgeResolver.ts` should be a stateless, pure-ish function
(§8) callable repeatedly for different sub-questions within one coordinated multi-agent session
— confirmed as the right shape by this forward-compatibility requirement, not just a stylistic
preference.

### 12. Future Knowledge Platform Integration

Deeper integration (Prisma-backed Knowledge Platform, 10,000+ item indexing per
`TECHNICAL_DEBT.md`'s TD note) is out of scope — X.3 uses the same memory-backed platform every
Phase N integration test already uses. Corpus population (real Vietnamese legal content, with
the metadata conventions §7 depends on) is a separate, already-deferred milestone; X.3 proves the
wiring, not the content.

---

## Dependency Diagram

```
ReasoningIntent (Stage 1, frozen)
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ knowledgeResolver.ts (X.3, NEW — the only file allowed to import │
│ src/knowledge/, per Constraint C-06)                             │
└─────────────────────────────────────────────────────────────────┘
        │                                          │
        │ resolveLegalBasis/resolveSchoolPolicy/   │ searchKnowledge(text,
        │ resolveChecklist/resolveContext           │ domains, context, limit)
        │ (context, asOfDate) — temporally filtered │ — NOT temporally filtered
        ▼                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ IKnowledgePlatform (Phase N, frozen)                             │
└─────────────────────────────────────────────────────────────────┘
        │
        │ returns KnowledgeItem[] / KnowledgeResult[]
        ▼
knowledgeResolver.ts maps (toKnowledgeItemRef, toLegalBasisRef,
toRuleKnowledgeItemRef, toThresholdKnowledgeItemRef)
        │
        ▼
ResolvedKnowledge { legalItems, schoolPolicyItems, ruleItems,        ◄── consumed by
  thresholdItems, procurementItems, + new additive caseItems }           legalReasoningEngine.ts
        │                                                                (frozen; only legalItems +
        ▼                                                                schoolPolicyItems feed role
legalReasoningEngine.reason(question, resolvedKnowledge)                 assignment/conflict — §1.6)
  [Batch A — FROZEN, UNCHANGED]
        │
        ▼
ReasoningResult → AIContextBuilder → PromptBuilder → PromptRenderer →
ClaudeLLMAdapter → OutputValidator   [Batch B / X.4 — ALL FROZEN, UNCHANGED]
```

---

## Suggested Interfaces

```typescript
// src/reasoning/application/knowledgeResolver.ts

export async function resolveKnowledge(
  intent: ReasoningIntent,
  platform: IKnowledgePlatform,
): Promise<ResolvedKnowledge>

// Optional — only if multi-agent reuse (§11) or test-mocking needs indirection beyond a
// plain function; not required for X.3's own exit criteria.
export interface IKnowledgeResolver {
  resolve(intent: ReasoningIntent, platform: IKnowledgePlatform): Promise<ResolvedKnowledge>
}
```

```typescript
// Internal mapping helpers (private to knowledgeResolver.ts, per ADR-022 Decisions 3-5)
function toLegalBasisRef(basis: LegalBasis): LegalBasisRef
function toKnowledgeItemRef(item: KnowledgeItem): KnowledgeItemRef
function toRuleKnowledgeItemRef(item: KnowledgeItem): RuleKnowledgeItemRef | null   // null on parse failure
function toThresholdKnowledgeItemRef(item: KnowledgeItem): ThresholdKnowledgeItemRef | null
```

```typescript
// A data-driven intent→resolution-steps table, not an if/else chain — matches this project's
// established "no switch/if, Map lookup" convention (QueryRouter's own stated Rule 3).
const INTENT_RESOLUTION_STRATEGY: Readonly<Record<IntentType, readonly ResolutionStep[]>>
```

`ResolvedKnowledge` itself gains one new, optional, additive field (per §1.6):
```typescript
export interface ResolvedKnowledge {
  // ...existing fields, unchanged...
  readonly caseItems?: readonly KnowledgeItemRef[]   // searchKnowledge()-sourced, informational only
}
```

---

## Risk Analysis

| Risk | Severity | Mitigation |
|---|---|---|
| `caseItems`/best-practice items accidentally wired into `legalItems`/`schoolPolicyItems` (the only two arrays `legalReasoningEngine.ts` reads), defeating ADR-022's "never `PRIMARY_BASIS`" guarantee | HIGH if it happens | The guarantee holds *by construction* only if `caseItems` stays a separate field — a dedicated test asserting `searchKnowledge()`-sourced items never appear in `legalItems`/`schoolPolicyItems` closes this structurally, per ADR-022's own acceptance criterion 3 |
| Corpus has no real content yet with `conflictDimension`/`conflictValue`/`scope` metadata tags — conflict resolution is proven (Batch A) but functionally inert against real (non-test-seeded) data | MEDIUM, forward-looking | Not a blocker for X.3 (its own exit criteria only require test-seeded parity, per ADR-022 acceptance criterion 2); flag for whoever eventually runs corpus population |
| Metadata-encoding fragility (ADR-022 Decision 5) — malformed `ruleDefinition`/`thresholdDefinition` JSON | MEDIUM | Critical `MissingEvidence`, never throw — already decided, needs a dedicated test |
| `effectiveFrom` fallback (`createdAt`) can be materially wrong for old laws entered late into the corpus | LOW-MEDIUM | `LOW`-severity warning makes it visible; already decided |
| Blanket `resolveContext()` calls instead of intent-targeted resolution — wasted provider queries | LOW (perf, not correctness) | Data-driven `INTENT_RESOLUTION_STRATEGY` table (§Suggested Interfaces), not an afterthought |
| `mockKnowledgeFixtures.ts` deleted before parity is actually proven | LOW | ADR-022's own Migration Strategy already sequences this as a separate, final commit |

---

## First Coding Task

Unchanged from the readiness review, reconfirmed by this architecture review: **`toLegalBasisRef()`
and `toKnowledgeItemRef()`** — pure mapping functions (ADR-022 Decisions 3–4), no platform call,
no dependency on the intent-resolution-strategy table, no dependency on the `caseItems` scoping
question (§1.6). Smallest, safest, most independently testable starting point; matches the
"types/mapping first" discipline already used to open every prior milestone in this project.

Explicitly **not** the first task: anything touching `searchKnowledge()`/`caseItems` — that
depends on the §1.6 scoping decision being settled (it is, in this review) and is better proven
once the simpler rule-based path already works end-to-end.
