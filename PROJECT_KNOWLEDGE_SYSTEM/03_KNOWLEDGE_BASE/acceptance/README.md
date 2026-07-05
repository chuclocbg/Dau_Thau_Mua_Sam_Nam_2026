# Acceptance

**Purpose:** Reference material for acceptance (nghiệm thu) committee composition rules and
minute/documentation requirements.

**Status:** Scaffolded, not yet populated.

## Future Contents

- Committee composition rules by package type.
- Required minute/documentation content per acceptance type.
- **Known debt to document here:** `acceptanceService.ts`'s `DEFAULT_LEGAL_BASIS` currently
  applies a goods-only circular (TT 13/2026/TT-BCT) to all acceptance types — a tracked,
  frozen-module technical debt item (TD-01). This folder's reference content should note the
  correct legal basis per acceptance type until the underlying code debt is resolved via a
  bridge layer.

## Boundaries

Documents the *correct* legal basis per type even where the frozen code (TD-01) currently
applies the wrong one — this folder is allowed to state a fact more precisely than the code
currently implements it, as long as the discrepancy itself is flagged, never silently ignored.

## Ownership

Owned by whoever maintains `src/acceptance/` and the `checklists` provider. Per
[`../../KNOWLEDGE_BASE_EDITOR_GUIDE.md`](../../KNOWLEDGE_BASE_EDITOR_GUIDE.md).

## Update Policy

Additive, per [`../../DOCUMENTATION_CHANGE_POLICY.md`](../../DOCUMENTATION_CHANGE_POLICY.md).
Update when TD-01 is resolved (remove the caveat) or when committee/minute rules change.

**Related:** [`../checklists/README.md`](../checklists/README.md) · [`../../02_AI_CONTEXT/TECHNICAL_DEBT.md`](../../02_AI_CONTEXT/TECHNICAL_DEBT.md)
