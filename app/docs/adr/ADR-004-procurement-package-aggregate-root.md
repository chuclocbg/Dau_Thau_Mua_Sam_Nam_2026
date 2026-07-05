# ADR-004 — ProcurementPackage as Primary Aggregate Root

Status: ACCEPTED
Date: 2026-07-02

---

## Context

Multiple downstream modules (Workflow, Documents, Approval, Contract, Payment, Asset)
need to reference the central procurement object. A clear aggregate root is needed
so that downstream modules have a stable attachment point.

---

## Decision

`ProcurementPackage` is the primary aggregate root of the procurement domain.

All downstream business modules attach to the platform by `packageId`:
- `WorkflowInstance.context.id` references the package ID.
- Document Generator generates documents for a given package ID.
- Approval records reference the package ID.
- Contract records reference the package ID.
- Payment records reference the package ID.
- Asset records reference the package ID.

`ProcurementPackage` is created from a `PackageProposal`, which comes from a
`ProcurementPlan`, which comes from approved `ProcurementRequest`s.
The chain: Request → Plan → Proposal → Package.

---

## Consequences

**Positive:**
- Downstream modules always know their anchor point. No ambiguity about
  "what is this approval for?" — it is always "for package X."
- Lifecycle termination (COMPLETED, CANCELLED, ARCHIVED) on a package
  cascades semantically to all attached records.

**Negative:**
- The package aggregate must be created before any downstream module can act.
  This enforces the planning → package flow (see ADR-006) but may feel restrictive
  for edge cases where approval precedes a formal package record.

---

## Alternatives Rejected

**ProcurementPlan as aggregate root**: Planning owns the lifecycle, packages are children.
Rejected because a plan may spawn multiple packages, and downstream modules
(Contract, Payment) operate on individual packages, not plans.

**WorkflowInstance as aggregate root**: Workflow is the lifecycle anchor.
Rejected because workflow is infrastructure, not a business entity.
Modules attach to the business object (Package), not to the process tracker (Workflow).
