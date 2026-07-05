# Documentation Versioning

**Purpose:** How `PROJECT_KNOWLEDGE_SYSTEM` itself is versioned, and its relationship to the
underlying code's release tags (e.g., `v1.0-knowledge-platform`).

**Audience:** Anyone deciding whether a documentation change warrants a version bump.

**Dependencies:** [`DOCUMENTATION_LIFECYCLE.md`](DOCUMENTATION_LIFECYCLE.md).

**Status:** ACTIVE policy as of `PROJECT_KNOWLEDGE_SYSTEM v1.0` (this system's own first
declared version, frozen at the point of this governance layer's creation).

**Related:** [`README.md`](README.md) · [`02_AI_CONTEXT/CURRENT_RELEASE.md`](02_AI_CONTEXT/CURRENT_RELEASE.md)

## Table of Contents

1. [Two Independent Version Numbers](#two-independent-version-numbers)
2. [What PROJECT_KNOWLEDGE_SYSTEM v1.0 Means](#what-project_knowledge_system-v10-means)
3. [When to Bump the Documentation Version](#when-to-bump-the-documentation-version)
4. [Where the Version Is Recorded](#where-the-version-is-recorded)

---

## Two Independent Version Numbers

The **code** release tag (`v1.0-knowledge-platform`, owned by
[`02_AI_CONTEXT/CURRENT_RELEASE.md`](02_AI_CONTEXT/CURRENT_RELEASE.md)) and the
**documentation system** version (`PROJECT_KNOWLEDGE_SYSTEM v1.0`, owned by this file) are
**deliberately independent**. The documentation can be improved (a new governance layer, a
populated Knowledge Base folder) without the code changing, and vice versa. Do not conflate
the two, and do not assume they move in lockstep.

## What PROJECT_KNOWLEDGE_SYSTEM v1.0 Means

Frozen at the point where: all 4 top-level folders exist and are internally consistent
(verified by the Documentation QA Audit), all cross-references resolve, the governance layer
(this file and its 8 siblings) exists and is itself internally consistent. It does **not**
mean the Knowledge Base is populated with real content — v1.0 explicitly includes a scaffold-
only Knowledge Base, per its own stated scope (`03_KNOWLEDGE_BASE/README.md`).

## When to Bump the Documentation Version

- **Patch-level change** (no version bump needed): fixing a broken link, correcting a stale
  fact, populating a Knowledge Base folder with real content that matches its stated scope.
- **Minor version bump** (v1.1, v1.2...): adding a new document type, adding a new folder,
  resolving a `DOCUMENTATION_BACKLOG.md` Critical or High item that changes structure (e.g.,
  persisting the Phase X ADR drafts as new files).
- **Major version bump** (v2.0): a structural change to the 4-folder architecture itself, a
  change to the governance layer's own rules (Constitution amendment), or the point where
  Phase X is approved and its own documentation (once it exists) needs to be integrated as a
  peer to Phase A-N's.

## Where the Version Is Recorded

This file states the current documentation version. When it changes, the outgoing version's
summary should be added to a version history section here (not yet needed — this is the first
version) — following the same archive-before-overwrite discipline as
[`DOCUMENTATION_LIFECYCLE.md`](DOCUMENTATION_LIFECYCLE.md), applied to this file itself once
it accumulates a real history.

## Version History

*(Empty — `v1.0` is the first and current version. Future bumps append here, above this note,
dated, per Constitution Article III.)*
