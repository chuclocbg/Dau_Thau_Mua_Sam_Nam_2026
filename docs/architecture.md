# Kiến Trúc Hệ Thống — Hồ Sơ Mua Sắm Nam 2026
> **Cập nhật:** 18/06/2026 — Phiên bản 3.0 (bổ sung Phase 6: multi-agent layer + provider infrastructure)

---

## Tổng quan

Đây là ứng dụng **frontend thuần túy** (pure client-side SPA — Single Page Application) được xây dựng bằng React + TypeScript + Vite. Không có backend, không có cơ sở dữ liệu, không có API server, không có xác thực người dùng. Toàn bộ logic xử lý, tính toán và tạo văn bản chạy trong trình duyệt.

Ứng dụng phục vụ **Trường Cao đẳng Kỹ thuật Công nghiệp** (ĐVSNCL trực thuộc Bộ Công Thương), đơn vị tự chủ tài chính nhóm 2 theo QĐ 541/QĐ-BCT ngày 25/3/2026, trong việc tự động soạn thảo bộ **24 văn bản pháp lý** cho quy trình mua sắm tài sản công.

**Nguyên tắc chủ đạo (từ CLAUDE.md):**
- Audit-first: mọi hồ sơ được xây dựng với giả định sẽ bị Kiểm toán Nhà nước, Thanh tra BTC và Thanh tra BCT kiểm tra
- Ưu tiên quy định mới hơn quy định cũ
- Không chia nhỏ gói thầu; không khóa nhãn hiệu; không giả mạo căn cứ pháp lý
- Bảo toàn khả năng truy vết toàn bộ quy trình

---

## Ngăn xếp công nghệ (Technology Stack)

| Thành phần | Công nghệ | Phiên bản |
|---|---|---|
| Framework UI | React (SPA) | 19.2.6 |
| Ngôn ngữ | TypeScript | 6.0.2 |
| Build tool | Vite | 8.0.12 |
| Tạo văn bản Word | `docx` | 9.7.1 |
| Xuất file | `file-saver` | 2.0.5 |
| Nén file | `jszip` | 3.10.1 |
| Bộ icon | `lucide-react` | 1.18.0 |
| CSS | Custom (glassmorphic) | — |

---

## Cấu trúc thư mục

