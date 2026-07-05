# ADR-006 — Planning Precedes Package

Status: ACCEPTED
Date: 2026-07-02

---

## Context

In Vietnamese public procurement, organizations must produce an approved
Kế hoạch lựa chọn nhà thầu (procurement selection plan) before any procurement
package can be initiated. This is a legal requirement under Luật 22/2023/QH15 Điều 38.

The platform must enforce this sequence to produce legally valid procurement records.

---

## Decision

A `ProcurementPackage` may only be created from an approved `PackageProposal`.
A `PackageProposal` may only be created from an approved `ProcurementPlan`.
A `ProcurementPlan` may only be created from approved `ProcurementRequest`s.

The enforced chain: APPROVED Request → APPROVED Plan → APPROVED Proposal → Package.

`createPackageFromPlan()` in `planningService.ts` is the only bridge from planning
to package creation. It validates proposal status before calling `createPackage()`.

No shortcut path exists that creates a package without a preceding approved plan.

---

## Consequences

**Positive:**
- Platform output is legally valid under Luật 22/2023/QH15.
- Document Generator can always read the approved plan as the source of truth
  for the package it is generating documents for.
- Complete traceability: package → proposal → plan → requests.

**Negative:**
- Emergency or retroactive procurement entries cannot be made without creating
  a formal plan first. This is intentional — it is the law's requirement.
- Internal training procurement (< threshold) may feel over-formalized.
  A future exception flow (see docs/Backlog.md) may relax this for small-value cases.

---

## Alternatives Rejected

**Direct package creation**: Allow packages to be created without a plan.
Rejected — violates Luật 22/2023/QH15 Điều 38. Any package without a traceable
plan approval is legally non-compliant.

**Optional plan link**: Plan is optional on the package.
Rejected — optionality means the constraint is unenforced. The field becomes null
in every rush case, which is exactly the case where traceability matters most.
