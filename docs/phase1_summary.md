# Phase 1 Completion Summary

**Ngày hoàn thành:** 13/06/2026  
**Commit:** `09403e5` — `master` branch  
**Kho lưu trữ:** https://github.com/chuclocbg/Dau_Thau_Mua_Sam_Nam_2026  
**Người thực hiện:** ktapp  
**Đánh giá ban đầu:** Principal Software Architect + Procurement Expert + State Audit Expert

---

## 1. Mục tiêu Phase 1

Phase 1 nhằm loại bỏ các lỗi ở mức **Critical** — những lỗi mà nếu không sửa, phần mềm
sẽ tạo ra hồ sơ vi phạm pháp luật, tự mâu thuẫn nội bộ, hoặc được kiểm toán phân loại là
bằng chứng của hành vi gian lận.

> **Nguyên tắc xuyên suốt:** Audit-first theo CLAUDE.md. Mọi phát hiện được nhìn nhận dưới
> góc độ của Kiểm toán Nhà nước, Thanh tra Bộ Tài chính, và Thanh tra Bộ Công Thương.

---

## 2. Kết quả — 9/9 mục hoàn thành

| Mã | Tên lỗi | Mức rủi ro ban đầu | Trạng thái |
|---|---|---|---|
| P1-01 | `numberToWords()` chỉ xử lý 4 giá trị cứng | CRITICAL | DONE |
| P1-02 | Ngưỡng Chào hàng cạnh tranh sai (10B → 5B) | CRITICAL | DONE |
| P1-03 | Doc 6 HTML hardcode tên nhà cung cấp Gói 1 | CRITICAL | DONE |
| P1-04 | Docs 14–17 luôn chọn Supplier 1 làm nhà thầu trúng | CRITICAL | DONE |
| P1-05 | Doc 24 DOCX hardcode "Đã hoàn thành" chưa thực hiện | CRITICAL | DONE |
| P1-06 | XSS qua `dangerouslySetInnerHTML` không sanitize | CRITICAL | DONE |
| P1-07 | Demo Gói 4: 5 bước phê duyệt cùng ngày thứ Bảy | CRITICAL | DONE |
| P1-08 | Demo Gói 1–3: bàn giao và nghiệm thu cùng ngày | CRITICAL | DONE |
| P1-09 | Thiếu Bản cam kết không xung đột lợi ích (Điều 16 LĐT) | CRITICAL | DONE |

---

## 3. Chi tiết từng mục

### P1-01 — `numberToWords()` — thuật toán đầy đủ

**Vấn đề:** Hàm chỉ có 4 câu `if` hardcode. Mọi giá trị khác 4 giá trị demo trả về chuỗi
placeholder vô nghĩa pháp lý.

**Rủi ro kiểm toán:** Hợp đồng thiếu số tiền bằng chữ hợp lệ → có thể bị tuyên vô hiệu một
phần. Quyết định phê duyệt dự toán với số tiền placeholder → văn bản hành chính không hoàn
chỉnh.

**Giải pháp:** Thay toàn bộ hàm bằng thuật toán đệ quy tiếng Việt chuẩn, xử lý 0–999 tỷ
VND. Các quy tắc đặc biệt được triển khai đầy đủ: mười/mươi, mốt, lăm/năm, linh.

**Căn cứ pháp lý liên quan:** Điều 62 Luật ĐT 22/2023 (nội dung hợp đồng); NĐ 30/2020/NĐ-CP
(hình thức văn bản hành chính).

---

### P1-02 — Ngưỡng CHCT sửa từ 10B thành 5B

**Vấn đề:** Gói 5B–10B bị phân loại sai thành Chào hàng cạnh tranh.

**Rủi ro kiểm toán:** Phương thức sai → toàn bộ quy trình LCNT không hợp lệ. KHLCNT không
được trình Bộ CT phê duyệt → vi phạm thủ tục bắt buộc. Kiểm toán có thể tuyên vô hiệu toàn
bộ quy trình lựa chọn nhà thầu và yêu cầu thu hồi.

**Giải pháp:** Sửa một dòng điều kiện trong `getProcurementMethod()`. Tác động lớn, thay đổi
nhỏ: `10_000_000_000` → `5_000_000_000`.

