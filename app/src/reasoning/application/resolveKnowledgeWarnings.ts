// ── ResolveKnowledgeWarnings — Phase X.3.3 ─────────────────────────────────────
// Converts X.3.2's effectivePeriodAssumedItemIds signal (KnowledgeRetrievalResult) into the
// plain-string messages ResolvedKnowledge.warnings actually expects (readonly string[] — NOT
// the richer ReasoningWarning object used elsewhere in the pipeline; confirmed by direct
// inspection of reasoningTypes.ts before writing this). Pure formatting of an already-computed
// fact — never a date comparison or judgment call, so this is not "effectivePeriod reasoning."

export function buildEffectivePeriodWarnings(itemIds: readonly string[]): readonly string[] {
  return itemIds.map(itemId =>
    `Không xác định được ngày hiệu lực chính thức cho mục tri thức "${itemId}" — giả định hiệu lực từ ngày tạo bản ghi.`,
  )
}
