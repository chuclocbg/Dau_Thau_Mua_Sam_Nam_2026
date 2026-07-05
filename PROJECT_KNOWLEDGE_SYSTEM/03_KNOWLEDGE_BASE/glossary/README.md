# Glossary (Exhaustive Reference)

**Purpose:** The complete, exhaustive term/abbreviation/translation reference — as opposed to
[`../../01_PROJECT_DOCS/GLOSSARY.md`](../../01_PROJECT_DOCS/GLOSSARY.md), which is a curated
~50-term onboarding subset only. **This is the sole owner of exhaustive glossary content —
the Project Docs glossary must never be expanded to duplicate this folder's eventual content.**

**Status:** Scaffolded, not yet populated.

## Future Contents

- Every term the Knowledge Platform's `GlossaryProvider` already models: abbreviation
  expansions (`ABBREVIATES` relation) and term translations (`TRANSLATES_TO` relation) —
  source this folder's content from the provider's actual data, not a separately
  hand-maintained list, to avoid the two drifting apart.
- Vietnamese-English pairs for every procurement/legal term used anywhere in the system.

## Boundaries

Exhaustive scope, sourced from `GlossaryProvider` data — this is the **only** folder allowed
to hold the full term list; `01_PROJECT_DOCS/GLOSSARY.md` stays a curated ~50-term subset
forever (per that file's own stated scope) and must never be expanded to compete with this one.

## Ownership

Owned by whoever maintains the `glossary` Knowledge Platform provider (`GlossaryProvider`).
Per [`../../KNOWLEDGE_BASE_EDITOR_GUIDE.md`](../../KNOWLEDGE_BASE_EDITOR_GUIDE.md).

## Update Policy

Additive, per [`../../DOCUMENTATION_CHANGE_POLICY.md`](../../DOCUMENTATION_CHANGE_POLICY.md).
Update when a new abbreviation or translation is added to the provider.

**Related:** [`../ontology/README.md`](../ontology/README.md) · [`../../01_PROJECT_DOCS/GLOSSARY.md`](../../01_PROJECT_DOCS/GLOSSARY.md)