**Căn cứ pháp lý:** NĐ 214/2025/NĐ-CP Điều 81, khoản 2; SKILL.md mục III.

---

### P1-03 — Doc 6 HTML tên nhà cung cấp động

**Vấn đề:** Tiêu đề cột HTML preview luôn hiển thị "T&T", "Máy tính VN", "Sao Nam".

**Rủi ro kiểm toán:** Người dùng có thể không nhận ra preview sai và ký nhầm; hoặc mất tin
tưởng vào tính chính xác của hệ thống.

**Giải pháp:** Thay 3 chuỗi tĩnh bằng `${pkg.supplier1Name}`, `${pkg.supplier2Name}`,
`${pkg.supplier3Name}` trong HTML renderer.

---

### P1-04 — `getWinnerSupplier()` — nhà thầu trúng theo giá thực tế

**Vấn đề:** Docs 14–17 luôn tuyên bố `pkg.supplier1Name` trúng thầu không qua so sánh.

**Rủi ro kiểm toán [CRITICAL]:** Khi Supplier 2 hoặc 3 có giá thấp hơn:
- Doc 6 (Bảng so sánh) hiển thị S2/S3 rẻ hơn
- Docs 14–17 vẫn tuyên bố S1 trúng "vì giá thấp nhất"
- Mâu thuẫn nội bộ trực tiếp = bằng chứng hành vi thông đồng theo Điều 89 khoản 1 điểm d
  Luật ĐT 22/2023
- Toàn bộ kết quả LCNT có thể bị hủy, kèm xử lý vi phạm hành chính

**Giải pháp:** Thêm hàm `getWinnerSupplier(pkg)` tính tổng giá từng nhà cung cấp và trả về
người thắng. Cập nhật cả `getHtml()` và `getDocx()` của 5 document.

**Căn cứ pháp lý:** Điều 89 Luật ĐT 22/2023 (các hành vi bị cấm trong đấu thầu).

---

### P1-05 — Doc 24 DOCX placeholder ngày đăng tải

**Vấn đề:** Cột "Ngày đăng tải thực tế" in "Đã hoàn thành" ngay khi tạo hồ sơ.

**Rủi ro kiểm toán:** Văn bản đã ký tuyên bố hoàn thành 4 nghĩa vụ đăng tải công khai chưa
thực hiện. Khi đối chiếu với Hệ thống mạng đấu thầu quốc gia, kiểm toán thấy mâu thuẫn →
khai báo sai sự thật. Vi phạm Điều 12 Luật ĐT 22/2023 và TT 79/2025/TT-BTC.

**Giải pháp:** Thay "Đã hoàn thành" bằng "Ngày ..... tháng ..... năm ....." để cán bộ điền
sau khi thực hiện.

---

### P1-06 — DOMPurify chặn XSS

**Vấn đề:** `dangerouslySetInnerHTML` render HTML thô từ `getHtml()` không qua lọc.

**Rủi ro bảo mật:** Trên môi trường chia sẻ nội mạng, payload XSS trong tên nhà thầu có thể
được thực thi trong trình duyệt của người dùng khác.

**Giải pháp:** Cài `dompurify@3.4.10`. Wrap mọi `getHtml()` call với `DOMPurify.sanitize()`
trước khi truyền vào `dangerouslySetInnerHTML.__html`.

---

### P1-07 — Demo Gói 4 ngày phân bổ hợp lý

**Vấn đề:** 5 bước phê duyệt cùng 2026-06-13 (thứ Bảy). HSYC→đóng thầu chỉ 2 ngày.

**Rủi ro kiểm toán:** "Same-day multiple approvals on Saturday" là dấu hiệu đỏ kiểm toán phân
loại là "hồ sơ hợp thức hóa hậu kỳ" (backdated documents). Vi phạm thời gian tối thiểu NĐ
214/2025 Điều 81.

**Giải pháp:** Phân bổ lại 10 mốc thời gian qua 16 ngày làm việc thực tế (09/06–26/06/2026).

---

### P1-08 — Khoảng cách bàn giao–nghiệm thu cho hàng hóa phức tạp

**Vấn đề:** Gói 1, 2, 3 có `dateDelivery === dateAcceptance`.

