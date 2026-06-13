# Release Notes — Phiên bản 1.1.0

**Ngày phát hành:** 13/06/2026  
**Loại:** Bản vá lỗi nghiêm trọng (Critical patch)  
**Phạm vi:** Phase 1 — 9 lỗi ở mức Critical  
**Tính tương thích ngược:** Đầy đủ — giao diện không thay đổi

---

## Tóm tắt cho người dùng

Phiên bản này sửa 9 lỗi nghiêm trọng có thể dẫn đến hồ sơ vi phạm pháp luật, mâu thuẫn nội
bộ, hoặc bị kiểm toán phân loại là hành vi gian lận. **Không có thay đổi nào về giao diện.**
Tất cả nút bấm, tab, form nhập liệu và thứ tự bố cục giữ nguyên.

> Nếu bạn đã tạo hồ sơ bằng phiên bản 1.0.0, hãy tạo lại bộ văn bản bằng phiên bản này
> trước khi ký và lưu trữ.

---

## 1. Số tiền bằng chữ hoạt động đúng với mọi giá trị

**Trước:** Hàm chuyển số sang chữ chỉ biết 4 giá trị cứng. Bất kỳ gói thầu nào có giá trị
ngoài 4 giá trị đó (80 triệu, 45 triệu, 320 triệu, 650 triệu) đều in ra chuỗi vô nghĩa.

**Sau:** Thuật toán tiếng Việt đầy đủ, xử lý chính xác mọi giá trị từ 0 đến 999 tỷ đồng,
bao gồm các trường hợp đặc biệt: "linh", "mươi"/"mười", "mốt", "lăm"/"năm".

**Ảnh hưởng trước khi sửa:** Tờ trình đề xuất (Doc 1), Quyết định phê duyệt dự toán (Doc 4),
Hợp đồng (Doc 18), Biên bản thanh lý (Doc 21) có số tiền bằng chữ không hợp lệ — tài liệu
có thể bị tuyên vô hiệu khi tranh chấp.

---

## 2. Phương thức lựa chọn nhà thầu xác định đúng ngưỡng

**Trước:** Gói thầu từ 5 tỷ đến 10 tỷ VND bị phân loại sai thành "Chào hàng cạnh tranh"
thay vì "Đấu thầu rộng rãi".

**Sau:** Ngưỡng được sửa đúng theo NĐ 214/2025/NĐ-CP:
- ≤ 50 triệu: Mua sắm trực tiếp dưới 50 triệu
- 50 triệu – 500 triệu: Chỉ định thầu rút gọn
- 500 triệu – 5 tỷ: Chào hàng cạnh tranh
- > 5 tỷ: **Đấu thầu rộng rãi** *(ngưỡng này đã bị sai trong phiên bản trước)*

**Ảnh hưởng trước khi sửa:** Toàn bộ bộ văn bản cho gói 5–10 tỷ áp dụng sai căn cứ pháp lý,
sai quy trình. KHLCNT không được trình Bộ Công Thương phê duyệt theo yêu cầu bắt buộc.

---

## 3. Nhà thầu trúng thầu được xác định dựa trên giá thực tế

**Trước:** Các văn bản đánh giá và phê duyệt kết quả (Docs 14, 15, 16, 17) luôn tuyên bố nhà
cung cấp thứ nhất trúng thầu, bất kể giá báo của nhà cung cấp thứ hai hay thứ ba có thấp hơn.

**Sau:** Hệ thống so sánh tổng giá của cả ba nhà cung cấp và chọn người có giá thấp nhất. Kết
quả được phản ánh nhất quán trên tất cả 5 văn bản liên quan (Docs 6, 14, 15, 16, 17).

**Ảnh hưởng trước khi sửa:** Nếu nhà cung cấp thứ hai hoặc thứ ba có giá thấp hơn, Bảng so
sánh (Doc 6) hiển thị họ rẻ hơn nhưng các văn bản phê duyệt vẫn tuyên bố nhà cung cấp thứ
nhất trúng — đây là mâu thuẫn nội bộ trực tiếp, bằng chứng của hành vi thông đồng theo Điều
89 Luật Đấu thầu 22/2023.

---

## 4. Xem trước tên nhà cung cấp trong bảng so sánh báo giá

**Trước:** Tiêu đề cột trong bảng HTML xem trước của Doc 6 luôn hiển thị "T&T", "Máy tính VN",
"Sao Nam" — tên rút gọn của nhà cung cấp demo Gói 1 — bất kể bạn đang xem gói nào.

**Sau:** Tiêu đề cột hiển thị đúng tên nhà cung cấp của gói thầu đang được chọn.

---

## 5. Bảng theo dõi đăng tải thông tin không còn khai báo "Đã hoàn thành"

