# Vietnamese Legal Document Hierarchy

Source: Luật Ban hành văn bản quy phạm pháp luật 80/2015/QH13, sửa đổi bởi 63/2020/QH14

---

## Authority Levels

Higher authority level = higher legal weight. Lower-level documents cannot contradict higher-level ones.

| Level | Code | Tên văn bản | Cơ quan ban hành | Ràng buộc pháp lý |
|-------|------|------------|-----------------|-------------------|
| 1 | `CONSTITUTION` | Hiến pháp | Quốc hội | CÓ — tối cao |
| 2 | `LAW` | Bộ luật / Luật | Quốc hội | CÓ |
| 3 | `RESOLUTION_NA` | Nghị quyết Quốc hội | Quốc hội | CÓ |
| 4 | `ORDINANCE` | Pháp lệnh | Ủy ban Thường vụ Quốc hội | CÓ |
| 5 | `DECREE` | Nghị định | Chính phủ | CÓ |
| 6 | `RESOLUTION_GOV` | Nghị quyết Chính phủ | Chính phủ | CÓ |
| 7 | `PM_DECISION` | Quyết định Thủ tướng | Thủ tướng Chính phủ | CÓ |
| 8 | `CIRCULAR` | Thông tư | Bộ, cơ quan ngang Bộ | CÓ |
| 9 | `JOINT_CIRCULAR` | Thông tư liên tịch | Nhiều Bộ phối hợp | CÓ |
| 10 | `MINISTERIAL_DECISION` | Quyết định Bộ trưởng | Bộ trưởng | CÓ |
| 11 | `OFFICIAL_LETTER` | Công văn hướng dẫn | Mọi cấp | KHÔNG — hướng dẫn |
| 12 | `CONSOLIDATED` | Văn bản hợp nhất | Cơ quan ban hành gốc | KHÔNG — tổng hợp |
| 13 | `PROVINCIAL` | Quy định địa phương | UBND tỉnh / HĐND | CÓ (phạm vi địa phương) |
| 14 | `INTERNAL` | Quy chế nội bộ | Tổ chức / Đơn vị | CÓ (phạm vi nội bộ) |

---

## Amendment Rules

A lower-level document MAY implement or guide a higher-level document.
A lower-level document MAY NOT contradict a higher-level document.

```
CONSTITUTION (1)
  ← implements ← LAW (2)
    ← implements ← DECREE (5)
      ← implements ← CIRCULAR (8)
        ← implements ← OFFICIAL_LETTER (11, guidance only)
```

---

## Procurement Domain

Documents currently active in the procurement domain:

| Symbol | Type | Level | Status |
|--------|------|-------|--------|
| 22/2023/QH15 | LAW | 2 | ACTIVE — Luật Đấu thầu |
| 214/2025/NĐ-CP | DECREE | 5 | SUPERSEDED by 104/2026 for provisions from 2026-06-01 |
| 104/2026/NĐ-CP | DECREE | 5 | ACTIVE — supersedes most of 214/2025 from 2026-06-01 |
| 79/2025/TT-BTC | CIRCULAR | 8 | ACTIVE — Thông tư tài chính (nguồn vốn nhà nước) |
| 13/2026/TT-BCT | CIRCULAR | 8 | ACTIVE — Thông tư thương mại (hàng hóa) |

See [procurement-laws.md](procurement-laws.md) for full amendment chain details.

---

## Key Legal Principles for the Platform

1. **Không hardcode** — Never reference document symbols in business logic conditionals.
2. **Hiệu lực theo ngày** — Effective periods define which law version applies on any given date.
3. **Phạm vi áp dụng** — Each document has domain/scope applicability (e.g. TT-BCT for GOODS only).
4. **Chuỗi thay thế** — The supersession chain must be traversed to find the currently effective provision.
5. **Văn bản hướng dẫn** — Official letters are advisory; they do not override binding law.
