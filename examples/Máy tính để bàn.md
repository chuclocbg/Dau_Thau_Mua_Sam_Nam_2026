# Ví dụ: Mua Sắm Máy Tính Để Bàn Phòng Thực Hành

## Loại gói thầu

- **packageType:** `goods_fixed_asset` (tài sản cố định — đơn giá/máy ≥ 10 triệu VND)
- **contractType:** `lump_sum` (giá cố định, số lượng xác định rõ)
- **warrantyMonths:** 24 (bắt buộc tối thiểu 24 tháng đối với thiết bị tin học)

## Thông tin đầu vào mẫu

```
Tên gói thầu: Mua sắm máy tính để bàn phục vụ phòng thực hành [tên khoa/phòng]
Nguồn vốn: Quỹ phát triển hoạt động sự nghiệp
Đơn vị đề xuất: [Phòng Tổ chức Hành chính - Quản trị]
```

## Yêu cầu kỹ thuật mẫu (không khóa thương hiệu)

| Mặt hàng | Thông số tối thiểu | Đơn vị | Số lượng dự kiến |
|---|---|---|---|
| Máy tính để bàn đồng bộ | CPU đa nhân thế hệ mới, RAM tối thiểu 16GB DDR4, SSD tối thiểu 512GB, màn hình 23-24 inch Full HD | Bộ | [điền] |
| Switch Gigabit managed | 24 cổng, băng thông ≥48Gbps, hỗ trợ VLAN và QoS, hàng mới 100% | Cái | [điền] |
| Bộ lưu điện UPS | Công suất ≥1000VA/600W, thời gian lưu điện ≥15 phút ở tải 50%, hàng mới 100% | Cái | [điền] |

> Tất cả hàng hóa mới 100%. Cho phép chào hàng cấu hình tương đương hoặc cao hơn.

## Checklist kiểm toán cho gói goods_fixed_asset

- [ ] Tiêu chí kỹ thuật không ghi tên thương hiệu/nhà sản xuất/xuất xứ
- [ ] Đơn giá từ ít nhất 3 báo giá thị trường thực tế (Biên bản khảo sát giá — Doc 5)
- [ ] Tổng giá trị xác định đúng phương thức LCNT
- [ ] Doc 22 (Phiếu ghi tăng tài sản) được lập sau nghiệm thu
- [ ] Tài sản ghi tăng vào phần mềm MISA trong vòng 30 ngày sau nghiệm thu
- [ ] Bảo hành tối thiểu 24 tháng ghi rõ trong hợp đồng (Doc 18)
- [ ] Trình tự ngày tháng: Đề xuất → Khảo sát → So sánh → KHLCNT → HSYC → Đóng thầu → Đánh giá → Thẩm định → QĐ phê duyệt → Ký HĐ

## Rủi ro kiểm toán thường gặp

[HIGH] Ghi tiêu chí "CPU Intel Core i7 thế hệ 13" → khóa thương hiệu, vi phạm Điều 44 khoản 7 Luật ĐT.

[HIGH] Không ghi tăng tài sản sau nghiệm thu → vi phạm Luật Quản lý, Sử dụng Tài sản Công và NĐ 186/2025.

[MEDIUM] Bảo hành ghi "12 tháng" cho thiết bị máy tính → thấp hơn thông lệ thị trường, kiểm toán có thể đặt câu hỏi về tiêu chuẩn chất lượng.

---

## Kịch bản ví dụ cụ thể

**Mục đích:** Trang bị mới phòng thực hành tin học 30 máy phục vụ dạy học lập trình và kỹ năng văn phòng.

### Bảng dự toán mẫu

| STT | Tên hàng | Thông số tối thiểu | ĐVT | SL | Đơn giá dự toán (VND) | Thành tiền (VND) |
|---|---|---|---|---|---|---|
| 1 | Máy tính để bàn đồng bộ | CPU đa nhân ≥3,5 GHz, RAM 16 GB DDR4, SSD 512 GB, màn hình 23–24 inch Full HD, có tích hợp camera | Bộ | 30 | 14.500.000 | 435.000.000 |
| 2 | Switch Gigabit managed | 24 cổng, băng thông ≥48 Gbps, hỗ trợ VLAN và QoS | Cái | 2 | 5.500.000 | 11.000.000 |
| 3 | Bộ lưu điện UPS | Công suất ≥1.000 VA/600 W, thời gian lưu điện ≥15 phút ở tải 50% | Cái | 6 | 3.200.000 | 19.200.000 |
| 4 | Bàn phím + chuột không dây | Kết nối USB hoặc Bluetooth 5.0 trở lên, pin AA hoặc sạc USB-C | Bộ | 30 | 450.000 | 13.500.000 |
| **Tổng** | | | | | | **478.700.000** |

> ⚠ Các mức giá trên là **ước tính dự toán tham khảo**, không phải báo giá thực. Cơ quan phải thực hiện khảo sát giá thị trường theo quy trình Doc 5 trước khi phê duyệt dự toán.

### Phân tích áp dụng

| Hạng mục | Giá trị / Kết quả |
|---|---|
| Tổng dự toán | 478.700.000 VND |
| Ngưỡng xác định phương thức | ≤ 500.000.000 VND |
| **Phương thức lựa chọn nhà thầu** | **Chỉ định thầu rút gọn** (NĐ 214/2025) |
| packageType | `goods_fixed_asset` (máy tính đơn giá 14,5 triệu/bộ ≥ 10 triệu VND) |
| Ghi tăng tài sản (Doc 22) | **Bắt buộc** — mỗi máy tính ghi tăng riêng với số series |
| Bảo hành tối thiểu | 24 tháng |

> **Lưu ý dự toán tổng gói:** Tổng 478,7 triệu < 500 triệu — thuộc ngưỡng chỉ định thầu rút gọn. Nếu thêm hạng mục hoặc đơn giá thực tế cao hơn dự toán, cần kiểm tra lại phương thức trước khi phê duyệt KHLCNT.

### Trình tự văn bản cần lập (chỉ định thầu rút gọn, goods_fixed_asset)

1. Doc 1 — Tờ trình đề xuất mua sắm
2. Doc 5 — Biên bản khảo sát, so sánh giá thị trường (≥3 báo giá)
3. Doc 6 — Kế hoạch lựa chọn nhà thầu (KHLCNT)
4. Doc 7 — Quyết định phê duyệt KHLCNT
5. Doc 8 — Quyết định thành lập Tổ chuyên gia
6. Doc 9 — Hồ sơ yêu cầu (HSYC)
7. Doc 10 — Quyết định phê duyệt HSYC
8. Doc 13 — Báo cáo đánh giá HSĐX
9. Doc 14 — Báo cáo thẩm định kết quả (Tổ thẩm định độc lập)
10. Doc 15 — Tờ trình đề nghị phê duyệt kết quả LCNT
11. Doc 16 — Quyết định phê duyệt kết quả LCNT
12. Doc 18 — Hợp đồng mua sắm (ghi rõ bảo hành 24 tháng)
13. Doc 19 — Biên bản bàn giao hàng hóa (kèm danh sách serial number)
14. Doc 20 — Biên bản nghiệm thu kỹ thuật (kiểm tra cấu hình thực tế từng máy)
15. Doc 21 — Thanh lý hợp đồng
16. **Doc 22** — Phiếu ghi tăng tài sản (30 phiếu riêng biệt, mỗi máy 1 phiếu)
