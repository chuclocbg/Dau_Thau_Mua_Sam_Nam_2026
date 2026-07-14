# Phase X.19 Architecture Decision — Version-Based Optimistic Locking for Recovery Markers

**Date:** 2026-07-14
**Status:** DECIDED. Triggered by the ADR checklist (`Persistence model changed?` = true, once a
schema migration became the approved fix) after implementation revealed the initially-planned
`updatedAt`-based compare-and-swap was not correctness-preserving.
**Affects:** `prisma/schema.prisma` (one new migration), `src/runtime/recovery/recoveryTypes.ts`,
`memoryRecoveryRepository.ts`, `prismaRecoveryRepository.ts`, `conversationRecoveryCoordinator.ts`.

---

## Decision

Add `version Int @default(0)` to `ConversationRecoveryMarker`, incremented on every write. The
optimistic-locking compare-and-swap (`resolveIfPending()`) compares and increments **`version`**,
not `updatedAt`.

## Why the Original Plan (`updatedAt`-based CAS) Was Rejected

`X19_IMPLEMENTATION_PLAN.md` originally proposed reusing the existing `updatedAt` column (already
present, `@updatedAt`-managed, no migration needed) as the compare-and-swap token, specifically to
stay migration-free. **Implementation testing disproved this before it shipped:** a concurrency
test (`Promise.all` of two simultaneous `recoverMarker()` calls against the same marker) showed
*both* calls succeeding, when exactly one should have. Root cause: `updatedAt` is a `DateTime`
with millisecond resolution; two claims occurring within the same millisecond produce identical
`updatedAt` values, so the second claim's stale-read check (`existing.updatedAt !==
expectedUpdatedAt`) sees no difference and incorrectly proceeds. This is not a rare edge case —
the test reproduced it deterministically on the very first run, since two near-simultaneous
in-process async calls routinely land in the same millisecond. The same risk applies to the
Prisma-backed path, since `@updatedAt` is computed client-side by Prisma as `new Date()`, at the
same millisecond resolution.

A wall-clock timestamp is fundamentally the wrong primitive for optimistic concurrency control
when writes can occur faster than the clock's resolution. The standard, correct fix is a
monotonically-incrementing integer version column — which requires a migration, the thing the
original plan was trying to avoid. The result is genuinely more correct at the cost of the
smallest reasonable schema change (one `Int` column, one migration, no other model touched).

## Why Not Other Alternatives

- **A random/UUID claim token in the existing `error` field:** rejected — abuses a field whose
  documented meaning is "failure message," would confuse any future reader of a healthy
  in-progress marker showing a non-null `error`.
- **A new `RecoveryMarkerStatus` enum value (e.g., `RECOVERING`) as the claim gate:** also requires
  a migration (Postgres enum alteration), and is a larger, more invasive change than a single
  integer column — rejected in favor of the smaller `version` column, which achieves the same
  correctness property (atomic claim) without changing the meaning of `status` at all.
- **An in-process-only monotonic counter (no schema change):** rejected — does not protect against
  the actual, named threat model (`TD` register: "concurrent-scan-safe idempotency," meaning
  **cross-process** scans, e.g. two deployment instances both running `scripts/recoveryScan.ts`
  near-simultaneously during a rolling deploy). An in-process counter has no meaning across
  processes; only a database-level, atomically-compared column closes this for real.

## Migration Details

One new migration, additive only: `ALTER TABLE conversation_recovery_markers ADD COLUMN version
INTEGER NOT NULL DEFAULT 0`. No other model touched. No data migration needed — existing rows
(none exist outside this development environment's own test runs) default to `version = 0`.
Generated and applied live against the same Postgres instance X.17 verified, per this project's
own "prove it for real when a live database is available" discipline.

## Files Changed by This Decision (beyond what the original plan already named)

| File | Change |
|---|---|
| `prisma/schema.prisma` | `ConversationRecoveryMarker` gains `version Int @default(0)`. |
| `prisma/migrations/<timestamp>_add_recovery_marker_version/` | New migration (additive, no other model affected). |
| `src/runtime/recovery/recoveryTypes.ts` | `RecoveryMarker` gains `readonly version: number`; `resolveIfPending()`'s signature changes from `expectedUpdatedAt: string` to `expectedVersion: number`. |
| `src/runtime/recovery/memoryRecoveryRepository.ts`, `prismaRecoveryRepository.ts` | CAS check/increment now compares/bumps `version`, not `updatedAt`. |
| `src/runtime/recovery/conversationRecoveryCoordinator.ts` | Passes `marker.version` instead of `marker.updatedAt` to the claim call. |
| Test file (`x19-recovery-optimistic-locking.test.ts`) | Updated to exercise `version`; the millisecond-collision workaround (artificial `setTimeout` delay) is removed — no longer needed, since integer increments never collide. |

## Rollback Implications

Slightly higher than a pure code change, but still low and standard for an additive migration:
reverting requires a down-migration dropping the `version` column (or leaving it — an unused,
harmless column — if reverting only the application-code half). No existing data is at risk since
the column is additive with a default; no other model or migration depends on it. This is the same
rollback profile every other additive Phase X migration (X.11, X.13, X.14) has already had.

---

*End of decision. Implementation proceeds per this ADR plus `X19_IMPLEMENTATION_PLAN.md`'s
otherwise-unchanged scope and acceptance criteria.*
