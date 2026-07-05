// ── IVectorStoreAdapter — pluggable vector similarity backend ─────────────────
// Default is an in-memory cosine-similarity store — fine for tests/small corpora,
// swappable for a real vector DB (pgvector, Pinecone, etc.) without touching callers.

export interface VectorMatch {
  readonly itemId: string
  readonly score: number   // 0.0–1.0 cosine similarity
}

export interface IVectorStoreAdapter {
  upsert(itemId: string, vector: readonly number[]): Promise<void>
  remove(itemId: string): Promise<void>
  query(vector: readonly number[], limit: number): Promise<readonly VectorMatch[]>
}

function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  if (magA === 0 || magB === 0) return 0
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

export class MemoryVectorStoreAdapter implements IVectorStoreAdapter {
  private readonly store = new Map<string, readonly number[]>()

  async upsert(itemId: string, vector: readonly number[]): Promise<void> {
    this.store.set(itemId, vector)
  }

  async remove(itemId: string): Promise<void> {
    this.store.delete(itemId)
  }

  async query(vector: readonly number[], limit: number): Promise<readonly VectorMatch[]> {
    if (vector.length === 0) return []
    const scored = Array.from(this.store.entries())
      .map(([itemId, v]) => ({ itemId, score: cosineSimilarity(vector, v) }))
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score)
    return scored.slice(0, limit)
  }
}