```
Dau_Thau_Mua_Sam_Nam_2026/
│
├── CLAUDE.md                           # ⭐ Luật lệ dự án — đọc TRƯỚC KHI làm bất cứ điều gì
├── SKILL.md                            # Kỹ năng nghiệp vụ đấu thầu — cập nhật ngưỡng & căn cứ pháp lý
│
├── app/                                # Mã nguồn ứng dụng React
│   ├── src/
│   │   ├── App.tsx                     # Component chính — UI, state, form, validation (30 KB)
│   │   ├── demoData.ts                 # Dữ liệu 4 gói thầu mẫu + TypeScript interfaces (18 KB)
│   │   ├── docTemplates.ts             # 24 mẫu văn bản (HTML preview + DOCX export) (132 KB)
│   │   ├── App.css                     # CSS toàn bộ ứng dụng
│   │   └── main.tsx                    # Điểm khởi động ứng dụng
│   ├── package.json
│   └── vite.config.ts
│
├── Legal/                              # Văn bản pháp luật tham chiếu
│   ├── Luật Đấu thầu 22/2023/QH15 (.docx + .md)
│   ├── Luật 57/2024/QH15 (sửa đổi)
│   ├── Luật 90/2025/QH15 (sửa đổi)
│   │   ⚠ THIẾU: Luật 116/2025, 133/2025, 142/2025 (sửa đổi thêm)
│   │   ⚠ THIẾU: VBHN 74/VBHN-VPQH ngày 25/3/2026 (văn bản hợp nhất)
│   ├── Nghị định 214/2025/NĐ-CP        ✅ Có
│   ├── Nghị định 225/2025/NĐ-CP        ✅ Có
│   ├── Nghị định 254/2025/NĐ-CP        ✅ Có
│   ├── Nghị định 98/2025/NĐ-CP         ✅ Có
│   ├── Nghị định 193/2026/NĐ-CP        ✅ Có (mới bổ sung)
│   │   ⚠ THIẾU: Nghị định 186/2025/NĐ-CP (trong CLAUDE.md ưu tiên #9)
│   │   ⚠ THIẾU: Nghị định 52/2026/NĐ-CP (trong CLAUDE.md ưu tiên #10)
│   │   ⚠ THIẾU: Nghị định 60/2021/NĐ-CP (trong CLAUDE.md ưu tiên #11)
│   ├── Thông tư 65/2021/TT-BTC         ✅ Có
│   ├── Thông tư 79/2025/TT-BTC         ✅ Có
│   │   ⚠ THIẾU: Thông tư 80/2025/TT-BTC (trong CLAUDE.md ưu tiên #7 — chỉ viện dẫn trong code chưa có file)
│   ├── Thông tư 13/2026/TT-BCT         ✅ Có
│   └── Quyết định 541/QĐ-BCT (2026)    ✅ Có
│
├── Prompts/                            # Prompt AI — ⚠ TẤT CẢ VẪN LÀ PLACEHOLDER (Vite boilerplate)
│   ├── system_prompt.md                # ❌ Chưa triển khai
│   ├── tao_hop_dong.md                 # ❌ Chưa triển khai
│   ├── tao_khlcnt.md                   # ❌ Chưa triển khai
│   └── tao_to_trinh.md                 # ❌ Chưa triển khai
│
├── templates/                          # Mẫu Word trống — ⚠ TẤT CẢ 0 BYTES
│   ├── Hop_dong.docx                   # ❌ 0 bytes
│   ├── KHLCNT.docx                     # ❌ 0 bytes
│   ├── Nghiem_thu.docx                 # ❌ 0 bytes
│   └── To_trinh.docx                   # ❌ 0 bytes
│
├── examples/                           # ⚠ TẤT CẢ VẪN LÀ PLACEHOLDER (Vite boilerplate)
│   ├── Bàn ghế làm việc.md             # ❌ Chưa triển khai
│   ├── Máy tính để bàn.md              # ❌ Chưa triển khai
│   └── Thiết bị ngành cơ khí.md        # ❌ Chưa triển khai
│
├── tests/                              # ⚠ VẪN LÀ PLACEHOLDER
│   └── test_hsmt.py.md                 # ❌ Chưa triển khai
│
└── docs/                               # Tài liệu dự án
    ├── architecture.md                 # Tài liệu này (v2.0)
    ├── workflow.md                     # Quy trình người dùng
    ├── legal_workflow.md               # Quy trình pháp lý đấu thầu
    ├── audit_checklist.md              # Checklist kiểm toán 80 hạng mục
    ├── audit_report.md                 # Báo cáo kiểm toán đầy đủ (mới)
    └── roadmap.md                      # ⚠ Vẫn là Vite boilerplate — chưa có nội dung thực
```

---

## Thứ tự ưu tiên pháp lý (theo CLAUDE.md — bắt buộc tuân thủ)

| # | Văn bản | Trạng thái trong Legal/ |
|---|---|---|
| 1 | Luật Đấu thầu số 22/2023/QH15 | ✅ Có |
| 2 | Luật số 57/2024/QH15 | ✅ Có |
| 3 | Luật số 90/2025/QH15 | ✅ Có |
| 4 | VBHN 74/VBHN-VPQH (25/03/2026) — Văn bản hợp nhất | ⚠ **Thiếu** |
| 5 | Nghị định 214/2025/NĐ-CP | ✅ Có |
| 6 | Thông tư 79/2025/TT-BTC | ✅ Có |
| 7 | Thông tư 80/2025/TT-BTC | ⚠ **Thiếu file, code đã viện dẫn** |
| 8 | Luật Quản lý, sử dụng tài sản công | ⚠ Thiếu |
| 9 | Nghị định 186/2025/NĐ-CP | ⚠ **Thiếu** |
| 10 | Nghị định 52/2026/NĐ-CP | ⚠ **Thiếu** |
| 11 | Nghị định 60/2021/NĐ-CP | ⚠ **Thiếu** |
| 12 | Thông tư 13/2026/TT-BCT | ✅ Có |
| 13 | Quy chế chi tiêu nội bộ nhà trường | ⚠ Thiếu |

> **Ghi chú quan trọng:** Luật 116/2025, 133/2025, 142/2025 (sửa đổi bổ sung Luật ĐT) được nêu trong SKILL.md nhưng chưa có trong Legal/ và chưa được viện dẫn trong mã nguồn.

