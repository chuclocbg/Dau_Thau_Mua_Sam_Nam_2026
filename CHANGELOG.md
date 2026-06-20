# Changelog

All notable changes to this project are documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)  
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [1.0.0] — 2026-06-20

### Tổng quan

Phiên bản đầu tiên sẵn sàng triển khai. Hệ thống sinh hồ sơ mua sắm tự động cho Trường Cao đẳng Kỹ thuật Công nghiệp, đáp ứng đầy đủ quy định pháp luật đấu thầu hiện hành (Luật ĐT 22/2023, NĐ 214/2025, TT 79–80/2025/TT-BTC).

**Số liệu:** 4690 tests / 102 test files / 0 regressions  
**TypeScript:** `tsc --noEmit` clean — 0 errors, 0 suppressions  
**Bundle:** Initial load không bao gồm JSZip/docx (lazy-loaded khi cần)

### Phase 10 — Code Quality (P10-01 đến P10-09, P10-10)

**Changed**
- `app/package.json`: version `0.0.0` → `1.0.0`
- `app/tsconfig.app.json`: bật `noUnusedLocals: true` + `noUnusedParameters: true`
- `app/src/App.tsx`: JSZip và docx/Packer lazy-loaded bằng dynamic `import()` trong ZIP handlers
- `app/src/App.tsx`: `structuredClone(pkg)` → `JSON.parse(JSON.stringify(pkg)) as ProcurementPackage`
- `app/src/AiAssistantPanel.tsx`: JSZip và docx/Packer lazy-loaded bằng dynamic `import()`
- `app/src/agents/index.ts`: export `generateTraceId` từ barrel (dedup)
- `app/src/utils/agentFormatters.ts`: `formatTimestamp` consolidate từ `AgentTracePanel` về shared module

**Removed**
- `export` keyword khỏi `formatDateVietnamese` trong `docTemplates.ts` (chỉ dùng nội bộ)
- `export` keyword khỏi `DocumentConfig` interface trong `docTemplates.ts` (chỉ dùng nội bộ)
- `(registry as any).getTrace()` unsafe cast trong `AgentRegistryPanel.tsx`

**Added**
- `.env.example` — hướng dẫn cấu hình `ANTHROPIC_API_KEY`
- `.gitignore` entries cho Playwright artifacts
- `CHANGELOG.md` (file này)
- `CONTRIBUTING.md` — hướng dẫn đóng góp và tiêu chuẩn code
- `docs/release-notes.md` — lịch sử phát hành v0.1–v1.0

**Docs updated**
- `docs/roadmap.md`: thêm Phase 9 và Phase 10; cập nhật test count 4452 → 4690; version 4.3
- `docs/architecture.md`: cập nhật v4.0; xóa cảnh báo Phase 6 stale; thêm Phase 7–10 addendum
- `docs/workflow.md`: sửa ngưỡng sai 10 tỷ → 5 tỷ VND (2 chỗ); thêm phần AI Assistant Panel và Agent Panels
- `README.md`: tài liệu onboarding đầy đủ (tạo trong P10-09)

---

## [0.9.0] — 2026-06-19 (Phase 9)

### Phase 9 — LLM & Persistence

**Added**
- `app/src/utils/agentFormatters.ts` (P9-02): shared formatters — `formatTimestamp`, `formatPayload`, `buildTraceSummary`; giải quyết technical debt [MEDIUM] từ Phase 8
- `app/src/persistence/agentSessionStore.ts` (P9-04): IndexedDB bounded session store, max 10 sessions, fallback in-memory khi IndexedDB không khả dụng
- `app/src/persistence/` (6 files): schema, memory, migration, idb-stores, migrating-stores, index barrel
- Playwright E2E suite (P9-07): 13 golden-path browser tests (A–M)
- HTML audit report `BiolReport.html` trong ZIP export (P9-06)

**Changed**
- `AgentRegistry.getTrace(traceId)`: public typed API thay `(registry as any)` — Phase8DashboardPanel nhận live trace (P9-01)
- `ChatAgent`, `LegalReviewerAgent`: nhận `LLMBridgeConfig` qua `createAgentSystem()` (P9-03, P9-05)

**Data corrections (commits b5aae8e, 9a4aac0, b5761a4)**
- Sửa tên Hiệu trưởng: `TS. Nguyễn Hồng Giang` → `ThS. Đào Đức Quảng`
- Sửa tên phòng ban và mã đơn vị trong toàn bộ codebase
- Hỗ trợ số nghìn tỷ trong `numberToWords` (+10 tests)

**Tests:** +228 (4452 → 4690)

---

## [0.8.0] — 2026-06-19 (Phase 8)

