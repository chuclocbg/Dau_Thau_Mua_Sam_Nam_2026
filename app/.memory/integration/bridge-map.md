# Integration Bridge Map

Visual map of all cross-module bridges in the platform.

---

## Current Bridge Chain (Phases A–I)

```
MasterData ──────────────────────────────────────────────┐
  └── masterdataIntegration.ts ──────────────────────────┤
                                                          ↓
Workflow Engine ─────────────────────────────────────────→ Package
                                                          ↓
Procurement Rule Engine ─────────────────────────────────→ packageIntegration.ts
Legal (legalSchema) ─────────────────────────────────────┘
                                                          ↓
                                                       Planning
                                                          ↓
                                                    planningIntegration.ts
                                                          ↓
                                                       Approval
                                                          ↓
                                                    approvalIntegration.ts
                                                          ↓
                                                       Contract
                                                          ↓
                                                    contractIntegration.ts
                                                          ↓
                                                      Acceptance
                                                          ↓
                                                   acceptanceIntegration.ts
                                                          ↓
                                               Shared Financial Domain
                                                          ↓
                                                   financialIntegration.ts
                                                          ↓
                                                       Payment
```

---

## Bridge Ownership Table

| Bridge File | Owned By | Imports From (frozen) | Purpose |
|-------------|----------|-----------------------|---------|
| `masterdataIntegration.ts` | MasterData | Workflow | Seed workflow with masterdata reference values |
| `packageIntegration.ts` | Package | MasterData, Workflow, RuleEngine | Classify + submit packages |
| `planningIntegration.ts` | Planning | Package, MasterData, Workflow, RuleEngine | Build plan workflows, convert requests to packages |
| `approvalIntegration.ts` | Approval | Package, Planning, Workflow, MasterData | Route approval to correct authority |
| `contractIntegration.ts` | Contract | Approval, Workflow | Create contract from approved decision |
| `acceptanceIntegration.ts` | Acceptance | Contract, Workflow | Link acceptance to contract lifecycle |
| `financialIntegration.ts` | SharedFinancial | MasterData, Legal | Build standard legal basis citations |
| `paymentIntegration.ts` | Payment | Acceptance, Contract, SharedFinancial | Build payment from completed acceptance |

---

## Future Bridges (Phases J–N)

| Bridge File | Owned By | Imports From | Phase |
|-------------|----------|-------------|-------|
| (auth bridge not needed — auth is at API layer only) | — | — | J |
| `knowledgeIntegration.ts` | Knowledge | src/legal/ | N |
| `reasoningIntegration.ts` | Reasoning | src/knowledge/ | N |
| `aiIntegration.ts` | AI Context | src/reasoning/ | N |
| `supplierIntegration.ts` | Supplier | src/masterdata/ | O |

---

## Bridge File Rules

1. Bridge files contain zero business logic
2. Bridge files contain zero conditionals based on procurement rules
3. Bridge files only adapt data shapes and call frozen module APIs
4. Each bridge is owned by the newer (consuming) module
5. Bridge file naming: `[moduleDir]Integration.ts` in the consuming module's directory
