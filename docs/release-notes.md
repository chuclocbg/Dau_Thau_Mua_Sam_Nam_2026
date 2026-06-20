# Ghi Chú Phát Hành — Hệ Thống Hồ Sơ Mua Sắm 2026

---

## v1.0 — Phase 10 (20/06/2026)

**Code quality pass — không có tính năng mới.**

Cải thiện:
- Lazy-load `jszip` và `docx/Packer` bằng dynamic import — giảm initial bundle size
- Thay `structuredClone()` bằng `JSON.parse(JSON.stringify(...))` — tương thích browser cũ (Chrome < 98, Safari < 15.4, WebView kiosk)
- Bật `noUnusedLocals: true` + `noUnusedParameters: true` trong `tsconfig.app.json`
- Xóa dead exports `formatDateVietnamese` và `DocumentConfig` khỏi `docTemplates.ts`
- Xóa unsafe `(registry as any).getTrace()` → typed public API `registry.getTrace()`
- Consolidate `formatTimestamp`/`formatPayload` vào `utils/agentFormatters.ts` (dedup)
- Export `generateTraceId` từ agents barrel (dedup)
- Playwright `.gitignore` entries và `.env.example`
- Hoàn thiện tài liệu: roadmap, architecture, workflow, release-notes, CONTRIBUTING

**Số liệu:** 4690 tests / 102 test files / 0 regressions

---

## v0.9 — Phase 9 (19/06/2026)

**LLM wiring + Persistence layer.**

Tính năng mới:
- **Active trace wiring** (P9-01): `Phase8DashboardPanel` nhận live trace từ `AgentRegistry.getTrace()` thay vì `[]` tĩnh
- **Shared formatters** (P9-02): `utils/agentFormatters.ts` — `formatTimestamp`, `formatPayload`, `buildTraceSummary`; giải quyết technical debt [MEDIUM] từ Phase 8
- **LLM wiring** (P9-03): `ChatAgent` và `LegalReviewerAgent` nhận `LLMBridgeConfig` — sẵn sàng kết nối Claude API qua `ANTHROPIC_API_KEY`
- **IndexedDB persistence** (P9-04): `persistence/agentSessionStore.ts` — lưu tối đa 10 session, tự xóa cũ nhất khi đầy; fallback in-memory nếu IndexedDB không khả dụng
- **createAgentSystem injection** (P9-05): `createAgentSystem()` inject `LLMBridgeConfig` chia sẻ vào toàn bộ agent system
- **HTML audit report in ZIP** (P9-06): `buildAgentAuditReport()` tạo `BiolReport.html` đính kèm vào ZIP export
- **Playwright E2E** (P9-07): 13 golden-path browser tests (A–M) bao phủ toàn bộ luồng UI chính

**Corrections trước Phase 9:**

| Commit | Nội dung |
|---|---|
| `b5aae8e` | fix(task1): Đổi tên Hiệu trưởng: `TS. Nguyễn Hồng Giang` → `ThS. Đào Đức Quảng` |
| `9a4aac0` | fix(task2): Sửa tên phòng ban và mã đơn vị trong toàn bộ codebase |
| `b5761a4` | feat(task3): Hỗ trợ số nghìn tỷ trong `numberToWords` (+10 tests) |
| `80f9967` | docs(task4): Phân tích pháp lý ngưỡng chỉ định thầu rút gọn 500M VND |
| `8fefbf2` | docs(task5): Tạo `README.md` tại thư mục gốc |
| `fc75da4` | docs(task6): Điền nội dung 3 ví dụ mua sắm thực tế (`examples/`) |
| `f090b9d` | docs(task7): Tạo mẫu Quyết định phê duyệt dự toán + Báo cáo thực hiện hợp đồng |

**Số liệu:** 4690 tests / 102 test files (+238 so với Phase 8)

---

## v0.8 — Phase 8 (19/06/2026)

**Audit Dashboard — 17 tasks.**

