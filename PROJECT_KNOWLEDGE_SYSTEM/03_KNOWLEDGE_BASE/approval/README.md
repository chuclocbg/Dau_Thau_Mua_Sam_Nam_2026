# Approval

**Purpose:** Reference material for approval authority levels, escalation paths, and the
value thresholds that determine who must approve what.

**Status:** Scaffolded, not yet populated.

## Future Contents

- Authority-level hierarchy reference (which role approves which value band).
- Escalation-path reference for exceptions.
- Cross-reference to [`legal/`](../legal/README.md) for the legal basis of each authority
  threshold, and to the Knowledge Platform's `school` provider for institution-specific
  (Layer 3) approval rules that may be stricter than the national baseline.

## Boundaries

Authority thresholds are reference material only; the actual enforcement lives in
`src/approval/` and the `school` provider — this folder must never become a second source of
truth for a threshold value.

## Ownership

Owned by whoever maintains `src/approval/` and the `school` provider. Per
[`../../KNOWLEDGE_BASE_EDITOR_GUIDE.md`](../../KNOWLEDGE_BASE_EDITOR_GUIDE.md).

## Update Policy

Additive, per [`../../DOCUMENTATION_CHANGE_POLICY.md`](../../DOCUMENTATION_CHANGE_POLICY.md).
Update when an authority-level threshold or escalation path changes.

**Related:** [`../../01_PROJECT_DOCS/MODULE_CATALOG.md`](../../01_PROJECT_DOCS/MODULE_CATALOG.md)