---

## Ba tệp nguồn cốt lõi

### 1. `app/src/demoData.ts` (18 KB)

Định nghĩa **TypeScript interfaces** và **4 gói thầu mẫu**.

**Interface `ProcurementPackage`** — mô tả toàn bộ thông tin một gói thầu:

| Nhóm trường | Trường | Mô tả |
|---|---|---|
| Định danh | `id`, `packageName`, `packageCode`, `budgetYear` | Mã và tên gói thầu |
| Tài chính | `fundingSource`, `fundingSourceName` | Nguồn vốn (3 loại) |
| Nhân sự | `rectorName`, `departmentName`, `departmentCode` | Hiệu trưởng, phòng/khoa |
| Tổ chuyên gia | `expertTeamLeader`, `expertTeamMember1`, `expertTeamMember2` | 3 thành viên tổ CG |
| Tổ thẩm định | `appraisalLeader`, `appraisalMember` | 2 thành viên tổ thẩm định |
| Nhà cung cấp | `supplier1Name/Address/TaxCode/...` (×3) | Thông tin 3 nhà báo giá |
| Mốc thời gian | 17 trường `date*` | Toàn bộ tiến độ gói thầu |
| Thời hạn | `contractDurationDays` | Số ngày thực hiện HĐ |
| Hàng hóa | `items: ProcurementItem[]` | Danh mục vật tư |

**4 gói thầu mẫu đính kèm:**

| ID | Mã gói | Tên gói thầu | Nguồn vốn | Giá trị | Phương thức |
|---|---|---|---|---|---|
| pkg-1 | MS-2026-MT01 | Máy tính & thiết bị mạng — Khoa CNTT | Quỹ phát triển SN | ~320M VND | Chỉ định thầu rút gọn |
| pkg-2 | SC-2026-DH02 | Bảo trì điều hòa không khí | Thu sự nghiệp | ~82M VND | Chỉ định thầu rút gọn |
| pkg-3 | MS-2026-HC03 | Hóa chất & thiết bị đo — Khoa CNHC | Quỹ phát triển SN | ~522M VND | Chào hàng cạnh tranh |
| pkg-4 | MS-2026-VPP04 | Văn phòng phẩm kỳ thi tuyển sinh | Thu sự nghiệp | ~29.8M VND | Quyết định mua sắm trực tiếp |

---

### 2. `app/src/docTemplates.ts` (132 KB — 2,339 dòng)

Trái tim của ứng dụng. Định nghĩa tất cả 24 mẫu văn bản.

#### Hàm `getProcurementMethod()` — NGƯỠNG HIỆN TẠI VÀ LỖI

```typescript
// docTemplates.ts dòng 47-89
if (total <= 50_000_000)         → DIRECT_50              (≤50M VND)
if (total <= 500_000_000)        → DIRECT_SELECTION_SIMPLIFIED   (50M–500M)
if (total <= 10_000_000_000)     → COMPETITIVE_SHOPPING   (500M–10B) ← LỖI
else                             → OPEN_BIDDING           (>10B)     ← LỖI
```

**⚠ [CRITICAL] Ngưỡng sai so với NĐ 214/2025 và SKILL.md:**

| Khoảng giá trị | Code hiện tại | Quy định đúng |
|---|---|---|
| ≤50M | DIRECT_50 ✅ | CĐT tự quyết |
| 50M–500M | DIRECT_SELECTION_SIMPLIFIED ✅ | Chỉ định thầu (DTMS) |
| 500M–**5B** | COMPETITIVE_SHOPPING ✅ | Chào hàng cạnh tranh |
| **5B–10B** | COMPETITIVE_SHOPPING **❌ SAI** | **Đấu thầu rộng rãi (ĐTRR)** |
| >10B | OPEN_BIDDING ✅ (ngưỡng cần hạ xuống 5B) | Đấu thầu rộng rãi |

Hậu quả: gói thầu từ 5–10 tỷ VND bị phân loại sai phương thức, sinh ra toàn bộ hồ sơ pháp lý không đúng thẩm quyền.

#### Hàm `numberToWords()` — BỊ HỎI

Chỉ xử lý đúng 4 giá trị cố định: 320M, 80M, 650M, 45M VND.
Mọi giá trị khác trả về chuỗi không hợp lệ về mặt pháp lý.

