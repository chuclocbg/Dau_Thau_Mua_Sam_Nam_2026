# Báo Cáo Rà Soát Pháp Lý — Ngưỡng Chỉ Định Thầu Rút Gọn

> **Phân loại:** Tài liệu nội bộ — rà soát pháp lý  
> **Ngày soạn:** 2026-06-20  
> **Trạng thái:** Cần xác nhận từ pháp chế trước khi áp dụng chính thức

---

## 1. Ngưỡng hiện tại trong hệ thống

Hệ thống AI hồ sơ mua sắm hiện áp dụng mức ngưỡng sau:

| Phương thức | Điều kiện áp dụng | Mã trong hệ thống |
|---|---|---|
| Mua sắm trực tiếp | Tổng giá trị ≤ 50.000.000 VND | `DIRECT_50` |
| **Chỉ định thầu rút gọn** | **50.000.000 < Tổng giá trị ≤ 500.000.000 VND** | `DIRECT_SELECTION_SIMPLIFIED` |
| Chào hàng cạnh tranh | 500.000.000 < Tổng giá trị ≤ 5.000.000.000 VND | `COMPETITIVE_SHOPPING` |
| Đấu thầu rộng rãi | Tổng giá trị > 5.000.000.000 VND | `OPEN_BIDDING` |

Ngưỡng 500.000.000 VND được dùng làm ranh giới trên của chỉ định thầu rút gọn tại các tệp:

- `app/src/docTemplates.ts` (hàm `getProcurementMethod`, dòng ~108)
- `app/src/ai/legalReviewer.ts` (dòng ~155, ~196)
- `app/src/ai/packageGenerator.ts` (dòng ~284)
- `app/src/agents/validateAuthority.ts` (dòng ~77)
- `app/src/agents/detectPackageSplitting.ts` (nhãn mô tả ngưỡng)
- `app/src/ai/legalKnowledgeBase.ts` (mô tả phương thức)
- `app/src/App.tsx` (nhãn hiển thị UI)

---

## 2. Cơ sở pháp lý và vấn đề phức tạp

### 2.1 Luật Đấu thầu số 22/2023/QH15

Điều 23 khoản 1 điểm m Luật Đấu thầu 22/2023 cho phép chỉ định thầu đối với:

> *"Gói thầu mua sắm hàng hóa, xây lắp, dịch vụ phi tư vấn có giá trị trong hạn mức theo quy định của Chính phủ"*

**Quan trọng:** Luật không tự quy định con số cụ thể. Hạn mức do Chính phủ quy định qua Nghị định.

### 2.2 Nghị định 214/2025/NĐ-CP

Nghị định 214/2025/NĐ-CP (thay thế Nghị định 24/2024/NĐ-CP và các sửa đổi trước đó) quy định hạn mức áp dụng chỉ định thầu. Theo thông tin hiện có:

- **Hàng hóa thông thường:** Ngưỡng chỉ định thầu rút gọn là ≤ 500.000.000 VND (500 triệu)
- **Dịch vụ tư vấn:** Có thể có ngưỡng khác (thường thấp hơn)
- **Xây lắp:** Có thể có ngưỡng khác

> ⚠ **Lưu ý:** Ngưỡng 500 triệu áp dụng cho **hàng hóa thông thường** (goods). Hệ thống hiện tại chỉ xử lý gói mua sắm hàng hóa, nên đây là ngưỡng phù hợp cho phạm vi hiện tại.

### 2.3 Nghị định 24/2024/NĐ-CP (đã hết hiệu lực)

Nghị định 24/2024 (sửa đổi Nghị định 24/2024 về đấu thầu) đã được thay thế bởi Nghị định 214/2025. **Không sử dụng Nghị định 24/2024 làm căn cứ** trong các hồ sơ soạn từ năm 2026.

### 2.4 Consolidated Document 74/VBHN-VPQH (25/03/2026)

Văn bản hợp nhất số 74/VBHN-VPQH hợp nhất Luật Đấu thầu 22/2023, Luật 57/2024 và Luật 90/2025. Đây là văn bản tham chiếu ưu tiên cho các hồ sơ từ Q2/2026.

---

## 3. Điểm không chắc chắn và rủi ro

### [HIGH] Ngưỡng không phải phổ quát cho tất cả loại gói thầu

Ngưỡng 500 triệu là ngưỡng cho **hàng hóa thông thường**. Hệ thống hiện chưa xử lý:

