# Phase N2 — Legal Reasoning Architecture

Date: 2026-07-03
Status: FROZEN — approved 2026-07-03
Location: src/reasoning/
Depends on: src/knowledge/ (IKnowledgePlatform only)

---

## The Permanent Separation

```
╔══════════════════════════════════════════════════════════════════════╗
║  KNOWLEDGE PLATFORM (Phase N — FROZEN)                               ║
║  Responsibility: retrieve information                                 ║
║  Can: search, resolve, suggest, score                                 ║
║  Cannot: decide, reason, evaluate rules, resolve conflicts            ║
╚══════════════════════════════════════════════════════════════════════╝
                            ║ (IKnowledgePlatform only)
                            ▼
╔══════════════════════════════════════════════════════════════════════╗
║  LEGAL REASONING LAYER (Phase N2 — this spec)                        ║
║  Responsibility: decide which knowledge applies                       ║
║  Can: reason, evaluate, conflict-resolve, explain, recommend          ║
║  Cannot: store documents, cache knowledge, write to any repository    ║
╚══════════════════════════════════════════════════════════════════════╝
                            ║ (ReasoningResult)
                            ▼
╔══════════════════════════════════════════════════════════════════════╗
║  AI ADVISORY LAYER (Phase X — future)                                 ║
║  Consumes ReasoningResult as structured context for LLM generation    ║
╚══════════════════════════════════════════════════════════════════════╝
```

The separation is permanent and enforced by module boundaries:
- `src/reasoning/` imports ONLY `IKnowledgePlatform` from `src/knowledge/` (via integration bridge)
- `src/knowledge/` imports NOTHING from `src/reasoning/`
- No provider in `src/knowledge/providers/` performs evaluation, conflict resolution, or rule application
- No service in `src/reasoning/` holds a repository or writes to any storage

---

## Sub-Specifications

| File | Contents |
|------|----------|
| [types.md](../reasoning/types.md) | All type definitions: ReasoningQuestion · ReasoningResult · ReasoningIntent · ReasoningStep · AppliedArticle · FormattedCitation · MissingEvidence · ReasoningWarning · Confidence |
| [pipeline.md](../reasoning/pipeline.md) | 8-stage pipeline; 15 responsibilities mapped to stages; stage contracts; inter-stage data flow |
| [conflict.md](../reasoning/conflict.md) | Conflict resolution strategy; 4-tier hierarchy resolution; more-restrictive principle; lex posterior; lex specialis; UNRESOLVED escalation |
| [rules.md](../reasoning/rules.md) | Rule engine design; threshold evaluation; exception detection; rule types; rule loading from Knowledge Platform |

---

## Source Layout

```
src/reasoning/
├── reasoningTypes.ts                  ← ALL types in this file only
├── ILegalReasoningEngine.ts           ← top-level interface (2 methods)
├── DefaultLegalReasoningEngine.ts     ← pipeline orchestrator
├── pipeline/
│   ├── IReasoningStage.ts             ← common stage interface
│   ├── IntentDetector.ts              ← Stage 1: intent + entity extraction
│   ├── KnowledgeResolver.ts           ← Stage 2: ONLY file calling IKnowledgePlatform
│   ├── ReasoningEngine.ts             ← Stage 3: hierarchy, conflicts, supersession, xref
│   ├── RuleEngine.ts                  ← Stage 4: thresholds, rules, exceptions
│   ├── EvidenceCollector.ts           ← Stage 5: evidence assembly, missing evidence
│   ├── CitationFormatter.ts           ← Stage 6: Vietnamese citation formatting
│   └── AnswerComposer.ts              ← Stage 7: confidence, humanReview, explainability
├── conflict/
│   ├── IConflictResolver.ts
│   └── HierarchyConflictResolver.ts
├── rules/
│   ├── IRuleEvaluator.ts
│   └── DefaultRuleEvaluator.ts
├── intent/
│   ├── IntentPatternRegistry.ts       ← intent classification patterns (open string registry)
│   └── EntityExtractor.ts             ← extract documentSymbol, money values, dates from text
└── integration/
    └── reasoningIntegration.ts        ← ONLY import from src/knowledge/ (bridge file)
```

**~15 source files | ~585 tests (~15 × 39)**

---

## Immutable Architecture Rules

1. **KnowledgeResolver is the sole platform consumer.** Only `KnowledgeResolver.ts` may call `IKnowledgePlatform`. All other stages receive `ResolvedKnowledge` populated by KnowledgeResolver. No stage calls the platform directly.

2. **Reasoning Layer never persists.** No `IRepository` in `src/reasoning/`. No `INSERT`, `UPDATE`. The layer is pure computation. Every call is stateless.

3. **Every conclusion references a KnowledgeItem.** Every `AppliedArticle`, `FormattedCitation`, and `RuleResult` in `ReasoningResult` must carry an `itemId` pointing to the `KnowledgeItem` it was derived from. Conclusions without evidence are warnings, not decisions.

4. **humanReviewRequired is one-way.** Any stage may set `humanReviewRequired = true`. No stage may set it back to `false`. Once set, it propagates to `ReasoningResult`.

5. **Conflict resolution follows a fixed 4-tier strategy.** The strategy order is immutable: (1) legal hierarchy → (2) more-restrictive principle → (3) lex posterior → (4) lex specialis → UNRESOLVED. No ad-hoc resolution. UNRESOLVED → humanReviewRequired.

6. **Rules are loaded from the Knowledge Platform, not from code.** `RuleEngine` evaluates rules. It does not define them. Rule definitions are `KnowledgeItem` objects in the `procurement` domain (`type='EVALUATION_RULE'`). Adding a new procurement rule requires a corpus insert, zero code change.

7. **Thresholds are loaded from the Knowledge Platform, not from code.** Threshold values (e.g., 2B VNĐ open tender threshold) are `KnowledgeItem` objects in the `procurement` domain (`type='THRESHOLD'`). Threshold updates via law amendment require only a corpus update.

8. **Reasoning Layer is jurisdiction-agnostic at the interface level.** `ILegalReasoningEngine` is not Vietnam-specific. The Vietnamese procurement rules are in the `DefaultRuleEvaluator` and the Knowledge Platform corpus. The interface is reusable for any legal jurisdiction.

---

## Key Metrics

```
Pipeline latency target (p95):
  Simple question (1 domain, no conflict):    < 200 ms
  Complex question (3+ domains, conflict):    < 800 ms
  Full cross-reference expansion (depth 2):   < 1500 ms
  (All targets assume Knowledge Platform available at < 50 ms)

Confidence score interpretation:
  ≥ 0.85:  HIGH — auto-serve decision
  0.70–0.84: MEDIUM — serve with confidence label
  0.50–0.69: LOW — serve with review recommendation
  < 0.50:  VERY_LOW — humanReviewRequired = true; block auto-serve

humanReviewRequired triggers (any one is sufficient):
  - confidence < 0.50
  - any UNRESOLVED conflict
  - missing CRITICAL evidence
  - more than 3 unresolved exceptions
  - any load-bearing KnowledgeItem with qualityScore < 0.50
  - explicit stage flag
```
