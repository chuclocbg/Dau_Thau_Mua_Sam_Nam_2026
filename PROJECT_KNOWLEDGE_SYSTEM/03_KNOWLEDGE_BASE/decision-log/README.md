# Decision Log

**Purpose:** A chronological (not thematic, that's what [`../adr/`](../adr/README.md) is for)
record of decisions made, for readers who want "what happened, in order" rather than
"what was decided about X."

**Status:** Scaffolded. Mirrors `app/.memory/decision-log.md` (the legacy pre-ADR log) and
should eventually be reconciled with [`../../04_PROJECT_MEMORY/DECISION_HISTORY.md`](../../04_PROJECT_MEMORY/DECISION_HISTORY.md)
(which tells the *narrative* — why — behind each entry here).

## Future Contents

- Chronological entries, one per significant decision, each linking to its full ADR (if one
  exists) or its narrative explanation in Project Memory.
- This folder is **append-only** — never edit a past entry to "correct" history; add a new
  entry noting the correction instead, per the project's own "never rewrite history" principle.

## Boundaries

Chronological pointers only — full narrative reasoning lives in
[`../../04_PROJECT_MEMORY/DECISION_HISTORY.md`](../../04_PROJECT_MEMORY/DECISION_HISTORY.md);
this folder never repeats that reasoning, only dates and links to it.

## Ownership

Owned by whoever maintains `app/.memory/decision-log.md`. This folder mirrors it, never leads it.

## Update Policy

Append-only, per Constitution Article III. A new entry per significant decision, dated, never
edited after the fact.

**Related:** [`../adr/README.md`](../adr/README.md) · [`../../04_PROJECT_MEMORY/DECISION_HISTORY.md`](../../04_PROJECT_MEMORY/DECISION_HISTORY.md)
