# Documentation Style Guide

**Purpose:** Concrete, checkable style rules — resolving, going forward, the terminology and
naming inconsistencies found in the Documentation QA Audit (`DOCUMENTATION_BACKLOG.md` items
5, 9, 10, 11).

**Audience:** Anyone writing or editing any file in this system.

**Dependencies:** [`DOCUMENTATION_CONSTITUTION.md`](DOCUMENTATION_CONSTITUTION.md) Article IV.

**Status:** ACTIVE governing style as of `PROJECT_KNOWLEDGE_SYSTEM v1.0`.

**Related:** [`DOCUMENTATION_TEMPLATE.md`](DOCUMENTATION_TEMPLATE.md) · [`DOCUMENTATION_REVIEW_CHECKLIST.md`](DOCUMENTATION_REVIEW_CHECKLIST.md)

## Table of Contents

1. [File Naming Convention (Now Explicit)](#file-naming-convention-now-explicit)
2. [The Status Legend — Scoped](#the-status-legend--scoped)
3. [Capitalization Rule: frozen / Frozen / FROZEN](#capitalization-rule-frozen--frozen--frozen)
4. [Heading Structure](#heading-structure)
5. [Internal Jargon](#internal-jargon)
6. [Vietnamese/English Term Handling](#vietnameseenglish-term-handling)
7. [Link Style](#link-style)

---

## File Naming Convention (Now Explicit)

This split is **intentional**, resolving the previously-undocumented inconsistency:

- `01_PROJECT_DOCS/`, `02_AI_CONTEXT/`, `04_PROJECT_MEMORY/`, and the governance layer
  (this file and its siblings): `UPPER_SNAKE_CASE.md` — these are individual, named documents
  meant to be referenced by exact name.
- `03_KNOWLEDGE_BASE/`: `lowercase-with-dashes/README.md` — these are domain *directories*
  (following standard directory naming) whose entry point is always `README.md`, the
  universal convention for "the file you see when you open this folder."

## The Status Legend — Scoped

The `FROZEN` / `APPROVED` / `PLANNED` legend (declared in `01_PROJECT_DOCS/README.md`) applies
**only** to documents describing the status of a body of work (architecture, a module, a
phase) — e.g., `CONSTITUTION.md`, `KNOWLEDGE_PLATFORM.md`, `AI_ADVISORY_ARCHITECTURE.md`. It
does **not** apply to documents describing their own currency as a document (e.g.,
`EXECUTIVE_SUMMARY.md`'s "current as of `v1.0-knowledge-platform`") — those use free-text
dated prose instead, since "is this document up to date" and "is the thing it describes frozen"
are different questions. Both are legitimate `Status:` field uses; state which kind a document
is using if it's ever ambiguous.

## Capitalization Rule: frozen / Frozen / FROZEN

- `frozen` (lowercase) — regular prose use, e.g., "a frozen module."
- `Frozen` (title case) — only at the start of a sentence, or in a proper heading.
- `FROZEN` (all caps) — reserved exclusively for a `Status:` field value under the scoped
  legend above. Never use `FROZEN` in running prose to mean "definitely, really frozen, I
  promise" — that's what `frozen` already means; all-caps is a status-field signal, not an
  emphasis device.

## Heading Structure

`#` for the document title (one per file). `##` for major sections, always listed in a
"Table of Contents" section immediately after the header block. `###` for subsections within
a major section. Never skip a level (no `#` directly to `###`).

## Internal Jargon

Session-specific or process-specific shorthand (e.g., a numbered generation "wave," an
internal review round number) must never appear in a file without being defined in that same
file, and should generally be avoided in `04_PROJECT_MEMORY/` in favor of plain description of
what actually happened — a future reader has no access to the conversation that produced the
jargon.

## Vietnamese/English Term Handling

Vietnamese domain terms (HSMT, KHLCNT, etc.) are always given with their Vietnamese form first,
English translation second, on first use in any document — see
`01_PROJECT_DOCS/GLOSSARY.md`'s table format as the canonical pattern. Do not translate a
Vietnamese legal term into English-only prose; the Vietnamese term is the authoritative one.

## Link Style

Every "related documents" reference uses the single-line format:
`**Related:** [Label](path.md) · [Label](path.md)` — never link-only prose buried mid-paragraph
as the sole way to find a related document. Inline prose links are fine *in addition to* the
Related line, never as a replacement for it.
