# Ontology

**Purpose:** Synonym and broader/narrower concept relationships — the domain reference
companion to the Knowledge Platform's `OntologyProvider`.

**Status:** Scaffolded, not yet populated.

## Future Contents

- Synonym clusters (`SIMILAR_TO` relation) — which terms mean the same thing in different
  phrasing.
- Broader/narrower concept hierarchy (`BROADER_THAN` relation — a relation type invented for
  this exact purpose, not one of the 10 originally documented constants).
- This is source material Phase X's future intent-detection and query-expansion logic will
  eventually consume — see [`../../01_PROJECT_DOCS/AI_ADVISORY_ARCHITECTURE.md`](../../01_PROJECT_DOCS/AI_ADVISORY_ARCHITECTURE.md)'s
  note on ontology-aware search being a known current gap.

## Boundaries

Sourced from `OntologyProvider` data only — does not overlap with `glossary/` (translation/
abbreviation) or `legal/` (citation reference); each holds a genuinely distinct relation type.

## Ownership

Owned by whoever maintains the `ontology` Knowledge Platform provider (`OntologyProvider`).
Per [`../../KNOWLEDGE_BASE_EDITOR_GUIDE.md`](../../KNOWLEDGE_BASE_EDITOR_GUIDE.md).

## Update Policy

Additive, per [`../../DOCUMENTATION_CHANGE_POLICY.md`](../../DOCUMENTATION_CHANGE_POLICY.md).
Update when a new synonym cluster or broader/narrower relation is added to the provider.

**Related:** [`../glossary/README.md`](../glossary/README.md) · [`../../01_PROJECT_DOCS/KNOWLEDGE_PLATFORM.md`](../../01_PROJECT_DOCS/KNOWLEDGE_PLATFORM.md)
