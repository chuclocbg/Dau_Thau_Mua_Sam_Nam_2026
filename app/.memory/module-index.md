# Module Index

| Module | Directory | Status | Tests |
|--------|-----------|--------|-------|
| Legal Foundation | `src/legal/` | FROZEN | ~156 |
| Legal Domain Services | `src/legal/domain/` | FROZEN | ~78 |
| Legal Document Importer | `src/agents/` | FROZEN | ~117 |
| Procurement Rule Engine | `src/procurement/rules/` | FROZEN | ~117 |
| Workflow Engine | `src/procurement/workflow/` | FROZEN | ~156 |
| Master Data | `src/masterdata/` | FROZEN | ~234 |
| Procurement Package | `src/procurement/package/` | FROZEN | ~273 |
| Procurement Planning | `src/procurement/planning/` | FROZEN | ~312 |
| Approval Module | `src/approval/` | FROZEN | 312 |
| Contract Module | `src/contract/` | FROZEN | 312 |
| Acceptance Module | `src/acceptance/` | FROZEN | 312 |
| Shared Financial Domain | `src/shared/financial/` | FROZEN | 312 |
| Payment Module | `src/payment/` | FROZEN | 355 |
| Auth Module | `src/auth/` | FROZEN | ~265 |
| Storage Module | `src/storage/` | FROZEN | 232 |
| Notification Module | `src/notification/` | FROZEN | 276 |
| Knowledge Platform (FROZEN — 16/16 providers) | `src/knowledge/platform/`, `graph/`, `search/`, `repositories/`, `application/`, `providers/` | FROZEN — Phase N complete | 336 |

**Total: 395 test files, 13,721 tests — all passing (verified 2026-07-05 via `vitest run`).**
Knowledge Platform core frozen 2026-07-05 (13 core files, Stage 1). **All 16 of 16 providers now
built and Phase N is FROZEN:** LegalProvider + ProcurementProvider (Stage 2), TemplateProvider,
ChecklistProvider, OntologyProvider, GlossaryProvider (Batch 1), VendorKnowledgeProvider,
AssetKnowledgeProvider, BudgetKnowledgeProvider, NotificationKnowledgeProvider (Batch 2),
SchoolPolicyProvider, CaseProvider, RiskProvider, AuditProvider (Batch 3), BestPracticeProvider,
AIFeedbackProvider (Batch 4, final) — 29 provider-related files, 336 tests, see
`docs/knowledge-platform.md`. No providers remain unbuilt. Release Candidate audit (2026-07-05):
**GO WITH NOTES**. **Current Milestone = Knowledge Platform v1.0. Next Planned Milestone = Phase X
(AI Advisory Layer) Architecture Design** — not started, pending explicit approval.

**Naming collision note:** `src/knowledge/` also contains `knowledgeBase.ts` and
`knowledgeTypes.ts` at its top level — an unrelated, pre-existing "Phase 16 — Governance
Knowledge Base" module from a different, earlier commit track (document templates, checklists,
legal citations — NOT part of this `.memory`-tracked roadmap). No import collision exists (the
old files are never imported via the new `src/knowledge/index.ts` barrel), but the two modules
coexist in the same directory. See `docs/knowledge-platform.md` for detail.

## Production Prisma Layer (Phase M1) — IMPLEMENTED, PENDING PRODUCTION VERIFICATION

Real Prisma repository implementations now exist for all 11 modules that persist data (Workflow
excluded — stateless engine, owns no table). 82 models, 48 enums, 67 repository classes. See
`docs/prisma-production.md` for the full repository-mapping table. **Never executed against a
live database** — Docker unavailable in this environment (Phase M0). Do not treat as tested.

| Module | Prisma repo file | Classes |
|---|---|---|
| Legal | `src/legal/prismaRepositories.ts` | 6 |
| MasterData | `src/masterdata/prismaMasterData.ts` | 1 generic (10 instances) |
| Package | `src/procurement/package/prismaPackageRepositories.ts` | 5 |
| Planning | `src/procurement/planning/prismaPlanningRepositories.ts` | 6 |
| Approval | `src/approval/prismaApprovalRepositories.ts` | 5 |
| Contract | `src/contract/prismaContractRepositories.ts` | 6 |
| Acceptance | `src/acceptance/prismaAcceptanceRepositories.ts` | 8 |
| Auth | `src/auth/infrastructure/prismaAuthRepositories.ts` | 8 |
| Storage | `src/storage/infrastructure/prismaStorageRepositories.ts` | 5 |
| Notification | `src/notification/infrastructure/prismaNotificationRepositories.ts` | 10 |
| Payment | `src/payment/prismaPaymentRepositories.ts` (new file, frozen module untouched) | 6 |

## Integration bridges (one-way imports from frozen modules)
- `src/approval/approvalIntegration.ts` → package, planning, workflow, masterdata
- `src/contract/contractIntegration.ts` → procurement/package/packageTypes, procurement/workflow/workflowEngine
- `src/acceptance/acceptanceIntegration.ts` → contract/contractTypes, procurement/workflow/workflowEngine
- `src/shared/financial/financialIntegration.ts` → masterdata/masterdataTypes, legal/legalSchema
- `src/payment/paymentIntegration.ts` → acceptance/acceptanceTypes, contract/contractTypes, shared/financial/
- `src/auth/integration/authIntegration.ts` → masterdata only
- `src/storage/integration/storageIntegration.ts` → masterdata, auth, shared
- `src/notification/integration/notificationIntegration.ts` → masterdata only
