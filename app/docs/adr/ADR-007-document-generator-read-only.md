# ADR-007 — Document Generator is Read-Only

Status: ACCEPTED
Date: 2026-07-02

---

## Context

The Document Generator produces official Vietnamese procurement documents
(Kế hoạch LCNT, HSMT, Quyết định phê duyệt, Hợp đồng template, etc.)
by reading structured data from domain modules and rendering it into document format.

A key question is whether Document Generator should write back to domain modules
(e.g., update package status, record document generation events) or remain
purely a consumer.

---

## Decision

Document Generator is a read-only consumer.

It reads from:
- ProcurementPlan + ProcurementRequest (planning module)
- ProcurementPackage + PackageProposal (package module)
- MasterDataRepositories (reference values)
- LegalRepositories (law text and citations)

It writes to:
- Its own document repository (generated document records, version history)
- Nothing else — no writes to planning, package, workflow, or legal modules.

If a generated document triggers a workflow transition (e.g., approval of HSMT
advances the workflow), that transition is performed by the calling service
(e.g., Approval Module), not by Document Generator itself.

---

## Consequences

**Positive:**
- Document Generator cannot corrupt domain state.
- All domain modules remain frozen — Document Generator adds no new
  dependencies to frozen modules' import graphs.
- Re-generating a document is always safe (idempotent reads).

**Negative:**
- Document generation events are not automatically recorded on the package.
  A separate service call must record that a document was generated.

---

## Alternatives Rejected

**Document Generator updates package status**: After generating HSMT, it marks
the package as SUBMITTED. Rejected because this couples document generation
to workflow advancement. A document can be re-generated without re-submitting.

**Document Generator writes to workflow history**: Records document creation as
a history entry. Rejected — workflow history is owned by the Workflow Engine
(ADR-003). Document history lives in the document module's own repository.
