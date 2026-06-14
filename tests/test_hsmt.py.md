# Đặc Tả Kiểm Thử — Hồ Sơ Mời Thầu / Yêu Cầu (HSMT/HSYC)

> Tệp này mô tả các trường hợp kiểm thử cho logic sinh và validate HSMT/HSYC (Doc 12).
> Các test case Vitest thực tế nằm tại `app/src/__tests__/`.

## Phạm vi kiểm thử

| Module | Hàm kiểm thử | Mức độ |
|---|---|---|
| `getProcurementMethod()` | Phân loại đúng phương thức theo giá trị | Critical |
| `numberToWords()` | Chuyển đổi chính xác mọi giá trị | Critical |
| `validateDateGaps()` | Phát hiện khoảng cách ngày không hợp lệ | High |
| `validatePackageBeforeExport()` | Chặn xuất khi thiếu thông tin bắt buộc | High |
| `Doc 12 getHtml()` | Render không ném exception | Medium |
| `Doc 12 getDocx()` | DOCX có đủ 5 chương | Medium |
| XSS sanitization | Mọi input của người dùng được lọc | High |

## Test Case: getProcurementMethod()

```typescript
// TC-01: Ngưỡng đúng DIRECT_50
expect(getProcurementMethod({...pkg, items: [{unitPrice: 50000000, quantity: 1}]}).code)
  .toBe('DIRECT_50');

// TC-02: Ngưỡng chính xác ranh giới DIRECT_50 → DIRECT_SELECTION_SIMPLIFIED
expect(getProcurementMethod({...pkg, items: [{unitPrice: 50000001, quantity: 1}]}).code)
  .toBe('DIRECT_SELECTION_SIMPLIFIED');

// TC-03: Ngưỡng COMPETITIVE_SHOPPING (500M–5B)
expect(getProcurementMethod({...pkg, items: [{unitPrice: 1000000000, quantity: 1}]}).code)
  .toBe('COMPETITIVE_SHOPPING');

// TC-04: Ranh giới COMPETITIVE_SHOPPING → OPEN_BIDDING (5B)
expect(getProcurementMethod({...pkg, items: [{unitPrice: 5000000001, quantity: 1}]}).code)
  .toBe('OPEN_BIDDING');

// TC-05: packageType service → method name chứa "dịch vụ phi tư vấn"
expect(getProcurementMethod({...pkg, packageType: 'service', items: [{unitPrice: 1000000000, quantity: 1}]}).name)
  .toContain('dịch vụ phi tư vấn');

// TC-06: packageType service → basis chứa Khoản 12 Điều 4
expect(getProcurementMethod({...pkg, packageType: 'service'}).basis.join(' '))
  .toContain('Khoản 12 Điều 4');
```

## Test Case: numberToWords()

```typescript
// TC-07: Giá trị cơ bản
expect(numberToWords(1000000)).toBe('Một triệu đồng chẵn');

// TC-08: Giá trị có hàng nghìn
expect(numberToWords(50000000)).toBe('Năm mươi triệu đồng chẵn');

// TC-09: Giá trị phức hợp thường gặp
expect(numberToWords(320000000)).toBe('Ba trăm hai mươi triệu đồng chẵn');

// TC-10: Giá trị hàng tỷ
expect(numberToWords(1500000000)).toBe('Một tỷ năm trăm triệu đồng chẵn');

// TC-11: Quy tắc "mốt" (21, 31, ...)
expect(numberToWords(21000000)).toBe('Hai mươi mốt triệu đồng chẵn');

// TC-12: Quy tắc "lăm" (15, 25, ...)
expect(numberToWords(15000000)).toBe('Mười lăm triệu đồng chẵn');

// TC-13: Edge case: 0
expect(numberToWords(0)).toBe('Không đồng');
```

## Test Case: validateDateGaps()

```typescript
// TC-14: Khoảng cách Đề xuất → Khảo sát < 1 ngày → warning
// TC-15: Khoảng cách Phê duyệt KHLCNT → Lập HSYC đúng → không warning
// TC-16: Khoảng cách Đóng thầu → Đánh giá < 1 ngày → warning
```

## Test Case: XSS

```typescript
// TC-17: <script>alert(1)</script> trong packageName → bị strip
// TC-18: onerror="alert(1)" trong supplier1Name → bị strip
// TC-19: javascript: trong href → bị strip
// TC-20: Nội dung tiếng Việt hợp lệ được giữ nguyên sau sanitize
```

## Hướng dẫn chạy test

```bash
cd app
npm test                    # chạy tất cả test
npx vitest run --reporter=verbose  # kết quả chi tiết
npx vitest run src/__tests__/utils.test.ts  # chỉ chạy utils
```

## Trạng thái coverage hiện tại (2026-06-14)

- Tổng: 162 tests, 9 test files
- Covered: numberToWords, getProcurementMethod, validateDateGaps, validatePackageBeforeExport, XSS sanitization, Doc 24, Doc 25 DOCX
- Chưa covered: Doc 26, 27, 28 (thêm trong P2-04), Doc 12 content validation
