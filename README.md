# Hệ Thống Hồ Sơ Mua Sắm — Trường Cao đẳng Kỹ thuật Công nghiệp

Ứng dụng web hỗ trợ soạn thảo tự động bộ văn bản pháp lý cho quy trình mua sắm tài sản công tại Trường Cao đẳng Kỹ thuật Công nghiệp (ĐVSNCL trực thuộc Bộ Công Thương), tuân thủ Luật Đấu thầu 22/2023/QH15 và Nghị định 214/2025/NĐ-CP.

---

## Mục đích

- Sinh tự động 28 văn bản mua sắm đầy đủ (tờ trình, kế hoạch LCNT, HSMT/HSYC, biên bản, quyết định, hợp đồng, nghiệm thu, cam kết độc lập, báo giá, thanh lý tài sản)
- Đảm bảo tuân thủ pháp lý, khả năng kiểm toán và truy vết
- Hỗ trợ xuất file Word (.docx) và ZIP toàn bộ hồ sơ

---

## Kiến trúc

Ứng dụng là **SPA thuần client-side** (không có backend, không có cơ sở dữ liệu, không có xác thực người dùng). Toàn bộ logic chạy trong trình duyệt.

```
Dau_Thau_Mua_Sam_Nam_2026/
├── app/                    # Mã nguồn React + TypeScript + Vite
│   └── src/
│       ├── App.tsx         # Giao diện chính, state, form, validation
│       ├── demoData.ts     # Dữ liệu mẫu 4 gói thầu + TypeScript interfaces
│       ├── docTemplates.ts # 24 mẫu văn bản (HTML preview + DOCX export)
│       ├── ai/             # Lớp AI: legalKnowledgeBase, legalReviewer, packageGenerator
│       ├── agents/         # Multi-agent: PlannerAgent, WorkflowEngine, ToolCallingAgent
│       └── utils/          # Tiện ích: agentFormatters, numberToWords, traceId
├── docs/                   # Tài liệu kỹ thuật và pháp lý
├── examples/               # Ví dụ hồ sơ theo từng loại mua sắm
├── Legal/                  # Văn bản pháp luật tham chiếu
├── Prompts/                # Hướng dẫn nghiệp vụ AI
├── templates/              # Mẫu file Word (.docx)
└── CLAUDE.md               # Luật lệ dự án — đọc trước khi làm bất kỳ điều gì
```

---

## Cài đặt

```bash
cd app
npm install
```

---

## Lệnh phát triển

| Lệnh | Mục đích |
|------|---------|
| `npm run dev` | Khởi động dev server (Vite HMR) |
| `npm run build` | Build production (`tsc -b && vite build`) |
| `npm run preview` | Xem trước bản build |
| `npm run lint` | Kiểm tra ESLint |

---

## Kiểm thử

```bash
# Chạy toàn bộ test suite (Vitest)
npm run test

# Chế độ watch (tự động chạy lại khi sửa file)
npm run test:watch

# Báo cáo code coverage
npm run test:coverage

# Kiểm thử end-to-end (Playwright)
npm run test:e2e
```

Tất cả lệnh trên chạy từ thư mục `app/`.

---

## Kiểm tra kiểu (TypeScript)

```bash
# Từ thư mục app/
npx tsc --noEmit
```

---

## Giới hạn đã biết

- **Không có backend:** Mọi dữ liệu tồn tại trong session trình duyệt. Không có lưu trữ lâu dài.
- **Dữ liệu mẫu:** Thông tin trong `demoData.ts` là dữ liệu demo. Nhập thông tin thực tế qua form UI.
- **AI tùy chọn:** Tính năng AI nâng cao yêu cầu biến môi trường `ANTHROPIC_API_KEY`. Nếu không có, hệ thống dùng logic tĩnh.
- **Ngưỡng pháp lý:** Ngưỡng chỉ định thầu rút gọn (500 triệu) áp dụng cho hàng hóa thông thường. Xem `docs/legal-review-direct-appointment-threshold.md` để biết chi tiết.
- **Không xử lý gói dịch vụ tư vấn và xây lắp:** Hệ thống hiện chỉ hỗ trợ gói mua sắm hàng hóa.

---

## Biến môi trường

| Biến | Bắt buộc | Mục đích |
|------|----------|---------|
| `ANTHROPIC_API_KEY` | Không | Kích hoạt AI agents (legalReviewer, packageGenerator). Không có key vẫn dùng được hệ thống với logic tĩnh. |

Đặt trong `app/.env.local` (không commit vào git):

```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Tài liệu kỹ thuật

| Tài liệu | Nội dung |
|----------|---------|
| `docs/architecture.md` | Kiến trúc chi tiết, stack công nghệ, cấu trúc thư mục |
| `docs/workflow.md` | Quy trình nghiệp vụ mua sắm từng bước |
| `docs/legal_workflow.md` | Căn cứ pháp lý cho từng bước quy trình |
| `docs/audit_checklist.md` | Danh mục kiểm tra kiểm toán |
| `docs/legal-review-direct-appointment-threshold.md` | Phân tích ngưỡng chỉ định thầu rút gọn |
| `SKILL.md` | Nghiệp vụ đấu thầu, ngưỡng, phương thức lựa chọn nhà thầu |
