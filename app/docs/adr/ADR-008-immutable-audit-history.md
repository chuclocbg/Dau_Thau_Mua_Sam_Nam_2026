# ADR-008 — Immutable Audit History

Status: ACCEPTED
Date: 2026-07-02

---

## Context

Vietnamese public procurement is subject to audit by Kiểm toán Nhà nước, Thanh tra,
and internal control organs. Any modification or deletion of historical records
constitutes evidence tampering under Vietnamese administrative law.

The platform must guarantee that history records are permanent.

---

## Decision

All history and audit records in this platform are append-only.

Affected structures:
- `WorkflowHistory.entries[]` — transitions and approvals in the procurement lifecycle
- `ProcurementPlan.approvalHistory[]` — plan approval records
- `PackageHistory` repository — all package lifecycle events
- Any future audit log records

Operations allowed on history:
- `addHistoryEntry()` — append a new entry (immutable timestamp)

Operations prohibited on history:
- `deleteHistoryEntry()` — no such function exists or may be created
- `updateHistoryEntry()` — no such function exists or may be created
- Direct `repos.history.update(id, ...)` on history records (allowed by interface but must not be called for audit purposes)

When a history record is found to be incorrect (e.g., wrong approvedBy value was
recorded), the correction is a new history entry noting the correction —
not a modification of the original.

---

## Consequences

**Positive:**
- Complete audit trail for every procurement from request to completion.
- No audit finding can claim records were altered after the fact.
- History entries serve as immutable evidence in disputes.

**Negative:**
- History tables grow continuously. No record can be pruned.
  Archival strategy (move to cold storage after N years) is a future infrastructure concern.
- Errors in history entries must be documented alongside the erroneous entry,
  not silently corrected.

---

## Alternatives Rejected

**Soft-delete history entries**: Mark incorrect entries as `isDeleted=true`.
Rejected — soft-deleted records are still visible to auditors and must be explained.
Correction-by-addition is clearer than deletion-with-flag.

**Versioned history entries**: Each history entry can be superseded by a newer version.
Rejected — adds complexity and still doesn't remove the original record from the
database. Append-only achieves the same outcome with less code.
