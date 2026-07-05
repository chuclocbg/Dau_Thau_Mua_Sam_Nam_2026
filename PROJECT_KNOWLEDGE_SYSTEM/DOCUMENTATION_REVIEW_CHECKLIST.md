# Documentation Review Checklist

**Purpose:** A concrete, repeatable checklist operationalizing the Documentation QA Audit's
methodology — so future changes are checked the same rigorous way, not just at audit time.

**Audience:** Anyone completing a documentation change per [`DOCUMENTATION_CHANGE_POLICY.md`](DOCUMENTATION_CHANGE_POLICY.md).

**Dependencies:** [`DOCUMENTATION_STYLE_GUIDE.md`](DOCUMENTATION_STYLE_GUIDE.md), [`DOCUMENTATION_TEMPLATE.md`](DOCUMENTATION_TEMPLATE.md).

**Status:** ACTIVE checklist as of `PROJECT_KNOWLEDGE_SYSTEM v1.0`.

**Related:** [`DOCUMENTATION_HEALTH_REPORT.md`](DOCUMENTATION_HEALTH_REPORT.md) (the audit this checklist operationalizes)

## Table of Contents

1. [Before Writing](#before-writing)
2. [Template Completeness](#template-completeness)
3. [Single Source of Truth](#single-source-of-truth)
4. [Link Integrity](#link-integrity)
5. [Terminology](#terminology)
6. [AI Context Specific](#ai-context-specific)
7. [Archival (If Applicable)](#archival-if-applicable)

---

## Before Writing

- [ ] Read [`DOCUMENTATION_CONSTITUTION.md`](DOCUMENTATION_CONSTITUTION.md) if this is your
      first change to this system.
- [ ] Confirm which folder this change belongs in and read that folder's rule in
      [`DOCUMENTATION_CHANGE_POLICY.md`](DOCUMENTATION_CHANGE_POLICY.md).
- [ ] Check `02_AI_CONTEXT/SCHEMA.md`'s ownership map — does this fact already have an owner?
      If yes, link to it; do not restate it (Article II).

## Template Completeness

- [ ] Does the file have all 6 required fields (Purpose, Audience, Dependencies, Status, Table
      of Contents, Related)? Use [`DOCUMENTATION_TEMPLATE.md`](DOCUMENTATION_TEMPLATE.md) —
      this exact check is what the audit found failing in 8 files; do not repeat that gap.
- [ ] Is the `Status:` field using the scoped legend correctly (see Style Guide)?

## Single Source of Truth

- [ ] Does any fact in this file duplicate a fact already owned elsewhere? If the duplication
      is the deliberate human/machine dual-representation exception (Article IV), is that
      explicitly stated?
- [ ] If this file now owns a new fact, is it added to `SCHEMA.md`'s `owns:` map (for
      `02_AI_CONTEXT/` files)?

## Link Integrity

- [ ] Every new relative link resolves to an actual file (re-run the validation approach from
      the QA audit: extract all `](path.md)` patterns, verify each target exists).
- [ ] Every file that now references this new/changed file has been checked for its own
      continued accuracy.

## Terminology

- [ ] `frozen`/`Frozen`/`FROZEN` capitalization follows the Style Guide's rule.
- [ ] No undefined internal jargon (session-specific shorthand, unexplained abbreviations).
- [ ] Vietnamese terms given with English translation on first use, per Style Guide.
- [ ] No placeholder text (`TODO`, `TBD`, `lorem ipsum`, `FIXME`) — grep for these before
      considering any file done.

## AI Context Specific

*(Only applies to changes in `02_AI_CONTEXT/`)*

- [ ] `## Machine Context` heading present, immediately before the YAML fence.
- [ ] YAML keys conform to `SCHEMA.md`'s shared vocabulary (`as_of`, `status`, `owner_file`,
      `related`).
- [ ] `status:` value is one of `CURRENT`, `STALE`, `SUPERSEDED` — never free text.

## Archival (If Applicable)

*(Only applies to changes touching `CURRENT_MILESTONE.md` or `CURRENT_RELEASE.md`)*

- [ ] Outgoing content copied to the corresponding `04_PROJECT_MEMORY/` history file **first**,
      per [`DOCUMENTATION_LIFECYCLE.md`](DOCUMENTATION_LIFECYCLE.md)'s trigger.
- [ ] Only then was the `CURRENT_*.md` file overwritten.
