# Procurement Law Corpus

Last updated: 2026-07-03

This file documents the CURRENT known procurement law corpus. It is a reference document, not executable code. The Legal Knowledge Engine (Phase N) will manage this data at runtime.

---

## Active Documents

### 22/2023/QH15 — Luật Đấu thầu
- **Type:** LAW (authority level 2)
- **Issuer:** Quốc hội
- **Effective:** 2024-01-01
- **Status:** ACTIVE
- **Scope:** ALL procurement — foundation law
- **Key provisions:**
  - Điều 4: Định nghĩa, phân loại gói thầu
  - Điều 5-6: Điều kiện tham gia đấu thầu (eligibility)
  - Điều 20-28: Hình thức lựa chọn nhà thầu (procurement methods)
  - Điều 29-42: Hồ sơ mời thầu, xét thầu (bid documentation)
  - Điều 49: Phê duyệt kết quả lựa chọn (approval)
- **Supersedes:** Luật Đấu thầu 43/2013/QH13

---

### 214/2025/NĐ-CP — Nghị định hướng dẫn Luật Đấu thầu (giai đoạn đầu)
- **Type:** DECREE (authority level 5)
- **Issuer:** Chính phủ
- **Effective:** 2025-07-01
- **Expired:** 2026-06-01 (for most provisions)
- **Status:** PARTIALLY_SUPERSEDED
- **Superseded by:** 104/2026/NĐ-CP (from 2026-06-01)
- **Residual provisions:** Some transition provisions remain in effect for cases opened before 2026-06-01
- **Implements:** 22/2023/QH15

---

### 104/2026/NĐ-CP — Nghị định hướng dẫn Luật Đấu thầu (cập nhật)
- **Type:** DECREE (authority level 5)
- **Issuer:** Chính phủ
- **Effective:** 2026-06-01
- **Status:** ACTIVE
- **Supersedes:** 214/2025/NĐ-CP (most provisions)
- **Implements:** 22/2023/QH15
- **Key provisions:**
  - Điều 76: Thẩm quyền phê duyệt (approval authority thresholds)
  - Điều 89: Hợp đồng (contract types and requirements)

---

### 79/2025/TT-BTC — Thông tư tài chính
- **Type:** CIRCULAR (authority level 8)
- **Issuer:** Bộ Tài chính (Ministry of Finance)
- **Effective:** 2025-08-01
- **Status:** ACTIVE
- **Applicability:** STATE and ODA fund sources ONLY (not ENTERPRISE)
- **Key provisions:**
  - Điều 15: Tạm ứng (advance payment rates — up to 30% STATE, 15% ENTERPRISE)
  - Điều 18: Bảo lãnh tạm ứng (advance payment guarantee requirements)
  - Điều 22: Thời hạn thanh toán (payment deadline — 30 days)
- **Implements:** 22/2023/QH15, 104/2026/NĐ-CP

---

### 13/2026/TT-BCT — Thông tư thương mại
- **Type:** CIRCULAR (authority level 8)
- **Issuer:** Bộ Công Thương (Ministry of Industry and Trade)
- **Effective:** 2026-05-01
- **Status:** ACTIVE
- **Applicability:** GOODS package type ONLY
- **Implements:** 22/2023/QH15, 104/2026/NĐ-CP

---

## Amendment Chain

```
Luật 43/2013/QH13
    ↓ REPLACE (2024-01-01)
Luật 22/2023/QH15 ← ACTIVE ─────────────────────────────────────┐
    ↓ IMPLEMENT                                                    │
NĐ 214/2025/NĐ-CP (2025-07-01)                                   │
    ↓ REPLACE (most provisions, 2026-06-01)                       │
NĐ 104/2026/NĐ-CP ← ACTIVE                                       │
    ↓ IMPLEMENT                                                    │
TT 79/2025/TT-BTC ← ACTIVE (Finance; STATE/ODA scope) ───────────┤
TT 13/2026/TT-BCT ← ACTIVE (Commerce; GOODS scope) ──────────────┘
```

---

## Applicability Rules

These rules belong in the `DocumentApplicabilityRule` database table (Phase N), NOT in code:

| Document | Applies When |
|----------|-------------|
| 22/2023/QH15 | Always — all procurement |
| 104/2026/NĐ-CP | asOfDate >= 2026-06-01 — all procurement |
| 214/2025/NĐ-CP | 2025-07-01 <= asOfDate < 2026-06-01 — all procurement |
| 79/2025/TT-BTC | asOfDate >= 2025-08-01 AND fundSource IN [STATE, ODA] |
| 13/2026/TT-BCT | asOfDate >= 2026-05-01 AND packageType = GOODS |

---

## Future Law Guidance

When new laws/decrees are issued:
1. Add a new `KnowledgeNode` record via the Legal Knowledge Engine registry API
2. Add `DocumentApplicabilityRule` records for its scope
3. Add `Amendment` edge if it supersedes an existing document
4. Add `TypedCitation` edges to the laws it implements
5. Zero code changes required — business logic resolves applicable documents at runtime
