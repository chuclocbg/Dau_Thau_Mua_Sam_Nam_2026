# AI Context Update Policy

**Purpose:** Specific, event-driven policy for keeping `02_AI_CONTEXT/` in sync — this is the
folder most prone to the exact staleness failure documented in
`04_PROJECT_MEMORY/LESSONS_LEARNED.md` Lesson 1, so it gets its own dedicated policy rather
than relying on the general [`DOCUMENTATION_CHANGE_POLICY.md`](DOCUMENTATION_CHANGE_POLICY.md) alone.

**Audience:** Anyone whose action changes a fact that `02_AI_CONTEXT/` tracks.

**Dependencies:** [`02_AI_CONTEXT/SCHEMA.md`](02_AI_CONTEXT/SCHEMA.md), [`DOCUMENTATION_LIFECYCLE.md`](DOCUMENTATION_LIFECYCLE.md).

**Status:** ACTIVE policy as of `PROJECT_KNOWLEDGE_SYSTEM v1.0`.

**Related:** [`02_AI_CONTEXT/README.md`](02_AI_CONTEXT/README.md) · [`DOCUMENTATION_REVIEW_CHECKLIST.md`](DOCUMENTATION_REVIEW_CHECKLIST.md)

## Table of Contents

1. [Event → File Update Map](#event--file-update-map)
2. [The Ownership Map Must Stay Complete](#the-ownership-map-must-stay-complete)
3. [What "In Sync" Means](#what-in-sync-means)
4. [Recommended (Not Yet Built) Automation](#recommended-not-yet-built-automation)

---

## Event → File Update Map

```yaml
events:
  - trigger: "test suite count changes (new tests added/removed)"
    update: CURRENT_RELEASE.md
  - trigger: "a new git tag is created"
    update: CURRENT_RELEASE.md
    also: "archive outgoing content per DOCUMENTATION_LIFECYCLE.md first"
  - trigger: "a phase is frozen, or a milestone is declared"
    update: CURRENT_MILESTONE.md
    also: "archive outgoing content per DOCUMENTATION_LIFECYCLE.md first"
  - trigger: "a new technical debt item is found, or an existing one is resolved"
    update: TECHNICAL_DEBT.md
    also: "add narrative to ../04_PROJECT_MEMORY/KNOWN_TECHNICAL_DEBT.md"
  - trigger: "a new architectural constraint is ratified (e.g., an ADR draft is formally accepted)"
    update: ARCHITECTURE_CONSTRAINTS.md
  - trigger: "a new risk is identified, or an existing one is mitigated"
    update: KNOWN_RISKS.md
  - trigger: "Phase X (or any future phase) receives or loses approval for a specific scope"
    update: NEXT_APPROVED_PHASE.md
  - trigger: "a frozen module list changes (a new phase is frozen)"
    update: FREEZE_STATUS.md
  - trigger: "a new naming collision, or any other repository-structure fact, is discovered"
    update: REPOSITORY_CONTEXT.md
```

## The Ownership Map Must Stay Complete

Per the QA audit finding (`DOCUMENTATION_BACKLOG.md` item 3), `SCHEMA.md`'s `owns:` map was
found incomplete — 6 files existed without being registered. **Any new file added to
`02_AI_CONTEXT/` must be added to `SCHEMA.md`'s `owns:` map in the same change**, listing
exactly which facts it owns. A file that owns a fact but isn't in the map is, by definition,
not actually enforcing Constitution Article II — it's a silent gap waiting to cause the next
staleness incident.

## What "In Sync" Means

Not "updated eventually" — updated **in the same change** that altered the underlying fact.
The `.memory/` staleness incident happened because updates were deferred and accumulated
across multiple files simultaneously; this policy exists specifically to make "update the
AI Context file now, as part of this change" the default rather than a follow-up task that's
easy to forget.

## Recommended (Not Yet Built) Automation

Tracked in `DOCUMENTATION_BACKLOG.md`'s Future Ideas: a script that checks whether
`CURRENT_RELEASE.md`'s stated test count matches a live `vitest run` output, flaggable as a
pre-commit or CI check. Until built, the discipline above is manual — treat this policy
document itself as the checklist until automation exists.
