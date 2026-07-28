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

**KI-010 — options (legal rules) param silently dropped in submitToTreasury() (found during Runtime Iteration 3, 2026-07-28)**
- File: `src/payment/paymentTreasuryService.ts:28`
- Issue: `options?: { rules?: readonly PaymentLegalRule[]; packageType?: string }` is accepted by
  `submitToTreasury()` but never read anywhere in the function body (lines 29-54) — the submission
  is built and persisted with no reference to `options.rules` or `options.packageType`.
- Impact: The function's own signature implies legal-rule-aware validation is available before a
  treasury submission, but no such validation actually runs — any caller passing `options.rules`
  gets silently ignored, so a submission that should be blocked by a legal rule is not.
- Fix: Apply `options.rules` (if provided) to validate the submission before `treasuryRepo.create()`,
  once the intended validation behavior is confirmed against `PaymentLegalRule`'s contract.
- Target phase: Not yet scheduled — flagged, not fixed, per explicit instruction to log only.
- Workaround: Callers must validate against legal rules themselves before calling this function.

**KI-011 — actor param silently dropped in resolveApproval() (found during Runtime Iteration 3, 2026-07-28)**
- File: `src/workspace/workspaceSession.ts:185`
- Issue: `resolveApproval(approvalId, status, actor, reason?)` accepts `actor: string` but never
  writes it into the approval record — the update at line 191 sets `status`, `decidedAt`, `reason`
  but not `actor`.
- Impact: The same class of gap as KI-007 — an approval's record has no trace of who resolved it,
  a traceability gap for a workspace-approval entity an audit review would expect to be attributable.
- Fix: Add `actor` (e.g. as a `resolvedBy` field) to the object passed to `this.approvals.set()`,
  once it is confirmed `WorkspaceApproval`'s type has a field to receive it.
- Target phase: Not yet scheduled — flagged, not fixed, per explicit instruction to log only.
- Workaround: None; the identity is not recoverable after the fact from this call path.

**KI-012 — approvedBy/notes/performedBy silently dropped in planningService.ts (found during Runtime Iteration 3, 2026-07-28)**
- File: `src/procurement/planning/planningService.ts:57-58,116`
- Issue: Same pattern as KI-007/KI-011, third file in the same track. `approveRequest(id, repos,
  approvedBy, notes?)` never writes `approvedBy` or `notes` into its `repos.requests.update(id,
  { status: 'APPROVED' })` call (line 65). `splitRequest(id, parts, repos, performedBy)` never
  writes `performedBy` anywhere — the created split requests reuse `original.requester` (line 131)
  and the cancellation update (line 145) records no actor either. (By contrast, `mergeRequests()`'s
  own `performedBy` parameter in this same file IS correctly used, at line 94 — confirming this is
  an inconsistency within the file, not a deliberate design choice.)
- Impact: Approval and split actions on procurement requests — both audit-relevant, state-changing
  actions — leave no record of who approved or who split, and an approval's notes are discarded.
- Fix: Once `ProcurementRequest`'s type/schema is confirmed to have fields for it, thread
  `approvedBy`/`notes` into `approveRequest()`'s update call, and `performedBy` into
  `splitRequest()`'s created-request/cancellation calls — following `mergeRequests()`'s own
  existing pattern in this file as a working example.
- Target phase: Not yet scheduled — flagged, not fixed, per explicit instruction to log only.
- Workaround: None; the identity is not recoverable after the fact from these call paths.

**Pattern note:** KI-007, KI-009, KI-010, KI-011, and KI-012 (6 instances across
`acceptanceSession.ts`, `acceptanceIntegration.ts` [KI-008, a sibling drop, not actor-related],
`PlannerAgent.ts`, `paymentTreasuryService.ts`, `workspaceSession.ts`, and `planningService.ts`)
share one shape: an actor/creator/approver/rules parameter accepted by a function but never
written into the record it produces or used to validate it. All were found incidentally while
verifying TS6133 "unused declaration" diagnostics were safe to mechanically clear — none were
found by a deliberate search. This suggests the same pattern likely recurs elsewhere in the
codebase beyond what a `tsc` unused-declaration pass happens to surface (a parameter that IS
read, just incorrectly, would not trigger TS6133 at all). Worth a dedicated, deliberate audit
for this specific shape rather than continuing to discover instances one at a time.

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
