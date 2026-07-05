# Checklists

**Purpose:** Procedural checklists by procurement phase — the domain reference companion to
the Knowledge Platform's `checklists` provider (`ChecklistProvider`).

**Status:** Scaffolded, not yet populated.

## Future Contents

- Phase-gate checklists (what must be complete before advancing), mirroring the
  `ChecklistProvider`'s phase-gate ordering relationships.
- `getRequiredBy()` reference — which templates/processes require which checklist, sourced
  from the provider's own `USES_CHECKLIST` incoming-edge data rather than hand-maintained
  separately.

## Boundaries

Sourced from `ChecklistProvider`'s actual graph data — never hand-author a phase-gate order
that could drift from what the provider enforces.

## Ownership

Owned by whoever maintains the `checklists` Knowledge Platform provider (`ChecklistProvider`).
Per [`../../KNOWLEDGE_BASE_EDITOR_GUIDE.md`](../../KNOWLEDGE_BASE_EDITOR_GUIDE.md).

## Update Policy

Additive, per [`../../DOCUMENTATION_CHANGE_POLICY.md`](../../DOCUMENTATION_CHANGE_POLICY.md).
Update when a checklist or phase-gate rule is added to the provider.

**Related:** [`../workflow/README.md`](../workflow/README.md) · [`../../01_PROJECT_DOCS/KNOWLEDGE_PLATFORM.md`](../../01_PROJECT_DOCS/KNOWLEDGE_PLATFORM.md)
