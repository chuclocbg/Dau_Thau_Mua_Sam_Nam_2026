# Ví dụ: Mua Sắm Thiết Bị Thực Hành Ngành Cơ Khí

## Loại gói thầu

- **packageType:** `goods_fixed_asset` (máy móc, thiết bị công nghiệp — đơn giá thường >> 10M)
- **contractType:** `lump_sum` (thiết bị đặt hàng theo thông số cố định)
- **warrantyMonths:** 12–24 (tùy loại thiết bị — ghi rõ trong HSYC)

> **Lưu ý đặc thù:** Thiết bị cơ khí thường có thông số kỹ thuật phức tạp. Nguy cơ cao nhất là đặc tả quá chi tiết theo một model cụ thể (khóa thương hiệu). Cần đặc tả bằng thông số chức năng, công suất, dung sai.

## Thông tin đầu vào mẫu

```
Tên gói thầu: Mua sắm thiết bị thực hành [tên ngành/xưởng]
Nguồn vốn: [Quỹ phát triển HDSN / Dự án đầu tư]
Đơn vị đề xuất: [Khoa Cơ khí / Phòng Tổ chức Hành chính - Quản trị]
```

## Yêu cầu kỹ thuật mẫu

| Mặt hàng | Thông số tối thiểu | Đơn vị | Số lượng |
|---|---|---|---|
| Máy tiện CNC | Đường kính gia công tối thiểu 300mm, chiều dài gia công ≥500mm, điều khiển CNC 2 trục, công suất động cơ chính ≥5,5 kW, hàng mới 100% | Cái | [điền] |
| Máy phay CNC | Hành trình X≥500mm, Y≥300mm, Z≥300mm, trục chính tốc độ ≥6000 vòng/phút, điều khiển 3 trục, hàng mới 100% | Cái | [điền] |
| Bộ dụng cụ đo kiểm | Bao gồm: thước kẹp ±0,02mm, panme ngoài 0-25mm, đồng hồ so 0,01mm, hàng mới 100% | Bộ | [điền] |

> Cho phép chào hàng cấu hình tương đương hoặc cao hơn. Kèm theo tài liệu kỹ thuật, phiếu bảo hành, hướng dẫn sử dụng tiếng Việt hoặc tiếng Anh.

## Điểm đặc biệt so với gói tin học

1. **Nguồn gốc hàng hóa:** Cho phép ghi "hàng mới 100%" mà KHÔNG ghi xuất xứ bắt buộc — nhà thầu khai báo xuất xứ thực tế khi giao hàng.
2. **Nghiệm thu kỹ thuật (Doc 20):** Yêu cầu chạy thử, kiểm tra công suất và độ chính xác trước khi ký nghiệm thu.
3. **Phiếu ghi tăng tài sản (Doc 22):** Bắt buộc sau nghiệm thu. Ghi rõ: tên tài sản, số series, giá trị ghi sổ, vị trí lắp đặt.

## Checklist kiểm toán

- [ ] Tiêu chí không ghi tên hãng (VD: không được ghi "Mazak", "Fanuc", "Okuma")
- [ ] Tiêu chí dùng thông số đo lường định lượng (mm, kW, vòng/phút)
- [ ] Tổ chuyên gia có ít nhất 1 thành viên chuyên ngành cơ khí?
- [ ] Biên bản nghiệm thu ghi kết quả đo kiểm thực tế (không chỉ ghi "đạt yêu cầu")
- [ ] Ghi tăng tài sản đúng giá trị hợp đồng (không trừ VAT nếu đơn vị không được khấu trừ)

## Rủi ro kiểm toán thường gặp

[CRITICAL] Tiêu chí ghi "máy tiện CNC Model ST-20 của Mazak" → khóa thương hiệu tuyệt đối, vi phạm Điều 44 khoản 7 Luật ĐT 2023, có thể hủy kết quả lựa chọn nhà thầu.

[HIGH] Nghiệm thu không có biên bản kiểm tra thông số kỹ thuật thực tế → kiểm toán đánh giá nghiệm thu hình thức, rủi ro không thu hồi được tài sản không đạt chất lượng.

[MEDIUM] Không ghi serial number trong biên bản bàn giao và phiếu ghi tăng tài sản → không truy vết được tài sản khi kiểm kê.

---

## Kịch bản ví dụ cụ thể

**Mục đích:** Bổ sung thiết bị thực hành cho xưởng cơ khí chế tạo phục vụ đào tạo trình độ cao đẳng ngành Cắt gọt kim loại.

### Bảng dự toán mẫu

