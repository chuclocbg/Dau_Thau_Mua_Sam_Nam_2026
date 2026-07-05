# Corpus Hierarchy — Document Structure · Legal Authority Levels

Part of: [corpus-foundation.md](../decisions/corpus-foundation.md)

---

## 1. Document Hierarchy

Every `KnowledgeObject` lives at a specific level of its domain's hierarchy. The `hierarchyPath` field encodes the full path from root to the object. Sub-document objects (articles, clauses, points) have a `parentObjectId` FK to the object one level above.

### 1a. Legal Document Hierarchy

```
Level 0 — Corpus root               (virtual; not stored as object)
Level 1 — Document (Văn bản)        objectType: LEGAL_DOCUMENT
Level 2 — Part (Phần)               objectType: PART               (not in all laws)
Level 3 — Chapter (Chương)          objectType: CHAPTER
Level 4 — Section (Mục)             objectType: SECTION            (not in all chapters)
Level 5 — Subsection (Tiểu mục)     objectType: SUBSECTION         (rare)
Level 6 — Article (Điều)            objectType: ARTICLE            ← primary search unit
Level 7 — Clause (khoản)            objectType: CLAUSE
Level 8 — Point (điểm)              objectType: POINT
Level 9 — SubPoint (tiết)           objectType: SUBPOINT           (rare; deep nesting)
Level 10 — Item (mục tiểu tiết)     objectType: ITEM               (very rare)

Side nodes (attached to document or chapter):
  Preamble (Lời nói đầu)            objectType: PREAMBLE
  Appendix (Phụ lục)                objectType: APPENDIX
  Annex (Phụ đính)                  objectType: ANNEX
  Table (Bảng)                      objectType: TABLE              (within appendix)
```

**Indexing principle:** The corpus indexes at every level but queries default to ARTICLE level. Providers resolve to clause/point level when `resolveLegalBasis()` requires a precise citation.

### 1b. Template & Form Hierarchy

```
Level 1 — Template Set (Bộ mẫu)        objectType: TEMPLATE_SET
            e.g. 'Bộ mẫu HSMT mua sắm hàng hóa 2024'
Level 2 — Template (Mẫu)               objectType: TEMPLATE          ← primary unit
            e.g. 'Mẫu số 1 — Đơn dự thầu'
Level 3 — Section (Chương)             objectType: TEMPLATE_SECTION
Level 4 — Field (Trường dữ liệu)       objectType: TEMPLATE_FIELD
```

### 1c. Process Guide Hierarchy (Procurement Lifecycle)

```
Level 1 — Phase (Giai đoạn)            objectType: PROCESS_PHASE
            e.g. 'Giai đoạn lập kế hoạch'
Level 2 — Stage (Bước)                 objectType: PROCESS_STAGE
            e.g. 'Bước 02 — Phê duyệt dự toán'
Level 3 — Task (Nhiệm vụ)              objectType: PROCESS_TASK
Level 4 — Check (Kiểm tra)             objectType: PROCESS_CHECK
```

### 1d. Case Hierarchy

```
Level 1 — Case File (Hồ sơ vụ việc)    objectType: CASE
Level 2 — Case Section                  objectType: CASE_SECTION
            e.g. 'Background', 'Decision', 'Outcome', 'Lessons'
```

### 1e. Generic Collection Hierarchy

Used by: audit, inspection, bestpractice, masterdata, glossary, ontology, faq, decision_log, risk

```
Level 1 — Collection (Tập hợp)          objectType: COLLECTION
            e.g. 'Common Audit Mistakes — Payment Phase 2024'
Level 2 — Item (Mục)                    objectType: COLLECTION_ITEM   ← primary unit
            e.g. 'PAY-002: Payment before acceptance'
```

---

## 2. hierarchyPath Encoding

The `hierarchyPath` field encodes the full path as a colon-separated string. It enables prefix-match queries (all objects under a specific article) and structural navigation.

### Pattern: `<nodeType>:<identifier>[/<nodeType>:<identifier>]...`

