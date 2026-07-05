# Module: Approval Module

**Status:** FROZEN (v1.1, 2026-07-03)
**Location:** `src/approval/`
**Tests:** 312

---

## Purpose

Manages approval requests and decisions. An `ApprovalRequest` is created when a plan,
package, or contract requires human sign-off. Routes to the correct authority based on
value threshold and delegation grants.

---

## Public API

```typescript
ApprovalRequest {
  id, requestType: ApprovalRequestType,
  entityId, entityType,          // what is being approved
  requiredAuthority: ApprovalAuthorityLevel,
  requestedBy: string,           // userId
  assignedTo?: string,           // userId of approver
  status: ApprovalStatus,        // PENDING | UNDER_REVIEW | APPROVED | REJECTED | WITHDRAWN
  decisions: ApprovalDecision[],
  legalBasis: LegalBasis[],
  deadline?: string,
  createdAt, updatedAt
}

ApprovalDecision {
  decisionId, requestId, decidedBy,
  decision: 'APPROVED' | 'REJECTED' | 'RETURNED_FOR_REVISION',
  comment: string,
  legalBasis: LegalBasis[],
  decidedAt
}

// Service functions
createApprovalRequest(params, repos): Promise<ApprovalRequest>
submitDecision(requestId, decision, repos): Promise<ApprovalRequest>
delegateApproval(requestId, toUserId, repos): Promise<ApprovalRequest>
resolveApprovalAuthority(request, hierarchyRepos): ApprovalAuthorityLevel
listPendingApprovals(userId, repos): Promise<ApprovalRequest[]>
```

---

## Dependencies

- `src/shared/repository/IBaseRepository.ts`
- `src/shared/financial/financialTypes.ts`
- `src/procurement/package/` (via approvalIntegration.ts)
- `src/procurement/planning/` (via approvalIntegration.ts)
- `src/procurement/workflow/` (via approvalIntegration.ts)
- `src/masterdata/` (via approvalIntegration.ts)

---

## Consumers

- `contractIntegration.ts` — contract creation requires approved ApprovalRequest

---

## Business Rules Enforced

- Authority routing based on `estimatedValue` vs `ApprovalAuthority.valueThreshold`
- Delegation grants are time-bounded and carry `LegalBasis[]`
- Single-signature and multi-signature approval supported
- Decisions are immutable (append-only history)