**Rủi ro kiểm toán:** "Same-day delivery and acceptance for complex equipment" là một trong ba
dấu hiệu đỏ kiểm toán phát hiện sớm nhất. Về mặt vật lý không thể nhận 20 máy tính, lắp đặt,
cài hệ điều hành, cấu hình mạng và ký nghiệm thu trong cùng một ngày.

**Giải pháp:** Thêm khoảng cách thực tế: Gói 1 (+5 ngày), Gói 2 (+3 ngày), Gói 3 (+7 ngày).

---

### P1-09 — Doc 25 Bản cam kết không xung đột lợi ích

**Vấn đề:** Bộ 24 văn bản thiếu cam kết độc lập bắt buộc của Tổ chuyên gia.

**Rủi ro kiểm toán:** Doc 13 (QĐ thành lập Tổ CG) tồn tại nhưng không có cam kết đi kèm →
quyết định pháp lý chưa đầy đủ. Toàn bộ kết quả đánh giá (Doc 14) thiếu căn cứ về tính độc
lập. Kiểm toán coi đây là điều kiện tiên quyết để chấp nhận Báo cáo đánh giá.

**Giải pháp:** Thêm Doc 25 với đầy đủ nội dung pháp lý, ba thành viên Tổ CG, ba nhà thầu,
năm điều khoản cam kết, hai hàng chữ ký.

**Căn cứ pháp lý:** Điều 16 Luật ĐT 22/2023/QH15 (bảo đảm cạnh tranh trong đấu thầu);
NĐ 214/2025/NĐ-CP.

---

## 4. Bộ kiểm thử được thiết lập

### 4.1 Cơ sở hạ tầng kiểm thử

| Thành phần | Chi tiết |
|---|---|
| Framework | Vitest 4.1.8 |
| Môi trường DOM | jsdom 29.1.1 |
| Coverage | @vitest/coverage-v8 |
| Câu lệnh | `npm test` / `npm run test:coverage` |
| Thư mục | `app/src/__tests__/` |

### 4.2 Kết quả

**162 tests — 0 failed — 0 skipped**

| File | Loại | Số test | Phase |
|---|---|---|---|
| `numberToWords.test.ts` | Unit | 27 | P1-01 |
| `procurement-method.test.ts` | Unit | 22 | P1-02 |
| `winner-supplier.test.ts` | Unit | 13 | P1-04 |
| `doc6.integration.test.ts` | Integration | 9 | P1-03 |
| `docs14-17.integration.test.ts` | Integration | 21 | P1-04 |
| `doc24.integration.test.ts` | Integration | 9 | P1-05 |
| `doc25.integration.test.ts` | Integration | 19 | P1-09 |
| `sanitization.test.ts` | Security | 22 | P1-06 |
| `demo-data.regression.test.ts` | Regression | 20 | P1-07/08 |

### 4.3 Phương pháp kiểm thử đặc biệt

- **DOCX XML inspection:** `Packer.toBuffer()` + JSZip để mở và đọc `word/document.xml`
  bên trong file `.docx` — xác minh nội dung thực tế, không chỉ kiểm tra buffer tồn tại.
- **XSS test:** `pkgXss` fixture có payload trong `packageName`, `supplier1Name`,
  `supplier2Name`, `supplier3Name`. Kiểm tra DOMPurify loại bỏ `<script>` và `onerror`.
- **Regression boundary:** Test ngưỡng 5,000,000,000 và 5,000,000,001 để đảm bảo P1-02
  không bị phục hồi.
- **Date gap regression:** Demo data ngày tháng được kiểm tra tự động để phát hiện nếu
  P1-07/P1-08 bị vô tình đảo ngược trong các lần sửa sau.

### 4.4 Lỗi kiểm thử đã giải quyết (6 lỗi)

Sáu lỗi kiểm thử đã được tìm ra và sửa trong quá trình phát triển. **Tất cả đều là lỗi
trong test case, không phải lỗi trong mã ứng dụng.** Không có thay đổi nào được thực hiện
với mã ứng dụng để "ép" test pass.