**Legal documents:**
```
law:22/2023/QH15
law:22/2023/QH15/chuong:II
law:22/2023/QH15/chuong:II/muc:1
law:22/2023/QH15/chuong:II/muc:1/dieu:15
law:22/2023/QH15/chuong:II/muc:1/dieu:15/khoan:2
law:22/2023/QH15/chuong:II/muc:1/dieu:15/khoan:2/diem:a
law:22/2023/QH15/chuong:II/muc:1/dieu:15/khoan:2/diem:a/tiet:1
law:22/2023/QH15/phu-luc:I
```

**Decrees and circulars:**
```
decree:104/2026/ND-CP/dieu:6
circular:79/2025/TT-BTC/chuong:III/dieu:15
```

**Templates:**
```
template-set:HSMT-GOODS-2024
template-set:HSMT-GOODS-2024/template:MAU-01
template-set:HSMT-GOODS-2024/template:MAU-01/section:I/field:CONTRACT_VALUE
```

**Process guides:**
```
process:planning/stage:02-budget/task:approve-estimate
```

**Cases:**
```
case:2024-GOI-001
case:2024-GOI-001/section:outcome
```

**Generic collections:**
```
audit:payment-phase-2024/item:PAY-002
risk:common-patterns/item:ADVANCE_GUARANTEE_INADEQUATE
glossary:procurement-vi/item:HSMT
```

**Prefix query example:** "All objects under Điều 15 of Luật 22/2023/QH15"
```sql
WHERE hierarchy_path LIKE 'law:22/2023/QH15/%/dieu:15%'
```

---

## 3. Legal Authority Hierarchy

The Vietnamese legal document authority hierarchy. 14 levels; lower number = higher authority. Conflicts between provisions are resolved in favor of the higher authority level.

| Level | Code | Vietnamese | English | Primary Issuing Body |
|-------|------|-----------|---------|---------------------|
| 1 | `HP` | Hiến pháp | Constitution | Quốc hội (plenary) |
| 2 | `BCL` | Bộ luật | Code | Quốc hội |
| 3 | `L` | Luật | Law | Quốc hội |
| 4 | `NQUBTVQH` | Nghị quyết UBTVQH | Resolution of Standing Committee | Ủy ban Thường vụ Quốc hội |
| 5 | `NQ` | Nghị quyết | Resolution | Chính phủ / Quốc hội |
| 6 | `NĐ` | Nghị định | Decree | Chính phủ (Thủ tướng ký) |
| 7 | `QĐ-TTg` | Quyết định Thủ tướng | Prime Minister Decision | Thủ tướng Chính phủ |
| 8 | `TT` | Thông tư | Circular | Bộ (Bộ trưởng ký) |
| 9 | `TTLT` | Thông tư liên tịch | Joint Circular | Nhiều Bộ |
| 10 | `QĐ-BT` | Quyết định Bộ trưởng | Ministerial Decision | Bộ |
| 11 | `CV` | Công văn | Official Letter | Bộ / Cục / Vụ |
| 12 | `VBHN` | Văn bản hợp nhất | Consolidated Document | Bộ (consolidation only) |
| 13 | `CT` | Chỉ thị | Directive | Chính phủ / Thủ tướng / Bộ |
| 14 | `QC` | Quy chế | Regulation | Tổ chức (nội bộ) |

**Authority conflict resolution rules:**

1. Lower level number always prevails (higher authority wins).
2. A `TT` (8) cannot override a `NĐ` (6). A `NĐ` (6) cannot override a `L` (3).
3. A `QC` (14) — internal institutional regulation — may be MORE restrictive than `L` (3) but never less restrictive.
4. `VBHN` (12) has no independent legal force. It is a reading aid. The constituent documents retain authority. When citing, cite the original `L`/`NĐ`/`TT`, not the `VBHN`.
5. Between documents at the same authority level: later issuance date prevails (lex posterior), unless both are in force for different scopes (lex specialis).

**Issuing body registry (standardized names for `issuingBody` field):**

