# Documentation Constitution

**Purpose:** The supreme, non-negotiable governing law for `PROJECT_KNOWLEDGE_SYSTEM` itself —
the documentation equivalent of `01_PROJECT_DOCS/CONSTITUTION.md` (which governs *code*). Every
other governance document (`DOCUMENTATION_STYLE_GUIDE.md`, `DOCUMENTATION_LIFECYCLE.md`,
`DOCUMENTATION_CHANGE_POLICY.md`, `DOCUMENTATION_REVIEW_CHECKLIST.md`,
`DOCUMENTATION_TEMPLATE.md`, `DOCUMENTATION_VERSIONING.md`, `AI_CONTEXT_UPDATE_POLICY.md`,
`KNOWLEDGE_BASE_EDITOR_GUIDE.md`) must comply with this one; where any of them conflicts with
this document, this document wins.

**Audience:** Anyone, human or AI, who will ever add, edit, or review a file in
`PROJECT_KNOWLEDGE_SYSTEM/`.

**Status:** FROZEN as governing law as of `PROJECT_KNOWLEDGE_SYSTEM v1.0`. Individual articles
may be amended only through the process defined in [`DOCUMENTATION_CHANGE_POLICY.md`](DOCUMENTATION_CHANGE_POLICY.md).

**Related:** [`README.md`](README.md) · [`01_PROJECT_DOCS/CONSTITUTION.md`](01_PROJECT_DOCS/CONSTITUTION.md) · [`DOCUMENTATION_HEALTH_REPORT.md`](DOCUMENTATION_HEALTH_REPORT.md)

---

## Table of Contents

1. [The Eight Articles](#the-eight-articles)
2. [Article I — Never Fabricate](#article-i--never-fabricate)
3. [Article II — Single Owner Per Fact](#article-ii--single-owner-per-fact)
4. [Article III — Never Rewrite History](#article-iii--never-rewrite-history)
5. [Article IV — Two Styles, One System](#article-iv--two-styles-one-system)
6. [Article V — Archive Before Overwrite](#article-v--archive-before-overwrite)
7. [Article VI — Zero Broken Links](#article-vi--zero-broken-links)
8. [Article VII — Severity Classification](#article-vii--severity-classification)
9. [Article VIII — Documentation Debt Is Real Debt](#article-viii--documentation-debt-is-real-debt)

---

## The Eight Articles

Every rule in every other governance document traces back to one of these eight. If a
proposed process doesn't trace back to an article here, it needs a ninth article added first
— not a silent exception.

## Article I — Never Fabricate

No file in this system states a completed task, a test result, a verified status, or a fact
that was not actually checked. "Scaffolded, not yet populated" is an acceptable, honest status.
A false "Complete" is not. This mirrors `CLAUDE.md`'s own rule for code, applied to
documentation with equal force.

## Article II — Single Owner Per Fact

Every fact stated anywhere in this system has exactly one file that owns it. Every other file
that needs the fact links to the owner rather than restating it — with one documented
exception: a fact may be deliberately restated once for a human audience
(`01_PROJECT_DOCS/`) and once for a machine audience (`02_AI_CONTEXT/`), per Article IV, as
long as this dual representation is itself declared, not silent. `02_AI_CONTEXT/SCHEMA.md`'s
`owns:` map is the canonical registry of ownership and must be kept complete — an unregistered
file that owns a fact is itself a Constitution violation.

## Article III — Never Rewrite History

`04_PROJECT_MEMORY/` is append-only. A past entry is never edited to make it read as if a
mistake never happened; a correction is a new entry, dated, explaining what was wrong and what
is now believed instead. This is the documentation-layer expression of the same principle that
governs frozen code modules — the past is immutable, only the present adds to it.

## Article IV — Two Styles, One System

`01_PROJECT_DOCS/` is human-oriented and explanatory; `02_AI_CONTEXT/` is machine-readable,
compact, and deterministic. Neither style is permitted to drift toward the other — a Project
Docs file that becomes a terse YAML dump, or an AI Context file that becomes narrative prose,
is a Constitution violation regardless of how accurate its content is. Full rules:
[`DOCUMENTATION_STYLE_GUIDE.md`](DOCUMENTATION_STYLE_GUIDE.md).

## Article V — Archive Before Overwrite

Any file designated as holding only *current* state (`CURRENT_MILESTONE.md`,
`CURRENT_RELEASE.md`, and any future file following the same pattern) must have its outgoing
content appended to its corresponding `04_PROJECT_MEMORY/` history file **before** it is
overwritten. This is not optional and not left to memory alone — see
[`DOCUMENTATION_LIFECYCLE.md`](DOCUMENTATION_LIFECYCLE.md) for the concrete trigger.

## Article VI — Zero Broken Links

Every relative markdown link in this system must resolve to an actual file. This is
mechanically checkable (see [`DOCUMENTATION_REVIEW_CHECKLIST.md`](DOCUMENTATION_REVIEW_CHECKLIST.md))
and must be verified, not assumed, before any change is considered complete.

## Article VII — Severity Classification

Every finding, risk, or debt item recorded anywhere in this system uses the same four-tier
scale used by the code review and audit-first principles in `CLAUDE.md` and
`01_PROJECT_DOCS/CONSTITUTION.md`: `[CRITICAL]`, `[HIGH]`, `[MEDIUM]`, `[LOW]`. No governance
document may invent a different scale.

## Article VIII — Documentation Debt Is Real Debt

A gap in documentation — a missing template field, an unregistered fact owner, an unenforced
rule — is tracked with the same seriousness as code technical debt: given an ID, a severity, an
owner, and a location, never left as an implicit, undocumented shortcoming. See
`DOCUMENTATION_BACKLOG.md` for the currently tracked instance of this article in practice.