Tính năng mới:
- `Phase8DashboardPanel`: dashboard có thể thu gọn với 9 sections
- `AgentTracePanel`: audit trail chronological theo `traceId`
- `AgentRegistryPanel`: tổng quan multi-trace (message count, agent usage)
- `AgentFlowPanel`: ma trận routing (from agent → to agent)
- `AgentLegalCitationPanel`: tần suất trích dẫn pháp lý
- `AgentErrorPanel`: lọc message lỗi cross-trace
- `ai/llmBridge.ts`: LLM provider bridge, rule-based fallback khi không có API key
- `ai/agentAuditExporter.ts`: xuất HTML audit summary vào ZIP
- `ai/plannerBridge.ts`: route `AiAssistantPanel` qua `PlannerAgent` (P6-01)
- Legal KB: mở rộng từ 15 lên 21 entries (kb-016 đến kb-021)
- `LegalKBPanel`, `PackageLegalReviewPanel`, `AgentOutputPanel`: surface live results
- Wire `packageContext` vào `ChatInterfacePanel` (8-A)

**Số liệu:** 4452 tests / 96 test files (+797 so với Phase 7)

---

## v0.7 — Phase 7 (18/06/2026)

**UI Wiring — agent layer vào App.tsx.**

Tính năng mới:
- `AgentProviderPanel`: `createAgentSystem()` → `AgentSystemBundle`, `AgentStatusDashboard`
- `AutonomousWorkflowPanel`: wire `AutonomousAgent` state machine + `WorkflowPanel`
- `ChatInterfacePanel`: wire `ChatAgent` + `AgentChatPanel`, với `packageContext`
- E2E UI tests: 56 tests bao phủ 3 panel mới + `App.tsx` integration

**Số liệu:** 3655 tests / 82 test files (+224 so với Phase 6)

---

## v0.6 — Phase 6 (18/06/2026)

**Multi-Agent Procurement System.**

Tính năng mới:
- 6 agent chuyên biệt: `PlannerAgent`, `SpecificationAgent`, `LegalReviewerAgent`, `RiskAgent`, `ChatAgent`, `AutonomousAgent`
- `AgentRegistry`: message broker, routing, audit trace log với `traceId` bắt buộc
- 42 provider/utility module: P6-10x (LLM runtime), P6-11x (utilities), P6-12x (network)
- Tiêu chuẩn 56-test per module

**Số liệu:** 3431 tests / 78 test files

---

## v0.5 — Phase 5 (trước 18/06/2026)

**AI Agent modules (rule-based, client-side).**

Tính năng mới:
- `packageGenerator` (P5-01): NL → `AISuggestion` (keyword matching)
- `specGenerator` (P5-02): tên thiết bị → `SpecSuggestion` (template)
- `legalReviewer` (P5-03): `ProcurementPackage` → `LegalReviewResult` với findings
- `legalKnowledgeBase` (P5-04): BM25-lite search, 15 KB entries ban đầu
- `workflowOrchestrator` (P5-05): pipeline 5 bước → `WorkflowResult`

---

## v0.4 — Phase 4 (trước 18/06/2026)

**Technical debt cleanup:** Tách validation helpers, cải thiện module hóa.

---

## v0.3 — Phase 3 (trước 18/06/2026)

**Medium quality improvements:** 9 cải tiến UX, error handling, accessibility.

---

## v0.2 — Phase 2 (trước 18/06/2026)

**Legal & UX fixes — 14 vấn đề:**

- XSS sanitization với DOMPurify
- Xóa tên nhà cung cấp hardcoded khỏi Doc 6 (thay bằng `[Nhà cung cấp số 1/2/3]`)
- Date validation với 17 mốc ngày theo trình tự pháp lý
- Doc 24: sửa trạng thái hardcoded "hoàn thành" → giá trị động
- Và 10 vấn đề UX khác

---

## v0.1 — Phase 1 (trước 18/06/2026)

**Critical bug fixes — 9 lỗi chặn triển khai:**

- `numberToWords`: xử lý số lớn đúng (sau Task 3: hỗ trợ đến nghìn tỷ)
- Ngưỡng `chào hàng cạnh tranh`: sửa 10 tỷ → **5 tỷ VND** (đúng theo NĐ 214/2025)
- `getWinnerSupplier()`: chọn nhà thầu giá thấp nhất hợp lệ (không phải nhà thầu thứ nhất)
- Date validation: 17 mốc ngày phải đúng trình tự pháp lý
- Và 5 lỗi nghiêm trọng khác
