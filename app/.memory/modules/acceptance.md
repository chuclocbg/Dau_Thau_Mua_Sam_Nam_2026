# Module: Acceptance Module

**Status:** FROZEN (v1.1, 2026-07-03)
**Location:** `src/acceptance/`
**Tests:** 312

---

## Purpose

Manages formal acceptance (nghiệm thu) of delivered goods/services/construction work.
An `AcceptanceRequest` can have multiple `AcceptanceSession` objects (PARTIAL sessions)
before a final FINAL session closes the acceptance.

---

## Session Close Semantics

- **PARTIAL close:** session complete, acceptance not finished — more sessions follow
- **FINAL close:** all work accepted — triggers payment eligibility
- Once FINAL, no new sessions can be added

---

## Public API

```typescript
AcceptanceRequest {
  id, contractId, requestType,
  sessions: AcceptanceSession[],
  status: AcceptanceStatus,
  legalBasis: LegalBasis[],
  finalizedAt?: string,
  createdAt, updatedAt
}

AcceptanceSession {
  sessionId, requestId,
  participants: string[],        // userIds
  findings: AcceptanceFinding[],
  decision: 'ACCEPTED' | 'ACCEPTED_WITH_CONDITIONS' | 'REJECTED',
  sessionType: 'PARTIAL' | 'FINAL',
  conductedAt, closedAt?
}

// Service functions
createAcceptanceRequest(contractId, params, repos): Promise<AcceptanceRequest>
openSession(requestId, sessionParams, repos): Promise<AcceptanceSession>
recordFindings(sessionId, findings, repos): Promise<AcceptanceSession>
closeSession(sessionId, decision, sessionType, repos): Promise<AcceptanceSession>
finalizeAcceptance(requestId, repos): Promise<AcceptanceRequest>
```

---

## Dependencies

- `src/contract/` (via acceptanceIntegration.ts)
- `src/procurement/workflow/` (via acceptanceIntegration.ts)

---

## Consumers

- `financialIntegration.ts` — acceptance triggers payment schedule
- `paymentIntegration.ts` — payment references acceptance completion

---

## Known Technical Debt

- **TD-01** (CRITICAL): `acceptanceService.ts:11-17` — `DEFAULT_LEGAL_BASIS: string[]` uses plain strings, not `LegalBasis[]`. Violates RULE-09. Module is FROZEN — tracked, awaiting unfreeze.
- Prisma repo is stub until Phase M

---

## Extension Policy

`legalBasis[]` is extensible — new legal instruments for acceptance are added as new LegalBasis entries.
No code change needed for new acceptance types if they fit PARTIAL/FINAL semantics.