#### Lỗi Doc 6 (HTML) — Tên nhà cung cấp cố định

`docTemplates.ts` dòng 776–778 hardcode tên nhà cung cấp Gói 1 (`T&T`, `Máy tính VN`, `Sao Nam`) trong header bảng so sánh HTML, bất kể gói nào đang được chọn.

#### Lỗi Doc 14, 15, 16, 17 — Nhà thầu trúng cố định

Supplier 1 luôn được chọn trúng thầu không qua so sánh giá. Nếu người dùng nhập giá trị khiến Supplier 2 hoặc 3 rẻ hơn, hồ sơ tự mâu thuẫn nội bộ.

#### Lỗi Doc 24 (DOCX) — Khai báo hoàn thành sai

`docTemplates.ts` dòng 2285–2288 hardcode `"Đã hoàn thành"` cho tất cả 4 nghĩa vụ đăng tải lên hệ thống đấu thầu quốc gia, bất kể người dùng đã thực sự đăng tải hay chưa.

#### Interface `DocumentConfig`

```typescript
id: number
name: string
getCategory(method)      → 'required' | 'recommended' | 'not_applicable'
getCategoryLabel(method) → string
getSigner(pkg)           → string
getSignDate(pkg)         → string
getAuditRisk(pkg)        → string   // cảnh báo rủi ro kiểm toán
getHtml(pkg, method)     → string   // HTML để xem trước trong trình duyệt
getDocx(pkg, method)     → Document // Đối tượng docx để xuất .docx
```

**Kiến trúc dual-render:** Mỗi văn bản duy trì cả `getHtml()` và `getDocx()` song song. Mọi thay đổi nội dung phải cập nhật cả hai hàm thủ công — nguồn gốc của nhiều lỗi sai lệch HTML/DOCX.

---

### 3. `app/src/App.tsx` (30 KB)

Component React duy nhất quản lý toàn bộ giao diện và trạng thái ứng dụng.

**State chính:**

| State | Kiểu | Mô tả |
|---|---|---|
| `selectedPackage` | `ProcurementPackage` | Gói thầu đang làm việc |
| `activeTab` | `string` | Bộ lọc danh sách văn bản |
| `activeDocIndex` | `number` | Văn bản đang xem trước |
| `activeSection` | `string` | Tab form đang mở |
| `isExportingZip` | `boolean` | Trạng thái đang nén ZIP |

**Lỗi trong App.tsx:**

| Vị trí | Loại | Mô tả |
|---|---|---|
| Dòng 483 | Logic sai | "Hiệu trưởng tự quyết không giới hạn hạn mức" — tuyên bố quá rộng, thiếu điều kiện |
| Dòng 535 | **XSS** | `dangerouslySetInnerHTML` không sanitize — nội dung từ form được render trực tiếp |
| Dòng 93 | Logic | `totalAmount = Σ(quantity × supplier1Price)` — phụ thuộc hoàn toàn vào giá NCC1 |
| Dòng 121 | Thiếu | Validate thứ tự ngày nhưng không validate khoảng cách tối thiểu giữa các mốc |
| Chưa có | Thiếu | Không có pre-export validation trước khi tạo ZIP |

**Trường hợp đặc biệt — `handleItemChange()`:**
Khi `supplier1Price` thay đổi, `unitPrice` tự động cập nhật theo (`unitPrice ← supplier1Price`). Điều này có thể gây lệch giữa giá dự toán gốc và giá báo giá NCC1.

---

## Luồng dữ liệu (Data Flow)

```
demoData.ts
    │  ProcurementPackage[]
    ▼
App.tsx (React State)
    │  selectedPackage: ProcurementPackage
    │
    ├─► getProcurementMethod(pkg) → method.code + method.name
    │         ⚠ Ngưỡng COMPETITIVE_SHOPPING sai (10B thay vì 5B)
    │
    ├─► validateDateOrder() → dateValidationErrors[]
    │         ⚠ Chỉ kiểm tra thứ tự, không kiểm tra khoảng cách tối thiểu
    │
    ├─► documentTemplates[i].getCategory(method.code) → tab filtering
    │
    └─► documentTemplates[i].getHtml(pkg, method.code) → HTML string
              └─► dangerouslySetInnerHTML → DOM preview
              ⚠ XSS không được kiểm soát
    │
    └─► handleDownloadAllZip() → JSZip
              └─► documentTemplates[i].getDocx(pkg, method.code) → Document
                        └─► Packer.toBlob() → Blob → saveAs()
```

