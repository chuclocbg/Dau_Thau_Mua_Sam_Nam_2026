# Acceptance Module — Phase H

Legal basis (initial seed — extensible, not exhaustive):
- Luật 22/2023/QH15
- NĐ 214/2025/NĐ-CP
- NĐ 104/2026/NĐ-CP
- TT 13/2026/TT-BCT
- TT 79/2025/TT-BTC

The platform is designed to cite any additional applicable law, decree, circular,
sector-specific regulation, or organizational internal regulation via `legalBasis[]`.
Adding new legal sources never requires code changes.

---

## ER Diagram

```
Contract ────────── AcceptanceRequest ──┬── AcceptanceCommittee ──── AcceptanceMember[]
                          │              ├── AcceptanceSession ───── AcceptanceItem[]
ProcurementPackage ───────┘              │                      └─── AcceptanceMinute
WorkflowInstance ─────────┘              ├── AcceptanceHistoryEntry[]  (immutable)
                                         └── AcceptanceAttachment[]
```

---

## AcceptanceRequest Status Machine

```
DRAFT ──────────────────────────────────────────────────────► WITHDRAWN
  │                                                                ▲
  ▼                                                                │
COMMITTEE_FORMED ──────────────────────────────────────────► WITHDRAWN
  │                                                                ▲
  ▼                                                                │
IN_PROGRESS ◄──────────── PARTIAL_ACCEPTED ────────────────► WITHDRAWN
  │                │               │
  ▼                │               ▼
COMPLETED       (more          COMPLETED
               sessions)
  │
  └──────────────────────────────────────────────────────────► REJECTED
```

Allowed transitions:
| From                      | To              | Operation          |
|---------------------------|-----------------|--------------------|
| DRAFT                     | COMMITTEE_FORMED | formCommittee      |
| COMMITTEE_FORMED          | IN_PROGRESS     | createSession (first) |
| IN_PROGRESS               | PARTIAL_ACCEPTED | closeSession (PARTIAL) |
| IN_PROGRESS/PARTIAL_ACCEPTED | COMPLETED    | completeAcceptance |
| IN_PROGRESS/PARTIAL_ACCEPTED | REJECTED     | rejectAcceptance   |
| DRAFT/COMMITTEE_FORMED/IN_PROGRESS | WITHDRAWN | withdrawRequest |

---

## AcceptanceSession Status Machine

```
PENDING ──► IN_PROGRESS ──► COMPLETED
                │
                └──────────► CANCELLED
PENDING ─────────────────────► CANCELLED
```

---

## AcceptanceMinute Status Machine

```
DRAFT ──► SIGNED
  └──► (VOIDED — admin operation)
```

---

## Sequence Diagram — Committee Formation + Session Flow

```
Client → acceptanceService.createAcceptanceRequest(params)
  → repos.requests.create(status: DRAFT, legalBasis: [...defaults + extra])
  → history: CREATED

Client → acceptanceCommittee.formCommittee(requestId, params)
  → assertNoDuplicateCommittee()
  → validateStatusTransition(DRAFT → allowed)
  → repos.committees.create()
  → repos.requests.update(status: COMMITTEE_FORMED)
  → history: COMMITTEE_FORMED

Client → acceptanceCommittee.addMember(requestId, committeeId, params)
  → repos.members.create(isActive: true)
  → history: MEMBER_ADDED

Client → acceptanceSession.createSession(requestId, params)
  → repos.sessions.create(status: PENDING, sessionNumber: N)
  → repos.requests.update(status: IN_PROGRESS)  [first session only]

Client → acceptanceSession.startSession(sessionId, actualDate)
  → repos.sessions.update(status: IN_PROGRESS, actualDate)
  → history: SESSION_STARTED

Client → acceptanceItem.recordItem(sessionId, requestId, params)
  → validateItemParams()  [sum check]
  → repos.items.create(status: ACCEPTED|REJECTED|PENDING)
  → history: ITEM_RECORDED

Client → acceptanceMinute.createMinute(requestId, sessionId, params)
  → assertOneMinutePerSession()
  → repos.minutes.create(status: DRAFT)
  → history: MINUTE_CREATED

Client → acceptanceMinute.signMinute(minuteId, signedBy)
  → repos.minutes.update(status: SIGNED, signedBy, signedAt)
  → history: MINUTE_SIGNED

Client → acceptanceSession.closeSession(sessionId)
  → repos.sessions.update(status: COMPLETED)
  → if PARTIAL: repos.requests.update(status: PARTIAL_ACCEPTED)
  → history: SESSION_COMPLETED

Client → acceptanceService.completeAcceptance(requestId)
  → validateStatus([IN_PROGRESS, PARTIAL_ACCEPTED])
  → repos.requests.update(status: COMPLETED, completedAt)
  → history: COMPLETED
```

