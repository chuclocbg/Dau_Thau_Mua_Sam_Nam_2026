# 03_KNOWLEDGE_BASE

**Purpose:** The long-term business/domain knowledge repository — where the actual reference
content (full legal citations, form templates, checklists, FAQ, ontology) lives, as opposed to
the *rules* governing behavior (which live in [`../01_PROJECT_DOCS/CONSTITUTION.md`](../01_PROJECT_DOCS/CONSTITUTION.md)).

**Audience:** Anyone looking for domain-specific reference material, human or AI.

**Status:** Scaffolded. Every folder below has a README describing its intended future
contents — the folders are not yet populated with the actual reference documents. This is
deliberate: the structure is designed now so that content, when added, has an obvious home
and doesn't drift into duplicating something already in `app/docs/`, `app/knowledge/`, or the
Knowledge Platform's own providers.

## Explicit Scope Statement

**These 15 folders were requested and scaffolded exactly as named.** They map closely, but
**not 1:1**, onto the Knowledge Platform's 16 provider domains (see
[`../01_PROJECT_DOCS/KNOWLEDGE_PLATFORM.md`](../01_PROJECT_DOCS/KNOWLEDGE_PLATFORM.md)). The
mapping, and the gap, are stated explicitly here rather than left implicit:

| Knowledge Base folder | Maps to Knowledge Platform domain(s) |
|---|---|
| `legal/` | `legal` |
| `procurement/` | `procurement` |
| `workflow/` | (no direct KP provider — workflow state machine is in `src/procurement/workflow/`, not the Knowledge Platform) |
| `approval/` | (no direct KP provider — approval logic is in `src/approval/`) |
| `contract/` | `templates` (contract templates), no dedicated KP domain otherwise |
| `acceptance/` | `checklists` (acceptance procedures), no dedicated KP domain otherwise |
| `asset/` | `asset` |
| `forms/`, `templates/` | `templates` |
| `checklists/` | `checklists` |
| `faq/` | cross-cutting, no single KP domain |
| `glossary/` | overlaps `glossary` provider — see ownership note below |
| `ontology/` | `ontology` |
| `adr/`, `decision-log/` | none — these are process artifacts, not domain knowledge |

**Explicitly deferred, not silently forgotten:** the Knowledge Platform has 9 provider domains
with **no dedicated Knowledge Base folder yet** — `vendor`/supplier, `budget`, `notification`,
`risk`, `audit`, `school` (policy), `cases`, `bestpractice`, `ai_feedback`. This gap was found
during the documentation architecture review and is recorded here as a **stated scope
decision**, not an oversight: adding folders for these is deferred to a future wave, pending a
decision on whether they need dedicated Knowledge Base reference content or whether the
Knowledge Platform's own provider data is sufficient on its own for those domains.

## Table of Contents

| Folder | Future contents |
|---|---|
| [`legal/`](legal/README.md) | Full ranked legal corpus, citation reference |
| [`procurement/`](procurement/README.md) | Procurement method selection reference, thresholds |
| [`workflow/`](workflow/README.md) | Workflow state machine reference, transition rules |
| [`approval/`](approval/README.md) | Authority-level and escalation reference |
| [`contract/`](contract/README.md) | Contract clause and guarantee reference |
| [`acceptance/`](acceptance/README.md) | Acceptance committee and minute procedure reference |
| [`asset/`](asset/README.md) | Asset lifecycle and depreciation reference |
| [`forms/`](forms/README.md) | Official form catalog |
| [`templates/`](templates/README.md) | Document generation templates |
| [`checklists/`](checklists/README.md) | Procedural checklists by phase |
| [`faq/`](faq/README.md) | Frequently asked questions |
| [`glossary/`](glossary/README.md) | Exhaustive term/abbreviation reference |
| [`ontology/`](ontology/README.md) | Synonym/broader-narrower concept relationships |
| [`adr/`](adr/README.md) | Architecture Decision Records (mirrors `app/docs/adr/`) |
| [`decision-log/`](decision-log/README.md) | Chronological decision log (mirrors `app/.memory/decision-log.md`) |

## Ownership Rule (Glossary and Ontology specifically)

`../01_PROJECT_DOCS/GLOSSARY.md` = curated ~50 essential onboarding terms.
`glossary/README.md` (this folder) = exhaustive reference scope, eventually sourced from and
cross-checked against the Knowledge Platform's own `GlossaryProvider` data, never duplicating
it by hand.
