# Architecture Constraints

**Purpose:** The load-bearing architectural rulings that must never be silently violated by
new code — including future Phase X code. These are conclusions already reached and accepted
in this project's own architecture review/design cycle, not aspirational goals.

**Status:** Binding. Full reasoning behind each: [`../01_PROJECT_DOCS/TECHNICAL_ARCHITECTURE.md`](../01_PROJECT_DOCS/TECHNICAL_ARCHITECTURE.md), [`../01_PROJECT_DOCS/AI_ADVISORY_ARCHITECTURE.md`](../01_PROJECT_DOCS/AI_ADVISORY_ARCHITECTURE.md).

## Machine Context

```yaml
as_of: 2026-07-14
status: CURRENT
related: [DEPENDENCY_RULES.md, DDD_RULES.md, FREEZE_STATUS.md, ../01_PROJECT_DOCS/AI_ADVISORY_ARCHITECTURE.md]

constraints:
  - id: C-01
    rule: "Frozen modules are extended only via new files (Integration Bridge or registerProvider())"
    scope: all business modules, Knowledge Platform
  - id: C-02
    rule: "Money is always bigint, never number/float"
    scope: repo-wide
  - id: C-03
    rule: "Legal citations are always LegalBasis[], never bare string[]"
    scope: repo-wide
  - id: C-04
    rule: "Knowledge Platform domain is an open string, never an enum"
    scope: src/knowledge/
  - id: C-05
    rule: "AI layer (Phase X, not yet built) speaks only AIContext — never calls a repository
           or Knowledge Platform provider directly"
    scope: future src/reasoning/, src/ai/
  - id: C-06
    rule: "Only KnowledgeResolver may call IKnowledgePlatform — enforced structurally
           (dependency check), not just by convention, once Phase X.2 exists"
    scope: future src/reasoning/
  - id: C-07
    rule: "15 (eventually more) AI advisors are DATA PROFILES consumed by one Reasoning
           Engine, never separate service classes"
    scope: future src/reasoning/, src/ai/
    rationale: "Mirrors the Knowledge Platform's own proven 16-provider extension pattern.
                Rejected alternative: one class per advisor (rejected — reintroduces the
                sprawl the provider pattern was built to avoid)."
  - id: C-08
    rule: "Exactly one LLM call per user-facing answer, even in multi-agent (X.10) flows —
           never LLM-to-LLM agent conversations"
    scope: future src/ai/
  - id: C-09
    rule: "MCP tools (X.9, not yet built) register the same way Knowledge Platform providers
           do — registration-only, zero core changes per new tool"
    scope: future MCP layer
  - id: C-10
    rule: "Every LLM output passes OutputValidator before reaching a user — citation, numeric,
           contradiction, language, completeness, forbidden-pattern checks, zero exceptions"
    scope: future src/ai/

# Engineering Platform, Phase A1 (Repository Foundation / Governance Engine, Layer 1) --
# written down here because this file is the natural owning location for binding rulings, and
# these two rules have governed every Phase X.16-X.20 milestone in practice without ever being
# recorded anywhere durable until now.
governance_policy:
  adr_trigger_checklist:
    introduced: "Phase X.19"
    questions:
      - "Does this change the persistence model (schema, migration, storage engine)?"
      - "Does this change a public API (external HTTP contract)?"
      - "Does this change system architecture (module boundaries, layering)?"
      - "Does this change Docker/deployment topology?"
      - "Does this change the authentication/authorization model?"
      - "Does this change messaging/event architecture?"
      - "Does this change the database engine?"
    rule: "If ALL seven are false, no ADR. If ANY is true, exactly one ADR before implementation
           proceeds. A document must answer something git history, CI logs, or source code
           cannot already answer -- otherwise it should not exist (Lean Governance v2, X.19)."
  decision_budget:
    introduced: "Phase X.19, widened same phase"
    autonomous_when_all_true:
      - "<=8 files modified in one commit"
      - "no public API changes"
      - "no architecture changes"
      - "no database migration"
      - "no dependency changes"
      - "no security changes"
    else: "explicit human approval required before implementation, per batch"
```
