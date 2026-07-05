# Approval Module

Legal basis: Luật 22/2023/QH15 Chương VII; NĐ 214/2025/NĐ-CP Chương VIII; NĐ 104/2026/NĐ-CP.

---

## ER Diagram

```
ApprovalRequest 1──0..1 ApprovalDecisionRecord
ApprovalRequest 1──*    ApprovalHistoryEntry
ApprovalRequest 1──*    ApprovalComment
ApprovalRequest 1──*    ApprovalAttachment
```

**ApprovalRequest** — central aggregate

| Field                  | Type            | Notes                                   |
|------------------------|-----------------|------------------------------------------|
| id                     | string (UUID)   | PK                                       |
| requestCode            | string (unique) | e.g. APR/KH/2026/0001                   |
| approvalType           | ApprovalType    | PLAN_APPROVAL, PACKAGE_APPROVAL, …       |
| subjectId              | string          | FK to plan or package id                 |
| subjectType            | SubjectType     | PLAN or PACKAGE                          |
| requestedBy            | string          | employee code                            |
| requestedAt            | ISO string      |                                          |
| department             | string          | requesting department code               |
| estimatedValue         | number          | VNĐ — used for authority threshold       |
| assignedAuthorityCode  | string?         | FK to masterdata ApprovalAuthority.code  |
| assignedAuthorityName  | string?         |                                          |
| dueDate                | string?         | YYYY-MM-DD                               |
| status                 | ApprovalStatus  |                                          |
| decisionId             | string?         | FK to ApprovalDecisionRecord             |
| notes                  | string?         |                                          |

**ApprovalDecisionRecord** — one per request, created only when UNDER_REVIEW

| Field             | Type             | Notes                                    |
|-------------------|------------------|------------------------------------------|
| id                | string (UUID)    | PK                                       |
| requestId         | string           | FK to ApprovalRequest (unique)           |
| outcome           | DecisionOutcome  | APPROVED / REJECTED / RETURNED           |
| decidedBy         | string           | employee code                            |
| decidedAt         | ISO string       |                                          |
| legalBasis        | string           | e.g. NĐ 214/2025 Điều 76 khoản 1        |
| conditions        | string[]         | optional conditions on approval          |
| revisionRequired  | string[]         | required for RETURNED outcome            |
| decisionReference | string           | official decision reference number       |

**ApprovalHistoryEntry** — immutable audit log

| Field       | Type          | Notes                       |
|-------------|---------------|-----------------------------|
| id          | string        | PK                          |
| requestId   | string        | FK                          |
| action      | ApprovalAction|                             |
| performedBy | string        |                             |
| performedAt | ISO string    |                             |
| fromStatus  | string?       |                             |
| toStatus    | string?       |                             |
| notes       | string?       |                             |

---

## State Diagram

```
DRAFT ──submit──> SUBMITTED ──assign──> UNDER_REVIEW ──approve──> APPROVED
  ^                   |                      |
  |                   |                      |──reject──> REJECTED
  |                   |                      |
  |                   |                      └──return──> RETURNED ──resubmit──> SUBMITTED
  |                   |
  └──withdraw (from DRAFT/SUBMITTED/UNDER_REVIEW)──> WITHDRAWN
```

Terminal states: `APPROVED`, `REJECTED`, `WITHDRAWN`, `EXPIRED`

---

## Sequence Diagram — PLAN_APPROVAL lifecycle

```
Requester            ApprovalService         WorkflowEngine        Authority
     │                     │                      │                    │
     │──createApprovalRequest──>│                 │                    │
     │<──ApprovalRequest(DRAFT)─│                 │                    │
     │──submitForApproval──────>│                 │                    │
     │<──ApprovalRequest(SUBMITTED)──────────────>│                    │
     │                          │                 │                    │
     │                    [Admin assigns authority]                     │
     │──assignAuthority────────>│                 │                    │
     │<──ApprovalRequest(UNDER_REVIEW)──────────────────────────────>  │
     │                          │                 │                    │
     │                    [Authority decides]                          │
     │                          │<──recordDecision(APPROVED)──────────>│
     │                          │──advance(PLAN_APPROVED)─────────────>│
     │<──ApprovalRequest(APPROVED)──────────────────────────────────── │
```

---

## API Reference

### approvalService.ts

#### `createApprovalRequest(params, repos)`

