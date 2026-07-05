# Release History

**Purpose:** Every tagged release and what it contains.

**Audience:** Anyone needing to know what shipped, when.

**Related:** [`../04_PROJECT_MEMORY/RELEASE_TIMELINE.md`](../04_PROJECT_MEMORY/RELEASE_TIMELINE.md) (narrative version, with reasoning) · [`../02_AI_CONTEXT/CURRENT_RELEASE.md`](../02_AI_CONTEXT/CURRENT_RELEASE.md) (live numbers)

## Table of Contents

1. [v1.0-knowledge-platform](#v10-knowledge-platform)
2. [Pre-Existing Tags (Unrelated Track)](#pre-existing-tags-unrelated-track)

---

## v1.0-knowledge-platform

**The first release this project itself tagged.** Contains Phases A through N: 13 business
modules, 3 infrastructure modules, and the complete 16-provider Knowledge Platform. Preceded by
a full Release Candidate architecture audit (recommendation: GO WITH NOTES) and a documented
17-commit release-preparation sequence organizing 227 previously-uncommitted files into logical,
reviewable commits. Exact test counts and commit hash: [`../02_AI_CONTEXT/CURRENT_RELEASE.md`](../02_AI_CONTEXT/CURRENT_RELEASE.md).

Notably excluded from this tag, deliberately: `src/orchestrator/`, `src/memory/` (an unrelated
pre-existing track never audited as part of this release), `generated/` (regenerable Prisma
client output), and several personal reference files outside `app/`.

## Pre-Existing Tags (Unrelated Track)

These predate this project's own work and belong to the earlier, unrelated commit history
(`P6-01-complete`, `P6-02-complete`, `phase3-complete`, `phase5-complete`, `phase6-complete`,
`v1.0.0`, `v1.1.0-phase1`, `v3.0`). Listed here only so a future reader doesn't mistake them
for this project's own release history. Full detail on how the two histories coexist:
[`../04_PROJECT_MEMORY/ARCHITECTURE_EVOLUTION.md`](../04_PROJECT_MEMORY/ARCHITECTURE_EVOLUTION.md).
