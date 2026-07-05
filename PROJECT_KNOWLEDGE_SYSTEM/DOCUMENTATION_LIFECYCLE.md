# Documentation Lifecycle

**Purpose:** Define the lifecycle stages every document passes through, and — directly
resolving `DOCUMENTATION_BACKLOG.md` item 2 (the archival rule's missing enforcement trigger)
— exactly what event triggers the archive-before-overwrite step.

**Audience:** Anyone updating a "current state" document, or reviewing whether one is stale.

**Dependencies:** [`DOCUMENTATION_CONSTITUTION.md`](DOCUMENTATION_CONSTITUTION.md) Article V.

**Status:** ACTIVE process as of `PROJECT_KNOWLEDGE_SYSTEM v1.0`.

**Related:** [`DOCUMENTATION_CHANGE_POLICY.md`](DOCUMENTATION_CHANGE_POLICY.md) · [`AI_CONTEXT_UPDATE_POLICY.md`](AI_CONTEXT_UPDATE_POLICY.md)

## Table of Contents

1. [The Four Lifecycle Stages](#the-four-lifecycle-stages)
2. [Which Files Are "Current-State" (Subject to Archival)](#which-files-are-current-state-subject-to-archival)
3. [The Archival Trigger — Now Explicit](#the-archival-trigger--now-explicit)
4. [The Archival Procedure](#the-archival-procedure)
5. [Ownership](#ownership)

---

## The Four Lifecycle Stages

```
DRAFT → ACTIVE (CURRENT) → STALE → ARCHIVED (SUPERSEDED)
```

- **DRAFT** — being written, not yet linked from any folder README's Table of Contents.
- **ACTIVE** — linked, current, believed accurate. Most of this system's 57+ files are here.
- **STALE** — a fact it states is known to have changed but the file hasn't been updated yet.
  A file should never remain STALE for more than one work session — this is a transitional
  state, not a resting one.
- **ARCHIVED** — superseded content, moved to `04_PROJECT_MEMORY/`, never deleted, never
  further edited (Article III).

## Which Files Are "Current-State" (Subject to Archival)

Exactly the files `02_AI_CONTEXT/SCHEMA.md` marks as owning a fact whose value changes over
time: `CURRENT_MILESTONE.md`, `CURRENT_RELEASE.md`, and any future file following the same
"holds only the present, not the past" pattern. `01_PROJECT_DOCS/` files describing durable
architecture (e.g., `KNOWLEDGE_PLATFORM.md`) are not subject to this — they're updated in
place when the architecture itself changes, since they don't claim to be a point-in-time
snapshot.

## The Archival Trigger — Now Explicit

**The archival step is triggered at exactly one moment: the phase-freeze or release-tagging
checklist**, as an explicit, non-skippable line item — not left to whoever happens to remember.
Specifically:

```yaml
trigger: "A new phase is frozen, OR a new release tag is created"
action_required_before_updating_current_files:
  1. "Copy the full current content of CURRENT_MILESTONE.md into
      04_PROJECT_MEMORY/MILESTONE_HISTORY.md, above the placeholder note, dated."
  2. "Copy the full current content of CURRENT_RELEASE.md into
      04_PROJECT_MEMORY/RELEASE_TIMELINE.md, above the placeholder note, dated."
  3. "Only then overwrite CURRENT_MILESTONE.md / CURRENT_RELEASE.md with the new state."
enforcement: "Manual, verified by DOCUMENTATION_REVIEW_CHECKLIST.md's own archival-check line
              item — there is no automated CI check for this yet (a stated, tracked gap, not
              a silent one — see DOCUMENTATION_BACKLOG.md Future Ideas)."
```

This ties the previously-unenforced rule to the one moment in this project's actual workflow
where it's guaranteed to matter — a phase freeze or a release tag are both already
deliberate, checklist-driven events (see `01_PROJECT_DOCS/DEVELOPMENT_GUIDE.md`), so adding
one more line to an already-existing checklist costs nothing and closes the gap.

## The Archival Procedure

1. Read the outgoing `CURRENT_*.md` file in full.
2. Append it, verbatim, to the corresponding `04_PROJECT_MEMORY/` file, above that file's
   "not yet archived" placeholder note, with a dated heading.
3. Overwrite the `CURRENT_*.md` file with the new state.
4. Verify (per `DOCUMENTATION_REVIEW_CHECKLIST.md`) that the new content still conforms to
   `02_AI_CONTEXT/SCHEMA.md`.

## Ownership

Whoever performs the phase-freeze or release-tagging action owns triggering this procedure —
the same person/session, not a separate "documentation team," since this project has none and
pretending otherwise would just create a step someone else assumes already happened.
