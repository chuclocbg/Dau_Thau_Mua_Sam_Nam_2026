# ADR-005 — Legal Engine as Single Legal Authority

Status: ACCEPTED
Date: 2026-07-02

---

## Context

Vietnamese public procurement is governed by 5+ legal instruments with complex
threshold hierarchies, method selection rules, and authority levels. If multiple
modules each interpret these rules independently, they will diverge when decrees
are updated — producing inconsistent decisions across the platform.

---

## Decision

`ProcurementEngine` in `src/procurement/application/procurementEngine.ts` is the
sole component that interprets Vietnamese procurement law and produces
`ProcurementDecision` outputs.

Rules are defined in `procurementRules.ts` with `effectiveFrom`/`effectiveTo` dates
and explicit `LegalBasis` citations. The engine evaluates rules as of `asOfDate`.

No other module may:
- Re-implement method selection logic.
- Re-implement threshold determination.
- Re-implement approval authority resolution.
- Hardcode procurement thresholds in service conditionals.

When a new decree supersedes old rules, only `procurementRules.ts` is updated.
All modules that call `ProcurementEngine.evaluate()` automatically receive the
updated decision without code changes.

---

## Consequences

**Positive:**
- A single law update (`procurementRules.ts`) propagates to the entire platform.
- Every decision produced by the engine carries a traceable `LegalBasis` struct.
- Audit: any decision can be re-evaluated as of any historical date.

**Negative:**
- All method/authority decisions go through the engine, even simple cases.
  This is intentional — "simple" edge cases are exactly where errors occur.
- Adding a new procurement exception requires adding a new rule, not a
  one-line conditional in the calling service.

---

## Alternatives Rejected

**Distributed rule interpretation**: Each module checks thresholds itself.
Rejected because when NĐ 104/2026 changed thresholds, every module would need
individual updates, and each is a separate failure point.

**Configuration-driven rules (YAML/JSON config)**: Rules loaded from config files.
Not rejected in principle — but the current `ProcurementRuleSpec` structure already
supports this. Moving rules to external files is a future infrastructure upgrade, not
a different architecture.
