# Hướng Dẫn Đóng Góp — Hệ Thống Hồ Sơ Mua Sắm 2026

Trước khi đóng góp, hãy đọc kỹ `CLAUDE.md` (quy tắc dự án) và `docs/architecture.md` (kiến trúc hệ thống).

---

## Yêu cầu môi trường

- Node.js ≥ 20
- npm ≥ 10
- Playwright (E2E tests): `npx playwright install` (chạy một lần)
- `ANTHROPIC_API_KEY` trong `.env` — chỉ cần cho LLM integration tests (tùy chọn)

---

## Cài đặt và chạy

```bash
cd app
npm install
npm run dev       # Dev server tại http://localhost:5173
```

---

## Kiểm tra bắt buộc trước khi commit

```bash
cd app
npx tsc --noEmit  # TypeScript — phải sạch 0 errors
npm run test      # Vitest — phải pass 100%
npm run test:e2e  # Playwright — 13 browser tests
```

**Quy tắc cứng:**
- Không được giảm số test đang pass (floor: **4690 tests**)
- Không commit khi `tsc --noEmit` có error
- Không dùng `.skip` để bỏ qua test

---

## Tiêu chuẩn code

### TypeScript
- `noUnusedLocals: true`, `noUnusedParameters: true` — bắt buộc
- Không dùng `as any` — dùng typed API thay thế
- Không dùng `// @ts-ignore` hoặc `// eslint-disable`

### React components
- SSR-safe: không dùng `window`, `document`, `localStorage` trực tiếp trong component render
- Heavy libraries (`jszip`, `docx`): lazy load bằng dynamic `import()` bên trong event handler

### Test (Vitest)
- Tiêu chuẩn **56-test per module** (Phase 6+): 12 nhóm × ~4–5 tests
- Mọi `AgentMessage` phải có `traceId` hợp lệ — `AgentRegistry.log()` throws nếu rỗng
- Không mock `AgentRegistry` — test với instance thực

---

## Quy tắc nội dung pháp lý (bắt buộc)

Hệ thống tạo văn bản pháp lý dùng cho kiểm toán nhà nước. Vi phạm các quy tắc này là lỗi nghiêm trọng:

| Quy tắc | Ví dụ sai | Ví dụ đúng |
|---|---|---|
| Không bịa căn cứ pháp lý | "Điều 99 Luật ĐT" (không tồn tại) | Chỉ dùng văn bản trong `CLAUDE.md` |
| Không hardcode nhãn hiệu | `"Panasonic"`, `"Canon"` | `"máy in laser tối thiểu 30 trang/phút"` |
| Không chia nhỏ gói thầu | Tách 600M → 2 gói 300M | Giữ nguyên một gói 600M |
| Không bịa báo giá | `price: 14_500_000` hardcoded | Giá từ user input hoặc placeholder |
| Dùng placeholder cho demo | `"Phòng Tài chính"` cụ thể | `"[Phòng Kế hoạch - Tài chính]"` |

---

## Thứ tự ưu tiên pháp lý

Khi có xung đột giữa các văn bản:

1. Luật Đấu thầu 22/2023/QH15
2. Luật 57/2024/QH15 → Luật 90/2025/QH15
3. VBHN 74/VBHN-VPQH (25/03/2026)
4. Nghị định 214/2025/NĐ-CP
5. Thông tư 79 và 80/2025/TT-BTC
6. Nghị định 186/2025, 52/2026, 60/2021
7. Thông tư 13/2026/TT-BCT
8. Quy chế nội bộ nhà trường

Luôn dùng quy định mới hơn. Không dùng quy định đã hết hiệu lực.

---

## Thêm tính năng mới

1. Đọc `docs/roadmap.md` để hiểu kế hoạch và lịch sử phát triển
2. Đọc `docs/architecture.md` để hiểu kiến trúc layer
3. Đọc `docs/workflow.md` để hiểu luồng nghiệp vụ
4. Tạo module theo pattern: pure function + 56 tests (hoặc Playwright tests cho UI)
5. Không sửa business logic khi viết tests
6. Cập nhật `docs/roadmap.md` và `docs/architecture.md` sau khi hoàn thành phase

---

## Thêm căn cứ pháp lý vào Knowledge Base

File: `app/src/ai/legalKnowledgeBase.ts`

Yêu cầu:
- Văn bản phải đã ban hành và đang có hiệu lực
- Cung cấp đầy đủ: `id`, `title`, `source`, `article`, `summary`, `keywords[]`
- Không fabricate số điều, khoản, điểm
- ID phải tiếp nối liên tục (hiện tại: kb-001 đến kb-021)

---

## Commit message

Theo pattern: `type(scope): Mô tả ngắn`

| type | Dùng khi |
|---|---|
| `feat` | Thêm tính năng mới |
| `fix` | Sửa bug |
| `docs` | Chỉ sửa tài liệu |
| `refactor` | Refactor không thêm/sửa tính năng |
| `test` | Thêm/sửa test |
| `chore` | Cấu hình, gitignore, .env |

Ví dụ: `feat(P11-01): AgentMemoryPanel — hiển thị conversation memory store`

---

## Pull Request

- Branch từ `develop` (không branch từ `master`)
- PR về `develop`; chỉ merge vào `master` khi release chính thức
- Chạy đủ `tsc` + `npm run test` + `npm run test:e2e` trước khi tạo PR
- Mô tả PR phải nêu: tính năng mới, tests thêm, commit liên quan
