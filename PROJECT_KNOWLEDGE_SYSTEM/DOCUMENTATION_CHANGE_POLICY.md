# Documentation Change Policy

**Purpose:** Who can change what, when, and how — the documentation-layer equivalent of the
code's frozen-module/Integration-Bridge policy.

**Audience:** Anyone about to edit a file in this system.

**Dependencies:** [`DOCUMENTATION_CONSTITUTION.md`](DOCUMENTATION_CONSTITUTION.md).

**Status:** ACTIVE policy as of `PROJECT_KNOWLEDGE_SYSTEM v1.0`.

**Related:** [`DOCUMENTATION_LIFECYCLE.md`](DOCUMENTATION_LIFECYCLE.md) · [`DOCUMENTATION_REVIEW_CHECKLIST.md`](DOCUMENTATION_REVIEW_CHECKLIST.md)

## Table of Contents

1. [Change Rules By Folder](#change-rules-by-folder)
2. [What Requires Re-Running the Review Checklist](#what-requires-re-running-the-review-checklist)
3. [What Does Not Require Review](#what-does-not-require-review)
4. [Emergency Corrections](#emergency-corrections)

---

## Change Rules By Folder

| Folder | Rule |
|---|---|
| `01_PROJECT_DOCS/` | Updated in place when the architecture/business fact it describes changes. No archival needed — these describe durable state, not a point-in-time snapshot. |
| `02_AI_CONTEXT/` | Updated in place, **except** `CURRENT_MILESTONE.md`/`CURRENT_RELEASE.md`, which follow the archival procedure in [`DOCUMENTATION_LIFECYCLE.md`](DOCUMENTATION_LIFECYCLE.md) first. Every edit must keep the file conformant to `SCHEMA.md`. |
| `03_KNOWLEDGE_BASE/` | Additive only, for now — populating a scaffold with real content. See [`KNOWLEDGE_BASE_EDITOR_GUIDE.md`](KNOWLEDGE_BASE_EDITOR_GUIDE.md). |
| `04_PROJECT_MEMORY/` | **Append-only.** Never edit a past entry (Article III). Corrections are new, dated entries. |
| Governance layer (this file and its siblings) | Amendable only via the process in this file's [Emergency Corrections](#emergency-corrections) section — these are meta-rules, changing them changes how everything else is governed. |

## What Requires Re-Running the Review Checklist

Any change touching: a `CURRENT_*.md` file, `SCHEMA.md`'s ownership map, any file's `Status:`
or `Related:` field, or any new file creation. Run
[`DOCUMENTATION_REVIEW_CHECKLIST.md`](DOCUMENTATION_REVIEW_CHECKLIST.md) in full before
considering the change complete.

## What Does Not Require Review

Pure content additions to an already-scaffolded `03_KNOWLEDGE_BASE/` folder that don't change
its README's scope statement — a spot-check for broken links is still recommended, not a full
checklist run.

## Emergency Corrections

If a file is found to state something false (a fabrication, per Article I) rather than merely
stale, correct it immediately regardless of the folder-specific rule above — Article I
overrides Article III's append-only rule for `04_PROJECT_MEMORY/` in this one case: a
fabrication is not "history" to be preserved, it's an error to be fixed, with a note explaining
what was wrong and when it was caught (which *is* new history, properly appended).
