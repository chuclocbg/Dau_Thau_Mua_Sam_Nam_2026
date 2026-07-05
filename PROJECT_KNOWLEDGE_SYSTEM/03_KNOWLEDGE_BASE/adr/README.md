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

## Future Contents

Once the numbering is reconciled (a tracked, low-effort fix — see
[`../../02_AI_CONTEXT/TECHNICAL_DEBT.md`](../../02_AI_CONTEXT/TECHNICAL_DEBT.md)), this folder
can hold a genuine unified index. Until then, treat `app/.memory/decision-index.md` as
authoritative.

**Related:** [`../decision-log/README.md`](../decision-log/README.md) · [`../../04_PROJECT_MEMORY/DECISION_HISTORY.md`](../../04_PROJECT_MEMORY/DECISION_HISTORY.md)