| Code | Vietnamese | English |
|------|-----------|---------|
| `QH` | Quốc hội | National Assembly |
| `UBTVQH` | Ủy ban Thường vụ Quốc hội | National Assembly Standing Committee |
| `CP` | Chính phủ | Government |
| `TTg` | Thủ tướng Chính phủ | Prime Minister |
| `BTC` | Bộ Tài chính | Ministry of Finance |
| `BKH` | Bộ Kế hoạch và Đầu tư | Ministry of Planning and Investment |
| `BXD` | Bộ Xây dựng | Ministry of Construction |
| `BCT` | Bộ Công Thương | Ministry of Industry and Trade |
| `BYT` | Bộ Y tế | Ministry of Health |
| `BGD` | Bộ Giáo dục và Đào tạo | Ministry of Education and Training |
| `BGTVT` | Bộ Giao thông Vận tải | Ministry of Transport |
| `BNV` | Bộ Nội vụ | Ministry of Home Affairs |
| `BTP` | Bộ Tư pháp | Ministry of Justice |
| `KTNN` | Kiểm toán Nhà nước | State Audit Office |
| `THANH_TRA` | Thanh tra Chính phủ | Government Inspectorate |

---

## 4. Document Type Registry

The `documentType` field uses these standard codes. All codes are open strings; this list is the founding registry, extensible without code change.

| Code | Pattern | Document Format | Notes |
|------|---------|-----------------|-------|
| `QH` | \d+/\d+/QH\d+ | Laws | Luật |
| `UBTVQH` | \d+/\d+/UBTVQH\d+ | Resolutions | Nghị quyết UBTVQH |
| `NQ-CP` | \d+/NQ-CP | Govt Resolutions | Nghị quyết CP |
| `ND-CP` | \d+/\d+/NĐ-CP | Decrees | Nghị định |
| `QD-TTg` | \d+/QĐ-TTg | PM Decisions | Quyết định TTg |
| `TT-BTC` | \d+/\d+/TT-BTC | MOF Circulars | Thông tư Bộ Tài chính |
| `TT-BKHDT` | \d+/\d+/TT-BKHĐT | MPI Circulars | Thông tư Bộ KH&ĐT |
| `TT-BXD` | \d+/\d+/TT-BXD | MOC Circulars | Thông tư Bộ Xây dựng |
| `TT-BCT` | \d+/\d+/TT-BCT | MOIT Circulars | Thông tư Bộ Công Thương |
| `TTLT` | \d+/\d+/TTLT-... | Joint Circulars | Thông tư liên tịch |
| `QD-BT` | \d+/QĐ-B\w+ | Min. Decisions | Quyết định Bộ trưởng |
| `CV` | \d+/\w+-\w+ | Official Letters | Công văn |
| `VBHN` | \d+/VBHN-\w+ | Consolidated | Văn bản hợp nhất |
| `CT-TTg` | \d+/CT-TTg | PM Directives | Chỉ thị Thủ tướng |
| `QC` | internal | Internal Regs | Quy chế (no standard number) |

---

## 5. Procurement-Relevant Law Categories

These are the thematic categories used in tagging (`legal_domain` facet). Relevant for cross-domain applicability rules.

| Tag Value | Vietnamese | Key Laws |
|-----------|-----------|---------|
| `procurement_law` | Luật đấu thầu | 22/2023/QH15 and predecessors |
| `budget_law` | Luật ngân sách nhà nước | 83/2015/QH13 |
| `public_investment_law` | Luật đầu tư công | 39/2019/QH14 |
| `construction_law` | Luật xây dựng | 50/2014/QH13 (amended) |
| `asset_law` | Luật quản lý, sử dụng tài sản công | 15/2017/QH14 |
| `anti_corruption_law` | Luật phòng, chống tham nhũng | 36/2018/QH14 |
| `inspection_law` | Luật thanh tra | 11/2022/QH15 |
| `audit_law` | Luật kiểm toán nhà nước | 81/2015/QH13 |
| `tax_law` | Luật thuế | Various |
| `labor_law` | Bộ luật lao động | 45/2019/QH14 |
| `civil_law` | Bộ luật dân sự | 91/2015/QH13 |
| `enterprise_law` | Luật doanh nghiệp | 59/2020/QH14 |
| `payment_regulation` | Quy định thanh toán NSNN | 79/2025/TT-BTC and predecessors |
| `finance_regulation` | Quy định tài chính | Various TT-BTC |
