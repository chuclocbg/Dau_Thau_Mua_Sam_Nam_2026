# Memory Graph Specification

A lightweight directed graph representing relationships between platform concepts.
NOT a graph database. Stored as markdown tables in `nodes.md` and `edges.md`.
Future implementation: Apache AGE (Phase N corpus graph).

---

## Node Types

| Type | Description | ID Prefix |
|------|-------------|-----------|
| MODULE | A software module in src/ | `mod:` |
| DECISION | An architectural decision record | `adr:` |
| LAW | A governing legal instrument | `law:` |
| PROVIDER | A Knowledge Platform provider | `prov:` |
| BRIDGE | An Integration bridge file | `bridge:` |
| PHASE | A development phase | `phase:` |
| SPEC | An architecture specification (frozen) | `spec:` |

---

## Edge Types

| Type | Meaning | Directionality |
|------|---------|----------------|
| DEPENDS_ON | A imports from B | A → B |
| BRIDGES_TO | Bridge mediates A consuming B | bridge → frozen module |
| CONSUMED_BY | B consumes A (reverse of DEPENDS_ON) | A → B (where B is new) |
| IMPLEMENTS | A implements the interface/spec B | A → B |
| ENFORCES | Module A enforces law B | A → B |
| FROZEN_BEFORE | A was frozen before B was built | A → B (temporal) |
| AFFECTS | Decision A affects module B | A → B |
| SUPERSEDES | Law/spec A supersedes B | A → B |
| PART_OF | A is a sub-component of B | A → B |
| PLANNED_AFTER | Phase A must complete before Phase B starts | A → B |

---

## Serialization Format

Each node/edge is one row in the markdown tables in `nodes.md` and `edges.md`.

Node format: `id | type | label | status | location`
Edge format: `from_id | type | to_id | label | notes`

---

## Query Patterns

This graph enables the following lookup patterns:
- "What does Module X depend on?" → DEPENDS_ON edges from X
- "What modules consume Module X?" → CONSUMED_BY or DEPENDS_ON edges TO X
- "What decisions affect Module X?" → AFFECTS edges TO X
- "What laws does Module X enforce?" → ENFORCES edges from X
- "What phases must complete before Phase Y?" → PLANNED_AFTER chain ending at Y
- "What bridges cross to Module X?" → BRIDGES_TO edges to X

---

## Maintenance

Update `nodes.md` and `edges.md` when:
- A new module is frozen
- A new ADR is published
- A new phase is added to the roadmap
- A new bridge file is created
- A law/decree/circular takes effect
