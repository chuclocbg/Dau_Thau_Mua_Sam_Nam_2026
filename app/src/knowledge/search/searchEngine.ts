import type { KnowledgeItem } from '../platform/knowledgeTypes.ts'
import type { IEmbeddingAdapter } from './embeddingAdapter.ts'
import { NoOpEmbeddingAdapter } from './embeddingAdapter.ts'
import type { IVectorStoreAdapter } from './vectorStoreAdapter.ts'
import { MemoryVectorStoreAdapter } from './vectorStoreAdapter.ts'

// ── SearchEngine — shared scoring utility every provider's search() can use ───
// Not called by the platform/router directly (Rule 3: no routing logic there) —
// each provider decides whether and how to use it inside its own search() method.

/** Keyword relevance: exact > prefix > substring > word-overlap. Same formula
 * precedent as MemorySearch elsewhere in this codebase (src/memory/search/). */
export function scoreKeyword(text: string, item: KnowledgeItem): number {
  const needle = text.toLowerCase().trim()
  if (!needle) return 0

  const haystacks = [item.title, item.summary, ...item.keywords].map(h => h.toLowerCase())
  let best = 0
  for (const h of haystacks) {
    if (h === needle) { best = Math.max(best, 1.0); continue }
    if (h.startsWith(needle)) { best = Math.max(best, 0.9); continue }
    if (h.includes(needle)) { best = Math.max(best, 0.7); continue }
    const words = needle.split(/\s+/)
    if (words.length > 1 && words.some(w => h.includes(w))) { best = Math.max(best, 0.5); continue }
  }
  return best
}

export class SearchEngine {
  constructor(
    private readonly embedding: IEmbeddingAdapter = new NoOpEmbeddingAdapter(),
    private readonly vectorStore: IVectorStoreAdapter = new MemoryVectorStoreAdapter(),
  ) {}

  /** Index an item's semantic vector (no-op with the default NoOp embedding adapter). */
  async index(item: KnowledgeItem): Promise<void> {
    const vector = await this.embedding.embed(`${item.title} ${item.summary} ${item.keywords.join(' ')}`)
    if (vector.length > 0) await this.vectorStore.upsert(item.id, vector)
  }

  private async scoreSemantic(text: string, itemId: string): Promise<number> {
    const vector = await this.embedding.embed(text)
    if (vector.length === 0) return 0
    const matches = await this.vectorStore.query(vector, 50)
    return matches.find(m => m.itemId === itemId)?.score ?? 0
  }

  /** Best of keyword and semantic signal — with the default adapters, semantic is always 0. */
  async score(text: string, item: KnowledgeItem): Promise<number> {
    const keyword = scoreKeyword(text, item)
    const semantic = await this.scoreSemantic(text, item.id)
    return Math.max(keyword, semantic)
  }
}
