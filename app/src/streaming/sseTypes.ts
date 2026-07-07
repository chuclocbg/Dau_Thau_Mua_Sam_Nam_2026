// ── SSE Types — Phase X.9.3 ────────────────────────────────────────────────────
// A minimal, transport-labeled streaming abstraction. StreamWriter is not vendor-specific (no
// Fastify/Node types leak into it) so a future transport (WebSocket, HTTP/2 push) could
// implement the same interface — SSEWriter (sseWriter.ts) is the one concrete implementation
// this milestone ships, exactly the same "abstraction, one real implementation" shape already
// used for Tracer/SimpleTracer in X.9.2.

export interface SSEEvent {
  readonly event: string
  readonly data: unknown
  readonly id?: string
}

export interface StreamWriter {
  readonly closed: boolean
  writeEvent(event: SSEEvent): Promise<void>
  close(): Promise<void>
}

export type StreamStageName = 'reasoning' | 'formatting' | 'tool_calling'
export type StreamStageStatus = 'started' | 'completed'

export interface StreamStageEvent {
  readonly stage: StreamStageName
  readonly status: StreamStageStatus
  readonly toolInvoked?: boolean
}

export interface StreamErrorEvent {
  readonly code: string
  readonly message: string
}
