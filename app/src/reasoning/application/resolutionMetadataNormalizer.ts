// ── Resolution Metadata Normalization — Phase X.3.6 ────────────────────────────
// KnowledgeItemRef.metadata is typed Readonly<Record<string, unknown>> (Batch A, frozen) but at
// runtime carries only flat JSON-string values (the real KnowledgeItem.metadata is
// Record<string, string> — ADR-022 §Problem Statement, gap 3). This shared helper safely reads
// a string out of that loosely-typed bag before rule/threshold parsing ever runs, so neither
// parser needs its own type-narrowing logic.

export function readMetadataString(metadata: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = metadata[key]
  return typeof value === 'string' ? value : undefined
}