| Param          | Type                          | Required |
|----------------|-------------------------------|----------|
| requestCode    | string                        | yes      |
| approvalType   | ApprovalType                  | yes      |
| subjectId      | string                        | yes      |
| subjectType    | SubjectType                   | yes      |
| requestedBy    | string                        | yes      |
| department     | string                        | yes      |
| estimatedValue | number (> 0)                  | yes      |
| dueDate        | string (YYYY-MM-DD)           | no       |
| notes          | string                        | no       |

Returns `Promise<ApprovalRequest>`. Creates DRAFT request, records CREATED history event.
Throws `ApprovalError('DUPLICATE_CODE')` if requestCode already exists.

#### `submitForApproval(requestId, submittedBy, repos)`

Allowed from: DRAFT, RETURNED. Transitions to SUBMITTED. Records SUBMITTED history.
Throws `ApprovalError('INVALID_STATUS')` if not in allowed statuses.

#### `assignAuthority(requestId, authorityCode, authorityName, assignedBy, repos)`

Allowed from: SUBMITTED, UNDER_REVIEW. Transitions to UNDER_REVIEW. Records ASSIGNED history.

#### `withdrawApprovalRequest(requestId, withdrawnBy, reason, repos)`

Allowed from: DRAFT, SUBMITTED, UNDER_REVIEW. Transitions to WITHDRAWN. Records reason in history notes.

---

### approvalDecision.ts

#### `recordDecision(requestId, params, repos)`

| Param             | Required | Notes                                            |
|-------------------|----------|--------------------------------------------------|
| outcome           | yes      | APPROVED / REJECTED / RETURNED                   |
| decidedBy         | yes      | employee code                                    |
| legalBasis        | yes      | legal article citation                           |
| decisionReference | yes      | official reference number                        |
| conditions        | no       | string[] — conditions on approval               |
| revisionRequired  | cond.    | required when outcome=RETURNED                   |

Requires request to be in UNDER_REVIEW status with authority assigned.
Sets request status to APPROVED / REJECTED / RETURNED.
Records history event matching the outcome.

#### `generateDecisionReference(type, year, sequence)`

Returns `QĐ/{type}/{year}/{sequence padded to 4 digits}`.

---

### approvalAuthority.ts

#### `resolveAuthorityForValue(estimatedValue, repo)`

Returns most-junior qualifying authority (highest `level` number where `maxValue >= estimatedValue`).
Returns `null` if no authority qualifies.

**Least-privilege rule**: NĐ 214/2025 mandates the lowest-rank authority that can lawfully approve.

#### `getAuthorityChain(estimatedValue, repo)`

Returns all qualifying active authorities sorted by level ascending (most senior first, most junior last).

#### `validateAuthorityPermission(authorityCode, estimatedValue, repo)`

Throws `ApprovalError('AUTHORITY_INSUFFICIENT')` if authority limit < estimatedValue.
Throws `ApprovalError('UNKNOWN_AUTHORITY')` if code not found or inactive.

---

### approvalIntegration.ts

#### `buildApprovalFromPackage(pkg, requestedBy, year, sequence)`

Builds `CreateApprovalRequestParams` from a `ProcurementPackage`. One-way bridge — no frozen module imports from this file.

#### `buildApprovalFromPlan(plan, requestedBy, year, sequence)`

Builds `CreateApprovalRequestParams` from a `ProcurementPlan`.

#### `advanceWorkflowOnApproval(instance, targetState, performedBy, notes?)`

Delegates directly to `advance()` from WorkflowEngine. Call after `recordDecision` to synchronize workflow state.

#### `buildApprovalSummary(requestId, repos)`

Returns `ApprovalSummary | null`. Aggregates request, decision, comment count, attachment count in one call.

#### `validateApprovalAgainstMasterData(ctx, repo)` / `resolveAuthorityFromMasterData(value, repo)`

Delegates to masterdataIntegration — approval module does not hold authority data.

---

### approvalComment.ts / approvalAttachment.ts

| Function                    | Description                                       |
|-----------------------------|---------------------------------------------------|
| `addComment(requestId, params, addedBy, repo)` | Validates, trims, stores. Max 5000 chars. |
| `getComments(requestId, repo, includeInternal)` | Default excludes internal comments.       |
| `countComments(requestId, repo)`               | Total count including internal.           |
| `addAttachment(requestId, params, uploadedBy, repo)` | Max 50 MB per file.               |
| `getAttachments(requestId, repo)`              | All attachments for request.              |
| `getTotalAttachmentSize(requestId, repo)`      | Sum of fileSize in bytes.                 |

---

### approvalHistory.ts

