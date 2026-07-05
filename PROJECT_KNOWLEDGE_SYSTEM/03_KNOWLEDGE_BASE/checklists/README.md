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

**Related:** [`../workflow/README.md`](../workflow/README.md) · [`../../01_PROJECT_DOCS/KNOWLEDGE_PLATFORM.md`](../../01_PROJECT_DOCS/KNOWLEDGE_PLATFORM.md)