---

## Legal Basis Extensibility

The `legalBasis: string[]` field on `AcceptanceRequest` is open-ended.

The 5 seed laws are always included by default. Callers may append:
- Additional Vietnamese laws (e.g., `Luật Xây dựng 50/2014/QH13`)
- Sector-specific decrees (e.g., `NĐ 99/2022/NĐ-CP` for construction)
- Ministerial circulars (e.g., `TT 26/2016/TT-BXD`)
- Local regulations (e.g., `QĐ 123/UBND-HN`)
- Internal organizational regulations

Adding new legal sources requires **no code changes** — only data.
The `addLegalBasis(requestId, lawCodes[], updatedBy, repos)` function appends and deduplicates.

---

## API Reference

### acceptanceService

| Function                 | Input                                    | Output             |
|--------------------------|------------------------------------------|--------------------|
| `createAcceptanceRequest`| `CreateAcceptanceParams, repos`          | `AcceptanceRequest` |
| `withdrawRequest`        | `requestId, withdrawnBy, reason, repos`  | `AcceptanceRequest` |
| `completeAcceptance`     | `requestId, completedBy, repos`          | `AcceptanceRequest` |
| `rejectAcceptance`       | `requestId, rejectedBy, reason, repos`   | `AcceptanceRequest` |
| `addLegalBasis`          | `requestId, lawCodes[], updatedBy, repos`| `AcceptanceRequest` |

### acceptanceCommittee

| Function            | Input                                              | Output                 |
|---------------------|----------------------------------------------------|------------------------|
| `formCommittee`     | `requestId, params, formedBy, repos`              | `AcceptanceCommittee`  |
| `addMember`         | `requestId, committeeId, params, addedBy, repos`  | `AcceptanceMember`     |
| `removeMember`      | `memberId, removedBy, repos`                      | `AcceptanceMember`     |
| `getCommitteeMembers`| `committeeId, repos`                             | `readonly AcceptanceMember[]` |

### acceptanceSession

| Function       | Input                                          | Output               |
|----------------|------------------------------------------------|----------------------|
| `createSession`| `requestId, params, createdBy, repos`         | `AcceptanceSession`  |
| `startSession` | `sessionId, startedBy, actualDate, repos`     | `AcceptanceSession`  |
| `closeSession` | `sessionId, closedBy, repos`                  | `AcceptanceSession`  |
| `cancelSession`| `sessionId, cancelledBy, reason, repos`       | `AcceptanceSession`  |
| `getSessions`  | `requestId, repos`                            | `readonly AcceptanceSession[]` |

### acceptanceItem

| Function                   | Input                                               | Output                |
|----------------------------|-----------------------------------------------------|-----------------------|
| `recordItem`               | `sessionId, requestId, params, recordedBy, repos`  | `AcceptanceItem`      |
| `getItems`                 | `requestId, repos`                                 | `readonly AcceptanceItem[]` |
| `getItemsBySession`        | `sessionId, repos`                                 | `readonly AcceptanceItem[]` |
| `calculateAcceptanceRate`  | `requestId, repos`                                 | `number` (0–100)      |

### acceptanceMinute

| Function      | Input                                          | Output               |
|---------------|------------------------------------------------|----------------------|
| `createMinute`| `requestId, sessionId, params, createdBy, repos` | `AcceptanceMinute` |
| `signMinute`  | `minuteId, signedBy, repos`                   | `AcceptanceMinute`   |
| `getMinutes`  | `requestId, repos`                            | `readonly AcceptanceMinute[]` |

### acceptanceIntegration

| Function                        | Input                                          | Output                     |
|---------------------------------|------------------------------------------------|----------------------------|
| `buildAcceptanceFromContract`   | `contract, requestCode, requestedBy, dept, extraLegalBasis?` | `CreateAcceptanceParams` |
| `advanceWorkflowOnAcceptanceComplete` | `instance, performedBy, notes?`        | `WorkflowInstance`         |
| `buildAcceptanceSummary`        | `requestId, repos`                            | `AcceptanceSummary \| null` |
| `validateContractForAcceptance` | `contractId, contractRepo`                    | `Contract`                 |

### acceptanceFactory

| Function                             | Output                              |
|--------------------------------------|-------------------------------------|
| `generateAcceptanceCode(type, year, seq)` | `"NT/{TAG}/{year}/{seq:04d}"`  |
| `generateMinuteCode(acceptanceCode, sessionNum)` | `"BB/{base}/{num:02d}"`  |
| `buildCreateAcceptanceParams(opts)`  | `CreateAcceptanceParams`            |
| `createMemoryAcceptanceRepositories()` | `AcceptanceRepositories`          |
| `createPrismaAcceptanceRepositories()` | `AcceptanceRepositories`          |