| Function                                           | Description                                           |
|----------------------------------------------------|-------------------------------------------------------|
| `recordHistoryEvent(requestId, action, performedBy, repo, opts?)` | Creates immutable audit entry.  |
| `getApprovalTimeline(requestId, repo)`             | All events sorted by performedAt ascending.           |
| `calculateProcessingDuration(requestId, repo)`     | ms from CREATED to APPROVED/REJECTED/WITHDRAWN. Null if incomplete. |
| `getLastAction(requestId, repo)`                   | Last event in timeline. Null if empty.                |

---

### approvalFactory.ts

| Function                                | Description                               |
|-----------------------------------------|-------------------------------------------|
| `generateApprovalCode(type, year, seq)` | APR/{TAG}/{year}/{seq:04d}               |
| `buildCreateApprovalRequestParams(opts)` | Convenience builder for all params.       |
| `createMemoryApprovalRepositories()`    | Re-exported from memoryApprovalRepositories |
| `createPrismaApprovalRepositories()`   | Re-exported from prismaApprovalRepositories |

---

## Usage Examples

### Create and submit a plan approval request

```typescript
import { createMemoryApprovalRepositories, generateApprovalCode } from './approvalFactory';
import { createApprovalRequest, submitForApproval, assignAuthority } from './approvalService';

const repos = createMemoryApprovalRepositories();
const request = await createApprovalRequest({
  requestCode:    generateApprovalCode('PLAN_APPROVAL', 2026, 1),
  approvalType:   'PLAN_APPROVAL',
  subjectId:      'PLAN-2026-001',
  subjectType:    'PLAN',
  requestedBy:    'EMP-42',
  department:     'KH-TC',
  estimatedValue: 8_500_000_000,
  dueDate:        '2026-12-31',
}, repos);

await submitForApproval(request.id, 'EMP-42', repos);
await assignAuthority(request.id, 'RECTOR', 'Hiệu trưởng', 'ADMIN', repos);
```

### Record an approval decision

```typescript
import { recordDecision } from './approvalDecision';

await recordDecision(request.id, {
  outcome:           'APPROVED',
  decidedBy:         'RECTOR-01',
  legalBasis:        'NĐ 214/2025 Điều 76 khoản 1',
  decisionReference: 'QĐ/KH/2026/0001',
  conditions:        ['Tuân thủ kế hoạch ngân sách đã phê duyệt'],
}, repos);
```

### Build approval from a package (integration bridge)

```typescript
import { buildApprovalFromPackage, advanceWorkflowOnApproval } from './approvalIntegration';

const approvalParams = buildApprovalFromPackage(procurementPackage, 'EMP-42', 2026, 1);
const approvalRequest = await createApprovalRequest(approvalParams, repos);
// ... after decision recorded:
const result = advanceWorkflowOnApproval(workflowInstance, 'PLAN_APPROVED', 'EMP-42');
```

---

## Validation Rules

| Rule | Condition                                           | Error Code              |
|------|-----------------------------------------------------|-------------------------|
| V-1  | requestCode must be unique                          | DUPLICATE_CODE          |
| V-2  | requestCode, subjectId, requestedBy, department required | VALIDATION_FAILED  |
| V-3  | estimatedValue > 0                                  | INVALID_VALUE           |
| V-4  | Status must be in allowed set for each transition   | INVALID_STATUS          |
| V-5  | assignedAuthorityCode must be set before decision   | NO_AUTHORITY            |
| V-6  | decidedBy, legalBasis, decisionReference required   | INVALID_DECISION        |
| V-7  | RETURNED outcome requires revisionRequired list     | INVALID_DECISION        |
| V-8  | Only one decision per request                       | DECISION_EXISTS         |
| V-9  | Comment content 1–5000 non-whitespace chars         | EMPTY_COMMENT / COMMENT_TOO_LONG |
| V-10 | Attachment: fileName, fileType, 0 < fileSize ≤ 50MB | INVALID_ATTACHMENT     |
| V-11 | Authority maxValue ≥ estimatedValue                 | AUTHORITY_INSUFFICIENT  |
| V-12 | Authority must be active and not archived           | UNKNOWN_AUTHORITY       |

---

## Migration Guide

