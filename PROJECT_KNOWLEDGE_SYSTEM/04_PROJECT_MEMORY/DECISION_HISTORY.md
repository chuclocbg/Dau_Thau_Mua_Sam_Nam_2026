# Decision History

**Purpose:** The reasoning behind key decisions — the "why," in narrative form, complementing
the formal ADRs in `app/.memory/decisions/` and `app/docs/adr/`.

**Related:** [`../03_KNOWLEDGE_BASE/adr/README.md`](../03_KNOWLEDGE_BASE/adr/README.md) · [Architecture Evolution](ARCHITECTURE_EVOLUTION.md)

## Selected Decisions and Their Reasoning

**Freeze modules permanently, extend only via bridge files.** Chosen over "allow careful edits
to existing modules with good test coverage" because test coverage alone doesn't prevent
subtle behavioral drift across 21+ phases of continuous work — freezing removes the temptation
entirely and has held for the whole project without exception.

**Knowledge Platform domain is an open string, never an enum.** Chosen over a `type Domain =
'legal' | 'procurement' | ...` union because a union requires a code change (and a rebuild of
every switch/match over it) for every new domain. Proven right: 16 domains added, zero type
changes.

**Advisors (Phase X) are data profiles, not service classes.** Chosen after the Phase X
architecture review explicitly identified "one class per advisor" as the most tempting and
most costly available mistake — it would have reintroduced exactly the sprawl the Knowledge
Platform's provider pattern was built to avoid. The decision reuses a pattern already proven
16 times rather than inventing a 17th one for a superficially different problem.

**Exactly one LLM call per answer, even in multi-agent flows.** Chosen over LLM-to-LLM agent
conversations because every additional LLM hop is another place a hallucination can be
introduced before the single `OutputValidator` gate ever sees it — cost, latency, and
validation-surface-area all point the same direction.

**`resolveCases`/`resolveBestPractice` retrieval strategy (ADR-DRAFT-X01).** The pre-existing
Phase X design docs assumed a `(question, context, limit)` signature that doesn't exist on the
frozen platform. Rather than modify the frozen interface, the decision was to recognize that
`searchKnowledge(text, domains, context, limit)` — already on the frozen interface — covers
the exact same need. Zero platform changes required. This was found by close reading, not
assumed; it is the single most concrete, checkable finding across the entire Phase X review
cycle.

**MCP and Multi-Agent: designed, explicitly not built.** Chosen because no production usage
data exists yet to justify either, and this project's own history (the advisor-as-data
decision, above) shows the cost of building ahead of proven need is real, not theoretical.

Full reasoning for each Knowledge Platform-era decision, including every ADR text: `app/.memory/decision-index.md`.
