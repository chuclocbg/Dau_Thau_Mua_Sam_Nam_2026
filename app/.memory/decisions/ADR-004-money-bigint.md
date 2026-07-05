# ADR-004: Money.amount Is bigint

**Status:** ACTIVE
**Date:** 2026-07-03
**Affects:** src/shared/financial/, all modules with monetary values

---

## Problem

Vietnamese Đồng (VNĐ) has no decimal subdivision. Common procurement values range from
50,000 VNĐ (direct award threshold) to 20,000,000,000+ VNĐ (Prime Minister authority).

IEEE 754 double-precision float can only represent integers exactly up to 2^53 (~9 quadrillion).
For VNĐ amounts up to 9 quadrillion, `number` is technically safe, but:
- Float arithmetic in financial code is universally recognized as a bug vector
- Prisma's `Float` type maps to IEEE 754 which causes rounding in edge cases (TD-05)
- External financial libraries (Decimal.js) add a dependency for something TypeScript can solve natively

## Alternatives Considered

1. `number` — rejected: float rounding, community consensus against it for money
2. `Decimal` (Prisma / decimal.js) — rejected: adds dependency, requires wrapper types
3. `string` — rejected: no arithmetic, no comparison operators
4. `bigint` — accepted: native TypeScript, correct for integers, no rounding

## Decision

`Money.amount` is `bigint`. All monetary values throughout the platform are `bigint`.

```typescript
interface Money {
  amount:   bigint
  currency: CurrencyCode  // 'VND'
}
```

## Consequences

- KI-004: Prisma schema uses `Float` (until Phase M fixes to `Decimal`) — known gap
- All arithmetic must use bigint operators: `amount1 + amount2`, `amount * BigInt(rate) / 100n`
- JSON serialization requires BigInt serializer (standard JSON.stringify doesn't handle bigint)
- `createMoney()` factory in `src/shared/financial/financialFactory.ts` is canonical

## Affected Modules

`src/shared/financial/` · `src/payment/` · `src/approval/` · `src/contract/` · `src/masterdata/` · all future modules
