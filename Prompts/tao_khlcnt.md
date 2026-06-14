# Prompt: Tạo Kế Hoạch Lựa Chọn Nhà Thầu (Doc 10 + Doc 11)

## Mục đích

KHLCNT là văn bản bắt buộc cho mọi phương thức LCNT từ chỉ định thầu rút gọn trở lên (≥50M VND). Bao gồm Tờ trình phê duyệt KHLCNT (Doc 10) và Quyết định phê duyệt KHLCNT (Doc 11).

## Điều kiện tiên quyết

KHLCNT chỉ được lập sau khi:
- Dự toán kinh phí đã được phê duyệt (QĐ phê duyệt dự toán — Doc 4)
- Phương thức LCNT đã xác định theo đúng ngưỡng giá trị
- Không áp dụng cho DIRECT_50 (≤50M VND)

## Thông tin cần thu thập

```
1. Tên gói thầu:
2. Giá gói thầu (= tổng dự toán đã phê duyệt):
3. Nguồn vốn:
4. Hình thức LCNT (do hệ thống xác định tự động):
5. Loại hợp đồng: lump_sum (trọn gói) | unit_price (theo đơn giá)
   - Dịch vụ bảo trì nhiều lần → unit_price (Điều 62 Luật ĐT 2023)
   - Hàng hóa giá cố định → lump_sum
6. Thời gian thực hiện hợp đồng (ngày):
7. Thời gian bắt đầu (Quý/Năm):
8. Ngày lập KHLCNT:
9. Ngày phê duyệt KHLCNT:
```

## Lưu ý pháp lý quan trọng

**Phân loại loại gói thầu (packageType) ảnh hưởng căn cứ:**
- `goods_fixed_asset` / `goods_consumable` → "gói thầu hàng hóa"
  Căn cứ: Điều 24 Luật ĐT 2023
- `service` → "gói thầu dịch vụ phi tư vấn"
  Căn cứ: Khoản 12 Điều 4 + Điều 24 Luật ĐT 2023

**Loại hợp đồng sai có thể bị kiểm toán yêu cầu hủy hợp đồng:**
- Gói dịch vụ bảo trì có khối lượng biến động → bắt buộc dùng unit_price
- Gói mua sắm hàng hóa giá cố định → lump_sum là phù hợp

## Quy trình phê duyệt

```
Phòng TC-KH lập KHLCNT (Doc 10) → Hiệu trưởng ký QĐ phê duyệt (Doc 11)
Thời gian: Doc 10 và Doc 11 cách nhau ít nhất 1 ngày làm việc
```

## Căn cứ pháp lý

- VBHN 74/VBHN-VPQH ngày 25/3/2026
- Nghị định 214/2025/NĐ-CP Điều 41 (nội dung KHLCNT)
- Thông tư 13/2026/TT-BCT (phân cấp thẩm quyền BCT)

## Lưu ý kiểm toán

[HIGH] KHLCNT phê duyệt sai loại hợp đồng hoặc sai hình thức LCNT → toàn bộ quy trình có thể bị tuyên vô hiệu.

[MEDIUM] Thời gian thực hiện hợp đồng ghi trong KHLCNT phải khớp với điều khoản hợp đồng thực tế (Doc 18).