### Phase 8 — Audit Dashboard (17 tasks: 8-A đến 8-Q)

**Added**
- `Phase8DashboardPanel`: dashboard 9 sections có thể thu gọn
- `AgentTracePanel` (8-K): audit trail chronological theo `traceId`
- `AgentRegistryPanel` (8-L): tổng quan multi-trace
- `AgentFlowPanel` (8-M): ma trận routing (from → to agent)
- `AgentLegalCitationPanel` (8-N): tần suất trích dẫn pháp lý
- `AgentErrorPanel` (8-O): error-only view cross-trace
- `ai/llmBridge.ts` (8-G): LLM provider bridge với rule-based fallback
- `ai/agentAuditExporter.ts` (8-H): HTML audit summary trong ZIP export
- `ai/plannerBridge.ts` (8-I): route AiAssistantPanel qua PlannerAgent (P6-01)
- Legal KB: mở rộng 15 → 21 entries (kb-016 đến kb-021)
- `LegalKBPanel` (8-D), `PackageLegalReviewPanel` (8-E), `AgentOutputPanel` (8-B)

**Changed**
- `ChatInterfacePanel`: wire `packageContext` (8-A)

**Tests:** +797 (3655 → 4452)

---

## [0.7.0] — 2026-06-18 (Phase 7)

### Phase 7 — UI Wiring

**Added**
- `AgentProviderPanel` (P7-A): `createAgentSystem()` → `AgentSystemBundle`
- `AutonomousWorkflowPanel` (P7-B): wire `AutonomousAgent` state machine + `WorkflowPanel`
- `ChatInterfacePanel` (P7-C): wire `ChatAgent` + `AgentChatPanel`
- E2E UI tests: 56 tests bao phủ 3 panel + integration

**Tests:** +224 (3431 → 3655)

---

## [0.6.0] — 2026-06-18 (Phase 6)

### Phase 6 — Multi-Agent Procurement System

**Added**
- 6 agent chuyên biệt: `PlannerAgent` (P6-01), `SpecificationAgent` (P6-02), `LegalReviewerAgent` (P6-03), `RiskAgent` (P6-04), `ChatAgent` (P6-05), `AutonomousAgent` (P6-06)
- `AgentRegistry`: message broker, routing, audit trace log — `traceId` bắt buộc
- `agents/index.ts`: barrel export — public API cho toàn bộ agent layer
- 42 provider/utility module: P6-10x (LLM runtime), P6-11x (core utilities), P6-12x (network & integration)
- 18 React component SSR-safe trong `components/`

**Tests:** 3431 / 78 test files (tiêu chuẩn 56-test per module)

---

## [0.5.0] — Phase 5

### Phase 5 — AI Agent Modules (rule-based)

**Added**
- `packageGenerator` (P5-01): NL → `AISuggestion`
- `specGenerator` (P5-02): tên thiết bị → `SpecSuggestion`
- `legalReviewer` (P5-03): `ProcurementPackage` → `LegalReviewResult`
- `legalKnowledgeBase` (P5-04): BM25-lite search, 15 KB entries
- `workflowOrchestrator` (P5-05): pipeline 5 bước → `WorkflowResult`
- `AiAssistantPanel.tsx`: UI one-click workflow

---

## [0.4.0] — Phase 4

### Phase 4 — Technical Debt

**Changed**
- Tách validation helpers khỏi `App.tsx`
- Cải thiện module hóa và maintainability

---

## [0.3.0] — Phase 3

### Phase 3 — Medium Quality

**Fixed / Improved**
- 9 cải tiến: UX, error handling, accessibility, edge cases

---

## [0.2.0] — Phase 2

### Phase 2 — Legal & UX Fixes

**Fixed**
- XSS sanitization với DOMPurify
- Doc 6: xóa tên nhà cung cấp hardcoded → placeholder trung lập
- Date validation: 17 mốc ngày theo trình tự pháp lý bắt buộc
- Doc 24: trạng thái hardcoded "hoàn thành" → giá trị động
- 10 vấn đề UX khác

---

## [0.1.0] — Phase 1

### Phase 1 — Critical Bug Fixes

**Fixed** (9 lỗi chặn triển khai)
- `numberToWords`: xử lý số lớn, hỗ trợ đến nghìn tỷ
- Ngưỡng chào hàng cạnh tranh: 10 tỷ → **5 tỷ VND** (NĐ 214/2025/NĐ-CP Điều 81)
- `getWinnerSupplier()`: logic chọn nhà thầu giá thấp nhất hợp lệ
- Date validation + 17-mốc sequence checking
- 5 lỗi nghiêm trọng khác
