# ADR-015: 4-Tier Legal Conflict Resolution Order

**Status:** ACTIVE
**Date:** 2026-07-03
**Affects:** src/reasoning/ (ReasoningEngine stage, IConflictResolver)

---

## Problem

Vietnamese procurement law involves 5+ instruments at different authority levels.
When two instruments give different answers to the same question (e.g., different advance
payment rates, different threshold values), the system must resolve the conflict
deterministically and traceably.

## Decision

4-tier conflict resolution in immutable order. The first tier that resolves the conflict wins.
If no tier resolves it: `UNRESOLVED` with `humanReviewRequired = true`.

```
Tier 1 — HIERARCHY
  Lower authorityLevel number prevails (Constitution=1 > Law=2 > Decree=6 > Circular=8)
  Example: Luật 22/2023 (level 2) overrides Thông tư 13/2026 (level 8)

Tier 2 — MORE_RESTRICTIVE (Layer 3 school policy)
  If the conflicting item is Layer 3 (SchoolPolicyProvider) and it is MORE restrictive:
    apply the school policy (it is institutionally binding)
  If the school policy is LESS restrictive:
    VIOLATION — log and apply national law; flag humanReviewRequired

Tier 3 — LEX_POSTERIOR
  At the same authority level: newer effectiveFrom prevails
  Example: NĐ 104/2026 supersedes parts of NĐ 214/2025 (same level, newer date)

Tier 4 — LEX_SPECIALIS
  At the same level and same date: narrower scope (more specific) prevails
  Example: TT 13/2026 (GOODS only) over TT 79/2025 (all types) for goods packages

UNRESOLVED
  humanReviewRequired = true
  confidence deduction: −0.20
  Reason logged in ReasoningResult.detectedConflicts
```

## Reason

This order reflects Vietnamese jurisprudence:
- Tier 1: constitutional hierarchy of legal norms
- Tier 2: institutional autonomy (school can be stricter than national law)
- Tier 3: lex posterior (newer law prevails at same authority)
- Tier 4: lex specialis (specific law prevails over general law)

## Consequences

- `IConflictResolver` implements exactly this 4-tier cascade
- No stage overrides this order
- VBHN (hợp nhất) documents have no independent legal force — they are convenience consolidations only
- Layer 3 override of Layer 1/2 to be LESS restrictive is a legal violation — always flagged
