# Graph Edges

All relationships between platform concepts.
Format: `from_id | edge_type | to_id | notes`

---

## Module Dependency Edges (DEPENDS_ON)

| From | Edge | To | Notes |
|------|------|-----|-------|
| mod:package | DEPENDS_ON | mod:masterdata | via packageIntegration.ts |
| mod:package | DEPENDS_ON | mod:workflow | via packageIntegration.ts |
| mod:package | DEPENDS_ON | mod:rules | via packageIntegration.ts |
| mod:planning | DEPENDS_ON | mod:package | direct |
| mod:planning | DEPENDS_ON | mod:masterdata | via planningIntegration.ts |
| mod:planning | DEPENDS_ON | mod:workflow | via planningIntegration.ts |
| mod:planning | DEPENDS_ON | mod:rules | via planningIntegration.ts |
| mod:approval | DEPENDS_ON | mod:package | via approvalIntegration.ts |
| mod:approval | DEPENDS_ON | mod:planning | via approvalIntegration.ts |
| mod:approval | DEPENDS_ON | mod:workflow | via approvalIntegration.ts |
| mod:approval | DEPENDS_ON | mod:masterdata | via approvalIntegration.ts |
| mod:contract | DEPENDS_ON | mod:approval | via contractIntegration.ts |
| mod:contract | DEPENDS_ON | mod:workflow | via contractIntegration.ts |
| mod:acceptance | DEPENDS_ON | mod:contract | via acceptanceIntegration.ts |
| mod:acceptance | DEPENDS_ON | mod:workflow | via acceptanceIntegration.ts |
| mod:financial | DEPENDS_ON | mod:masterdata | CurrencyCode |
| mod:financial | DEPENDS_ON | mod:legal | LegalReference |
| mod:payment | DEPENDS_ON | mod:acceptance | via paymentIntegration.ts |
| mod:payment | DEPENDS_ON | mod:contract | via paymentIntegration.ts |
| mod:payment | DEPENDS_ON | mod:financial | direct |
| mod:knowledge | DEPENDS_ON | mod:legal | via knowledgeIntegration.ts |
| mod:reasoning | DEPENDS_ON | mod:knowledge | via reasoningIntegration.ts |
| mod:ai | DEPENDS_ON | mod:reasoning | via aiIntegration.ts |
| mod:advisory | DEPENDS_ON | mod:ai | AIContext only |
| mod:storage | DEPENDS_ON | mod:auth | userId |
| mod:notification | DEPENDS_ON | mod:auth | userId |
| mod:prisma | DEPENDS_ON | mod:auth | schema |
| mod:prisma | DEPENDS_ON | mod:storage | schema |
| mod:prisma | DEPENDS_ON | mod:notification | schema |
| mod:knowledge | DEPENDS_ON | mod:prisma | DB |
| mod:supplier | DEPENDS_ON | mod:masterdata | reference data |

---

## Decision → Module Edges (AFFECTS)

| From | Edge | To | Notes |
|------|------|-----|-------|
| adr:001 | AFFECTS | mod:package | Integration Bridge pattern |
| adr:001 | AFFECTS | mod:planning | Integration Bridge pattern |
| adr:001 | AFFECTS | mod:approval | Integration Bridge pattern |
| adr:002 | AFFECTS | mod:legal | IBaseRepository canonical location |
| adr:004 | AFFECTS | mod:financial | Money = bigint |
| adr:005 | AFFECTS | mod:financial | LegalBasis type |
| adr:005 | AFFECTS | mod:acceptance | TD-01 violation |
| adr:007 | AFFECTS | mod:knowledge | domain open string |
| adr:008 | AFFECTS | mod:knowledge | separation from reasoning |
| adr:008 | AFFECTS | mod:reasoning | separation from knowledge |
| adr:009 | AFFECTS | mod:ai | AIContext boundary |
| adr:009 | AFFECTS | mod:advisory | import restrictions |
| adr:010 | AFFECTS | mod:reasoning | rules as data |
| adr:015 | AFFECTS | mod:reasoning | conflict resolution order |

---

## Law → Module Edges (ENFORCES)

| From | Edge | To | Notes |
|------|------|-----|-------|
| mod:rules | ENFORCES | law:ldt | method selection |
| mod:rules | ENFORCES | law:nd214 | thresholds |
| mod:rules | ENFORCES | law:nd104 | amended thresholds |
| mod:payment | ENFORCES | law:tt79 | advance payment, retention |
| mod:payment | ENFORCES | law:tt13 | goods procurement rules |
| mod:approval | ENFORCES | law:ldt | authority levels |

---

## Phase Ordering Edges (PLANNED_AFTER)

| From | Edge | To | Notes |
|------|------|-----|-------|
| phase:j | PLANNED_AFTER | (none) | First unblocked phase |
| phase:k | PLANNED_AFTER | phase:j | needs userId |
| phase:l | PLANNED_AFTER | phase:j | needs userId |
| phase:m | PLANNED_AFTER | phase:j | — |
| phase:m | PLANNED_AFTER | phase:k | storage schema |
| phase:m | PLANNED_AFTER | phase:l | notification schema |
| phase:n | PLANNED_AFTER | phase:m | needs real DB |
| phase:o | PLANNED_AFTER | phase:n | needs knowledge layer |
| phase:x | PLANNED_AFTER | phase:n | needs AI contracts |

---

## Law Supersession Edges (SUPERSEDES)

| From | Edge | To | Notes |
|------|------|-----|-------|
| law:nd104 | SUPERSEDES | law:nd214 | partial — some articles |