**Trước:** Doc 24 (Bảng theo dõi đăng tải) in "Đã hoàn thành" cho cả 4 nghĩa vụ đăng tải
công khai ngay khi tạo hồ sơ, trước khi bất kỳ hoạt động đăng tải nào diễn ra.

**Sau:** Cột ngày đăng tải thực tế hiển thị "Ngày ..... tháng ..... năm ....." — ô trống để
cán bộ phụ trách điền sau khi thực hiện từng nghĩa vụ.

**Ảnh hưởng trước khi sửa:** Văn bản đã ký tuyên bố hoàn thành nghĩa vụ đăng tải mà trên
thực tế chưa đăng. Khi kiểm toán tra soát hệ thống mạng đấu thầu quốc gia, họ sẽ thấy mâu
thuẫn trực tiếp với văn bản — có thể bị xử lý như khai báo gian lận.

---

## 6. Thêm mẫu Bản cam kết không xung đột lợi ích (Doc 25)

**Trước:** Bộ hồ sơ thiếu bản cam kết độc lập bắt buộc của Tổ chuyên gia theo Điều 16 Luật
Đấu thầu 22/2023/QH15.

**Sau:** Doc 25 "Bản cam kết không xung đột lợi ích" được thêm vào, bao gồm:
- Danh sách đầy đủ ba thành viên Tổ chuyên gia
- Tên ba nhà thầu tham dự
- Năm điều khoản cam kết về tính độc lập
- Chữ ký của Tổ trưởng và cả hai thành viên
- Áp dụng: Bắt buộc cho Chào hàng cạnh tranh và Đấu thầu rộng rãi; Khuyến nghị cho Chỉ định
  thầu rút gọn; Không áp dụng cho gói dưới 50 triệu.

---

## 7. Dữ liệu mẫu phản ánh quy trình hợp lệ

**Gói 4 (Văn phòng phẩm) — trước:** 5 bước phê duyệt được đặt cùng ngày thứ Bảy 13/06/2026.
Khoảng cách từ phát hành HSYC đến đóng thầu chỉ 2 ngày.  
**Sau:** Các mốc phân bổ thực tế qua 16 ngày (09/06 → 24/06), tuân thủ thời gian tối thiểu.

**Gói 1, 2, 3 — trước:** Ngày bàn giao bằng ngày nghiệm thu cho máy tính, điều hòa và thiết
bị phòng thí nghiệm.  
**Sau:** Khoảng cách thực tế:
- Gói 1 (20 máy tính): 5 ngày để cài đặt và kiểm tra
- Gói 2 (80 điều hòa): 3 ngày để kỹ thuật viên kiểm tra
- Gói 3 (thiết bị phòng thí nghiệm): 7 ngày để lắp đặt và hiệu chỉnh

---

## 8. Bảo mật — Ngăn chặn XSS trong xem trước văn bản

**Vấn đề:** Khung xem trước văn bản hiển thị HTML thô từ các template mà không qua lọc. Nếu
tên nhà thầu hoặc tên gói thầu chứa mã độc (ví dụ: `<script>alert(1)</script>`), mã đó sẽ
được thực thi trong trình duyệt.

**Sửa:** Thư viện DOMPurify được thêm vào. Toàn bộ nội dung HTML xem trước đều đi qua
`DOMPurify.sanitize()` trước khi hiển thị. Thẻ script và thuộc tính event handler bị loại bỏ;
nội dung văn bản hợp lệ được giữ nguyên.

---

## Không có thay đổi nào trong phiên bản này

- Giao diện người dùng
- Thứ tự và số lượng văn bản (ngoại trừ thêm Doc 25)
- Trường dữ liệu nhập liệu
- Định dạng file DOCX xuất ra
- Logic phân loại và gắn nhãn danh mục văn bản

---

## Hướng dẫn cập nhật

Đây là ứng dụng web tĩnh (React SPA), không cần cài đặt backend.

```bash
cd app
npm install           # cài DOMPurify và các dependency mới
npm run build         # build lại ứng dụng
```

Nếu chạy từ mã nguồn (development):
```bash
cd app
npm install
npm run dev
```

---

## Phiên bản tiếp theo

Phase 2 sẽ xử lý 14 vấn đề ở mức High, bao gồm:
- Validation khoảng cách ngày tối thiểu (NĐ 214/2025 Điều 81)
- Sửa thẩm quyền phê duyệt theo từng ngưỡng giá
- Thêm Phiếu yêu cầu báo giá (RFQ), Biên bản mở thầu, Thông báo mời chào hàng
- Bổ sung 3 điều khoản bắt buộc vào Hợp đồng (VAT, phạt vi phạm, bảo hành)
- Sửa brand locking trong thông số kỹ thuật demo

Xem `docs/refactoring_plan.md` để biết chi tiết.
