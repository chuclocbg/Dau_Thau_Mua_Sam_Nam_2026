/**
 * P6-10H: Normalized streaming types shared across all provider adapters.
 *
 * StreamChunk — discriminated union of all event types.
 * StreamResponse — AsyncIterable<StreamChunk> for `for await` iteration.
 * StreamingProvider — structural interface satisfied by all three providers.
 * readSseLines — shared SSE line reader from Response.body.
 *
 * Event sequence (success): token* → message → done
 * Event sequence (failure): error → done
 *
 * Never throws — all errors are surfaced as 'error' chunks.  Callers always
 * receive a 'done' chunk as the final event regardless of how the stream ends.
 */

// ─── Event type ───────────────────────────────────────────────────────────────

export type StreamEventType = 'token' | 'message' | 'done' | 'error';

// ─── Discriminated chunk union ────────────────────────────────────────────────

export type StreamChunk =
  | { event: 'token'; token: string; }
  | {
      event:         'message';
      content:       string;
      model?:        string;
      finishReason?: string;
      usage: {
        inputTokens:  number;
        outputTokens: number;
        totalTokens:  number;
      };
    }
  | { event: 'done'; }
  | {
      event: 'error';
      error: { code: string; message: string; cause?: unknown; };
    };

// ─── StreamResponse ───────────────────────────────────────────────────────────

/** AsyncIterable of StreamChunk — supports `for await (const chunk of response)`. */
export interface StreamResponse extends AsyncIterable<StreamChunk> {}

// ─── StreamingProvider ────────────────────────────────────────────────────────

/** Structural interface satisfied by OpenAIProvider, ClaudeProvider, GeminiProvider. */
export interface StreamingProvider {
  stream(request: {
    messages:     ReadonlyArray<{ role: string; content: string; }>;
    system?:      string;
    model?:       string;
    temperature?: number;
    maxTokens?:   number;
  }): StreamResponse;
}

// ─── SSE line reader ──────────────────────────────────────────────────────────

/**
 * Reads Server-Sent Events lines from a streaming Response body.
 *
 * Splits the byte stream on newline boundaries and yields each line.
 * Empty lines (SSE event separators) are yielded as empty strings.
 * Callers should filter for lines starting with 'data: '.
 * The reader lock is always released in the finally block.
 * Never throws — read errors end the generator silently.
 */
export async function* readSseLines(response: Response): AsyncGenerator<string> {
  if (!response.body) return;
  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let remainder = '';
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      const text     = decoder.decode(result.value, { stream: true });
      const combined = remainder + text;
      const lines    = combined.split('\n');
      remainder      = lines.pop() ?? '';
      for (const line of lines) yield line;
    }
    if (remainder.length > 0) yield remainder;
  } finally {
    reader.releaseLock();
  }
}
