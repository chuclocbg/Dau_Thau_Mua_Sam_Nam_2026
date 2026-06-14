# Lộ Trình Phát Triển — Hệ Thống Hồ Sơ Mua Sắm 2026

> **Trạng thái cập nhật:** 14/06/2026  
> **Phiên bản hiện tại:** 2.x (Phase 1 + 2 hoàn thành)

## Tổng quan tiến độ

| Phase | Nội dung | Trạng thái |
|---|---|---|
| Phase 1 — Critical | 9 lỗi chặn triển khai | ✅ DONE (commit 09403e5) |
| Phase 2 — High | 14 vấn đề pháp lý và UX | ✅ DONE (commit d4ae015) |
| Phase 3 — Medium | 9 cải tiến chất lượng | 🔄 Đang thực hiện |
| Phase 4 — Low | 6 nợ kỹ thuật dài hạn | ⏳ Chưa bắt đầu |

---

## Phase 1 — Critical (Hoàn thành 13/06/2026)

**Mục tiêu:** Đảm bảo hệ thống không tạo ra hồ sơ vi phạm pháp luật.

| # | Nội dung | Kết quả |
|---|---|---|
| P1-01 | `numberToWords()` — thuật toán đầy đủ tiếng Việt | ✅ |
| P1-02 | Ngưỡng COMPETITIVE_SHOPPING: 10B → 5B VND | ✅ |
| P1-03 | Doc 6: tên nhà cung cấp động thay vì cứng | ✅ |
| P1-04 | Doc 14-17: so sánh báo giá thực tế, không cố định Supplier 1 | ✅ |
| P1-05 | Doc 24: placeholder thay vì "Đã hoàn thành" | ✅ |
| P1-06 | XSS: DOMPurify bảo vệ mọi dangerouslySetInnerHTML | ✅ |
| P1-07 | Demo Gói 4: tách các ngày phê duyệt không cùng 1 ngày | ✅ |
| P1-08 | Demo: dateDelivery ≠ dateAcceptance cho thiết bị phức tạp | ✅ |
| P1-09 | Doc 25: Bản cam kết không xung đột lợi ích | ✅ |

---

## Phase 2 — High (Hoàn thành 14/06/2026)

**Mục tiêu:** Đảm bảo hồ sơ đủ điều kiện sử dụng thực tế với gói thầu thật.

Highlights:
- VBHN 74/VBHN-VPQH tích hợp làm căn cứ chủ đạo trong mọi phương thức
- 3 văn bản bắt buộc mới: RFQ (Doc 26), Thông báo mời chào hàng (Doc 27), Biên bản mở thầu (Doc 28)
- contractType field: lump_sum vs unit_price (Điều 62 Luật ĐT 2023)
- packageType field: goods_fixed_asset / goods_consumable / service / mixed
- Demo data: không còn tên thương hiệu trong thông số kỹ thuật
- Tổ thẩm định độc lập với tổ chuyên gia (placeholder trung lập)
- Warning banner cho số văn bản chưa điền (NĐ 30/2020)
- 5 file Legal/ placeholder với nguồn tra cứu chính thức

---

## Phase 3 — Medium (Đang thực hiện, mục tiêu 21/06/2026)

**Mục tiêu:** Cải thiện chất lượng kỹ thuật và đầy đủ của hồ sơ.

| # | Nội dung | Độ phức tạp | Trạng thái |
|---|---|---|---|
| P3-01 | `handleInfoChange` — generic type thay vì `any` | Thấp | ✅ |
| P3-02 | `totalAmount` — dùng `unitPrice` thay `supplier1Price` | Thấp | ✅ |
| P3-03 | Deep copy: `structuredClone` thay JSON roundtrip | Thấp | ✅ |
| P3-04 | `packageType` → Doc 22 phân loại tài sản/tiêu hao | Trung bình | ✅ |
| P3-05 | Gói dịch vụ — căn cứ pháp lý riêng (Khoản 12 Điều 4) | Trung bình | ✅ |
| P3-06 | Prompts/examples/tests/roadmap — nội dung thực | Cao | ✅ |
| P3-07 | Doc 3 — nội dung theo packageType | Thấp | ⏳ |
| P3-08 | React Error Boundary cho preview pane | Thấp | ⏳ |
| P3-09 | `handleItemChange` — tách unitPrice ≠ supplier1Price | Trung bình | ⏳ |

---

## Phase 4 — Low (Mục tiêu Q3/2026)

**Mục tiêu:** Giảm nợ kỹ thuật dài hạn, chuẩn bị cho mở rộng.

| # | Nội dung |
|---|---|
| P4-01 | Xóa `useEffect` import không dùng |
| P4-02 | Tách `docTemplates.ts` (hiện 132KB) thành 5-6 module |
| P4-03 | CSS modules thay cho 1 file App.css |
| P4-04 | File config tổ chức — tách tên trường, bộ, mã ký hiệu |
| P4-05 | Xóa hoặc document hóa `templates/` 4 file 0 bytes |
| P4-06 | Toast/modal lỗi khi ZIP export thất bại |

---

## Tính năng dự kiến Phase 5+ (chưa lên kế hoạch)

- **AI Agent integration:** Sử dụng Prompts/ để tích hợp Claude API sinh văn bản từ dữ liệu đầu vào
- **Multi-unit support:** Cấu hình cho đơn vị khác (tách khỏi hardcode CĐKTCN)
- **Lịch sử gói thầu:** Lưu trữ và tra cứu gói thầu đã hoàn thành
- **Import/Export JSON:** Chia sẻ cấu hình gói giữa người dùng
- **E-procurement sync:** Kết nối với hệ thống đấu thầu qua mạng của Bộ KH&ĐT

---

## Nguyên tắc duy trì

1. Mọi thay đổi code phải đi kèm test (162 tests hiện tại — không được giảm)
2. Không rewrite toàn bộ — chỉ incremental refactoring
3. Audit-first: mọi thay đổi template đều xem xét rủi ro kiểm toán
4. Không bịa đặt căn cứ pháp lý — chỉ trích dẫn văn bản đã được xác minh