---

## Giao diện 3 panel

```
┌─────────────────┬──────────────────────────┬────────────────────┐
│   Panel Trái    │      Panel Giữa           │   Panel Phải       │
│  Cấu Hình       │  Phân Tích & Xem Trước   │  Bộ 24 Tài Liệu   │
│  Gói Thầu       │                           │  Hồ Sơ            │
│                 │  [Tổng giá trị]           │                    │
│  [Chọn mẫu]    │  [Hình thức đề xuất]      │  [Tab lọc]        │
│                 │  [Thẩm quyền phê duyệt]  │  [Danh sách 24]   │
│  Tab: Thông tin │  [Trình tự thời gian]    │                    │
│  Tab: Mốc TG    │                           │  [Badge trạng thái]│
│  Tab: Hàng hóa  │  [Xem trước văn bản]     │                    │
│                 │  [Nút tải .docx]          │                    │
│  ⚠ Thiếu UI    │  ⚠ XSS line 535          │  [Tải ZIP tất cả] │
│  cho 3 ngày     │                           │                    │
└─────────────────┴──────────────────────────┴────────────────────┘
```

**UI date form thiếu 3 trường:**
- `dateDelivery` (ngày bàn giao) — dùng trong Doc 19, 21
- `dateLiquidation` (ngày thanh lý) — dùng trong Doc 21
- `dateAssetIncrease` (ngày ghi tăng TS) — dùng trong Doc 22

---

## Mối quan hệ giữa các tệp

```
CLAUDE.md ──────────────────────────────────────────────────────────┐
SKILL.md ────────────────────────────────────────────────────────┐   │
                                                                  │   │
demoData.ts                                                       │   │
  exports → ProcurementPackage (interface)                        │   │
  exports → ProcurementItem (interface)                           ▼   ▼
  exports → demoPackages (4 objects)                     Governing rules

docTemplates.ts
  imports ← ProcurementPackage, ProcurementItem from demoData.ts
  exports → documentTemplates (DocumentConfig[24])
  exports → getProcurementMethod()   ⚠ Ngưỡng 10B cần sửa thành 5B
  exports → formatVND()
  exports → numberToWords()          ⚠ Hàm broken — chỉ 4 giá trị cứng
  exports → downloadDocx()

App.tsx
  imports ← demoPackages, ProcurementPackage, ProcurementItem from demoData.ts
  imports ← documentTemplates, getProcurementMethod, formatVND, downloadDocx from docTemplates.ts
  imports ← JSZip, Packer from jszip/docx
```

---

## Danh sách 24 văn bản

| # | Tên văn bản | Bắt buộc / Khuyến nghị | Ký bởi |
|---|---|---|---|
| 1 | Tờ trình đề xuất mua sắm | Bắt buộc (CHCT+) | Trưởng phòng/Khoa |
| 2 | Dự toán chi tiết | Bắt buộc | Phòng KH-TC |
| 3 | Thuyết minh kỹ thuật | Bắt buộc | Phòng kỹ thuật |
| 4 | QĐ phê duyệt dự toán | Bắt buộc | Hiệu trưởng |
| 5 | Biên bản khảo sát giá | Bắt buộc | Tổ khảo sát |
| 6 | Bảng so sánh báo giá | Bắt buộc | Tổ khảo sát + KH-TC |
| 7 | Danh mục hàng hóa | Bắt buộc | Phòng chuyên môn |
| 8 | Yêu cầu kỹ thuật | Bắt buộc (CHCT+) | Phòng chuyên môn |
| 9 | Tiêu chuẩn đánh giá | Bắt buộc (CHCT+) | Tổ chuyên gia |
| 10 | Tờ trình KHLCNT | Bắt buộc | Phòng KH-TC |
| 11 | QĐ phê duyệt KHLCNT | Bắt buộc | Hiệu trưởng |
| 12 | Hồ sơ yêu cầu (HSYC) | Bắt buộc (CHCT+) | Tổ chuyên gia |
| 13 | QĐ thành lập Tổ chuyên gia | Bắt buộc (CHCT+) | Hiệu trưởng |
| 14 | Báo cáo đánh giá | Bắt buộc (CHCT) / KN (CDTRG) | Tổ chuyên gia |
| 15 | Báo cáo thẩm định | Bắt buộc (CHCT) / KN (CDTRG) | Phòng KH-TC |
| 16 | Tờ trình phê duyệt kết quả | Bắt buộc (CHCT) / KN (CDTRG) | Phòng TCHC-QT |
| 17 | QĐ phê duyệt kết quả LCNT | Bắt buộc (CHCT) / KN (CDTRG) | Hiệu trưởng |
| 18 | Hợp đồng kinh tế | Bắt buộc (CHCT+) | Hiệu trưởng + Nhà thầu |
| 19 | Biên bản bàn giao | Bắt buộc | Hai bên |
| 20 | Biên bản nghiệm thu | Bắt buộc | Hội đồng nghiệm thu |
| 21 | Biên bản thanh lý | Bắt buộc | Hai bên |
| 22 | Phiếu ghi tăng tài sản | Khuyến nghị (Bắt buộc cho TSCD) | Phòng KH-TC |
| 23 | Checklist hồ sơ kiểm toán | Khuyến nghị | Phòng KH-TC |
| 24 | Checklist đăng tải thông tin | Khuyến nghị | Cán bộ đăng tải |

