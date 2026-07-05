# Legal Index

Structured index of Vietnamese legal instruments governing this platform.
Matches the `PROCUREMENT_LEGAL_BASIS` in `src/shared/financial/financialFactory.ts`.

---

## Active Instruments

| Symbol | Full Name | Type | Effective | Issued By |
|--------|-----------|------|-----------|-----------|
| 22/2023/QH15 | Luật Đấu thầu | Law | 2024-01-01 | Quốc hội |
| 214/2025/NĐ-CP | NĐ chi tiết một số điều Luật Đấu thầu | Decree | 2025-07-01 | Chính phủ |
| 104/2026/NĐ-CP | NĐ sửa đổi bổ sung NĐ 214/2025/NĐ-CP | Decree | 2026-06-01 | Chính phủ |
| TT 13/2026/TT-BCT | TT hướng dẫn đấu thầu hàng hóa thương mại | Circular | 2026-05-01 | Bộ Công Thương |
| TT 79/2025/TT-BTC | TT hướng dẫn về tài chính trong đấu thầu | Circular | 2025-08-01 | Bộ Tài chính |

---

## Instrument Scope

| Instrument | Applies To |
|------------|-----------|
| 22/2023/QH15 | All package types, all fund sources |
| 214/2025/NĐ-CP | All package types, all fund sources |
| 104/2026/NĐ-CP | All package types (supersedes parts of 214) |
| TT 79/2025/TT-BTC | STATE and ODA fund sources; payment provisions |
| TT 13/2026/TT-BCT | GOODS and SERVICE package types |

---

## Key Financial Rules (from TT 79/2025/TT-BTC)

| Rule | Value | Citation |
|------|-------|---------|
| Advance rate max | 30% of contract value | Điều 15 TT 79/2025 |
| Performance guarantee | 3–10% of contract value | NĐ 214/2025 |
| Warranty guarantee | 2–5% of contract value | NĐ 214/2025 |
| Retention rate max | 10% | NĐ 214/2025 |
| Default retention rate | 5% | NĐ 214/2025 |

---

## How to Add a New Legal Instrument

1. Do NOT modify any frozen module.
2. Add a `LegalBasis` entry to the consuming module's legal seed list:
   ```typescript
   import { createLegalBasis } from 'src/shared/financial/financialFactory';
   const newBasis = createLegalBasis({ document: 'NĐ-99/NEW', issuingAuthority: 'Chính phủ', effectiveDate: '2026-09-01' });
   ```
3. Update this file with the new instrument.
4. Add an ADR entry documenting the legal change.
5. Old rules are NOT deleted — they are closed with `effectiveTo` (PRINCIPLE 9).

---

## Extensibility Promise

The platform is designed to accept any number of additional Vietnamese laws, decrees,
circulars, ministerial guidance, local regulations, and internal organizational regulations
without code changes. `LegalBasis[]` fields are open-ended arrays.
