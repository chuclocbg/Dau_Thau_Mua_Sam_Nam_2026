# Legal Baseline

The five governing instruments for this platform.
All procurement rules must be traceable to one of these documents.

---

## Governing Instruments

| Symbol | Full name | Type | Effective from | Status |
|--------|-----------|------|---------------|--------|
| 22/2023/QH15 | Luật Đấu thầu | Law | 2024-01-01 | ACTIVE |
| 214/2025/NĐ-CP | Nghị định quy định chi tiết một số điều Luật Đấu thầu | Decree | 2025-07-01 | ACTIVE |
| 104/2026/NĐ-CP | Nghị định sửa đổi, bổ sung Nghị định 214/2025/NĐ-CP | Decree | 2026-06-01 | ACTIVE |
| 79/2025/TT-BTC | Thông tư hướng dẫn về tài chính trong đấu thầu | Circular | 2025-08-01 | ACTIVE |
| 13/2026/TT-BCT | Thông tư hướng dẫn đấu thầu mua sắm hàng hóa thương mại | Circular | 2026-05-01 | ACTIVE |

---

## Key Thresholds (as of 2026-07-02)

Derived from NĐ 214/2025 + NĐ 104/2026. All values in VNĐ.

### Direct Procurement threshold (Mua sắm trực tiếp)
- GOODS/SERVICE: ≤ 50,000,000 VNĐ
- CONSTRUCTION: ≤ 100,000,000 VNĐ

### Competitive Quote threshold (Chào hàng cạnh tranh)
- GOODS/SERVICE: ≤ 200,000,000 VNĐ
- CONSTRUCTION: ≤ 300,000,000 VNĐ

### Open Tender (Đấu thầu rộng rãi)
- All values above Competitive Quote threshold

### Approval Authority thresholds
- UNIT_HEAD: ≤ 200,000,000 VNĐ
- DEPARTMENT_DIRECTOR: ≤ 2,000,000,000 VNĐ
- MINISTER: ≤ 20,000,000,000 VNĐ
- PRIME_MINISTER: > 20,000,000,000 VNĐ

---

## Legal Document Applicability

| Instrument | Applies to |
|------------|-----------|
| 22/2023/QH15 | All package types, all fund sources |
| 214/2025/NĐ-CP | All package types, all fund sources |
| 104/2026/NĐ-CP | All package types, all fund sources (supersedes parts of 214) |
| 79/2025/TT-BTC | STATE and ODA fund sources only |
| 13/2026/TT-BCT | GOODS and SERVICE package types only |

---

## Update Protocol

When a new decree or circular takes effect:
1. Add new rules to `procurementRules.ts` with `effectiveFrom` set to the effective date.
2. Close superseded rules with `effectiveTo` set to the day before the new rule is effective.
3. Update this file with the new instrument.
4. Add a new ADR entry documenting the legal change.
5. Do NOT delete old rules — the system must produce correct decisions for historical asOfDate values.