---

## Hạn chế kiến trúc

| Hạn chế | Mô tả | Rủi ro |
|---|---|---|
| Ngưỡng CHCT sai | Code: ≤10B. Đúng: ≤5B | CRITICAL — sai phương thức LCNT cho gói 5–10B |
| `numberToWords()` hỏng | Chỉ đúng 4 giá trị cứng | CRITICAL — hợp đồng/QĐ thiếu số tiền bằng chữ hợp lệ |
| Nhà thầu trúng cố định | Supplier 1 luôn trúng không qua so sánh | CRITICAL — hồ sơ mâu thuẫn nội bộ |
| Doc 6 tên NCC cứng | HTML dùng tên NCC Gói 1 cho mọi gói | HIGH — preview sai cho Gói 2, 3, 4 |
| Doc 24 hardcode hoàn thành | "Đã hoàn thành" dù chưa đăng tải | CRITICAL — khai báo gian lận tự động hóa |
| XSS trong preview | `dangerouslySetInnerHTML` không sanitize | HIGH — rủi ro bảo mật |
| Không có persistence | Mất dữ liệu khi F5 | MEDIUM — phải nhập lại mỗi lần |
| Không có authentication | Bất kỳ ai cũng dùng được | HIGH — không phù hợp nội mạng |
| Số văn bản là "..." | Số "..." không hợp lệ pháp lý | HIGH — văn bản chưa hoàn chỉnh |
| Thiếu UI 3 trường ngày | dateDelivery/Liquidation/AssetIncrease | MEDIUM — phụ thuộc dữ liệu mẫu |
| Dual rendering | HTML và DOCX duy trì song song | HIGH — dễ lệch nội dung |
| Single-institution | Tên trường hardcoded | LOW — không thể dùng cho đơn vị khác |
| VBHN 74 chưa có | Văn bản hợp nhất quan trọng nhất thiếu | HIGH — căn cứ pháp lý không đầy đủ |
| Luật 116/133/142 thiếu | 3 sửa đổi Luật ĐT chưa tích hợp | HIGH — có thể còn điều khoản thay đổi |

---

## Hướng phát triển tiếp theo (từ CLAUDE.md)

Theo CLAUDE.md, dự án cần duy trì:
- `docs/refactoring_plan.md` — **chưa tồn tại, cần tạo**
- Unit tests, integration tests, regression tests — **chưa triển khai**
- `Prompts/` — AI integration — **chưa triển khai**
- `examples/` — Gói thầu mẫu thực tế — **chưa triển khai**

Ưu tiên sửa lỗi theo CLAUDE.md (audit-first):
1. Sửa ngưỡng COMPETITIVE_SHOPPING (5B thay vì 10B)
2. Implement `numberToWords()` đầy đủ
3. Thêm logic so sánh giá để xác định nhà thầu trúng
4. Xóa hardcode "Đã hoàn thành" trong Doc 24
5. Sửa Doc 6 HTML tên nhà cung cấp

---

## Phase 6 — Multi-Agent Layer (✅ Hoàn thành 18/06/2026)

