// ── IEmbeddingAdapter — pluggable semantic search backend ─────────────────────
// Default is NoOp (returns an empty vector, meaning "no semantic signal available" —
// SearchEngine falls back to pure keyword scoring). A real adapter (OpenAI, local
// model, etc.) can be swapped in without touching SearchEngine or any provider.

export interface IEmbeddingAdapter {
  embed(text: string): Promise<readonly number[]>
}

export class NoOpEmbeddingAdapter implements IEmbeddingAdapter {
  async embed(_text: string): Promise<readonly number[]> {
    return []
  }
}