| # | Vấn đề | Nguyên nhân | Sửa test |
|---|---|---|---|
| 1 | `numberToWords`: "linh lăm" sai | Quy tắc "lăm" không áp dụng sau "linh" | Sửa kỳ vọng → "linh năm" |
| 2–3 | `doc6`: regex kết luận dừng sớm | `/Kết luận:[^<]*/` dừng tại `</b>` | Đổi sang `slice(indexOf(...))` |
| 4 | `docs14-17`: Doc 17 kiểm tra giá trị tầm thường | `unitPrice === supplier2Price` → budget = winner total | Đổi `unitPrice` thành 1,100,000 |
| 5–6 | `sanitization`: `alert(` trong output | Text content "javascript:alert(1)" không phải XSS | Sửa assertion → kiểm tra `<script>` và `onerror` |

---

## 5. Phân tích rủi ro kiểm toán — trước và sau Phase 1

| Rủi ro | Mức trước P1 | Mức sau P1 |
|---|---|---|
| Hợp đồng thiếu giá trị bằng chữ | CRITICAL | Đã xử lý |
| Phân loại sai phương thức (5B–10B) | CRITICAL | Đã xử lý |
| Bảng so sánh mâu thuẫn kết quả phê duyệt | CRITICAL | Đã xử lý |
| Khai báo hoàn thành đăng tải chưa thực hiện | CRITICAL | Đã xử lý |
| Thiếu cam kết độc lập Tổ chuyên gia | CRITICAL | Đã xử lý |
| Dữ liệu mẫu có dấu hiệu backdating | CRITICAL | Đã xử lý |
| XSS trong môi trường chia sẻ | HIGH | Đã xử lý |
| 14 vấn đề High (Phase 2) | HIGH | Chưa xử lý |
| 9 vấn đề Medium (Phase 3) | MEDIUM | Chưa xử lý |
| 6 vấn đề Low (Phase 4) | LOW | Chưa xử lý |

---

## 6. Nguyên tắc áp dụng xuyên suốt Phase 1

Theo CLAUDE.md:

- **Không viết lại toàn bộ.** Mọi thay đổi là sửa tăng dần, cô lập tại từng điểm.
- **Không thay đổi business logic mà không giải thích.** Từng mục có mô tả rõ ràng.
- **Không tạo vi phạm pháp luật mới.** Mọi giải pháp đều được đối chiếu với văn bản pháp
  luật trong thứ tự ưu tiên CLAUDE.md.
- **Audit-first.** Tiêu chí chính để đánh giá mức độ nghiêm trọng là liệu kiểm toán có thể
  đọc hồ sơ và phân loại thành vi phạm hay không.
- **Không fabricate.** Không tạo ra số văn bản giả, trích dẫn pháp lý giả, hoặc số liệu giả.

---

## 7. Phạm vi không thay đổi trong Phase 1

- Giao diện người dùng — không thay đổi
- Cấu trúc 24 văn bản gốc — không thay đổi (chỉ thêm Doc 25)
- Logic phân loại `getCategory()` của Docs 1–24 — không thay đổi
- Workflow nhập liệu và xuất ZIP — không thay đổi
- Các trường dữ liệu `ProcurementPackage` — không thay đổi
- Phần nghiệp vụ Phase 2, 3, 4 — chưa chạm đến

---

## 8. Trạng thái tại thời điểm hoàn thành

| Hạng mục | Trạng thái |
|---|---|
| Tất cả 9 mục Phase 1 | Hoàn thành |
| Bộ kiểm thử 162 tests | Pass 100% |
| `docs/refactoring_plan.md` | Cập nhật [DONE] cho tất cả P1-01 → P1-09 |
| Commit lên GitHub | `09403e5` trên `master` |
| Phase 2 (14 mục High) | Chưa bắt đầu |

---

## 9. Bước tiếp theo — Phase 2

Xem `docs/refactoring_plan.md` — mục "Phase 2 — High" để biết 14 vấn đề cần xử lý tiếp theo.

Thứ tự ưu tiên trong Phase 2:
1. P2-02 — Sửa Tổ thẩm định demo data cho độc lập với Tổ chuyên gia (Điều 16 khoản 7)
2. P2-03 — Sửa thông báo thẩm quyền "không giới hạn" theo từng ngưỡng
3. P2-05 — Sửa brand locking trong thông số kỹ thuật demo
4. P2-07 — Sửa quý hardcode trong KHLCNT
5. P2-01 — Thêm validation khoảng cách ngày tối thiểu (NĐ 214/2025 Điều 81)