---

## Validation Rules

| Code | Rule                                                              |
|------|-------------------------------------------------------------------|
| V-1  | requestCode must not be blank                                     |
| V-2  | requestCode must be unique in repository                          |
| V-3  | contractId must not be blank                                      |
| V-4  | requestedBy and department must not be blank                      |
| V-5  | committeeCode and establishedBy must not be blank                 |
| V-6  | memberCode, memberName, and role are required for members         |
| V-7  | Duplicate memberCode in the same committee is rejected            |
| V-8  | sessionType and scheduledDate are required                        |
| V-9  | itemCode and description are required                             |
| V-10 | contractedQuantity must be > 0                                    |
| V-11 | acceptedQuantity + rejectedQuantity ≤ contractedQuantity         |
| V-12 | acceptedQuantity and rejectedQuantity must be ≥ 0                |
| V-13 | minuteCode and conclusion are required                            |
| V-14 | One minute per session (duplicate check)                          |
| V-15 | attachment.fileSize ≤ 100MB                                       |

---

## Prisma Migration SQL (excerpt)

```sql
CREATE TYPE "AcceptanceStatus" AS ENUM ('DRAFT','COMMITTEE_FORMED','IN_PROGRESS','PARTIAL_ACCEPTED','COMPLETED','REJECTED','WITHDRAWN');
CREATE TYPE "AcceptanceType"   AS ENUM ('PARTIAL','FINAL','WARRANTY');
CREATE TYPE "SessionStatus"    AS ENUM ('PENDING','IN_PROGRESS','COMPLETED','CANCELLED');
CREATE TYPE "ItemStatus"       AS ENUM ('PENDING','ACCEPTED','REJECTED');
CREATE TYPE "MinuteStatus"     AS ENUM ('DRAFT','SIGNED','VOIDED');
CREATE TYPE "MemberRole"       AS ENUM ('CHAIRMAN','SECRETARY','MEMBER','EXPERT');

CREATE TABLE "acceptance_requests" (
  "id"             UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  "requestCode"    TEXT     UNIQUE NOT NULL,
  "acceptanceType" "AcceptanceType" NOT NULL,
  "contractId"     TEXT     NOT NULL,
  "packageId"      TEXT,
  "workflowId"     TEXT,
  "requestedBy"    TEXT     NOT NULL,
  "requestedAt"    TEXT     NOT NULL,
  "department"     TEXT     NOT NULL,
  "description"    TEXT,
  "legalBasis"     TEXT[]   NOT NULL DEFAULT '{}',
  "status"         "AcceptanceStatus" NOT NULL DEFAULT 'DRAFT',
  "completedAt"    TEXT,
  "notes"          TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ NOT NULL
);
-- ... (acceptance_committees, acceptance_members, acceptance_sessions,
--      acceptance_items, acceptance_minutes, acceptance_history, acceptance_attachments)
```

---

## Acceptance Criteria

1. `createAcceptanceRequest` creates a DRAFT request with all 5 default legal bases always included.
2. Extra law codes passed by caller are merged and deduplicated; no limit on number of legal sources.
3. `addLegalBasis` appends new law codes at any time without duplication.
4. `formCommittee` can only be called once per request (COMMITTEE_EXISTS error on duplicate).
5. `formCommittee` advances request status to COMMITTEE_FORMED.
6. `addMember` prevents duplicate memberCode within the same committee.
7. `removeMember` marks member inactive; `getCommitteeMembers` excludes them.
8. `createSession` auto-increments `sessionNumber` per request starting at 1.
9. First session creation advances request to IN_PROGRESS.
10. PARTIAL session close advances request to PARTIAL_ACCEPTED.
11. FINAL session close keeps request IN_PROGRESS (completeAcceptance transitions to COMPLETED).
12. `recordItem` status: all-accepted → ACCEPTED; all-rejected → REJECTED; mixed → PENDING.
13. `acceptedQuantity + rejectedQuantity` must not exceed `contractedQuantity`.
14. One minute per session; second minute throws MINUTE_EXISTS.
15. `signMinute` transitions DRAFT → SIGNED; re-signing throws INVALID_STATUS.
16. `calculateAcceptanceRate` = total accepted / total contracted × 100, capped at 100, integer.
17. `buildAcceptanceSummary` returns null for unknown requestId; aggregates 8 counts.
18. `validateContractForAcceptance` requires EFFECTIVE or COMPLETED contract.
19. All history entries are immutable append-only (PRINCIPLE 3).
20. All 312 unit tests pass; no frozen module is modified.
