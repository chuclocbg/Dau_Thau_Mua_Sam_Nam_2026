# Module: Production Prisma Layer

**Status:** PLANNED — Phase M (after J, K, L)
**Location:** Distributed across all `*prisma*.ts` files + `prisma/schema.prisma`
**Tests:** ~390 (planned)

---

## Purpose

Replaces all 24 stub Prisma repository implementations with real database-connected code.
No new entity types. No service logic changes. Pure infrastructure wiring.
Also fixes TD-05 (Float → Decimal for monetary fields).

---

## Scope

Fill in all `*prisma*.ts` stub implementations across:

| Module | Prisma Files | Models to Add |
|--------|-------------|--------------|
| Legal | `prismaRepositories.ts` | LegalDocument, LegalVersion, LegalClause |
| MasterData | `prismaMasterData.ts` | Department, PackageType, ProcurementMethod, ApprovalAuthority, FundingSource, BudgetCode |
| Workflow | new | WorkflowInstance, WorkflowHistory |
| Package | new | ProcurementPackage |
| Planning | new | ProcurementPlan, ProcurementRequest |
| Approval | new | ApprovalRequest, ApprovalDecision |
| Contract | new | Contract, ContractHistory |
| Acceptance | new | AcceptanceRequest, AcceptanceSession |
| SharedFinancial | new | BudgetAllocation, FundingCommitment, PaymentSchedule |
| Payment | new | PaymentRequest, PaymentHistory, TreasurySubmission |
| Auth (new) | new | User, Role, Permission, DelegationGrant, Session, Token |
| Storage (new) | new | Attachment, AttachmentVersion |
| Notification (new) | new | Notification, NotificationTemplate |

---

## Critical Fixes in Phase M

- **TD-05:** All monetary `Float` fields → `Decimal` (fixes bigint precision)
- Add compound indexes: `(status, department)`, `(contractId, status)`, `(createdAt DESC)` per module
- Connection pool: `DATABASE_POOL_SIZE` env var, default 10
- Migration naming: `YYYYMMDD_NNN_description`

---

## Strategy

Memory repos continue to exist for tests. Prisma repos are injected at runtime.
No service code changes — only infrastructure wiring.
All modules follow the same pattern:
```typescript
class PrismaXRepository implements IXRepository {
  constructor(private db: PrismaClient) {}
  // implement all IBaseRepository<X> methods
}
```

---

## Dependencies

- All 12 frozen business modules (for their types)
- Auth (J), Storage (K), Notification (L)
- PostgreSQL + Prisma Client

---

## Design Reference

Full schema plan: `.memory/infra-architecture.md` (Phase M section)
