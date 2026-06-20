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
