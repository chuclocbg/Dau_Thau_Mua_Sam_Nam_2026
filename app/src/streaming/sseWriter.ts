import type { ServerResponse } from 'node:http'
import type { SSEEvent, StreamWriter } from './sseTypes.ts'

// ── SSE Writer — Phase X.9.3 ───────────────────────────────────────────────────
// The one concrete StreamWriter implementation: backpressure-safe Server-Sent Events framing
// over a raw Node ServerResponse. Directly addresses PRODUCTION_HARDENING_AUDIT.md's
// "Streaming is not implemented for reasoning output" finding (that finding correctly noted
// this as a future optimization, not a current defect — this milestone is that future work).
//
// Backpressure: ServerResponse.write() returns false when the internal buffer is full; this
// writer awaits the 'drain' event before resolving in that case, exactly per Node's own
// documented backpressure contract — never a busy-wait, never an unbounded buffer.
//
// Graceful termination: close() always calls response.end() exactly once (idempotent), so a
// stream that errors, times out, or is aborted still leaves the underlying connection cleanly
// terminated rather than hanging open.

export class SSEWriter implements StreamWriter {
  private readonly res: ServerResponse
  private clientClosed = false

  constructor(res: ServerResponse) {
    this.res = res
    this.res.once('close', () => { this.clientClosed = true })
  }

  get closed(): boolean {
    return this.clientClosed || this.res.writableEnded
  }

  async writeEvent(event: SSEEvent): Promise<void> {
    if (this.closed) return
    const lines: string[] = []
    if (event.id !== undefined) lines.push(`id: ${event.id}`)
    lines.push(`event: ${event.event}`)
    for (const dataLine of JSON.stringify(event.data).split('\n')) {
      lines.push(`data: ${dataLine}`)
    }
    lines.push('', '')
    await this.write(lines.join('\n'))
  }

  async close(): Promise<void> {
    if (this.res.writableEnded) return
    await new Promise<void>((resolve) => { this.res.end(() => resolve()) })
  }

  private write(chunk: string): Promise<void> {
    if (this.closed) return Promise.resolve()
    return new Promise((resolve) => {
      const canWriteMore = this.res.write(chunk)
      if (canWriteMore) { resolve(); return }
      this.res.once('drain', () => resolve())
    })
  }
}