```sql
-- Approval requests
CREATE TABLE approval_requests (
  id                      VARCHAR(36)  PRIMARY KEY,
  request_code            VARCHAR(50)  NOT NULL UNIQUE,
  approval_type           VARCHAR(50)  NOT NULL,
  subject_id              VARCHAR(36)  NOT NULL,
  subject_type            VARCHAR(20)  NOT NULL,
  requested_by            VARCHAR(50)  NOT NULL,
  requested_at            DATETIME     NOT NULL,
  department              VARCHAR(50)  NOT NULL,
  estimated_value         BIGINT       NOT NULL,
  assigned_authority_code VARCHAR(50),
  assigned_authority_name VARCHAR(200),
  due_date                DATE,
  status                  VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
  decision_id             VARCHAR(36),
  notes                   TEXT,
  created_at              DATETIME     NOT NULL,
  updated_at              DATETIME     NOT NULL
);

CREATE TABLE approval_decisions (
  id                 VARCHAR(36)  PRIMARY KEY,
  request_id         VARCHAR(36)  NOT NULL UNIQUE,
  outcome            VARCHAR(20)  NOT NULL,
  decided_by         VARCHAR(50)  NOT NULL,
  decided_at         DATETIME     NOT NULL,
  legal_basis        TEXT         NOT NULL,
  conditions         JSON         NOT NULL DEFAULT '[]',
  revision_required  JSON         NOT NULL DEFAULT '[]',
  decision_reference VARCHAR(100) NOT NULL,
  created_at         DATETIME     NOT NULL,
  updated_at         DATETIME     NOT NULL,
  FOREIGN KEY (request_id) REFERENCES approval_requests(id)
);

CREATE TABLE approval_history (
  id           VARCHAR(36)  PRIMARY KEY,
  request_id   VARCHAR(36)  NOT NULL,
  action       VARCHAR(30)  NOT NULL,
  performed_by VARCHAR(50)  NOT NULL,
  performed_at DATETIME     NOT NULL,
  from_status  VARCHAR(20),
  to_status    VARCHAR(20),
  notes        TEXT,
  created_at   DATETIME     NOT NULL,
  updated_at   DATETIME     NOT NULL,
  INDEX idx_history_request (request_id),
  INDEX idx_history_time (request_id, performed_at)
);

CREATE TABLE approval_comments (
  id          VARCHAR(36)  PRIMARY KEY,
  request_id  VARCHAR(36)  NOT NULL,
  content     TEXT         NOT NULL,
  author_code VARCHAR(50)  NOT NULL,
  is_internal TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL,
  updated_at  DATETIME     NOT NULL,
  INDEX idx_comments_request (request_id)
);

CREATE TABLE approval_attachments (
  id            VARCHAR(36)  PRIMARY KEY,
  request_id    VARCHAR(36)  NOT NULL,
  file_name     VARCHAR(255) NOT NULL,
  file_type     VARCHAR(100) NOT NULL,
  file_size     BIGINT       NOT NULL,
  uploaded_by   VARCHAR(50)  NOT NULL,
  document_type VARCHAR(50)  NOT NULL,
  created_at    DATETIME     NOT NULL,
  updated_at    DATETIME     NOT NULL,
  INDEX idx_attachments_request (request_id)
);
```

---

## Acceptance Criteria

1. `createApprovalRequest` creates a DRAFT request and records a CREATED history event
2. `assertUniqueApprovalCode` throws `DUPLICATE_CODE` if requestCode already exists
3. `submitForApproval` transitions DRAFT → SUBMITTED and rejects non-allowed statuses
4. `assignAuthority` transitions SUBMITTED/UNDER_REVIEW → UNDER_REVIEW and stores authority code + name
5. `withdrawApprovalRequest` transitions DRAFT/SUBMITTED/UNDER_REVIEW → WITHDRAWN; rejects APPROVED
6. `recordDecision` requires UNDER_REVIEW status and assigned authority; creates `ApprovalDecisionRecord`
7. `recordDecision` with RETURNED outcome requires non-empty `revisionRequired`
8. Only one `ApprovalDecisionRecord` per `ApprovalRequest` (throws `DECISION_EXISTS`)
9. `recordDecision` transitions request status to APPROVED/REJECTED/RETURNED and sets `decisionId`
10. `resolveAuthorityForValue` returns highest-level (most junior) authority where `maxValue >= estimatedValue`
11. `validateAuthorityPermission` throws `AUTHORITY_INSUFFICIENT` when authority limit < value
12. `buildApprovalSummary` returns commentCount and attachmentCount correctly
13. `buildApprovalFromPackage` and `buildApprovalFromPlan` produce correct `CreateApprovalRequestParams`
14. `addComment` trims whitespace, enforces 5000-char limit, validates non-empty content
15. `addAttachment` enforces 50 MB limit and requires fileName + fileType
16. `calculateProcessingDuration` returns ms between CREATED and terminal event; null if incomplete
17. `createMemoryApprovalRepositories()` returns independent instances on each call
