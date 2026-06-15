/**
 * P6-10I: ConversationMemory — bounded in-memory conversation history.
 *
 * Intended for injection into ProviderManager so that chat() and stream()
 * automatically carry prior turns when calling the provider.
 *
 * Immutability contract:
 *   add()         — stores a shallow copy; caller mutations do not bleed in.
 *   getMessages() — returns an array of shallow copies; recipient mutations
 *                   do not bleed out.
 *
 * maxMessages:
 *   When set, the oldest messages are discarded after each add() that would
 *   push the total above the limit.  The newest message is always kept.
 *
 * Never throws — all methods are synchronous and have no failure modes.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MemoryMessage {
  role:    'user' | 'assistant';
  content: string;
}

export interface MemoryOptions {
  /** Maximum number of messages to retain.  Oldest are dropped on overflow. */
  maxMessages?: number;
}

// ─── ConversationMemory ───────────────────────────────────────────────────────

export class ConversationMemory {
  private messages:          MemoryMessage[];
  private readonly maxMsgs?: number;

  constructor(options?: MemoryOptions) {
    this.messages = [];
    this.maxMsgs  = options?.maxMessages;
  }

  /**
   * Appends a copy of `message` to history, then applies the maxMessages trim
   * (oldest dropped when the limit is exceeded).
   */
  add(message: MemoryMessage): void {
    this.messages.push({ ...message });
    if (this.maxMsgs !== undefined && this.messages.length > this.maxMsgs) {
      this.messages.splice(0, this.messages.length - this.maxMsgs);
    }
  }

  /** Appends a user-role message. */
  addUser(content: string): void {
    this.add({ role: 'user', content });
  }

  /** Appends an assistant-role message. */
  addAssistant(content: string): void {
    this.add({ role: 'assistant', content });
  }

  /** Removes all messages from history. */
  clear(): void {
    this.messages = [];
  }

  /** Returns the number of messages currently stored. */
  size(): number {
    return this.messages.length;
  }

  /**
   * Returns a snapshot of the current history.
   *
   * Each element is a shallow copy — mutating the returned array or its
   * elements has no effect on this ConversationMemory instance.
   */
  getMessages(): MemoryMessage[] {
    return this.messages.map(m => ({ ...m }));
  }

  /**
   * Trims the history to at most the last `n` messages.
   *
   * trimToLast(0)        → clears all messages.
   * trimToLast(negative) → treated as 0 (clears all).
   * trimToLast(n)        where n ≥ size() → no-op.
   */
  trimToLast(n: number): void {
    const keep = Math.max(0, Math.floor(n));
    if (this.messages.length > keep) {
      this.messages = keep === 0
        ? []
        : this.messages.slice(this.messages.length - keep);
    }
  }
}
