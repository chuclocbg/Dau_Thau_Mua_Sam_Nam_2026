import type { ServerResponse } from 'node:http'

// ── Request Abort Signal — Phase X.9.3 ─────────────────────────────────────────
// Client disconnect detection, exposed as a native AbortSignal. Uses the standard, documented
// Node.js pattern: a ServerResponse emits 'close' both on normal completion (after end()) and
// on premature client disconnect — the two are distinguished by checking writableEnded at the
// moment 'close' fires. Only the premature case aborts the signal.

export function createAbortSignalForResponse(res: ServerResponse): AbortSignal {
  const controller = new AbortController()
  if (res.writableEnded) return controller.signal

  res.once('close', () => {
    if (!res.writableEnded && !controller.signal.aborted) {
      controller.abort()
    }
  })

  return controller.signal
}
