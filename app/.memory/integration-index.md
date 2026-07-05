# Integration Index

Documents every cross-module bridge in the platform.
Bridge files are the ONLY permitted way to import from a frozen module.

Full bridge details: `.memory/integration/bridges/`
Bridge map diagram: `.memory/integration/bridge-map.md`

---

## The Integration Bridge Pattern

```
[New Module / Service]
        │
        │ imports from frozen module
        ▼
[*Integration.ts]          ← the bridge (new module owns this)
        │
        │ calls public API only
        ▼
[Frozen Module]            ← never modified
```

Rules:
1. Only `*Integration.ts` files may import from frozen modules.
2. Frozen modules never import from bridge files.
3. The consuming module owns and maintains the bridge file.
4. Bridge files contain NO business logic — only data translation and adapter calls.

---

## Current Bridge Map

| Bridge File | Producer (frozen) | Consumer (new) | Direction |
|-------------|------------------|----------------|-----------|
| `src/masterdata/masterdataIntegration.ts` | MasterData | Workflow | one-way → |
| `src/procurement/package/packageIntegration.ts` | Package, Workflow, MasterData, RuleEngine | Planning | one-way → |
| `src/procurement/planning/planningIntegration.ts` | Planning, Package, Workflow, MasterData, RuleEngine | Approval | one-way → |
| `src/approval/approvalIntegration.ts` | Approval, Package, Planning, Workflow, MasterData | Contract | one-way → |
| `src/contract/contractIntegration.ts` | Contract, Workflow | Acceptance | one-way → |
| `src/acceptance/acceptanceIntegration.ts` | Acceptance, Contract, Workflow | SharedFinancial | one-way → |
| `src/shared/financial/financialIntegration.ts` | SharedFinancial, MasterData, Legal | Payment | one-way → |
| `src/payment/paymentIntegration.ts` | Payment, Acceptance, Contract, SharedFinancial | (API layer) | one-way → |

## Planned Bridges (future phases)

| Bridge File | Producer | Consumer | Phase |
|-------------|----------|----------|-------|
| `src/knowledge/integration/knowledgeIntegration.ts` | Legal (`src/legal/`) | Knowledge Platform | N |
| `src/reasoning/integration/reasoningIntegration.ts` | Knowledge Platform | Reasoning Layer | N |
| `src/ai/integration/aiIntegration.ts` | Reasoning Layer | AI Context Layer | N |
| `src/supplier/supplierIntegration.ts` | MasterData | Supplier Registry | O |

---

## Bridge File Contents (standard template)

Each bridge file contains:
1. Import from frozen module public API
2. Type adapters (frozen type → consumer type, if shapes differ)
3. Facade functions with clear names
4. NO business rules
5. NO state

Example from `paymentIntegration.ts`:
```typescript
// Bridges: Acceptance → Payment, Contract → Payment, SharedFinancial → Payment
import { AcceptanceStatus } from '../acceptance/acceptanceTypes'
import { ContractStatus } from '../contract/contractTypes'
import { Money } from '../shared/financial/financialTypes'
export function buildPaymentLegalBasisFromAcceptance(acceptance: AcceptanceRecord): LegalBasis[]
export function extractContractRetentionTerms(contract: ContractRecord): RetentionTerms
```
