# Kế Hoạch Tái Cấu Trúc — Hồ Sơ Mua Sắm Nam 2026
> **Nguyên tắc:** Audit-first theo CLAUDE.md — mọi phát hiện được nhìn nhận dưới góc độ Kiểm toán Nhà nước, Thanh tra BTC, Thanh tra BCT.  
> **Quy tắc:** Không viết lại toàn bộ. Ưu tiên sửa tăng dần. Không thay đổi business logic khi chưa giải thích.  
> **Ngày lập:** 13/06/2026  
> **Cập nhật:** Sau mỗi phase hoàn thành, đánh dấu `[DONE]` vào từng mục.
> **Test suite:** 162 tests passing — `npm test` trong `app/`. Xem `app/src/__tests__/`.

---

## MỤC LỤC

- [Phase 1 — Critical (Chặn triển khai)](#phase-1--critical)
- [Phase 2 — High (Trước khi dùng hồ sơ thật)](#phase-2--high)
- [Phase 3 — Medium (Cải thiện chất lượng)](#phase-3--medium)
- [Phase 4 — Low (Nợ kỹ thuật dài hạn)](#phase-4--low)
- [Bảng tóm tắt](#bảng-tóm-tắt)

---

## Phase 1 — Critical

> Các lỗi này tạo ra hồ sơ **vi phạm pháp luật**, **tự mâu thuẫn nội bộ**, hoặc **khai báo gian lận tự động**. Phần mềm **không được đưa vào sử dụng thật** khi còn bất kỳ mục nào trong Phase 1 chưa xử lý.

---

### P1-01 — [DONE] Hàm `numberToWords()` chỉ xử lý 4 giá trị cứng

**Root cause:**  
Hàm được viết nhanh cho mục đích demo với 4 câu `if` hardcode tương ứng 4 giá trị của 4 gói mẫu. Không có thuật toán chuyển đổi số sang chữ thực sự.

**Impact:**  
Với bất kỳ giá trị nào ngoài {320.000.000; 80.000.000; 650.000.000; 45.000.000} VND, hàm trả về chuỗi vô nghĩa về mặt pháp lý:
```
"522.000.000 đồng (Bằng chữ: Xem chi tiết trong dự toán)"
```
Hậu quả trực tiếp:
- **Doc 1** (Tờ trình đề xuất): số tiền bằng chữ không hợp lệ
- **Doc 4** (QĐ phê duyệt dự toán): quyết định hành chính có số tiền placeholder → vô hiệu
- **Doc 18** (Hợp đồng): hợp đồng kinh tế thiếu giá trị bằng chữ → tranh chấp có thể dẫn đến tuyên vô hiệu một phần
- **Doc 21** (Biên bản thanh lý): không xác định được giá trị thanh lý
- Tất cả gói thầu thật (giá trị ≠ 4 giá trị demo) đều bị ảnh hưởng

**Recommended fix:**  
Thay thế toàn bộ hàm bằng thuật toán đệ quy chuẩn tiếng Việt, xử lý tới hàng nghìn tỷ VND. Tiêu chuẩn tham chiếu: TCVN hoặc các thư viện `number-to-words-vi` có sẵn trên npm.

```typescript
// Gợi ý cấu trúc
export const numberToWords = (total: number): string => {
  // Xử lý edge cases: 0, âm, > 999 tỷ
  // Phân tách: tỷ → trăm triệu → triệu → trăm nghìn → nghìn → trăm → đơn vị
  // Quy tắc đặc biệt tiếng Việt: "mười", "mươi", "linh", "lẻ", "mốt", "tư"
  // Kết thúc bằng " đồng chẵn" hoặc " đồng"
};
```

**Files affected:**
- `app/src/docTemplates.ts` — lines 13–29 (thay toàn bộ hàm)
- Không cần thay đổi file nào khác (các nơi gọi `numberToWords()` tự hưởng lợi)

---

### P1-02 — [DONE] Ngưỡng Chào hàng cạnh tranh sai (10 tỷ thay vì 5 tỷ)

**Root cause:**  
`getProcurementMethod()` sử dụng `10_000_000_000` (10 tỷ VND) làm ngưỡng trên của `COMPETITIVE_SHOPPING`. Theo NĐ 214/2025/NĐ-CP và SKILL.md (mục III), ngưỡng đúng là `5_000_000_000` (5 tỷ VND).

**Impact:**  
Mọi gói thầu có giá trị từ **5 tỷ đến 10 tỷ VND** sẽ được phân loại thành "Chào hàng cạnh tranh" trong khi phải là "Đấu thầu rộng rãi". Hậu quả dây chuyền:
- Toàn bộ 24 văn bản được tạo ra sai phương thức → không có giá trị pháp lý
- Căn cứ pháp lý trong tất cả các QĐ, TTr, HSYC trích dẫn điều khoản sai hình thức
- KHLCNT không được trình Bộ CT phê duyệt theo yêu cầu bắt buộc (SKILL.md mục III: ĐTRR → KHLCNT trình Bộ CT)
- Nếu kiểm toán phát hiện, toàn bộ quy trình LCNT bị tuyên vô hiệu

**Recommended fix:**  
Thay `10_000_000_000` thành `5_000_000_000` tại điều kiện phân nhánh. Đây là thay đổi một dòng nhưng có tác động lớn.

```typescript
// docTemplates.ts dòng 69 — TRƯỚC:
} else if (total <= 10000000000) {

// SAU:
} else if (total <= 5000000000) {
```

Đồng thời bổ sung test case kiểm tra: gói 4,9 tỷ → COMPETITIVE_SHOPPING; gói 5,1 tỷ → OPEN_BIDDING.

**Files affected:**
- `app/src/docTemplates.ts` — line 69
- `tests/` — cần thêm test case sau khi sửa

---

### P1-03 — [DONE] Doc 6 HTML hardcode tên nhà cung cấp của Gói 1

**Root cause:**  
Khi viết template HTML cho Doc 6 (Bảng so sánh báo giá), lập trình viên gõ cứng tên viết tắt của 3 nhà cung cấp Gói 1 vào tiêu đề cột bảng thay vì dùng biến từ `pkg`:

```html
<!-- docTemplates.ts lines 776-778 -->
<th colspan="2">Báo giá 1 (T&T)</th>
<th colspan="2">Báo giá 2 (Máy tính VN)</th>
<th colspan="2">Báo giá 3 (Sao Nam)</th>
```

Phần thân bảng đã dùng biến đúng. Phần DOCX đã dùng biến đúng. Chỉ phần HTML header bị cứng.

**Impact:**  
- Xem trước Doc 6 trên giao diện (HTML) luôn hiển thị "T&T", "Máy tính VN", "Sao Nam"
- Khi người dùng chọn Gói 2, 3, hoặc 4, bảng HTML preview có tên sai → dễ nhầm, khó phát hiện
- Nếu người dùng không in để kiểm tra mà chỉ xem preview, họ nghĩ tên đúng
- File `.docx` xuất ra đúng; preview sai → khoảng cách tin cậy giữa preview và file thật

**Recommended fix:**  
Thay 3 dòng HTML header tĩnh bằng template literal đọc từ `pkg`:

```typescript
// TRƯỚC:
<th colspan="2">Báo giá 1 (T&T)</th>
<th colspan="2">Báo giá 2 (Máy tính VN)</th>
<th colspan="2">Báo giá 3 (Sao Nam)</th>

// SAU:
<th colspan="2">Báo giá 1 (${pkg.supplier1Name})</th>
<th colspan="2">Báo giá 2 (${pkg.supplier2Name})</th>
<th colspan="2">Báo giá 3 (${pkg.supplier3Name})</th>
```

**Files affected:**
- `app/src/docTemplates.ts` — lines 776–778 (HTML `getHtml()` của Doc 6)

---

### P1-04 — [DONE] Docs 14, 15, 16, 17: Nhà thầu trúng luôn là Supplier 1 — không có so sánh giá

**Root cause:**  
Cả 4 văn bản đánh giá và phê duyệt kết quả đều hardcode `pkg.supplier1Name` làm nhà thầu trúng mà không thực hiện bất kỳ phép so sánh nào. Tên hàm `getHtml()` và `getDocx()` không có logic:
```typescript
// Tất cả 4 docs đều có dạng:
`Tổ chuyên gia đã tiến hành đánh giá ... nhà thầu: "${pkg.supplier1Name}"`
`Đề xuất: Lựa chọn nhà thầu ${pkg.supplier1Name} trúng thầu`
`Kết quả: Đề xuất phê duyệt ... nhà thầu ${pkg.supplier1Name} là đúng quy định`
```

**Impact:**  
Nếu người dùng nhập giá trị thực tế khiến Supplier 2 hoặc 3 có tổng giá thấp hơn:
- **Doc 6** (Bảng so sánh) sẽ hiển thị Supplier 2 rẻ hơn
- **Doc 14–17** vẫn tuyên bố Supplier 1 trúng thầu vì "giá thấp nhất"
- Hồ sơ **tự mâu thuẫn nội bộ** về kết quả đấu thầu
- Kiểm toán viên đọc hồ sơ thấy bằng chứng trực tiếp của **hành vi thông đồng trong đấu thầu** theo Điều 89 Luật ĐT 2023, điểm d khoản 1

**Recommended fix:**  
Thêm hàm helper tính toán nhà thầu trúng dựa trên tổng giá thực tế:

```typescript
// Thêm vào docTemplates.ts
export const getWinnerSupplier = (pkg: ProcurementPackage): {
  name: string; total: number; rank: 1 | 2 | 3
} => {
  const s1 = pkg.items.reduce((s, i) => s + i.quantity * i.supplier1Price, 0);
  const s2 = pkg.items.reduce((s, i) => s + i.quantity * i.supplier2Price, 0);
  const s3 = pkg.items.reduce((s, i) => s + i.quantity * i.supplier3Price, 0);
  const min = Math.min(s1, s2, s3);
  if (min === s1) return { name: pkg.supplier1Name, total: s1, rank: 1 };
  if (min === s2) return { name: pkg.supplier2Name, total: s2, rank: 2 };
  return { name: pkg.supplier3Name, total: s3, rank: 3 };
};
```

Sử dụng `getWinnerSupplier(pkg).name` thay cho `pkg.supplier1Name` tại:
- Doc 14 `getHtml()` và `getDocx()` — các dòng tham chiếu nhà thầu trúng
- Doc 15 `getHtml()` và `getDocx()`
- Doc 16 `getHtml()` và `getDocx()`
- Doc 17 `getHtml()` và `getDocx()`

Thêm cảnh báo giao diện khi nhà thầu trúng không phải Supplier 1 (để người dùng biết hệ thống đã điều chỉnh tự động).

**Files affected:**
- `app/src/docTemplates.ts` — lines ~1514, ~1518, ~1547, ~1550 (Doc 14); ~1590, ~1618 (Doc 15); Doc 16 getHtml/getDocx; Doc 17 getHtml/getDocx
- `app/src/App.tsx` — có thể cần hiển thị cảnh báo khi winner ≠ supplier1

---

### P1-05 — [DONE] Doc 24 DOCX hardcode "Đã hoàn thành" cho nghĩa vụ đăng tải chưa thực hiện

**Root cause:**  
Mảng dữ liệu của bảng trong `getDocx()` Doc 24 dùng chuỗi tĩnh thay vì trường động:

```typescript
// docTemplates.ts lines 2285-2288:
["1", "Kế hoạch lựa chọn nhà thầu", "...", "Đã hoàn thành"],
["2", "Hồ sơ mời thầu / Hồ sơ yêu cầu", "...", "Đã hoàn thành"],
["3", "Kết quả lựa chọn nhà thầu", "...", "Đã hoàn thành"],
["4", "Thông tin về kết quả thực hiện hợp đồng", "...", "Đã hoàn thành"]
```

**Impact:**  
- Mỗi gói thầu được tạo ra đều có văn bản xác nhận "Đã hoàn thành" 4 nghĩa vụ đăng tải công khai
- Thực tế, người dùng chỉ vừa tạo hồ sơ, chưa đăng tải lên mạng đấu thầu
- Khi kiểm toán tra Hệ thống mạng đấu thầu quốc gia và không thấy đăng tải, đối chiếu với Doc 24 đã ký → bằng chứng khai báo gian lận
- Vi phạm Điều 12 Luật ĐT 2023 về trách nhiệm đăng tải thông tin, TT 79/2025/TT-BTC

**Recommended fix:**  
Thay cột trạng thái từ chuỗi cứng thành trường người dùng điền. Hai phương án:

**Phương án A (minimal):** Thay "Đã hoàn thành" bằng "☐ Chưa thực hiện" (checkbox trống) — nhắc người dùng phải tự điền sau.

**Phương án B (preferred):** Thêm 4 trường ngày đăng tải vào `ProcurementPackage`:
```typescript
datePublishKhlcnt?: string;
datePublishHsyc?: string;
datePublishResult?: string;
datePublishContract?: string;
```
Render trong Doc 24: nếu trường có giá trị → "Đã đăng tải ngày DD/MM/YYYY"; nếu trống → "**[Chưa thực hiện — điền ngày sau khi đăng tải]**".

**Files affected:**
- `app/src/docTemplates.ts` — lines 2285–2288 (DOCX), cũng cần cập nhật HTML phần Doc 24
- `app/src/demoData.ts` — thêm 4 trường optional vào `ProcurementPackage` interface (nếu chọn Phương án B)
- `app/src/App.tsx` — thêm 4 input ngày vào form (nếu chọn Phương án B)

---

### P1-06 — [DONE] XSS qua `dangerouslySetInnerHTML` không sanitize

**Root cause:**  
Preview văn bản tại `App.tsx:535` render HTML thô từ `getHtml()` — hàm này dùng template literals nhúng trực tiếp dữ liệu người dùng nhập vào form:

```typescript
// App.tsx line 535:
<div dangerouslySetInnerHTML={{ __html: activeDoc.getHtml(selectedPackage, method.code) }} />
```

Nếu người dùng nhập tên nhà thầu có chứa `<script>alert(1)</script>`, nội dung đó được render vào DOM.

**Impact:**  
- Trên môi trường một người dùng (chạy localhost): rủi ro thấp
- Trên môi trường chia sẻ nội mạng (nhiều người dùng cùng truy cập một instance): một người dùng có thể inject nội dung vào tài liệu của người khác
- Nếu nội dung được lưu và share (copy URL, share file HTML), payload có thể lan rộng
- Đây là lỗ hổng kiến trúc cơ bản của mô hình "dữ liệu người dùng → HTML không qua lọc"

**Recommended fix:**  
Cài và sử dụng DOMPurify trước khi render:

```bash
npm install dompurify @types/dompurify
```

```typescript
// App.tsx — thay line 535:
import DOMPurify from 'dompurify';
// ...
<div dangerouslySetInnerHTML={{ 
  __html: DOMPurify.sanitize(activeDoc.getHtml(selectedPackage, method.code)) 
}} />
```

Cấu hình DOMPurify để cho phép các thẻ HTML an toàn trong tài liệu (table, tr, td, p, b, strong, br, span, div) nhưng loại bỏ script, iframe, event handlers.

**Files affected:**
- `app/src/App.tsx` — line 535
- `app/package.json` — thêm dependency `dompurify`

---

### P1-07 — [DONE] Demo data Gói 4: 5 bước phê duyệt cùng ngày thứ Bảy

**Root cause:**  
Dữ liệu mẫu của Gói 4 (MS-2026-VPP04) được tạo vội với toàn bộ các mốc phê duyệt dồn vào ngày 13/06/2026 — một ngày thứ Bảy:

```typescript
// demoData.ts lines 370-374:
dateEvaluate:        '2026-06-13', // Thứ Bảy
dateAppraise:        '2026-06-13', // Thứ Bảy — cùng ngày với đánh giá
dateResultProposal:  '2026-06-13', // Thứ Bảy — cùng ngày
dateResultApprove:   '2026-06-13', // Thứ Bảy — cùng ngày
dateContractSign:    '2026-06-13', // Thứ Bảy — cùng ngày
```

Ngoài ra, `dateDocIssue: 2026-06-10` → `dateBidClose: 2026-06-12` = **2 ngày lịch**, vi phạm thời gian tối thiểu 5 ngày làm việc theo Điều 81 NĐ 214/2025.

**Impact:**  
- Demo data là tài liệu học thuật: bất kỳ cán bộ nào dùng Gói 4 làm mẫu học sẽ tạo ra hồ sơ thật với ngày tháng không thể chấp nhận
- Kiểm toán phân loại 5 văn bản cùng ngày, cùng ngày thứ Bảy là "dấu hiệu hợp thức hóa hồ sơ" (backdated documents)
- Khoảng cách phát hành HSYC → đóng thầu chỉ 2 ngày là vi phạm thời gian tối thiểu → LCNT bị tuyên không hợp lệ

**Recommended fix:**  
Phân bố lại ngày tháng Gói 4 cho hợp lý:
```typescript
dateDocIssue:        '2026-06-09', // Thứ Hai
dateBidClose:        '2026-06-16', // Thứ Hai (7 ngày lịch = 5 ngày làm việc)
dateEvaluate:        '2026-06-18', // Thứ Tư
dateAppraise:        '2026-06-19', // Thứ Năm (ngày làm việc tiếp theo)
dateResultProposal:  '2026-06-22', // Thứ Hai
dateResultApprove:   '2026-06-23', // Thứ Ba
dateContractSign:    '2026-06-24', // Thứ Tư
dateDelivery:        '2026-06-26', // Thứ Sáu
dateAcceptance:      '2026-06-27', // Thứ Bảy (văn phòng phẩm có thể nhận + nghiệm thu cùng ngày)
```

**Files affected:**
- `app/src/demoData.ts` — lines 361–380 (toàn bộ phần ngày tháng Gói 4)

---

### P1-08 — [DONE] Tất cả 4 gói: dateDelivery === dateAcceptance cho hàng hóa phức tạp

**Root cause:**  
Dữ liệu mẫu tất cả 4 gói đều gán cùng ngày cho bàn giao và nghiệm thu. Đây có thể được chấp nhận với văn phòng phẩm (Gói 4), nhưng không thực tế với:
- Gói 1: 20 máy tính + 2 switch + 2 UPS (cần lắp đặt, cài phần mềm, cấu hình mạng)
- Gói 2: Bảo trì 80 điều hòa + thay 6 block + nạp 30kg gas (không thể hoàn thành trong 1 ngày)
- Gói 3: 3 máy chưng cất + thiết bị pH + hóa chất (cần kiểm tra, lắp đặt, chạy thử)

**Impact:**  
- Demo data huấn luyện người dùng dùng ngày bàn giao = ngày nghiệm thu
- Đây là một trong 3 "dấu hiệu đỏ" kiểm toán phát hiện sớm nhất: **"Same-day delivery and acceptance for complex equipment"**
- Với máy tính và thiết bị phòng thí nghiệm, không thể vật lý nhận hàng, unbox, lắp đặt, chạy thử và ký nghiệm thu trong cùng 1 ngày

**Recommended fix:**  
Cập nhật dữ liệu mẫu cho Gói 1, 2, 3 với khoảng cách hợp lý:

| Gói | dateDelivery | dateAcceptance | Lý do khoảng cách |
|---|---|---|---|
| Pkg-1 (20 máy tính) | 2026-05-22 | **2026-05-27** | 5 ngày cài đặt + test |
| Pkg-2 (80 điều hòa) | 2026-06-05 | **2026-06-08** | 3 ngày phục vụ kỹ thuật viên |
| Pkg-3 (thiết bị lab) | 2026-05-06 | **2026-05-13** | 7 ngày lắp đặt + hiệu chỉnh |

**Files affected:**
- `app/src/demoData.ts` — `dateAcceptance` của pkg-1 (line 103), pkg-2 (line 183), pkg-3 (line 274)

---

### P1-09 — [DONE] Thiếu mẫu Tuyên bố không xung đột lợi ích (Cam kết độc lập Tổ CG)

**Root cause:**  
Điều 16 Luật Đấu thầu 22/2023 quy định mỗi thành viên Tổ chuyên gia phải ký "Bản cam kết không có xung đột lợi ích" trước khi thực hiện nhiệm vụ. Bộ 24 văn bản không có mẫu này.

**Impact:**  
- Doc 13 (QĐ thành lập Tổ CG) tồn tại nhưng không có cam kết kèm theo → quyết định pháp lý chưa đầy đủ
- Mọi kết quả đánh giá sau đó (Doc 14) đều thiếu căn cứ về tính độc lập của Tổ CG
- Kiểm toán yêu cầu cam kết này như điều kiện tiên quyết để chấp nhận Báo cáo đánh giá

**Recommended fix:**  
Thêm Doc 25 "Bản cam kết không xung đột lợi ích" vào `documentTemplates` array, với:
- `getCategory()`: `'required'` cho COMPETITIVE_SHOPPING và OPEN_BIDDING; `'recommended'` cho DIRECT_SELECTION_SIMPLIFIED
- Nội dung: 3 phần — (1) lý lịch thành viên, (2) khai báo quan hệ với nhà thầu, (3) cam kết độc lập
- Ký bởi: từng thành viên Tổ CG riêng lẻ (cần mẫu cho tất cả 3 người)
- Có thể làm 1 mẫu với 3 chữ ký trong cùng trang

**Files affected:**
- `app/src/docTemplates.ts` — thêm DocumentConfig mới sau Doc 24 (cuối mảng)
- `app/src/demoData.ts` — không cần thay đổi (dùng các trường `expertTeam*` hiện có)

---

## Phase 2 — High

> Các vấn đề này không tạo ra hồ sơ gian lận ngay lập tức nhưng tạo ra lỗ hổng **pháp lý nghiêm trọng**, **rủi ro kiểm toán cao**, hoặc làm phần mềm **hoạt động sai logic** trong các trường hợp thực tế phổ biến. Phải xử lý trước khi dùng hồ sơ thật.

---

### P2-01 — `validateDateOrder()` chỉ kiểm tra thứ tự, không kiểm tra khoảng cách tối thiểu

**Root cause:**  
Hàm tại `App.tsx:98–126` chỉ so sánh `dates[i].val > dates[i+1].val` (ngày trước không được sau ngày sau). Không có kiểm tra nào về khoảng cách **tối thiểu** giữa các mốc quan trọng.

**Impact:**  
Vi phạm hiện tại trong demo data (Gói 4) không bị phát hiện:
- `dateDocIssue (10/6) → dateBidClose (12/6)` = 2 ngày, yêu cầu ≥5 ngày làm việc (NĐ 214/2025 Điều 81)
- `dateBidClose (12/6) → dateEvaluate (13/6)` = 1 ngày (Thứ Bảy) — không phải ngày làm việc
- Tất cả 5 mốc phê duyệt cùng 1 ngày → 0 ngày khoảng cách

**Recommended fix:**  
Mở rộng `validateDateOrder()` với bảng quy tắc khoảng cách tối thiểu:

```typescript
const minGapRules = [
  { from: 'dateDocIssue', to: 'dateBidClose', minWorkDays: 5, 
    label: 'HSYC → Đóng thầu phải ≥5 ngày làm việc (NĐ 214/2025 Điều 81)' },
  { from: 'dateContractSign', to: 'dateDelivery', minDays: 1,
    label: 'Ký HĐ phải trước ngày bàn giao' },
  { from: 'dateEvaluate', to: 'dateAppraise', minDays: 1,
    label: 'Đánh giá phải trước thẩm định (tối thiểu 1 ngày làm việc)' },
];
```

Hiển thị cảnh báo riêng biệt với màu cam (WARNING) thay vì chỉ đỏ (ERROR) — để phân biệt với lỗi thứ tự.

**Files affected:**
- `app/src/App.tsx` — function `validateDateOrder()`, lines 98–127

---

### P2-02 — Demo data vi phạm Điều 16 Luật ĐT: Tổ thẩm định không độc lập

**Root cause:**  
Trong cả 4 gói mẫu, `appraisalLeader` đều là "Bà Phạm Thị Dung (Trưởng phòng Tài chính - Kế hoạch)". Phòng TC-KH cũng là đơn vị soạn thảo KHLCNT (Doc 10). Cùng một người/phòng vừa lập kế hoạch vừa thẩm định kết quả.

Điều 16 khoản 7 Luật ĐT 22/2023: *"Người tham gia lập hồ sơ yêu cầu, hồ sơ mời thầu, đánh giá hồ sơ đề xuất không được là người thẩm định..."*

**Impact:**  
- Demo data dạy người dùng rằng Phòng TC-KH có thể vừa lập KHLCNT vừa thẩm định kết quả
- Trong thực tế nếu làm theo demo, Báo cáo thẩm định (Doc 15) sẽ bị coi là vi phạm nghiêm trọng
- Mọi QĐ phê duyệt kết quả LCNT dựa trên báo cáo thẩm định không độc lập đều có rủi ro bị tuyên vô hiệu khi khiếu nại

**Recommended fix:**  
Cập nhật demo data để Tổ thẩm định là đơn vị **khác** với đơn vị soạn KHLCNT. Đề xuất: dùng Ban Kiểm soát nội bộ hoặc cử người từ phòng ban không liên quan làm thẩm định.

```typescript
// demoData.ts — tất cả 4 gói:
appraisalLeader: 'Ông Lê Văn Đức (Trưởng Ban Kiểm soát nội bộ - Tổ trưởng)',
appraisalMember: 'Bà Trần Thị Hoa (Chuyên viên Ban KSNB - Thành viên)',
```

Thêm ghi chú trong Doc 13 (QĐ thành lập Tổ CG) rằng Tổ thẩm định phải độc lập với Tổ chuyên gia và đơn vị soạn KHLCNT.

**Files affected:**
- `app/src/demoData.ts` — `appraisalLeader`, `appraisalMember` của tất cả 4 packages (lines ~76–77, ~156–157, ~247–248, ~349–350)

---

### P2-03 — Tuyên bố thẩm quyền "không giới hạn hạn mức" thiếu căn cứ

**Root cause:**  
`App.tsx:483` hiển thị cho mọi gói thầu từ nguồn `autonomy_fund` hoặc `other_revenue`:
```
"Nguồn thu hợp pháp/Quỹ của đơn vị tự chủ nhóm 2: Hiệu trưởng tự quyết định và phê duyệt không giới hạn hạn mức."
```

Không có ngoại lệ, không có điều kiện, không dẫn căn cứ cụ thể.

**Impact:**  
- Tuyên bố này sai về mặt pháp lý: TT 13/2026/TT-BCT và Quy chế chi tiêu nội bộ của trường đều có thể đặt hạn mức
- Nếu người dùng trích dẫn thông báo này để bỏ qua quy trình đấu thầu cho gói lớn, đây là căn cứ sai
- Đặc biệt: gói thầu >5 tỷ từ nguồn tự chủ vẫn cần KHLCNT trình Bộ CT, không phải "Hiệu trưởng tự quyết vô hạn"

**Recommended fix:**  
Thay thế bằng thông báo chính xác theo từng khoảng giá trị:

```typescript
// App.tsx — thay dòng 483
{method.code === 'DIRECT_50' && '≤50M: Hiệu trưởng (CĐT) tự quyết, không cần KHLCNT.'}
{method.code === 'DIRECT_SELECTION_SIMPLIFIED' && '50M–500M: Hiệu trưởng phê duyệt, cần KHLCNT nội bộ.'}
{method.code === 'COMPETITIVE_SHOPPING' && '500M–5B: Hiệu trưởng phê duyệt; KHLCNT trình Bộ CT (theo TT 13/2026).'}
{method.code === 'OPEN_BIDDING' && '>5B: KHLCNT phải trình Bộ CT phê duyệt trước khi tổ chức đấu thầu.'}
```

**Files affected:**
- `app/src/App.tsx` — lines 480–484

---

### P2-04 — Thiếu 4 mẫu văn bản bắt buộc hoặc quan trọng cao

**Root cause:**  
Bộ 24 văn bản không bao gồm các văn bản sau dù chúng bắt buộc theo luật hoặc cần thiết để hồ sơ đầy đủ:

| Tên văn bản | Căn cứ pháp lý | Mức độ |
|---|---|---|
| Phiếu yêu cầu báo giá (RFQ) | NĐ 214/2025 Điều 80 | HIGH |
| Biên bản mở thầu/chào hàng | Điều 30 Luật ĐT 2023 | HIGH |
| Thông báo mời chào hàng | Điều 28 Luật ĐT 2023 | HIGH |
| Thông báo kết quả cho nhà thầu không trúng | Điều 44 Luật ĐT 2023 | MEDIUM |

**Impact:**  
- Hồ sơ thiếu RFQ → không có bằng chứng đã gửi yêu cầu cho 3 nhà cung cấp
- Thiếu biên bản mở thầu → không có bằng chứng thời điểm đóng thầu và số hồ sơ nhận được
- Thiếu thông báo mời → quy trình cạnh tranh chưa được khởi động pháp lý

**Recommended fix:**  
Thêm lần lượt vào `documentTemplates`:
- Doc 25 (hoặc sau 24): Phiếu yêu cầu báo giá — category: 'required' cho mọi phương thức ≥50M
- Doc 26: Thông báo mời chào hàng — category: 'required' cho COMPETITIVE_SHOPPING+
- Doc 27: Biên bản mở thầu — category: 'required' cho COMPETITIVE_SHOPPING+

**Files affected:**
- `app/src/docTemplates.ts` — thêm DocumentConfig mới
- `app/src/demoData.ts` — không cần thay đổi cấu trúc

---

### P2-05 — Brand locking trong specs demo data

**Root cause:**  
Trường `specs` trong demoData chứa tên thương hiệu cụ thể:
- `item-1-1`: "VGA GTX 1650" (tên sản phẩm NVIDIA)
- `item-2-3`: "Lốc nén chính hãng Panasonic"
- `item-3-1`: "sản xuất bởi Merck (Đức) hoặc Sigma-Aldrich"
- `item-3-2`: "tiêu chuẩn AR, Merck (Đức)"
- `item-4-1`: "Giấy in văn phòng Double A" (tên thương hiệu trong tên mặt hàng)
- `item-4-2`: "Bút bi Thiên Long xanh ngòi 0.5mm (Mã sản phẩm TL-027)"

**Impact:**  
- Vi phạm Điều 44 khoản 7 Luật ĐT 2023
- Demo data dạy người dùng viết specs kiểu khóa thương hiệu
- Kiểm toán đọc Doc 7, Doc 8, Doc 9 và thấy bằng chứng hạn chế cạnh tranh

**Recommended fix:**  
Chỉnh sửa `specs` theo hướng mô tả tính năng, không nêu tên thương hiệu:
```typescript
// Thay:
'specs': 'VGA GTX 1650 hoặc tương đương'
// Thành:
'specs': 'Card đồ họa rời VRAM ≥4GB, hiệu năng 3DMark Time Spy ≥3500 điểm hoặc tương đương'

// Thay:
'specs': 'sản xuất bởi Merck (Đức) hoặc Sigma-Aldrich'
// Thành:
'specs': 'Tiêu chuẩn phân tích AR/ACS, độ tinh khiết ≥98%, có Certificate of Analysis (COA) kèm theo'
```

**Files affected:**
- `app/src/demoData.ts` — `specs` field của items: 1-1, 2-3, 3-1, 3-2, 4-1, 4-2

---

### P2-06 — Xuất xứ hàng hóa hardcode "Việt Nam/Châu Á" mâu thuẫn với specs nhập khẩu

**Root cause:**  
Doc 7 (Danh mục hàng hóa) hardcode chuỗi "Việt Nam/Châu Á" cho trường xuất xứ của mọi mặt hàng, trong khi Gói 3 yêu cầu "Merck (Đức)" trong specs.

**Impact:**  
Hai văn bản cùng hồ sơ khai báo xuất xứ mâu thuẫn nhau: Doc 7 nói "Việt Nam/Châu Á", Doc 8 nói "Đức". Khi hàng thật giao từ Đức, đơn vị không có căn cứ để chấp nhận hay từ chối — tranh chấp nghiệm thu có nguy cơ cao.

**Recommended fix:**  
Thêm trường `origin` vào `ProcurementItem` interface, hoặc đơn giản hơn: thay "Việt Nam/Châu Á" bằng "Theo thực tế giao hàng (ghi rõ trong biên bản bàn giao)" trong Doc 7. Không nên hardcode xuất xứ trong HSYC.

**Files affected:**
- `app/src/docTemplates.ts` — Doc 7 `getHtml()` và `getDocx()` (tìm chuỗi "Việt Nam/Châu Á")
- `app/src/demoData.ts` — xem xét thêm trường `origin?: string` vào `ProcurementItem`

---

### P2-07 — KHLCNT hardcode "Quý II/2026" bất kể ngày tháng thực tế

**Root cause:**  
Trong template Doc 10 (Tờ trình KHLCNT) và Doc 11 (QĐ phê duyệt KHLCNT), quý thực hiện được viết cứng thay vì tính từ `pkg.dateKhlcnt`.

**Impact:**  
Nếu người dùng tạo gói thầu trong Quý I, III, hoặc IV, KHLCNT vẫn ghi "Quý II/2026". Hồ sơ mâu thuẫn giữa ngày ký và quý kế hoạch.

**Recommended fix:**  
Thêm hàm tính quý từ ngày:
```typescript
const getQuarter = (dateStr: string): string => {
  const month = new Date(dateStr).getMonth() + 1;
  const q = Math.ceil(month / 3);
  const year = dateStr.slice(0, 4);
  return `Quý ${['I','II','III','IV'][q-1]}/${year}`;
};
// Sử dụng: getQuarter(pkg.dateKhlcnt)
```

**Files affected:**
- `app/src/docTemplates.ts` — Doc 10 và Doc 11 `getHtml()` và `getDocx()`

---

### P2-08 — Thiếu 3 trường ngày tháng trong form UI

**Root cause:**  
`App.tsx` form tab "Mốc thời gian" thiếu input cho `dateDelivery`, `dateLiquidation`, `dateAssetIncrease`. Ba trường này tồn tại trong `ProcurementPackage` interface và được dùng trong Doc 19, 21, 22, nhưng người dùng không thể chỉnh sửa chúng qua giao diện.

**Impact:**  
- Người dùng không biết họ cần điền 3 ngày này
- Phụ thuộc hoàn toàn vào giá trị mặc định từ demo package đã chọn
- Nếu người dùng đổi ngày ký hợp đồng nhưng không thể đổi ngày bàn giao và nghiệm thu → Doc 19, 21 vẫn in ngày từ demo

**Recommended fix:**  
Thêm 3 input `<type="date">` vào form section "Mốc thời gian" với label rõ ràng:
- "Ngày bàn giao hàng hóa" → `dateDelivery`
- "Ngày thanh lý hợp đồng" → `dateLiquidation`
- "Ngày ghi tăng tài sản (kế toán)" → `dateAssetIncrease`

**Files affected:**
- `app/src/App.tsx` — phần form dates (tìm input `dateContractSign`, thêm 3 input sau đó)

---

### P2-09 — Số văn bản dùng ký tự "..." không hợp lệ pháp lý

**Root cause:**  
Hàm `docxHeaderTable()` và tương đương trong HTML tạo số văn bản dạng:
```
.../QĐ-CĐKTCN
.../TTr-TCKH
.../HĐ-CĐKTCN
```

Phần trước dấu "/" là số thứ tự — được để trống hoặc dùng "...".

**Impact:**  
Theo NĐ 30/2020/NĐ-CP về công tác văn thư, văn bản hành chính phải có số và ký hiệu riêng biệt. Văn bản với số "..." không phải là văn bản hành chính hợp lệ. Nếu người dùng tải file và in ngay mà không điền số, toàn bộ hồ sơ vô hiệu về mặt văn thư.

**Recommended fix:**  
**Ngắn hạn:** Thêm trường `documentNumber` vào form và đưa vào template. Thêm cảnh báo nổi bật "⚠ Nhớ điền số văn bản trước khi in" trong giao diện xem trước.

**Dài hạn:** Xem xét thêm bộ đếm số văn bản nội bộ theo năm và loại văn bản (cần backend để lưu trạng thái).

**Files affected:**
- `app/src/demoData.ts` — xem xét thêm trường `documentNumberPrefix?: string`
- `app/src/App.tsx` — thêm cảnh báo trong preview pane
- `app/src/docTemplates.ts` — `docxHeaderTable()` function

---

### P2-10 — VBHN 74/VBHN-VPQH và các luật sửa đổi chưa tích hợp

**Root cause:**  
SKILL.md (mục II) xác nhận văn bản hợp nhất chính thức là "VBHN 74/VBHN-VPQH ngày 25/3/2026" nhưng:
1. File này không có trong thư mục `Legal/`
2. Các luật sửa đổi 116/2025, 133/2025, 142/2025 không được viện dẫn trong bất kỳ document nào

**Impact:**  
Căn cứ pháp lý trong các văn bản phê duyệt và hợp đồng không hoàn chỉnh. Nếu có tranh chấp hoặc khiếu nại, bên phản biện có thể lập luận rằng đơn vị không áp dụng luật mới nhất.

**Recommended fix:**  
1. Bổ sung file VBHN 74/VBHN-VPQH vào `Legal/` folder
2. Cập nhật mảng `basis[]` trong `getProcurementMethod()` để viện dẫn VBHN 74 thay vì chỉ Luật 22/2023:
```typescript
basis: [
  'Văn bản hợp nhất số 74/VBHN-VPQH ngày 25/3/2026 (Luật Đấu thầu 22/2023 sửa đổi bởi Luật 57/2024, 90/2025, 116/2025, 133/2025, 142/2025)',
  // ...
]
```

**Files affected:**
- `app/src/docTemplates.ts` — mảng `basis[]` trong `getProcurementMethod()` (lines 51–88)
- `Legal/` — thêm file VBHN 74

---

### P2-11 — Hợp đồng thiếu 3 điều khoản cơ bản

**Root cause:**  
Doc 18 (Hợp đồng kinh tế) được template hóa ở mức tối thiểu, thiếu các điều khoản bắt buộc theo Điều 62 Luật ĐT 2023:

1. **Điều khoản VAT**: Không ghi rõ giá hợp đồng đã hay chưa bao gồm thuế GTGT 10%
2. **Điều khoản phạt vi phạm**: Không có quy định phạt chậm giao hàng, giao hàng không đúng chất lượng
3. **Điều khoản bảo hành**: Không có cam kết thời hạn bảo hành và trách nhiệm sửa chữa

**Impact:**  
- Thiếu điều khoản VAT → tranh chấp thanh toán khi kho bạc yêu cầu hóa đơn VAT
- Thiếu điều khoản phạt → không có cơ sở pháp lý để phạt nhà thầu vi phạm tiến độ
- Thiếu điều khoản bảo hành → sau khi nghiệm thu, nhà thầu có thể từ chối bảo hành

**Recommended fix:**  
Bổ sung 3 điều khoản vào Doc 18, tối thiểu dạng boilerplate có thể chỉnh sửa:
```
Điều X — Thuế GTGT: Giá hợp đồng [đã/chưa] bao gồm thuế GTGT 10%.
Điều Y — Phạt vi phạm: Chậm giao hàng quá hạn, phạt 0,05% giá trị phần chậm mỗi ngày, tối đa 8%.
Điều Z — Bảo hành: Thời gian bảo hành: [XX] tháng kể từ ngày nghiệm thu.
```

**Files affected:**
- `app/src/docTemplates.ts` — Doc 18 `getHtml()` và `getDocx()`

---

### P2-12 — Kiểu hợp đồng "trọn gói" áp dụng sai cho gói dịch vụ biến động

**Root cause:**  
Mọi gói thầu đều dùng "Hợp đồng trọn gói". Gói 2 (bảo trì điều hòa) bao gồm nạp gas theo kg và thay linh kiện theo thực tế kiểm tra — khối lượng không xác định được trước khi thực hiện.

**Impact:**  
Theo Điều 62 Luật ĐT 2023: "Hợp đồng trọn gói áp dụng khi đã xác định rõ toàn bộ khối lượng công việc." Đối với gói có khối lượng biến động, phải dùng hợp đồng theo đơn giá. Nếu tranh chấp phát sinh về khối lượng thực tế nạp gas hay linh kiện thay thế, hợp đồng không có cơ chế thanh toán phù hợp.

**Recommended fix:**  
Thêm trường `contractType: 'lump_sum' | 'unit_price'` vào `ProcurementPackage`, mặc định là `'lump_sum'`. Template Doc 10, 11, 18 dùng giá trị này. Cập nhật Gói 2 demo thành `'unit_price'`.

**Files affected:**
- `app/src/demoData.ts` — thêm trường `contractType`, Gói 2 đặt `'unit_price'`
- `app/src/docTemplates.ts` — Doc 10, 11, 18 đọc `pkg.contractType`

---

### P2-13 — Không có validation trước khi xuất ZIP

**Root cause:**  
Hàm `handleDownloadAllZip()` trong `App.tsx` tạo và tải ZIP ngay lập tức mà không kiểm tra tính đầy đủ của dữ liệu.

**Impact:**  
Người dùng có thể xuất bộ 24 văn bản với trường quan trọng trống:
- Tên gói thầu trống → tiêu đề văn bản trống
- Tổng giá trị = 0 → quyết định phê duyệt dự toán 0 đồng
- Tên nhà thầu trống → hợp đồng không có đối tác

**Recommended fix:**  
Thêm hàm `validatePackageBeforeExport(pkg)` kiểm tra ít nhất:
- `packageName`, `packageCode` không rỗng
- `items.length > 0` và mỗi item có `name`, `quantity > 0`, `supplier1Price > 0`
- Ít nhất `dateProposal` và `dateContractSign` đã điền
- Ít nhất `supplier1Name` đã điền
Hiển thị danh sách lỗi và yêu cầu xác nhận nếu có warning.

**Files affected:**
- `app/src/App.tsx` — hàm `handleDownloadAllZip()` (khoảng line 139)

---

### P2-14 — Thiếu 5 file văn bản pháp luật trong thư mục Legal/

**Root cause:**  
CLAUDE.md liệt kê 13 văn bản pháp luật theo thứ tự ưu tiên. Thư mục `Legal/` thiếu:

| # | Văn bản | Ghi chú |
|---|---|---|
| 4 | VBHN 74/VBHN-VPQH 25/3/2026 | Văn bản hợp nhất Luật ĐT — quan trọng nhất |
| 7 | TT 80/2025/TT-BTC | Được viện dẫn trong code OPEN_BIDDING nhưng không có file |
| 9 | NĐ 186/2025/NĐ-CP | Trong CLAUDE.md ưu tiên #9 |
| 10 | NĐ 52/2026/NĐ-CP | Trong CLAUDE.md ưu tiên #10 |
| 11 | NĐ 60/2021/NĐ-CP | Trong CLAUDE.md ưu tiên #11 |

**Impact:**  
Khi cán bộ cần tra cứu căn cứ pháp lý khi soạn hồ sơ thật, họ không có tài liệu gốc tham chiếu. Đặc biệt TT 80/2025 đã được viện dẫn trong code nhưng file không có.

**Recommended fix:**  
Thu thập và bổ sung 5 file vào `Legal/`. Tra nguồn chính thức: vbpl.vn, thuvienphapluat.vn.

**Files affected:**
- `Legal/` — thêm 5 file văn bản

---

## Phase 3 — Medium

> Các vấn đề này ảnh hưởng đến **chất lượng kỹ thuật**, **tính đầy đủ của hồ sơ**, hoặc **khả năng bảo trì** nhưng không tạo ra vi phạm pháp lý trực tiếp trong điều kiện sử dụng thông thường.

---

### P3-01 — `handleInfoChange` dùng kiểu `any`

**Root cause:** `App.tsx:32` khai báo `value: any` cho hàm cập nhật form chung.

**Impact:** Mất type safety — TypeScript không cảnh báo khi truyền sai kiểu dữ liệu vào field. Ví dụ: truyền chuỗi vào `budgetYear: number` không bị phát hiện compile-time.

**Recommended fix:**
```typescript
// Thay:
const handleInfoChange = (field: keyof ProcurementPackage, value: any) => {
// Thành:
const handleInfoChange = <K extends keyof ProcurementPackage>(
  field: K, value: ProcurementPackage[K]
) => {
```

**Files affected:** `app/src/App.tsx` — line 32

---

### P3-02 — `totalAmount` tính từ `supplier1Price` thay vì `unitPrice`

**Root cause:** `App.tsx:93` tính tổng dựa trên `supplier1Price`. Khi người dùng nhập `unitPrice` trực tiếp (không qua supplier1Price), hai giá trị có thể lệch, dẫn đến tổng hiển thị khác với tổng trong văn bản.

**Impact:** Giao diện hiển thị tổng giá trị có thể khác tổng trong Doc 2, Doc 4 (tính từ `unitPrice`). Người dùng thấy số không nhất quán.

**Recommended fix:** Thống nhất dùng `unitPrice` làm nguồn sự thật duy nhất, hoặc luôn sync `unitPrice ← supplier1Price` nhất quán.

**Files affected:** `app/src/App.tsx` — line 93

---

### P3-03 — Deep copy bằng `JSON.parse(JSON.stringify(pkg))` không an toàn

**Root cause:** `App.tsx:26` dùng JSON roundtrip để clone object. Kỹ thuật này không clone được: `undefined`, `Date`, `Function`, `RegExp`, circular reference.

**Impact:** Hiện tại chưa gây lỗi vì `ProcurementPackage` chỉ có string/number. Nhưng nếu sau này thêm trường có kiểu phức tạp hơn, bug sẽ xuất hiện im lặng.

**Recommended fix:**
```typescript
// Dùng structuredClone (Node 17+, browser modern):
setSelectedPackage(structuredClone(pkg));
```

**Files affected:** `app/src/App.tsx` — line 26

---

### P3-04 — Không phân loại tài sản cố định, công cụ dụng cụ, vật tư tiêu hao

**Root cause:** Doc 22 (Phiếu ghi tăng tài sản) được đánh dấu "Khuyến nghị" cho mọi gói kể cả Gói 4 (văn phòng phẩm — giấy in, bút bi). Hàng tiêu hao không được ghi tăng tài sản mà hạch toán vào chi phí kỳ.

**Impact:** Nếu kế toán làm theo hệ thống và ghi tăng tài sản cho văn phòng phẩm, đây là sai nguyên tắc kế toán tài sản công — Thông tư 45/2018/TT-BTC quy định ngưỡng tài sản cố định từ 10 triệu VND/đơn vị.

**Recommended fix:**  
Thêm trường `packageType: 'goods_fixed_asset' | 'goods_consumable' | 'service' | 'mixed'` vào `ProcurementPackage`. Doc 22 chỉ mark 'required' nếu `packageType` là `'goods_fixed_asset'` hoặc `'mixed'`.

**Files affected:**
- `app/src/demoData.ts` — thêm trường `packageType`
- `app/src/docTemplates.ts` — Doc 22 `getCategory()` logic

---

### P3-05 — Gói dịch vụ và gói hàng hóa xử lý pháp lý như nhau

**Root cause:** Gói 2 (bảo trì dịch vụ) đi qua cùng workflow với Gói 1, 3, 4 (mua hàng hóa). Luật ĐT 2023 có ngưỡng và quy trình khác nhau cho "gói thầu dịch vụ phi tư vấn" so với "gói thầu mua sắm hàng hóa".

**Impact:** Căn cứ pháp lý viện dẫn trong các văn bản của Gói 2 đang dùng căn cứ của gói hàng hóa, không phải dịch vụ phi tư vấn.

**Recommended fix:** Tận dụng trường `packageType` từ P3-04. Cập nhật `getProcurementMethod()` để trả về `basis[]` phù hợp theo loại gói.

**Files affected:**
- `app/src/docTemplates.ts` — `getProcurementMethod()` và các căn cứ trong Docs 10, 11, 12

---

### P3-06 — `Prompts/`, `examples/`, `tests/`, `docs/roadmap.md` đều là Vite boilerplate

**Root cause:** Các thư mục này được tạo khung nhưng chưa có nội dung thực. Tất cả đều chứa nội dung mặc định từ template Vite.

**Impact:**
- `Prompts/`: AI agent integration hoàn toàn chưa triển khai — 0% tính năng AI của hệ thống
- `examples/`: Không có hồ sơ mẫu thực tế để học; người dùng chỉ có demo data hardcode
- `tests/`: Không có bộ kiểm thử nào → không có cơ chế phát hiện regression khi sửa code
- `docs/roadmap.md`: Không có tầm nhìn phát triển — chỉ có README của Vite

**Recommended fix:**  
Theo thứ tự ưu tiên:
1. `tests/test_unit_numberToWords.test.ts` — unit test cho hàm số→chữ
2. `tests/test_unit_getProcurementMethod.test.ts` — test ngưỡng LCNT
3. `examples/Máy tính để bàn.md` — hồ sơ mẫu hoàn chỉnh với checklist đi kèm
4. `docs/roadmap.md` — kế hoạch phát triển 4 phase
5. `Prompts/` — thiết kế sau khi hoàn thành Phase 1 + 2

**Files affected:** Tất cả file trong `Prompts/`, `examples/`, `tests/`, `docs/roadmap.md`

---

### P3-07 — Doc 3 (Thuyết minh kỹ thuật) dùng nội dung boilerplate

**Root cause:** Doc 3 `getHtml()` và `getDocx()` tạo ra văn bản mô tả mục đích mua sắm với nội dung chung chung, không phân biệt theo loại hàng hóa hay dịch vụ trong gói.

**Impact:** Hồ sơ kỹ thuật không phản ánh đặc thù của gói thầu. Kiểm toán đọc Doc 3 của mọi gói đều thấy cùng một nội dung — dấu hiệu copypaste không phân tích cẩn thận.

**Recommended fix:** Tối thiểu, dùng `packageType` (từ P3-04) để sinh nội dung khác nhau cho hàng hóa và dịch vụ. Tối ưu: thêm trường `technicalJustification: string` vào `ProcurementPackage` và render trong Doc 3.

**Files affected:**
- `app/src/docTemplates.ts` — Doc 3 `getHtml()` và `getDocx()`
- `app/src/demoData.ts` — xem xét thêm trường `technicalJustification`

---

### P3-08 — Không có React Error Boundary

**Root cause:** Ứng dụng React không có error boundary. Nếu bất kỳ `getHtml()` hoặc `getDocx()` nào throw exception (ví dụ: khi items rỗng), toàn bộ app crash trắng màn hình.

**Impact:** Người dùng mất toàn bộ công việc đang làm. Không có thông báo lỗi hữu ích.

**Recommended fix:**
```typescript
// Thêm ErrorBoundary component bọc quanh preview pane và document list
class DocErrorBoundary extends React.Component {
  // render fallback UI khi getHtml/getDocx throw
}
```

**Files affected:** `app/src/App.tsx` — thêm ErrorBoundary, hoặc tạo file mới `app/src/DocErrorBoundary.tsx`

---

### P3-09 — `handleItemChange` liên kết `unitPrice ← supplier1Price` không minh bạch

**Root cause:** `App.tsx:55–56` tự động cập nhật `unitPrice` khi `supplier1Price` thay đổi. Hành vi này không được thông báo cho người dùng và có thể ghi đè giá dự toán gốc họ đã nhập vào `unitPrice`.

**Impact:** Người dùng nhập `unitPrice` là 20.000.000 VND (giá dự toán), sau đó nhập `supplier1Price` là 19.000.000 VND → `unitPrice` tự bị đổi thành 19M. Doc 2 (Dự toán) lúc này hiển thị 19M thay vì 20M ban đầu.

**Recommended fix:** Tách biệt `unitPrice` (giá dự toán phê duyệt) và `supplier1Price` (giá báo giá thực tế). Không tự động overwrite. Thêm chú thích UI giải thích sự khác biệt.

**Files affected:** `app/src/App.tsx` — lines 54–57 (`handleItemChange`)

---

## Phase 4 — Low

> Nợ kỹ thuật dài hạn. Không ảnh hưởng tính pháp lý ngay, nhưng làm khó bảo trì và mở rộng. Xử lý sau khi Phase 1–3 hoàn thành.

---

### P4-01 — `useEffect` import không dùng

**Root cause:** `App.tsx:1` import `useEffect` từ React nhưng không sử dụng trong codebase.

**Recommended fix:** Xóa khỏi import list.

**Files affected:** `app/src/App.tsx` — line 1

---

### P4-02 — `docTemplates.ts` quá lớn (132KB, 2.339 dòng)

**Root cause:** Tất cả 24 DocumentConfig được định nghĩa trong một file duy nhất. Không có tách module.

**Impact:**  
- Khó navigate: tìm doc 18 cần scroll qua 1.700 dòng
- Merge conflict cao khi nhiều người cùng sửa
- Vscode và IDE bị chậm khi mở file

**Recommended fix (incremental):**  
Tách theo nhóm nghiệp vụ:
```
app/src/templates/
  phase1-proposal.ts    // Docs 1-6   (đề xuất + báo giá)
  phase2-plan.ts        // Docs 7-13  (KHLCNT + HSYC + Tổ CG)
  phase3-result.ts      // Docs 14-18 (đánh giá + kết quả + HĐ)
  phase4-close.ts       // Docs 19-24 (bàn giao + nghiệm thu + TS)
  helpers.ts            // Hàm tiện ích dùng chung
  index.ts              // Re-export documentTemplates[]
```

**Files affected:** `app/src/docTemplates.ts` — tách thành 5–6 file theo CLAUDE.md "modularity"

---

### P4-03 — CSS tất cả trong một file `App.css`

**Root cause:** Tất cả CSS của giao diện nằm trong một file.

**Impact:** Khó tìm kiếm style theo component. Dễ tạo ra xung đột selector khi phát triển thêm.

**Recommended fix:** Tách module CSS hoặc dùng CSS-in-JS tương thích với Vite (ví dụ: CSS Modules).

**Files affected:** `app/src/App.css`

---

### P4-04 — Tên trường, văn bản tổ chức hardcoded trong `docTemplates.ts`

**Root cause:** Tên "Trường CĐ Kỹ thuật Công nghiệp", "BỘ CÔNG THƯƠNG", địa chỉ trường, ký hiệu văn thư xuất hiện trực tiếp trong hàng trăm vị trí trong file template.

**Impact:** Nếu hệ thống mở rộng cho đơn vị khác hoặc tên trường thay đổi, phải sửa tại hàng trăm vị trí.

**Recommended fix:**  
Tạo file cấu hình tổ chức:
```typescript
// app/src/config/institution.ts
export const INSTITUTION = {
  name: 'Trường Cao đẳng Kỹ thuật Công nghiệp',
  shortName: 'TRƯỜNG CĐ KỸ THUẬT CÔNG NGHIỆP',
  ministry: 'BỘ CÔNG THƯƠNG',
  code: 'CĐKTCN',
  address: '...',
};
```

**Files affected:** `app/src/docTemplates.ts`, thêm `app/src/config/institution.ts`

---

### P4-05 — `templates/` directory chứa 4 file 0 bytes

**Root cause:** Các file DOCX template trống được tạo như placeholder nhưng không có kế hoạch sử dụng.

**Impact:** Gây nhầm lẫn — developer mới không biết file này dùng để làm gì, hay là bug.

**Recommended fix:** Xóa các file trống hoặc thêm README giải thích mục đích dự kiến của thư mục `templates/`.

**Files affected:** `templates/Hop_dong.docx`, `templates/KHLCNT.docx`, `templates/Nghiem_thu.docx`, `templates/To_trinh.docx`

---

### P4-06 — Không có thông báo lỗi chi tiết khi ZIP export thất bại

**Root cause:** `handleDownloadAllZip()` trong `App.tsx` có `try/catch` nhưng chỉ `console.error` khi lỗi, không hiển thị thông báo cho người dùng.

**Impact:** Nếu một trong 24 document throw exception trong `getDocx()`, người dùng chỉ thấy nút "Đang tạo..." rồi không có gì xảy ra.

**Recommended fix:** Thêm state `exportError: string | null` và hiển thị modal/toast lỗi với tên document bị lỗi.

**Files affected:** `app/src/App.tsx` — hàm `handleDownloadAllZip()`

---

## Bảng tóm tắt

### Phase 1 — Critical (9 mục)

| Mã | Mô tả ngắn | File chính | Độ phức tạp |
|---|---|---|---|
| P1-01 | `numberToWords()` broken | `docTemplates.ts:13` | Cao |
| P1-02 | Ngưỡng CHCT 10B → 5B | `docTemplates.ts:69` | Thấp |
| P1-03 | Doc 6 HTML tên NCC cứng | `docTemplates.ts:776` | Thấp |
| P1-04 | Doc 14-17 Supplier 1 luôn trúng | `docTemplates.ts:~1514` | Trung bình |
| P1-05 | Doc 24 "Đã hoàn thành" hardcode | `docTemplates.ts:2285` | Thấp |
| P1-06 | XSS dangerouslySetInnerHTML | `App.tsx:535` | Thấp |
| P1-07 | Gói 4 demo: 5 bước cùng thứ Bảy | `demoData.ts:370` | Thấp |
| P1-08 | dateDelivery === dateAcceptance | `demoData.ts:103,183,274` | Thấp |
| P1-09 | Thiếu Cam kết không xung đột lợi ích | `docTemplates.ts` (thêm mới) | Trung bình |

### Phase 2 — High (14 mục)

| Mã | Mô tả ngắn | File chính | Độ phức tạp |
|---|---|---|---|
| P2-01 | Không validate khoảng cách ngày tối thiểu | `App.tsx:98` | Trung bình |
| P2-02 | Tổ thẩm định không độc lập (demo) | `demoData.ts:~76` | Thấp |
| P2-03 | Thẩm quyền "không giới hạn" sai | `App.tsx:483` | Thấp |
| P2-04 | Thiếu RFQ, biên bản mở thầu, mời chào hàng | `docTemplates.ts` (thêm mới) | Cao |
| P2-05 | Brand locking trong specs | `demoData.ts` | Thấp |
| P2-06 | Xuất xứ "Việt Nam/Châu Á" mâu thuẫn | `docTemplates.ts` | Thấp |
| P2-07 | KHLCNT hardcode "Quý II/2026" | `docTemplates.ts` | Thấp |
| P2-08 | Thiếu 3 trường ngày trong UI | `App.tsx` | Thấp |
| P2-09 | Số văn bản "..." không hợp lệ | `docTemplates.ts` | Trung bình |
| P2-10 | VBHN 74 và Luật 116/133/142 chưa tích hợp | `docTemplates.ts:51` | Thấp |
| P2-11 | Hợp đồng thiếu VAT, phạt, bảo hành | `docTemplates.ts` Doc 18 | Trung bình |
| P2-12 | Hợp đồng trọn gói sai cho gói dịch vụ | `docTemplates.ts`, `demoData.ts` | Trung bình |
| P2-13 | Không validate trước khi xuất ZIP | `App.tsx:139` | Trung bình |
| P2-14 | Thiếu 5 file trong Legal/ | `Legal/` folder | Thấp |

### Phase 3 — Medium (9 mục)

| Mã | Mô tả ngắn | File chính | Độ phức tạp |
|---|---|---|---|
| P3-01 | `handleInfoChange` dùng `any` | `App.tsx:32` | Thấp |
| P3-02 | `totalAmount` tính từ supplier1Price | `App.tsx:93` | Thấp |
| P3-03 | Deep copy JSON roundtrip không an toàn | `App.tsx:26` | Thấp |
| P3-04 | Không phân loại tài sản/tiêu hao | `docTemplates.ts` Doc 22 | Trung bình |
| P3-05 | Gói dịch vụ xử lý như hàng hóa | `docTemplates.ts`, `demoData.ts` | Trung bình |
| P3-06 | Prompts/examples/tests/roadmap boilerplate | Nhiều file | Cao |
| P3-07 | Doc 3 nội dung boilerplate | `docTemplates.ts` Doc 3 | Thấp |
| P3-08 | Không có React Error Boundary | `App.tsx` | Thấp |
| P3-09 | `handleItemChange` sync unitPrice không minh bạch | `App.tsx:54` | Trung bình |

### Phase 4 — Low (6 mục)

| Mã | Mô tả ngắn | File chính | Độ phức tạp |
|---|---|---|---|
| P4-01 | `useEffect` import không dùng | `App.tsx:1` | Thấp |
| P4-02 | `docTemplates.ts` 132KB quá lớn | `docTemplates.ts` | Cao |
| P4-03 | CSS tất cả trong một file | `App.css` | Cao |
| P4-04 | Tên tổ chức hardcoded | `docTemplates.ts` | Cao |
| P4-05 | `templates/` chứa 4 file 0 bytes | `templates/` | Thấp |
| P4-06 | ZIP export lỗi không thông báo user | `App.tsx` | Thấp |

---

## Thứ tự thực hiện khuyến nghị

```
Tuần 1:   P1-02, P1-03, P1-05, P1-06, P1-07, P1-08   (sửa đơn lẻ, nhanh)
Tuần 2:   P1-01                                         (numberToWords — cần test kỹ)
Tuần 3:   P1-04, P1-09                                  (logic winner + doc mới)
Tuần 4:   P2-02, P2-03, P2-05, P2-06, P2-07, P2-08    (demo data + UI nhỏ)
Tuần 5:   P2-01, P2-13                                  (validation logic)
Tuần 6:   P2-10, P2-11, P2-12                          (pháp lý + hợp đồng)
Tuần 7:   P2-04, P2-09, P2-14                          (tài liệu mới + Legal/)
Tuần 8:   P3-01 → P3-09                                 (code quality)
Tiếp theo: P4-01 → P4-06                                (tech debt)
```

> Không sửa business logic mà chưa cập nhật test case tương ứng.  
> Không merge Phase 2+ nếu Phase 1 chưa hoàn thành.