Phase 6 thêm ba lớp mới vào kiến trúc, hoàn toàn độc lập với lớp Phase 1–5.

---

### Lớp 1 — Agent Layer (`app/src/agents/`)

Hệ thống 6 agent chuyên biệt giao tiếp qua message-passing, được điều phối bởi `AgentRegistry`.

**Kiến trúc message-passing:**

```
User / App.tsx
      │  AgentMessage { traceId, from, to, type, payload, legalBasis }
      ▼
AgentRegistry          ← message broker + audit trace log
      │  route(msg) → agent
      ├──► PlannerAgent        (id: 'planner')
      ├──► SpecificationAgent  (id: 'specification')
      ├──► LegalReviewerAgent  (id: 'legal-reviewer')
      ├──► RiskAgent           (id: 'risk')
      ├──► ChatAgent           (id: 'chat')
      └──► AutonomousAgent     (id: 'autonomous')  ← master orchestrator
```

**Invariant bất biến:** `AgentRegistry.log()` ném lỗi nếu `traceId` rỗng — đảm bảo mọi message đều có thể truy vết kiểm toán.

**Mô tả các agent:**

| Agent | File | Chức năng chính | Tests |
|---|---|---|---|
| PlannerAgent | `PlannerAgent.ts` | Lập KHLCNT năm từ NL goal; phát hiện chia nhỏ gói thầu; lịch mua sắm | 56 |
| SpecificationAgent | `SpecificationAgent.ts` | Sinh YCKT chuẩn đấu thầu; phát hiện khóa nhãn hiệu; batch generate | 58 |
| LegalReviewerAgent | `LegalReviewerAgent.ts` | Rà soát pháp lý toàn hồ sơ; cross-check 28 văn bản; compliance score 0–100 | 57 |
| RiskAgent | `RiskAgent.ts` | Risk matrix theo chuẩn KTNN; phát hiện rủi ro hệ thống; kế hoạch giảm thiểu | 57 |
| ChatAgent | `ChatAgent.ts` | Hỏi đáp đa lượt tiếng Việt; KB-first (không fabricate); suggest follow-ups | 57 |
| AutonomousAgent | `AutonomousAgent.ts` | State machine IDLE→PLANNING→…→DONE; pause/resume; full audit trail | 56 |

**Public API — barrel `agents/index.ts`:**

```typescript
// Import từ đây thay vì trực tiếp từ agent file
import { PlannerAgent, LegalReviewerAgent, ChatAgent, AgentRegistry } from './agents';
import type { AgentMessage, IAgent, AgentId } from './agents';
```

> **Wiring status:** Barrel đã xuất đủ; chưa được import bởi `App.tsx` — tích hợp UI được lùi sang Phase 7.

---

### Lớp 2 — Provider Infrastructure (`app/src/providers/` — P6-10x)

Các module cung cấp khả năng gọi LLM, quản lý session, memory và điều phối đa agent.

| Module | Mô tả |
|---|---|
| `OpenAIProvider.ts` | Adapter gọi OpenAI API (chat completions + streaming) |
| `ClaudeProvider.ts` | Adapter gọi Anthropic Claude API |
| `GeminiProvider.ts` | Adapter gọi Google Gemini API |
| `ProviderRegistry.ts` | Đăng ký và tra cứu provider theo tên |
| `ProviderManager.ts` | Điều phối providers: fallback, retry, model selection |
| `ModelManager.ts` | Quản lý danh sách model và metadata |
| `PromptTemplateManager.ts` | Quản lý và render prompt template có biến |
| `ConversationBuilder.ts` | Xây dựng conversation array (system + history + user) |
| `ConversationMemory.ts` | Lưu lịch sử hội thoại theo session (in-memory) |
| `MemoryStore.ts` | Snapshot persistence cho agent memory |
| `SessionManager.ts` | Quản lý lifecycle session (create/resume/close) |
| `AgentRuntime.ts` | Runtime vòng lặp request→LLM→tool→response |
| `ToolRegistry.ts` | Đăng ký và tra cứu tool definitions |
| `ToolExecutor.ts` | Thực thi tool calls (sync và async) |
| `MultiAgentCoordinator.ts` | Điều phối nhiều agent chạy song song |
| `ApiServer.ts` | Mock HTTP API server (route registration + request dispatch) |
| `Planner.ts` | Task decomposition planner |
| `WorkflowEngine.ts` | Topological multi-step workflow orchestrator |
| `ToolCallingAgent.ts` | Agent vòng lặp multi-format tool calling |
| `StreamingTypes.ts` / `RetryPolicy.ts` / `env.ts` | Types, retry logic, environment config |

