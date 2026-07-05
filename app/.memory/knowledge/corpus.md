# Knowledge Corpus Foundation Memory

**Spec status:** COMPLETE (2026-07-03)
**Full spec:** `knowledge/corpus/` directory (6 files) + `knowledge/decisions/corpus-foundation.md`

---

## Two-Layer Model

```
CORPUS LAYER (storage truth):
  KnowledgeObject     — the versioned, sourced, validated corpus document
  KnowledgeVersion    — immutable; every change creates a new version
  KnowledgeSource     — where the object came from (OFFICIAL_GAZETTE, API_FEED, etc.)
  KnowledgeCitation   — relationship between two objects (IMPLEMENTS, AMENDS, REPEALS, ...)

RUNTIME LAYER (query projection):
  KnowledgeItem       — universal type projected from KnowledgeObject at query time
```

The runtime layer (`KnowledgeItem`) is what all consumers see.
The corpus layer is the source of truth managed by import/update pipelines.

---

## Scale Targets

| Metric | Launch | 5 Years |
|--------|--------|---------|
| KnowledgeObjects | ~520K | ~1M |
| Legal documents | ~10K | ~50K |
| Articles/clauses | ~500K | ~800K |
| Templates | ~500 | ~2K |
| Cases | ~5K | ~50K |
| Risk items | ~2K | ~10K |

---

## 4 Indexes

| Index | Storage | Upgrade Path |
|-------|---------|-------------|
| Full-text | PostgreSQL tsvector | → Elasticsearch |
| Semantic vector | NoOp (Phase N) → pgvector | → Qdrant |
| Faceted | PostgreSQL GIN | Stays GIN |
| Graph | Recursive CTE | → Apache AGE |

---

## Vietnamese Legal Authority Hierarchy (14 levels)

| Level | Code | Type |
|-------|------|------|
| 1 | HP | Hiến pháp (Constitution) |
| 2 | LCT | Luật / Bộ luật |
| 3 | NQ | Nghị quyết Quốc hội |
| 4 | UBTVQH | Pháp lệnh UBTVQH |
| 5 | NQ_CP | Nghị quyết Chính phủ |
| 6 | ND | Nghị định |
| 7 | QD_TTg | Quyết định Thủ tướng |
| 8 | TT | Thông tư |
| 9 | TT_LT | Thông tư liên tịch |
| 10 | QD_BT | Quyết định Bộ trưởng |
| 11 | CT_BT | Chỉ thị Bộ trưởng |
| 12 | CV | Công văn |
| 13 | QD_DV | Quyết định đơn vị |
| 14 | QC | Quy chế nội bộ |

Lower number = higher authority. Level 3 (school policy) = Level 14 here.

---

## hierarchyPath Encoding

```
law:22/2023/QH15/chuong:II/muc:1/dieu:15/khoan:2
```

Prefix-match queries: `hierarchyPath LIKE 'law:22/2023/QH15/chuong:II%'` returns all articles in Chapter II.

---

## Bootstrap Order (5 rounds)

```
Round 1: Foundation Laws (LP ≥ 0.8)     → 40% citation resolution
Round 2: Decrees (LP ≥ 0.6)             → 70%
Round 3: Circulars (LP ≥ 0.4)           → 85%
Round 4: Official Letters/Internal (LP ≥ 0.2) → 92%
Round 5: Experience Layer (cases, risk, best practices) → 95%+
```

LP = citation density (# citations to already-loaded documents / total citations)
