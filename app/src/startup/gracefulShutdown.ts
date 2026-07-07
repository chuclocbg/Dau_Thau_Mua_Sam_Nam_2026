// ── Graceful Shutdown — Phase X.9.1 ────────────────────────────────────────────
// Directly addresses PRODUCTION_HARDENING_AUDIT.md's finding: "no process-level shutdown
// lifecycle (grep for SIGTERM/SIGINT/process.on across src/ returns zero results)". Closes the
// HTTP listener (draining in-flight requests, per Fastify's own close() semantics) and
// disconnects any optional MCPClient before exiting. A hard timeout guarantees the process exits
// even if close() hangs, rather than leaving a zombie process behind.
//
// createShutdownHandler() is exported separately from registerGracefulShutdown() so tests can
// invoke the handler directly with a fake server/exit function, without touching real
// process.on()/process.exit() — the same test-first discipline used throughout X.6-X.8.

export interface CloseableServer {
  close(): Promise<unknown>
}

export interface ShutdownDependencies {
  readonly server: CloseableServer
  readonly onShutdown?: () => Promise<void>
  readonly timeoutMs: number
  readonly exit?: (code: number) => void
}

export function createShutdownHandler(deps: ShutdownDependencies): (signal: string) => Promise<void> {
  const exit = deps.exit ?? ((code: number) => process.exit(code))
  let shuttingDown = false

  return async (_signal: string): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true

    let settled = false
    let timerId: ReturnType<typeof setTimeout> | undefined

    const timeoutPromise = new Promise<void>((resolve) => {
      timerId = setTimeout(() => {
        if (!settled) { settled = true; exit(1) }
        resolve()
      }, deps.timeoutMs)
    })

    const workPromise = (async (): Promise<void> => {
      try {
        await deps.server.close()
        await deps.onShutdown?.()
        if (!settled) { settled = true; exit(0) }
      } catch {
        if (!settled) { settled = true; exit(1) }
      } finally {
        clearTimeout(timerId)
      }
    })()

    // Race, not sequential await: a hung close()/onShutdown() must not keep this promise
    // pending forever — the timeout path resolves the race even when the underlying work never
    // settles (the real process.exit() call terminates the process regardless; this only
    // matters for tests/callers that await the returned promise).
    await Promise.race([workPromise, timeoutPromise])
  }
}

export function registerGracefulShutdown(deps: ShutdownDependencies): void {
  const handler = createShutdownHandler(deps)
  process.on('SIGTERM', () => { void handler('SIGTERM') })
  process.on('SIGINT', () => { void handler('SIGINT') })
}
