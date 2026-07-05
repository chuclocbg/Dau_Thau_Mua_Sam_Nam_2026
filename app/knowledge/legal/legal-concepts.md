# Legal Concepts Ontology — Procurement Domain

This ontology maps procurement domain concepts to the Vietnamese legal framework. Used by the Legal Knowledge Engine (Phase N) for semantic search and AI context building.

---

## Concept Domains

- `PROCUREMENT` — Đấu thầu (core procurement)
- `FINANCE` — Tài chính công (public finance)
- `CONTRACT` — Hợp đồng (contracting)
- `SUPPLIER` — Nhà thầu (contractor/supplier)
- `APPROVAL` — Phê duyệt (administrative approval)
- `PAYMENT` — Thanh toán (payment and settlement)
- `ACCEPTANCE` — Nghiệm thu (acceptance and handover)

---

## Core Concept Definitions

### Procurement

| Concept ID | Vietnamese | English | Domain | Defined In |
|-----------|-----------|---------|--------|-----------|
| `dau_thau` | Đấu thầu | Public procurement | PROCUREMENT | 22/2023/QH15 Điều 4 |
| `goi_thau` | Gói thầu | Procurement package | PROCUREMENT | 22/2023/QH15 Điều 4 khoản 23 |
| `nha_thau` | Nhà thầu | Contractor / bidder | SUPPLIER | 22/2023/QH15 Điều 4 khoản 26 |
| `chu_dau_tu` | Chủ đầu tư | Project owner | PROCUREMENT | 22/2023/QH15 Điều 4 khoản 7 |
| `ke_hoach_dau_thau` | Kế hoạch đấu thầu | Procurement plan | PROCUREMENT | 22/2023/QH15 Điều 48 |
| `hinh_thuc_lua_chon` | Hình thức lựa chọn nhà thầu | Procurement method | PROCUREMENT | 22/2023/QH15 Điều 20-28 |

### Procurement Methods

| Concept ID | Vietnamese | English | Domain |
|-----------|-----------|---------|--------|
| `dau_thau_rong_rai` | Đấu thầu rộng rãi | Open tender | PROCUREMENT |
| `dau_thau_han_che` | Đấu thầu hạn chế | Restricted tender | PROCUREMENT |
| `chao_hang_canh_tranh` | Chào hàng cạnh tranh | Competitive quotation | PROCUREMENT |
| `chi_dinh_thau` | Chỉ định thầu | Direct procurement | PROCUREMENT |
| `mua_sam_truc_tiep` | Mua sắm trực tiếp | Direct shopping | PROCUREMENT |
| `tu_thuc_hien` | Tự thực hiện | Self-performance | PROCUREMENT |
| `cong_dong_tham_gia` | Cộng đồng tham gia | Community participation | PROCUREMENT |

### Financial

| Concept ID | Vietnamese | English | Defined In |
|-----------|-----------|---------|-----------|
| `tam_ung` | Tạm ứng | Advance payment | 79/2025/TT-BTC Điều 15 |
| `bao_lanh_tam_ung` | Bảo lãnh tạm ứng | Advance payment guarantee | 79/2025/TT-BTC Điều 18 |
| `bao_lanh_thuc_hien` | Bảo lãnh thực hiện hợp đồng | Performance guarantee | 22/2023/QH15 Điều 68 |
| `gia_giu_lai` | Giữ lại / Khấu trừ | Retention | 22/2023/QH15 Điều 69 |
| `quyet_toan` | Quyết toán | Final settlement | 104/2026/NĐ-CP |
| `ngan_sach` | Ngân sách nhà nước | State budget | 79/2025/TT-BTC |
| `von_oda` | Vốn ODA | ODA funding | 22/2023/QH15 |
| `von_doanh_nghiep` | Vốn doanh nghiệp | Enterprise capital | 22/2023/QH15 |

### Approval

| Concept ID | Vietnamese | English | Defined In |
|-----------|-----------|---------|-----------|
| `phe_duyet_ke_hoach` | Phê duyệt kế hoạch đấu thầu | Plan approval | 22/2023/QH15 Điều 49 |
| `phe_duyet_ket_qua` | Phê duyệt kết quả lựa chọn | Approval of selection result | 22/2023/QH15 Điều 49 |
| `tham_quyen_phe_duyet` | Thẩm quyền phê duyệt | Approval authority | 104/2026/NĐ-CP Điều 76 |
| `uy_quyen` | Ủy quyền | Delegation of authority | 22/2023/QH15 Điều 76 |

---

## Concept Relationships

```
dau_thau
  BROADER → nha_thau (has bidders)
  BROADER → goi_thau (has packages)
  BROADER → ke_hoach_dau_thau (governed by plan)

hinh_thuc_lua_chon
  NARROWER → dau_thau_rong_rai
  NARROWER → dau_thau_han_che
  NARROWER → chao_hang_canh_tranh
  NARROWER → chi_dinh_thau
  NARROWER → mua_sam_truc_tiep

tam_ung
  RELATED → bao_lanh_tam_ung (guarantee required when advance > threshold)
  RELATED → quyet_toan (advance deducted at final settlement)

gy_giu_lai
  RELATED → bao_lanh_thuc_hien (alternative to retention)
  RELATED → quyet_toan (retention released at final settlement)
```

---

## Procurement Package Type → Applicable Documents

This mapping is stored as `DocumentApplicabilityRule` records in the database. Provided here as reference:

| Package Type | Additional Applicable Documents |
|-------------|--------------------------------|
| GOODS | 13/2026/TT-BCT |
| CONSTRUCTION | 104/2026/NĐ-CP specific articles |
| CONSULTING | 22/2023/QH15 Chapter IV |
| SERVICE | 22/2023/QH15 general provisions |
| MIXED | All applicable to each component |

---

## Funding Source → Applicable Documents

| Fund Source | Additional Applicable Documents |
|-------------|--------------------------------|
| STATE | 79/2025/TT-BTC |
| ODA | 79/2025/TT-BTC + donor guidelines |
| PPP | PPP-specific regulations (future) |
| ENTERPRISE | 22/2023/QH15 general only |
