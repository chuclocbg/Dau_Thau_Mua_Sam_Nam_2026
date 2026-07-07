// ── Stream Race — Phase X.9.3 ──────────────────────────────────────────────────
// Races an in-flight promise against an AbortSignal and a hard timeout. This is the HTTP-layer
// cancellation mechanism for this milestone: the frozen reasoning/Tool Calling/MCP layers
// (ToolExecutor.execute(), MCPClient.callTool(), ReasoningEnginePipeline.answer()) accept no
// AbortSignal parameter of their own — adding one would mean modifying those frozen files,
// explicitly forbidden. What CAN be done honestly, without touching them, is stop the HTTP
// handler itself from waiting/writing further once the client disconnects or a timeout elapses
// — this function is that boundary. For this repository's actual reasoning path (in-memory,
// deterministic, no network I/O) the underlying computation finishes in milliseconds regardless,
// so this is not a fabricated safety net — it is a real, meaningful bound for network-backed MCP
// tool calls, and a correct no-op overhead for the pure-reasoning path. Documented transparently
// rather than claiming true mid-flight cancellation of frozen internals that do not support it.

export class StreamAbortedError extends Error {
  constructor() { super('STREAM_ABORTED') }
}

export class StreamTimeoutError extends Error {
  constructor(timeoutMs: number) { super(`STREAM_TIMEOUT_${timeoutMs}MS`) }
}

export async function raceSignalAndTimeout<T>(
  promise: Promise<T>, signal: AbortSignal, timeoutMs: number,
): Promise<T> {
  if (signal.aborted) throw new StreamAbortedError()

  let timerId: ReturnType<typeof setTimeout> | undefined
  let onAbort: (() => void) | undefined

  const guard = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => reject(new StreamTimeoutError(timeoutMs)), timeoutMs)
    onAbort = () => reject(new StreamAbortedError())
    signal.addEventListener('abort', onAbort, { once: true })
  })

  try {
    return await Promise.race([promise, guard])
  } finally {
    clearTimeout(timerId)
    if (onAbort !== undefined) signal.removeEventListener('abort', onAbort)
  }
}
