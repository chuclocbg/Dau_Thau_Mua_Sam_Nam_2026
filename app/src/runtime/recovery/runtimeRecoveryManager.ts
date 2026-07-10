import type { RuntimeContext } from '../runtimeContext.ts'
import type { IRecoveryRepository } from './recoveryTypes.ts'
import { recoverMarker } from './conversationRecoveryCoordinator.ts'
import type { RecoveryOutcome } from './conversationRecoveryCoordinator.ts'

// ── Runtime Recovery Manager — Phase X.13 ──────────────────────────────────────
// The startup recovery scan: drains the recovery queue (IRecoveryRepository.findPending(), the
// durable, oldest-first set of unfinished markers) by delegating each one to
// conversationRecoveryCoordinator.recoverMarker() -- this file owns the scan loop only, never
// per-marker replay logic (that stays in the coordinator, not duplicated here). Sequential, not
// parallel, by design: replaying conversation turns against the same in-process reasoning
// pipeline concurrently offers no benefit here and would only complicate the already-documented
// idempotency story.
//
// WIRING NOTE: not invoked from src/server/main.ts's boot sequence. main.ts is frozen (Phase
// X.9.1) and this milestone's own instructions permit no carve-out for it (unlike X.9.2/X.9.3,
// which had an explicit "wiring only" exception for specific files) -- "Do NOT modify any frozen
// milestone (X.3-X.12)" is stated without exception this time. runStartupRecoveryScan() is a
// complete, tested, independently invokable capability (see scripts/recoveryScan.ts for a CLI
// entrypoint, mirroring the X.9.5 waitForReady.ts/smokeTest.ts precedent) -- wiring it into the
// live process boot sequence is a deliberate, explicitly out-of-scope gap for a future,
// separately-authorized milestone, not a silent omission.

export interface RecoveryScanResult {
  readonly scanned: number
  readonly recovered: number
  readonly failed: number
  readonly alreadyResolved: number
  readonly outcomes: readonly RecoveryOutcome[]
}

export async function runStartupRecoveryScan(
  recoveryRepository: IRecoveryRepository,
  runtime: RuntimeContext,
): Promise<RecoveryScanResult> {
  const pending = await recoveryRepository.findPending()
  const outcomes: RecoveryOutcome[] = []

  for (const marker of pending) {
    outcomes.push(await recoverMarker(recoveryRepository, runtime, marker.id))
  }

  return {
    scanned: pending.length,
    recovered: outcomes.filter(o => o.recovered).length,
    failed: outcomes.filter(o => !o.recovered && o.reason === 'REPLAY_FAILED').length,
    alreadyResolved: outcomes.filter(o => !o.recovered && o.reason === 'ALREADY_RESOLVED').length,
    outcomes,
  }
}
