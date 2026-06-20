# Ví dụ: Mua Sắm Bàn Ghế Văn Phòng

## Loại gói thầu

- **packageType:** `goods_fixed_asset` (bàn ghế có đơn giá/bộ ≥ 10 triệu VND) hoặc
  `goods_consumable` (nếu đơn giá < 10 triệu VND/bộ — hạch toán vào chi phí, không ghi tăng tài sản)
- **contractType:** `lump_sum`
- **warrantyMonths:** 12 (tiêu chuẩn cho đồ gỗ/nội thất văn phòng)

> **Phân loại quan trọng:** TT 45/2018/TT-BTC quy định tài sản cố định ≥ 10 triệu VND/đơn vị và thời gian sử dụng ≥ 1 năm. Bàn ghế rẻ tiền (<10M/bộ) KHÔNG ghi tăng tài sản cố định mà hạch toán vào chi phí ngay.

## Thông tin đầu vào mẫu

```
Tên gói thầu: Mua sắm bàn ghế làm việc trang bị [tên phòng/ban]
Nguồn vốn: [Quỹ phát triển HDSN / NSNN]
Đơn vị đề xuất: [Phòng Tổ chức Hành chính - Quản trị]
```

## Yêu cầu kỹ thuật mẫu

| Mặt hàng | Thông số tối thiểu | Đơn vị | Số lượng |
|---|---|---|---|
| Bàn làm việc nhân viên | Kích thước tối thiểu 120x60x75 cm, mặt bàn MFC hoặc gỗ công nghiệp chịu ẩm, khung thép sơn tĩnh điện, tải trọng ≥80 kg | Bộ | [điền] |
| Ghế làm việc có bánh xe | Lưng tựa điều chỉnh độ cao, nệm bọc vải hoặc da PU, chân nylon 5 chấu, tải trọng ≥120 kg | Cái | [điền] |

> Hàng mới 100%, bảo hành tối thiểu 12 tháng. Cho phép chào hàng sản phẩm tương đương hoặc cao hơn về chất lượng.

## Checklist kiểm toán

- [ ] Không ghi "gỗ tự nhiên loại A" hay tên thương hiệu cụ thể trong tiêu chí
- [ ] Xác định đúng: đơn giá/bộ ≥ 10M VND → goods_fixed_asset; < 10M VND → goods_consumable
- [ ] Doc 22 (Ghi tăng tài sản) chỉ áp dụng nếu packageType = goods_fixed_asset
- [ ] Nếu goods_consumable: không lập Doc 22, hạch toán vào chi phí
- [ ] Bảo hành ghi rõ trong hợp đồng (Doc 18), không dùng từ "theo thông lệ"

## Rủi ro kiểm toán thường gặp

[HIGH] Mua bàn ghế đơn giá 9,8 triệu/bộ (cố tình ở dưới 10M) nhưng chất lượng và mục đích tương đương tài sản cố định → kiểm toán có thể xem là "cố tình né ngưỡng tài sản cố định" và yêu cầu ghi tăng tài sản.

[MEDIUM] Ghi tăng tài sản cho bàn ghế giá 3 triệu/chiếc → sai nguyên tắc kế toán TT 45/2018, có thể bị yêu cầu điều chỉnh sổ sách.

---

## Kịch bản ví dụ cụ thể

**Mục đích:** Trang bị bàn ghế làm việc cho Phòng Đào tạo sau khi phòng được nâng cấp diện tích.

### Bảng dự toán mẫu

| STT | Tên hàng | Thông số tối thiểu | ĐVT | SL | Đơn giá dự toán (VND) | Thành tiền (VND) |
|---|---|---|---|---|---|---|
| 1 | Bàn làm việc nhân viên | Kích thước tối thiểu 120×60×75 cm, mặt bàn gỗ công nghiệp chịu ẩm ≥18mm, khung thép sơn tĩnh điện, tải trọng ≥80 kg | Bộ | 10 | 3.500.000 | 35.000.000 |
| 2 | Ghế làm việc xoay có bánh xe | Lưng tựa điều chỉnh độ cao 42–52 cm, đệm bọc vải nỉ, chân nylon 5 chấu, tải trọng ≥120 kg | Cái | 10 | 1.800.000 | 18.000.000 |
| 3 | Bàn họp dài | Kích thước tối thiểu 240×90×75 cm, mặt bàn MFC, chân thép | Cái | 1 | 8.500.000 | 8.500.000 |
| 4 | Ghế chờ băng dài | 3 chỗ ngồi, khung thép sơn tĩnh điện, đệm PU | Cái | 2 | 2.200.000 | 4.400.000 |
| **Tổng** | | | | | | **65.900.000** |

> ⚠ Các mức giá trên là **ước tính dự toán tham khảo**, không phải báo giá thực. Cơ quan phải thực hiện khảo sát giá thị trường theo quy trình Doc 5 trước khi phê duyệt dự toán.

### Phân tích áp dụng

| Hạng mục | Giá trị / Kết quả |
|---|---|
| Tổng dự toán | 65.900.000 VND |
| Ngưỡng xác định phương thức | ≤ 500.000.000 VND |
| **Phương thức lựa chọn nhà thầu** | **Chỉ định thầu rút gọn** (NĐ 214/2025) |
| packageType | `goods_consumable` (đơn giá/bộ < 10 triệu VND) |
| Ghi tăng tài sản (Doc 22) | **Không áp dụng** — hạch toán vào chi phí |
| Bảo hành tối thiểu | 12 tháng |

### Trình tự văn bản cần lập (chỉ định thầu rút gọn)

1. Doc 1 — Tờ trình đề xuất mua sắm
2. Doc 5 — Biên bản khảo sát, so sánh giá thị trường (≥3 báo giá)
3. Doc 6 — Kế hoạch lựa chọn nhà thầu (KHLCNT)
4. Doc 7 — Quyết định phê duyệt KHLCNT
5. Doc 9 — Hồ sơ yêu cầu (HSYC)
6. Doc 10 — Quyết định phê duyệt HSYC
7. Doc 13 — Báo cáo đánh giá HSĐX
8. Doc 14 — Báo cáo thẩm định kết quả
9. Doc 15 — Tờ trình đề nghị phê duyệt kết quả LCNT
10. Doc 16 — Quyết định phê duyệt kết quả LCNT
11. Doc 18 — Hợp đồng mua sắm
12. Doc 19 — Biên bản bàn giao hàng hóa
13. Doc 20 — Biên bản nghiệm thu (kiểm tra số lượng, quy cách, màu sắc)
14. Doc 21 — Thanh lý hợp đồng
