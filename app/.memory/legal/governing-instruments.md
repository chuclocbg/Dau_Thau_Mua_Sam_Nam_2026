# Governing Legal Instruments

The five instruments this platform enforces. All procurement rules must trace to one of these.
For the full corpus of legal knowledge, see `knowledge/legal/procurement-laws.md`.

---

## Active Instruments (as of 2026-07-03)

| Symbol | Full Name | Type | Effective | Applies To |
|--------|-----------|------|----------|-----------|
| 22/2023/QH15 | Luật Đấu thầu | Law (LCT) | 2024-01-01 | All packages, all fund sources |
| 214/2025/NĐ-CP | NĐ quy định chi tiết Luật Đấu thầu | Decree (ND) | 2025-07-01 | All packages, all fund sources |
| 104/2026/NĐ-CP | NĐ sửa đổi NĐ 214/2025 | Decree (ND) | 2026-06-01 | All packages (supersedes parts of 214) |
| 79/2025/TT-BTC | TT hướng dẫn tài chính đấu thầu | Circular (TT) | 2025-08-01 | STATE + ODA fund sources only |
| 13/2026/TT-BCT | TT hướng dẫn mua sắm hàng hóa | Circular (TT) | 2026-05-01 | GOODS + SERVICE packages only |

---

## Key Thresholds (from NĐ 214/2025 + NĐ 104/2026)

All values in VNĐ (bigint). Direct procurement = Mua sắm trực tiếp.

| Method | GOODS/SERVICE | CONSTRUCTION |
|--------|--------------|-------------|
| Direct procurement | ≤ 50,000,000 | ≤ 100,000,000 |
| Competitive quote | ≤ 200,000,000 | ≤ 300,000,000 |
| Open tender | above competitive quote | above competitive quote |

**Approval Authority Thresholds:**

| Level | Threshold |
|-------|---------|
| UNIT_HEAD | ≤ 200,000,000 VNĐ |
| DEPARTMENT_DIRECTOR | ≤ 2,000,000,000 VNĐ |
| MINISTER | ≤ 20,000,000,000 VNĐ |
| PRIME_MINISTER | > 20,000,000,000 VNĐ |

---

## Applicability Matrix

| Instrument | STATE Budget | ODA | PRIVATE | GOODS | SERVICE | CONSTRUCTION | CONSULTING |
|------------|-------------|-----|---------|-------|---------|-------------|-----------|
| 22/2023/QH15 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 214/2025/NĐ-CP | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 104/2026/NĐ-CP | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 79/2025/TT-BTC | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ |
| 13/2026/TT-BCT | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |

---

## Update Protocol

When a new decree/circular takes effect:
1. Add new rules to `procurementRules.ts` with `effectiveFrom`
2. Close superseded rules with `effectiveTo`
3. Update this file with the new instrument
4. Add new ADR documenting the legal change
5. Do NOT delete old rules (system must handle historical `asOfDate` queries)
