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
Đơn vị đề xuất: [Phòng Quản trị đời sống]
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
