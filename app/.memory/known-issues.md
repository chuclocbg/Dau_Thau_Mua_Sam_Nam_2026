# Known Issues

Issues tracked here are accepted and deferred. Each has a named fix phase.

---

## OPEN

**KI-001 — buildPlanWorkflow hardcodes OPEN_TENDER**
- File: `src/procurement/planning/planningIntegration.ts:85`
- Issue: `procurementMethodCode: 'OPEN_TENDER'` and `approvalAuthorityCode: 'UNIT_HEAD'`
  are hardcoded for all plans regardless of the actual requests they contain.
- Impact: When a plan contains DIRECT_APPOINTMENT requests, the resulting workflow
  will have incorrect states and document requirements.
- Fix: Derive dominant procurement method from the plan's requests via `evaluatePlanWithRuleEngine()`.
- Target phase: Phase G (Approval Module) at the latest.
- Workaround: Manual workflow correction after `createPackageFromPlan()`.

**KI-002 — ProcurementRequest.legalBasis is free-text string (DEFERRED — frozen module)**
- File: `src/procurement/planning/planningTypes.ts`
- Issue: `readonly legalBasis: string` — not a structured `LegalBasis` struct.
- Impact: Document Generator cannot extract a machine-readable citation from planning requests.
  It will have to use the field as-is (unvalidated string) or ignore it.
- Fix: Change to `legalBasis?: LegalBasis` and update `createRequest()` params.
  This is a breaking change to `CreateRequestParams`.
- Target phase: Phase F (Document Generator) — fix before Document Generator reads requests.
- Workaround: Document Generator uses request.fundingSource and plan data for citations instead.

**KI-003 — ProcurementPlan lacks workflowId field**
- File: `src/procurement/planning/planningTypes.ts`
- Issue: `buildPlanWorkflow()` creates a WorkflowInstance for a plan but the plan entity
  has no `workflowId?: string` field to store the link.
- Impact: Workflow is created in memory and returned but cannot be retrieved later by planId.
- Fix: Add `workflowId?: string` to `ProcurementPlan` interface and update `buildPlanWorkflow()`
  to persist the workflow ID.
- Target phase: Phase G (Approval Module).
- Workaround: Callers must keep the workflow reference in scope.

**KI-004 — Prisma Float for monetary values — FIX APPLIED 2026-07-05 (Phase M1), UNVERIFIED**
- File: `prisma/schema.prisma` — genuinely monetary fields changed from `Float` to `Decimal(18,2)`
- Issue was: IEEE 754 floating point loses precision for large VNĐ values (e.g., 20,000,000,000).
- Fix applied: 9 fields across MasterData/Planning now use `Decimal(18,2)`; Payment's
  `Money{amount:bigint}` intentionally stays `BigInt`, not `Decimal` (more precise) — see
  `docs/prisma-production.md`.
- Remaining gap: the fix has never run against a live Postgres instance — `prisma validate` and
  `tsc --noEmit` pass, but no query/transaction has executed. Keep as OPEN until Phase M1's live-DB
  verification checklist actually runs (see `docs/infrastructure.md`).

**KI-005 — String arrays for entity ID lists (no FK constraints)**
- File: `prisma/schema.prisma` — `requestIds String[]`, `generatedPackageIds String[]`, `planIds String[]`
- Issue: Prisma string arrays have no referential integrity. A deleted plan's ID can remain
  in `AnnualProcurementPlan.planIds[]` with no cascade or error.
- Impact: Orphaned IDs accumulate; no DB-level enforcement.
- Fix: Extract to junction tables (`AnnualPlanPlanMapping`, etc.) before production migration.
- Target phase: Infrastructure setup.
- Workaround: Application-level cleanup in archiveX() service functions.

**KI-006 — No Prisma indexes on procurement tables**
- File: `prisma/schema.prisma`
- Issue: All status, department, fiscalYear, planId fields in procurement tables are unindexed.
- Impact: Full table scans on every filtered query at production scale.
- Fix: Apply recommendations from `docs/prisma-index-review.md`.
- Target phase: Before first production migration.

**KI-007 — createdBy silently dropped in createSession() (found during Runtime Iteration 3 Slice 167 investigation, 2026-07-28)**
- File: `src/acceptance/acceptanceSession.ts:10`
- Issue: `createdBy: string` is a required parameter of `createSession()` but is never written
  into the `repos.sessions.create({...})` call (lines 26-35) — it is accepted and discarded.
