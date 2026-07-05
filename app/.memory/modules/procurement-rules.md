# Module: Procurement Rule Engine

**Status:** FROZEN (v1.0, 2026-07-02)
**Location:** `src/procurement/rules/` + `src/procurement/application/`
**Tests:** ~117

---

## Purpose

Evaluates procurement rules — method selection, threshold checks, approval authority,
advance payment, guarantee, and document requirements. Rules are data (not logic).
Adding a new circular requires inserting new rule objects with `effectiveFrom`, not code changes.

---

## Files

- `procurementRules.ts` — rule data registry (ProcurementRule objects with legal citations)
- `procurementEngine.ts` — 6-capability stateless evaluation engine
- `procurementApi.ts` — pure JSON adapter (no HTTP framework)

---

## Public API (6 capabilities)

```typescript
// procurementEngine.ts — 6 stateless functions
classifyPackage(request, thresholds): ClassificationResult
selectMethod(package, thresholds, rules): MethodSelectionResult
resolveApprovalAuthority(package, authorities): ApprovalAuthorityLevel
checkDocumentRequirements(package, method): DocumentCheckResult
validateAdvancePayment(rate, package, rules): ValidationResult
resolveApplicableLaw(package, asOfDate, rules): ApplicableLawResult

// procurementApi.ts — JSON wrappers
evaluateProcurementPackage(request): EvaluationResponse
```

---

## Dependencies

- `src/procurement/domain/procurementTypes.ts` — `ProcurementPackageKind`, `ProcurementMethodCode`, `ApprovalAuthorityLevel`
- No other business module imports

---

## Consumers

- `packageIntegration.ts`
- `planningIntegration.ts`
- `approvalIntegration.ts` (indirectly via planning)

---

## Business Rules Enforced

All rules are dynamic (data-driven from `procurementRules.ts`):
- METHOD-001: Open tender required above competitive quote threshold
- METHOD-002: Competitive quote for GOODS/SERVICE ≤ 200M VNĐ
- METHOD-003: Direct award for GOODS/SERVICE ≤ 50M VNĐ
- ADVANCE-001: Advance payment ≤ 30% for state budget projects
- GUARANTEE-001: Bid security required above 5B VNĐ
- TIMELINE-001: Minimum 30 days for international tender notice

---

## Known Technical Debt

- **TD-02** (CRITICAL): `procurementEngine.ts:215-217` — hardcodes `d.symbol === '13/2026/TT-BCT'` and `d.symbol === '79/2025/TT-BTC'` in `resolveLegalDocuments()`. New circular will silently miss. Module is FROZEN — fix requires ADR + unfreeze.

---

## Extension Policy

New procurement rule → add to `procurementRules.ts` with `effectiveFrom` + `effectiveTo`.
New evaluation capability → requires unfreezing `procurementEngine.ts` (ADR required).
