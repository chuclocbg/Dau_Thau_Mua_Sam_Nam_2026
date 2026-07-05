# Graph Nodes

All platform concepts tracked in the memory graph.
Format: `id | type | label | status | location/reference`

---

## Module Nodes

| ID | Type | Label | Status | Location |
|----|------|-------|--------|----------|
| mod:legal | MODULE | Legal Foundation | FROZEN | src/legal/ |
| mod:legal-domain | MODULE | Legal Domain Services | FROZEN | src/legal/domain/ |
| mod:agents | MODULE | Legal Document Importer | FROZEN | src/agents/ |
| mod:masterdata | MODULE | Master Data | FROZEN | src/masterdata/ |
| mod:workflow | MODULE | Workflow Engine | FROZEN | src/procurement/workflow/ |
| mod:rules | MODULE | Procurement Rule Engine | FROZEN | src/procurement/rules/ + application/ |
| mod:package | MODULE | Procurement Package | FROZEN | src/procurement/package/ |
| mod:planning | MODULE | Procurement Planning | FROZEN | src/procurement/planning/ |
| mod:approval | MODULE | Approval Module | FROZEN | src/approval/ |
| mod:contract | MODULE | Contract Module | FROZEN | src/contract/ |
| mod:acceptance | MODULE | Acceptance Module | FROZEN | src/acceptance/ |
| mod:financial | MODULE | Shared Financial Domain | FROZEN | src/shared/financial/ |
| mod:payment | MODULE | Payment Module | FROZEN | src/payment/ |
| mod:auth | MODULE | Authentication & Authorization | PLANNED | src/auth/ (Phase J) |
| mod:storage | MODULE | Storage & Attachment | PLANNED | src/storage/ (Phase K) |
| mod:notification | MODULE | Notification Service | PLANNED | src/notification/ (Phase L) |
| mod:prisma | MODULE | Production Prisma Layer | PLANNED | distributed (Phase M) |
| mod:knowledge | MODULE | Knowledge Platform | PLANNED | src/knowledge/ (Phase N) |
| mod:reasoning | MODULE | Legal Reasoning Layer | PLANNED | src/reasoning/ (Phase N) |
| mod:ai | MODULE | AI Context Layer | PLANNED | src/ai/ (Phase N) |
| mod:supplier | MODULE | Supplier Registry | PLANNED | src/supplier/ (Phase O) |
| mod:advisory | MODULE | AI Advisory Layer | PLANNED | src/advisory/ (Phase X) |

---

## Decision Nodes (ADRs)

| ID | Type | Label | Status | Reference |
|----|------|-------|--------|-----------|
| adr:001 | DECISION | Hexagonal + Integration Bridge | ACTIVE | decisions/ADR-001-hexagonal.md |
| adr:002 | DECISION | Canonical IBaseRepository | ACTIVE | decisions/ADR-002-base-repository.md |
| adr:003 | DECISION | Domain type name resolution | ACTIVE | decisions/ADR-003-type-names.md |
| adr:004 | DECISION | Money = bigint | ACTIVE | decisions/ADR-004-money-bigint.md |
| adr:005 | DECISION | LegalBasis[] not string[] | ACTIVE | decisions/ADR-005-legal-basis.md |
| adr:007 | DECISION | Knowledge domain = open string | ACTIVE | decisions/ADR-007-open-domain.md |
| adr:008 | DECISION | Knowledge/Reasoning separation | ACTIVE | decisions/ADR-008-knowledge-reasoning-split.md |
| adr:009 | DECISION | AI context boundary | ACTIVE | decisions/ADR-009-ai-context-boundary.md |
| adr:010 | DECISION | Rules as KnowledgeItem data | ACTIVE | decisions/ADR-010-rules-as-data.md |
| adr:015 | DECISION | 4-tier conflict resolution | ACTIVE | decisions/ADR-015-conflict-resolution.md |

---

## Law Nodes

| ID | Type | Label | Status | Symbol |
|----|------|-------|--------|--------|
| law:ldt | LAW | Luật Đấu thầu | ACTIVE | 22/2023/QH15 |
| law:nd214 | LAW | NĐ chi tiết Luật Đấu thầu | ACTIVE | 214/2025/NĐ-CP |
| law:nd104 | LAW | NĐ sửa đổi NĐ 214 | ACTIVE | 104/2026/NĐ-CP |
| law:tt79 | LAW | TT tài chính đấu thầu | ACTIVE | 79/2025/TT-BTC |
| law:tt13 | LAW | TT mua sắm hàng hóa | ACTIVE | 13/2026/TT-BCT |

---

## Spec Nodes

| ID | Type | Label | Status | File |
|----|------|-------|--------|------|
| spec:n1 | SPEC | Corpus Foundation | FROZEN | knowledge/decisions/corpus-foundation.md |
| spec:n2 | SPEC | Legal Reasoning Architecture | FROZEN | knowledge/decisions/reasoning-architecture.md |
| spec:n3 | SPEC | AI Context Contract | FROZEN | knowledge/decisions/ai-context-contract.md |
| spec:knowledge | SPEC | Knowledge Platform V2 | FROZEN | knowledge/decisions/knowledge-platform-v2.md |

---

## Phase Nodes

| ID | Type | Label | Status |
|----|------|-------|--------|
| phase:j | PHASE | Authentication & Authorization | NEXT |
| phase:k | PHASE | Storage & Attachment | PLANNED |
| phase:l | PHASE | Notification Service | PLANNED |
| phase:m | PHASE | Production Prisma Layer | PLANNED |
| phase:n | PHASE | Knowledge Platform | PLANNED |
| phase:o | PHASE | Supplier Registry | PLANNED |
| phase:x | PHASE | AI Advisory Layer | PLANNED |