- Impact: The acceptance session record has no record of who created it — an audit-trail gap
  for an acceptance-workflow entity that a State Audit review would expect to be traceable.
- Fix: Add `createdBy` to the object passed to `repos.sessions.create()`, once it is confirmed
  `AcceptanceSession`'s schema/type actually has a field to receive it.
- Target phase: Not yet scheduled — flagged, not fixed, per explicit instruction to log only.
- Workaround: None; the identity is not recoverable after the fact from this call path.

**KI-008 — acceptanceRate computed but dropped from buildAcceptanceSummary() (found during Runtime Iteration 3 Slice 167 investigation, 2026-07-28)**
- File: `src/acceptance/acceptanceIntegration.ts:56`
- Issue: `calculateAcceptanceRate(requestId, repos)` is awaited as part of the `Promise.all` in
  `buildAcceptanceSummary()`, but the resulting `acceptanceRate` value is never included in the
  returned `AcceptanceSummary` object (lines 67-81).
- Impact: A real, already-computed completeness metric never reaches callers/UI — any acceptance
  dashboard or report relying on this summary is missing its rate figure.
- Fix: Add `acceptanceRate` to the returned object, once `AcceptanceSummary`'s type is confirmed
  to declare it.
- Target phase: Not yet scheduled — flagged, not fixed, per explicit instruction to log only.
- Workaround: Callers must call `calculateAcceptanceRate()` separately if they need this value.

**KI-009 — reviewPackage (legal review) never invoked in PlannerAgent deep-analysis path (found during Runtime Iteration 3 Slice 167 investigation, 2026-07-28)**
- File: `src/agents/PlannerAgent.ts:29`
- Issue: `reviewPackage` (from `../ai/legalReviewer`) is imported, and the file's own comment at
  line 129 states deep-analysis mode should run "P5 reviewPackage / runWorkflow" — but only
  `runWorkflow` (line 345) is actually called anywhere in the class body.
- Impact: The deep-analysis path's intended legal-review step is designed but unwired; packages
  built via deep analysis do not get an automated legal review pass despite the code's own
  stated intent.
- Fix: Wire a `reviewPackage(...)` call into the deep-analysis flow alongside `runWorkflow(...)`,
  once the intended call signature/placement is confirmed against `ai/legalReviewer`'s contract.
- Target phase: Not yet scheduled — flagged, not fixed, per explicit instruction to log only.
- Workaround: None; deep-analysis packages should be manually legal-reviewed until wired.

---

## RESOLVED

**KI-R04 — RULE-09 violation in paymentSchedule.ts (RESOLVED Architecture Freeze v1.1, 2026-07-03)**
- Was: `AdvanceRate.legalCitation: string` — free-text legal citation in domain type.
- Fix: Changed to `legalBasis: LegalBasis`; `DEFAULT_ADVANCE_RATE` now uses `createLegalBasis(...)`.
- Impact: All domain types now fully comply with RULE-09 and PRINCIPLE 8.

**KI-R03 — Float monetary values in domain services (RESOLVED Phase H.5)**
- Was: KI-004 — domain services used `number` for monetary amounts.
- Fix: `Money { amount: bigint, currency: CurrencyCode }` value object in `src/shared/financial/money.ts`.
  All new modules (Payment onwards) use Money. Frozen modules remain as-is.
  Prisma Float→Decimal migration deferred to Infrastructure phase.

**KI-R01 — Duplicate IBaseRepository definition (RESOLVED 2026-07-02)**
- Was: Defined independently in `packageRepository.ts` and `planningRepository.ts`.
- Fix: Canonical definition moved to `src/shared/repository/IBaseRepository.ts`.
  Both files import and re-export from shared.

**KI-R02 — Type name collision: PackageType / ProcurementMethod / ApprovalAuthority (RESOLVED 2026-07-02)**
- Was: `procurementTypes.ts` exported `type PackageType`, `type ProcurementMethod`,
  `type ApprovalAuthority` — same names as entity interfaces in `masterdataTypes.ts`.
- Fix: Renamed domain string-union types to `ProcurementPackageKind`, `ProcurementMethodCode`,
  `ApprovalAuthorityLevel` in `procurementTypes.ts`. Masterdata entity types unchanged.