- Gói dịch vụ tư vấn (ngưỡng thường thấp hơn)
- Gói xây lắp (ngưỡng có thể khác)
- Gói hỗn hợp có yếu tố xây lắp

**Khuyến nghị:** Nếu trường mở rộng sang gói dịch vụ tư vấn hoặc xây lắp, cần bổ sung logic phân loại theo loại gói thầu.

### [MEDIUM] Phụ thuộc vào Nghị định còn hiệu lực

Hạn mức chỉ định thầu là **hạn mức hành chính** có thể thay đổi theo Nghị định mới. Nếu Chính phủ ban hành Nghị định sửa đổi nâng hoặc hạ ngưỡng (ví dụ lên 800 triệu hoặc hạ xuống 300 triệu), hệ thống cần cập nhật.

**Khuyến nghị:** Tạo hằng số có tên rõ ràng (ví dụ `DIRECT_SELECTION_SIMPLIFIED_THRESHOLD`) thay vì hardcode 500_000_000 ở nhiều nơi. Hiện tại giá trị xuất hiện ≥7 lần trong codebase.

### [LOW] Ranh giới 500 triệu đúng hay phải < 500 triệu?

Hệ thống hiện dùng `total <= 500_000_000` (bao gồm đúng bằng 500 triệu). Đây là cách hiểu thông thường theo quy định "không vượt quá". Cần xác nhận văn bản gốc dùng "không vượt quá" hay "dưới" để đảm bảo biên giới chính xác.

### [LOW] Kiểm tra cập nhật Thông tư 79/2025/TT-BTC và 80/2025/TT-BTC

Hai Thông tư này quy định thủ tục đấu thầu qua mạng. Cần kiểm tra có điều khoản nào ảnh hưởng đến ngưỡng chỉ định thầu rút gọn không.

---

## 4. Kết luận về trạng thái hiện tại

| Hạng mục | Kết luận |
|---|---|
| Ngưỡng 500 triệu cho hàng hóa thông thường | **Phù hợp** với NĐ 214/2025 theo thông tin hiện có |
| Áp dụng cho gói dịch vụ tư vấn / xây lắp | **Chưa xử lý** — cần bổ sung nếu mở rộng phạm vi |
| Tính thống nhất trong codebase | **Rủi ro bảo trì** — ngưỡng hardcode ở ≥7 vị trí |
| Tham chiếu pháp lý hiển thị trong hồ sơ | **Đúng** — hệ thống trích dẫn NĐ 214/2025 và Luật ĐT 22/2023 |

---

## 5. Khuyến nghị thiết kế tương lai

### 5.1 Tập trung ngưỡng vào một tệp cấu hình

```typescript
// app/src/config/procurementThresholds.ts (đề xuất)
export const DIRECT_50_THRESHOLD               = 50_000_000;
export const DIRECT_SELECTION_THRESHOLD        = 500_000_000;
export const COMPETITIVE_SHOPPING_THRESHOLD    = 5_000_000_000;
// Các ngưỡng này dựa trên NĐ 214/2025/NĐ-CP (hàng hóa thông thường)
// Cập nhật tại đây khi Chính phủ sửa đổi Nghị định
```

### 5.2 Phân loại ngưỡng theo loại gói thầu

Khi mở rộng sang dịch vụ tư vấn hoặc xây lắp, cần bảng ngưỡng riêng theo `packageType`:

```typescript
const thresholds = {
  goods:        { direct: 500_000_000 },
  consulting:   { direct: ??? },   // cần tra cứu NĐ 214/2025
  construction: { direct: ??? },   // cần tra cứu NĐ 214/2025
};
```

### 5.3 Không thay đổi code ngay

Không thay đổi ngưỡng 500 triệu trong code hiện tại cho đến khi có xác nhận pháp chế rằng NĐ 214/2025 đã có hiệu lực đầy đủ và ngưỡng chính xác được ghi trong văn bản gốc.

---

## 6. Hành động cần thực hiện

- [ ] Bộ phận pháp chế xác nhận ngưỡng chính xác trong NĐ 214/2025 điều khoản cụ thể
- [ ] Xác nhận biên giới: "không vượt quá 500 triệu" hay "dưới 500 triệu"
- [ ] Nếu mở rộng sang dịch vụ/xây lắp: bổ sung ngưỡng tương ứng
- [ ] Xem xét tập trung ngưỡng vào hằng số named (P10 future task)
- [ ] Kiểm tra TT 79/2025 và TT 80/2025 có ảnh hưởng ngưỡng chỉ định thầu không