**Nguyên tắc thiết kế:** Tất cả provider module là SSR-compatible (không dùng `window`, `document`, `localStorage`). Provider pattern: `{ ok: true; value: T } | { ok: false; error: E }`.

---

### Lớp 3 — Utility Infrastructure (`app/src/providers/` — P6-11x và P6-12x)

#### P6-11x — Core Utilities (9 modules)

Các primitive độc lập, không phụ thuộc lẫn nhau, có thể dùng trong bất kỳ layer nào.

| Module | Mô tả |
|---|---|
| `Logger.ts` | Structured in-process log store (level-filtered, iterable) |
| `EventBus.ts` | In-process pub/sub message bus (sync emit, typed events) |
| `CacheStore.ts` | Key-value cache với optional TTL expiry |
| `ConfigStore.ts` | Ordered key-value configuration store |
| `MetricsCollector.ts` | Numeric metrics accumulator (count, sum, min, max) |
| `StateStore.ts` | Key-value state store với full snapshot |
| `TaskQueue.ts` | FIFO task queue với safe empty-queue semantics |
| `ResourcePool.ts` | FIFO generic object pool (acquire/release) |
| `RetryManager.ts` | Configurable async retry với exponential backoff |

#### P6-12x — Network & Integration (10 modules)

Các client và pipeline cho giao tiếp mạng và xử lý request/response.

| Module | Mô tả |
|---|---|
| `RestClient.ts` | fetch-based HTTP client (timeout, query params, base URL) |
| `RateLimiter.ts` | Sliding-window rate limiter |
| `HttpInterceptor.ts` | Request/response interceptor pipeline |
| `WebSocketClient.ts` | Injectable-transport WebSocket client |
| `Scheduler.ts` | FIFO job scheduler (delay, interval, one-shot) |
| `Pipeline.ts` | Sequential stage processor (`(input) → output`) |
| `MiddlewareChain.ts` | `(context, next)` middleware runner (Express-style) |
| `HookManager.ts` | Fire-and-forget named hook runner |
| `PluginManager.ts` | Named plugin registry (register/activate/deactivate) |
| `ServiceLocator.ts` | String-keyed service registry (IoC container lite) |

---

### Lớp 4 — UI Components (`app/src/components/`)

18 React component SSR-compatible (không dùng hooks, không dùng browser API):

- **Wired vào Dashboard.tsx:** ProviderPanel, SessionPanel, MemoryPanel, WorkflowEnginePanel, AgentPanel, ToolPanel, ChatPanel
- **Standalone panels:** AgentStatusDashboard, RoutePanel, AuditTrailPanel
- **Primitive components:** AgentCard, StepTimeline, ChatMessage, ChatInput, AutonomousPanel

**Deferred components (tồn tại, chưa wire):**

| Component | Lý do defer |
|---|---|
| `WorkflowPanel.tsx` | Cần wire với `AutonomousAgent` state machine — Phase 7 |
| `AgentChatPanel.tsx` | Cần wire với `ChatAgent` message-passing — Phase 7 |

---

### Tóm tắt lớp kiến trúc (Phase 6 hoàn chỉnh)

```
┌─────────────────────────────────────────────────────────────┐
│  App.tsx (Phase 1–5 SPA)  ←── Phases 1–5 không thay đổi   │
│  demoData.ts / docTemplates.ts / utils.ts / ai/             │
├─────────────────────────────────────────────────────────────┤
│  components/  (Phase 6 UI — 18 files, SSR-safe)            │
│  ⚠ WorkflowPanel, AgentChatPanel chưa wire vào App.tsx     │
├─────────────────────────────────────────────────────────────┤
│  agents/  (Phase 6 Multi-Agent — 6 agents + registry)      │
│  ⚠ agents/index.ts barrel chưa import bởi App.tsx          │
├─────────────────────────────────────────────────────────────┤
│  providers/  (Phase 6 Infrastructure — 42 modules)          │
│  P6-10x: LLM runtime  │  P6-11x: Utilities  │  P6-12x: Net │
└─────────────────────────────────────────────────────────────┘
```