| STT | Tên hàng | Thông số tối thiểu | ĐVT | SL | Đơn giá dự toán (VND) | Thành tiền (VND) |
|---|---|---|---|---|---|---|
| 1 | Máy tiện CNC | Đường kính gia công ≥300 mm, chiều dài gia công ≥500 mm, điều khiển CNC 2 trục, công suất động cơ chính ≥5,5 kW, độ chính xác định vị ≤0,01 mm, hàng mới 100% | Cái | 2 | 320.000.000 | 640.000.000 |
| 2 | Máy phay CNC | Hành trình X≥500 mm, Y≥300 mm, Z≥300 mm, tốc độ trục chính ≥6.000 vòng/phút, điều khiển 3 trục, công suất ≥7,5 kW, hàng mới 100% | Cái | 1 | 480.000.000 | 480.000.000 |
| 3 | Bộ dụng cụ đo kiểm cơ khí | Thước kẹp điện tử ±0,02 mm (dải 0–150 mm), panme ngoài 0–25 mm ±0,001 mm, đồng hồ so 0,01 mm (dải 0–10 mm), hàng mới 100% | Bộ | 10 | 4.500.000 | 45.000.000 |
| 4 | Bàn máy + bệ lắp đặt thiết bị | Bề mặt gang xám, tải trọng ≥2.000 kg/m², cấp phẳng ≤0,05 mm/m | Cái | 3 | 18.000.000 | 54.000.000 |
| **Tổng** | | | | | | **1.219.000.000** |

> ⚠ Các mức giá trên là **ước tính dự toán tham khảo**, không phải báo giá thực. Cơ quan phải thực hiện khảo sát giá thị trường theo quy trình Doc 5 trước khi phê duyệt dự toán. Giá thiết bị CNC biến động lớn theo xuất xứ thực tế.

### Phân tích áp dụng

| Hạng mục | Giá trị / Kết quả |
|---|---|
| Tổng dự toán | 1.219.000.000 VND |
| Ngưỡng phương thức | > 500.000.000 VND và ≤ 5.000.000.000 VND |
| **Phương thức lựa chọn nhà thầu** | **Chào hàng cạnh tranh** (NĐ 214/2025) |
| packageType | `goods_fixed_asset` (đơn giá toàn bộ hạng mục >> 10 triệu VND) |
| Ghi tăng tài sản (Doc 22) | **Bắt buộc** — ghi tăng từng máy với số series, vị trí lắp đặt cụ thể |
| Bảo hành tối thiểu | 12 tháng (ghi riêng từng thiết bị trong HSYC) |
| Tổ chuyên gia | Cần ít nhất 1 thành viên chuyên ngành cơ khí/chế tạo máy |

### Yêu cầu nghiệm thu kỹ thuật (Doc 20) — đặc thù thiết bị cơ khí

Biên bản nghiệm thu phải ghi kết quả kiểm tra thực tế, không chỉ ghi "đạt yêu cầu":

| Thông số | Máy tiện CNC | Máy phay CNC |
|---|---|---|
| Đường kính / hành trình thực đo | ……… mm | X: ……… mm, Y: ……… mm, Z: ……… mm |
| Tốc độ trục chính | ……… vòng/phút | ……… vòng/phút |
| Công suất thực đo | ……… kW | ……… kW |
| Độ chính xác định vị | ……… mm | ……… mm |
| Chạy thử không tải (30 phút) | Đạt / Không đạt | Đạt / Không đạt |
| Số serial | ……… | ……… |
| Năm sản xuất | ……… | ……… |

### Trình tự văn bản cần lập (chào hàng cạnh tranh)

1. Doc 1 — Tờ trình đề xuất mua sắm
2. Doc 5 — Biên bản khảo sát giá thị trường (≥3 báo giá)
3. Doc 6 — Kế hoạch lựa chọn nhà thầu (KHLCNT)
4. Doc 7 — Quyết định phê duyệt KHLCNT
5. Doc 8 — Quyết định thành lập Tổ chuyên gia (yêu cầu thành viên chuyên ngành cơ khí)
6. Doc 9/Doc 11 — Hồ sơ mời thầu (HSMT) — áp dụng chào hàng cạnh tranh
7. Doc 10 — Quyết định phê duyệt HSMT
8. Doc 12 — Thông báo mời chào hàng (đăng tải theo quy định)
9. Doc 13 — Báo cáo đánh giá hồ sơ đề xuất / hồ sơ dự thầu
10. Doc 14 — Báo cáo thẩm định kết quả LCNT
11. Doc 15 — Tờ trình đề nghị phê duyệt kết quả LCNT
12. Doc 16 — Quyết định phê duyệt kết quả LCNT
13. Doc 18 — Hợp đồng mua sắm (ghi serial number nếu biết trước, bảo hành rõ ràng)
14. Doc 19 — Biên bản bàn giao hàng hóa (kèm tài liệu kỹ thuật, phiếu bảo hành)
15. Doc 20 — Biên bản nghiệm thu kỹ thuật (đo kiểm thông số thực tế từng thiết bị)
16. Doc 21 — Thanh lý hợp đồng
17. **Doc 22** — Phiếu ghi tăng tài sản (3 phiếu: 2 máy tiện + 1 máy phay, ghi số serial và vị trí xưởng)
