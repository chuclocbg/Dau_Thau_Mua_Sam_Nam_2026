# ADR (Architecture Decision Records)

**Purpose:** Mirror/index of the project's Architecture Decision Records for readers who start
from the Knowledge Base rather than `app/docs/`.

**Status:** Scaffolded. **This folder does not duplicate ADR content** — it links to the two
existing, authoritative ADR sequences.

## Known Structural Issue (documented, not yet fixed)

This project currently has **two independent ADR numbering sequences that reuse the same
numbers for different decisions**: `app/docs/adr/ADR-00X-*.md` (10 ADRs, business-module era)
and `app/.memory/decisions/ADR-00X-*.md` (21+ ADRs, a different sequence). The canonical
`app/.memory/decision-index.md` correctly disambiguates both (mapping its own numbers onto
file paths in each), but a reader browsing the two folders directly will see, e.g., "ADR-004"
mean two unrelated things. **Do not add a third ADR sequence here** — this folder should only
ever link to `app/.memory/decision-index.md` as the single point of disambiguation, and to
`app/docs/adr/` and `app/.memory/decisions/` for full text.

## A Third, Deliberately Separate Sequence: Phase X ADR Drafts

Since v1.0, Phase X ADR drafts have begun being persisted under
[`../../01_PROJECT_DOCS/`](../../01_PROJECT_DOCS/) (e.g.
[`PHASE_X_ADR_DRAFT_001.md`](../../01_PROJECT_DOCS/PHASE_X_ADR_DRAFT_001.md)), numbered `X01`,
`X02`, etc. — **deliberately not** `ADR-00X`, specifically to avoid becoming a third instance
of the numbering collision described above. These are DRAFT/DECIDED-but-unratified; formal
ratification into `app/.memory/decision-index.md` is a separate, explicit action.

## Future Contents

Once the `docs/adr/` vs `.memory/decisions/` numbering is reconciled (a tracked, low-effort fix
— see [`../../02_AI_CONTEXT/TECHNICAL_DEBT.md`](../../02_AI_CONTEXT/TECHNICAL_DEBT.md)), this
folder can hold a genuine unified index. Until then, treat `app/.memory/decision-index.md` as
authoritative for ratified ADRs, and `01_PROJECT_DOCS/PHASE_X_ADR_DRAFT_*.md` for pending ones.

## Ownership

Owned by whoever maintains `app/.memory/decision-index.md` (ratified ADRs) and whoever drafts
new Phase X ADRs (drafts). This folder itself owns nothing — it is a pure index.

## Update Policy

Additive only. Add a link here when a new Phase X ADR draft is written; never restate its content.

**Related:** [`../decision-log/README.md`](../decision-log/README.md) · [`../../04_PROJECT_MEMORY/DECISION_HISTORY.md`](../../04_PROJECT_MEMORY/DECISION_HISTORY.md)
