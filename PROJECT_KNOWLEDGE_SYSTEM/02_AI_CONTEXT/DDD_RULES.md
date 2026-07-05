# DDD Rules

**Purpose:** How Domain-Driven Design concepts are actually applied here — bounded contexts,
aggregates, value objects — so new code models the domain consistently with existing code.

## Machine Context

```yaml
as_of: 2026-07-05
status: CURRENT
related: [../01_PROJECT_DOCS/DOMAIN_MODEL.md, ARCHITECTURE_CONSTRAINTS.md]

bounded_contexts:
  - Legal Foundation
  - Master Data
  - Workflow Engine
  - Procurement (Package, Planning, Rules)
  - Approval
  - Contract
  - Acceptance
  - Shared Financial Domain
  - Payment
  - Auth
  - Storage
  - Notification
  - Knowledge Platform (16 sub-domains, see below)

value_objects_shared_across_contexts:
  - name: Money
    definition: "{ amount: bigint, currency: CurrencyCode }"
    location: src/shared/financial/money.ts
  - name: LegalBasis
    definition: "structured legal citation, never a bare string"
    location: src/shared/financial/financialFactory.ts (createLegalBasis)

aggregate_roots:
  - ProcurementPackage (ADR: docs/adr/ADR-004-procurement-package-aggregate-root.md)
  - WorkflowInstance
  - ProcurementPlan

known_aggregate_note: "ProcurementNeed is embedded IN ProcurementRequest, not a separate
                        aggregate/repository — a deliberate decision (see project memory
                        decision history), not an oversight."

knowledge_platform_domain_model:
  entity: "KnowledgeItem — universal across all 16 providers, no domain-specific subtypes"
  relation: "KnowledgeRelationType — open string, 10 documented constants + provider-invented
             extensions (BROADER_THAN, ABBREVIATES, TRANSLATES_TO, BLACKLISTED_FOR,
             ROLLS_UP_TO, ESCALATES_TO, RESTRICTS, REVEALED, MITIGATED_BY, REMEDIATED_BY,
             DERIVED_FROM, CORRECTS — 12 beyond the original 10)"
  rule: "KnowledgeApplicabilityRule — universal, same evaluator for every domain"

domain_leak_known_debt:
  - "procurementEngine.ts mixes application orchestration with embedded law-symbol
     conditionals (hardcoded checks like d.symbol === '13/2026/TT-BCT') — a documented
     domain-logic leak into what should be a thin coordinator. See technical debt register."
```
