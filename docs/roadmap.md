# Lộ Trình Phát Triển — Hệ Thống Hồ Sơ Mua Sắm 2026

> **Trạng thái cập nhật:** 19/06/2026  
> **Phiên bản hiện tại:** 4.2 — Phase 8 complete, branch `develop`  
> **Test suite:** 4452 tests passing across 96 test files

---

## Tổng quan tiến độ

| Phase | Nội dung | Trạng thái |
|---|---|---|
| Phase 1 — Critical | 9 lỗi chặn triển khai | ✅ DONE (commit 09403e5) |
| Phase 2 — High | 14 vấn đề pháp lý và UX | ✅ DONE |
| Phase 3 — Medium | 9 cải tiến chất lượng | ✅ DONE |
| Phase 4 — Low | 6 nợ kỹ thuật dài hạn | ✅ DONE |
| Phase 5 — AI Agent | 5 module AI (rule-based, client-side) | ✅ DONE (tag `phase5-complete`) |
| Phase 6 — Multi-Agent | 6 agent chuyên biệt, kiến trúc message-passing + 42 provider/utility modules | ✅ DONE (tag `phase6-complete`) |
| Phase 7 — UI Wiring | Wire agent layer vào App.tsx, E2E UI tests | ✅ DONE (commits 566592a–5f61a19) |
| Phase 8 — Audit Dashboard | 17 tasks: UI audit panels, LLM bridge, E2E coverage | ✅ DONE (commits 40ff586–0133434) |

---

## Kiến trúc hiện tại (Phases 1–5)

```
app/src/
├── demoData.ts              # ProcurementPackage, ProcurementItem — core data model
├── docTemplates.ts          # 28 document templates (HTML + DOCX), getProcurementMethod()
├── utils.ts                 # validateDateGaps(), validatePackageBeforeExport()
├── App.tsx                  # Main SPA: form, preview, ZIP export
├── AiAssistantPanel.tsx     # AI workflow UI (toggle panel)
└── ai/
    ├── packageGenerator.ts  # P5-01: NL → AISuggestion (rule-based NLP)
    ├── specGenerator.ts     # P5-02: item name → SpecSuggestion (template)
    ├── legalReviewer.ts     # P5-03: ProcurementPackage → LegalReviewResult
    ├── legalKnowledgeBase.ts# P5-04: BM25-lite search, 15 legal KB entries
    └── workflowOrchestrator.ts # P5-05: 5-step pipeline → WorkflowResult
```

**Giới hạn kỹ thuật của Phase 5:**
- Toàn bộ AI là rule-based (keyword matching + template). Không có học máy.
- Knowledge base tĩnh — phải cập nhật thủ công khi pháp luật thay đổi.
- Agents không giao tiếp với nhau (orchestrator gọi tuần tự, không có message-passing).
- Không có bộ nhớ hội thoại (mỗi lần chạy workflow là độc lập).
- Không có cơ chế điều phối khi một bước thất bại.

---

## Phase 6 — Multi-Agent Procurement System ✅ DONE

> **Trạng thái:** Hoàn thành — tag `phase6-complete` (18/06/2026)  
> **Commit cuối:** `05c6d3a` — P6-polish: raise agent test suites to 56-test standard  
> **Kết quả thực tế:**  
> - 6 agent chuyên biệt (P6-01 đến P6-06) — đủ 56+ tests mỗi agent  
> - 42 provider/utility module bổ sung (P6-10x, P6-11x, P6-12x) — đủ 56 tests mỗi module  
> - Tổng: 3431 tests passing / 78 test files / 0 regressions  
> - TypeScript: `tsc --noEmit` clean — 0 errors, 0 suppressions  

> **Mục tiêu chiến lược:** Biến hệ thống từ một "pipeline một chiều" thành một **hệ thống đa tác nhân** (multi-agent system) trong đó các agent chuyên biệt giao tiếp qua message-passing, có bộ nhớ ngữ cảnh, và có khả năng điều phối tự động quy trình mua sắm đầu-cuối.  
>
> **Nguyên tắc bất biến (từ CLAUDE.md):**
> - Audit-first: mọi đầu ra agent phải có `traceId` và `legalBasis` để truy vết
> - Không fabricate căn cứ pháp lý — LLM chỉ được dùng cho soạn thảo văn phong, không được dùng để tạo căn cứ pháp lý
> - Không khóa nhãn hiệu; không chia nhỏ gói thầu; không bịa báo giá
> - Demo data: luôn dùng placeholder trung lập cho người, đơn vị, nhà cung cấp

---

### Kiến trúc tổng thể Phase 6

```
app/src/agents/                         # ✅ Implemented
├── types.ts                    # AgentId, AgentMessage, IAgent — core contracts
├── AgentRegistry.ts            # Message broker, routing, audit trace log
├── index.ts                    # Barrel — exports all 6 agents + types + helpers
│                               #   ✅ Imported by AgentProviderPanel — wired in Phase 7
├── PlannerAgent.ts             # P6-01 — 56 tests
├── SpecificationAgent.ts       # P6-02 — 58 tests
├── LegalReviewerAgent.ts       # P6-03 — 57 tests
├── RiskAgent.ts                # P6-04 — 57 tests
├── ChatAgent.ts                # P6-05 — 57 tests
└── AutonomousAgent.ts          # P6-06 — 56 tests (master orchestrator)

app/src/components/             # ✅ Implemented (flat structure — see note below)
├── AgentStatusDashboard.tsx    # All-agent status panel
├── AgentCard.tsx               # Individual agent health card
├── ChatPanel.tsx               # P6-05 conversational UI
├── ChatMessage.tsx             # Message bubble (user/agent/system)
├── ChatInput.tsx               # Input with suggestion chips
├── AutonomousPanel.tsx         # P6-06 orchestrator UI
├── StepTimeline.tsx            # Visual procurement timeline
├── Dashboard.tsx               # Composite panel (composes 7 sub-panels)
├── ProviderPanel.tsx, SessionPanel.tsx, MemoryPanel.tsx
├── WorkflowEnginePanel.tsx, AgentPanel.tsx, ToolPanel.tsx, ChatPanel.tsx
├── WorkflowPanel.tsx           # ✅ Wired via AutonomousWorkflowPanel (Phase 7)
├── AgentChatPanel.tsx          # ✅ Wired via ChatInterfacePanel (Phase 7)
├── AgentProviderPanel.tsx      # ✅ Phase 7 — createAgentSystem(), AgentSystemBundle
├── AutonomousWorkflowPanel.tsx # ✅ Phase 7 — AutonomousAgent UI container
└── ChatInterfacePanel.tsx      # ✅ Phase 7 — ChatAgent UI container (wired in App.tsx)

app/src/providers/              # ✅ Implemented — P6-10x / P6-11x / P6-12x (42 modules)
                                #   See architecture.md §Phase 6 Provider Infrastructure
```

> **Ghi chú — cấu trúc component phẳng:**  
> Tất cả component triển khai phẳng trong `components/`. Không ảnh hưởng chức năng.  
> Phase 7 đã bổ sung 3 component mới: `AgentProviderPanel.tsx`, `AutonomousWorkflowPanel.tsx`, `ChatInterfacePanel.tsx`.

> **Ghi chú — `WorkflowPanel.tsx` và `AgentChatPanel.tsx`:**  
> Cả hai đã được wire trong Phase 7:  
> `WorkflowPanel` ← `AutonomousWorkflowPanel` ← `App.tsx`;  
> `AgentChatPanel` ← `ChatInterfacePanel` ← `App.tsx`.

> **Ghi chú — `agents/index.ts` barrel:**  
> Barrel được import bởi `AgentProviderPanel.tsx` (Phase 7).  
> `createAgentSystem()` khởi tạo tất cả 6 agent với `AgentRegistry` dùng chung và trả về `AgentSystemBundle`.

**Core message contract (types.ts):**

```typescript
export type AgentId =
  | 'planner' | 'specification' | 'legal-reviewer'
  | 'risk' | 'chat' | 'autonomous';

export interface AgentMessage {
  traceId: string;           // UUID — required for audit trail
  from: AgentId | 'user';
  to: AgentId | 'broadcast' | 'user';  // 'user' added in Phase 8 (8-K)
  type: 'request' | 'response' | 'event' | 'error';
  payload: unknown;
  timestamp: number;
  legalBasis?: string[];     // citations consumed or produced by this message
}

export interface IAgent {
  readonly id: AgentId;
  readonly name: string;
  process(msg: AgentMessage): Promise<AgentMessage>;
  getCapabilities(): string[];
}
```

---

### P6-01 — Procurement Planner Agent

**Mục tiêu:**  
Lập kế hoạch mua sắm toàn năm từ một mô tả mục tiêu ngân sách cấp cao. Đề xuất danh sách gói thầu, phân bổ ngân sách, phát hiện nguy cơ chia nhỏ gói thầu vi phạm ngưỡng.

**Phát triển từ:** `ai/packageGenerator.ts` (P5-01) — nâng cấp lên thành stateful agent có message interface.

**Chức năng chính:**
- `plan(goal, totalBudget, budgetYear)` → danh sách `AISuggestion[]` cho cả năm
- `detectPackageSplitting(packages)` → cảnh báo [CRITICAL] nếu tổng gói thầu cùng mục đích vượt ngưỡng
- `suggestProcurementCalendar(packages)` → lịch mua sắm theo tháng
- `validateAuthority(packages)` → kiểm tra thẩm quyền phê duyệt từng gói

**Files:**
```
app/src/agents/PlannerAgent.ts
app/src/agents/__tests__/planner-agent.test.ts
```

**API:**
```typescript
export interface PlannerInput {
  naturalLanguageGoal: string;
  totalBudget: number;
  budgetYear: number;
  fundingSource?: FundingSource;
  existingPackages?: AISuggestion[]; // để phát hiện chia nhỏ
}

export interface PlannerOutput {
  packages: AISuggestion[];
  totalEstimated: number;
  calendar: MonthlyProcurementCalendar;
  splitWarnings: LegalFinding[];  // [CRITICAL] nếu phát hiện chia nhỏ
  authorityChecks: AuthorityCheck[];
  legalBasis: string[];
  confidence: 'high' | 'medium' | 'low';
}
```

**Test strategy:**
- Unit: `detectPackageSplitting()` với 3 gói cùng loại < ngưỡng nhưng tổng > ngưỡng
- Unit: `validateAuthority()` với các mức 50M / 200M / 500M / 5B
- Integration: `plan()` → `WorkflowOrchestrator` (P5-05) cho từng gói được đề xuất
- Regression: các test P5-01 không được phá vỡ

**Dependencies:** `ai/packageGenerator.ts`, `ai/legalReviewer.ts`, `AgentRegistry`

**Độ phức tạp:** Trung bình-Cao

---

### P6-02 — Specification Agent

**Mục tiêu:**  
Sinh yêu cầu kỹ thuật chuẩn đấu thầu cho danh sách hạng mục, đảm bảo tuân thủ Điều 44 khoản 7 Luật ĐT 22/2023, và giải thích lý do từng tiêu chí kỹ thuật được chọn để phục vụ kiểm toán.

**Phát triển từ:** `ai/specGenerator.ts` (P5-02) — thêm multi-item, giải thích, và phản hồi vòng lặp từ Legal Reviewer Agent.

**Chức năng chính:**
- `generateSpec(itemName, context)` → `SpecSuggestion` có `reasoning` field
- `reviewSpec(spec)` → phát hiện thương hiệu ẩn (tinh vi hơn P5-02)
- `suggestAlternatives(spec)` → gợi ý tiêu chí thay thế khi phát hiện lockout
- `batchGenerate(items[])` → sinh spec cho toàn bộ danh mục hàng hóa
- Nhận phản hồi từ `LegalReviewerAgent` để tự điều chỉnh spec

**Files:**
```
app/src/agents/SpecificationAgent.ts
app/src/agents/__tests__/specification-agent.test.ts
```

**API:**
```typescript
export interface SpecInput {
  itemName: string;
  packageType: PackageType;
  estimatedUnitPrice?: number;
  existingSpecs?: string;
  legalFindings?: LegalFinding[]; // feedback từ P6-03
}

export interface SpecOutput {
  specs: string;
  reasoning: string[];         // giải thích từng tiêu chí — phục vụ kiểm toán
  brandWarnings: string[];
  alternatives: string[];      // tiêu chí thay thế nếu spec bị lockout
  complianceStatus: 'compliant' | 'warning' | 'violation';
  legalBasis: string[];
}
```

**Test strategy:**
- Unit: `reviewSpec()` phát hiện 40+ brand pattern (mở rộng từ P5-02)
- Unit: `suggestAlternatives()` trả về spec hợp lệ khi input có tên thương hiệu
- Unit: `batchGenerate()` xử lý đúng mọi loại category
- Integration: feedback loop — `LegalReviewerAgent` phát hiện brand lock → `SpecificationAgent` tự sửa

**Dependencies:** `ai/specGenerator.ts`, `ai/legalReviewer.ts`, `AgentRegistry`

**Độ phức tạp:** Trung bình

---

### P6-03 — Legal Reviewer Agent

**Mục tiêu:**  
Rà soát pháp lý toàn diện ở cấp độ hồ sơ (không chỉ `ProcurementPackage` như P5-03) — bao gồm 28 tài liệu được tạo, kiểm tra chéo giữa các văn bản, và sinh báo cáo kiểm toán có thể in.

**Phát triển từ:** `ai/legalReviewer.ts` (P5-03) — nâng cấp scope từ package-level lên dossier-level.

**Chức năng chính:**
- `reviewPackage(pkg)` → (tái sử dụng P5-03)
- `reviewDossier(pkg, documentIds[])` → kiểm tra toàn bộ bộ hồ sơ
- `crossCheck(pkg)` → kiểm tra nhất quán giữa các văn bản (vd: ngày trong KHLCNT vs QĐ phê duyệt vs Hợp đồng)
- `explainFinding(finding)` → giải thích bằng ngôn ngữ tự nhiên, trích dẫn căn cứ đầy đủ
- `suggestFix(finding)` → gợi ý cách khắc phục cụ thể
- Phát sóng (broadcast) findings lên `AgentRegistry` để các agent khác phản ứng

**Files:**
```
app/src/agents/LegalReviewerAgent.ts
app/src/agents/__tests__/legal-reviewer-agent.test.ts
```

**API:**
```typescript
export interface DossierReviewInput {
  pkg: ProcurementPackage;
  documentIds: number[];       // subset của 28 documents cần review
  methodCode: string;
}

export interface DossierReviewOutput {
  findings: LegalFinding[];    // kế thừa từ P5-03
  crossCheckIssues: CrossCheckIssue[];  // mâu thuẫn giữa các văn bản
  complianceScore: number;     // 0–100: điểm tuân thủ pháp lý
  auditReadiness: 'ready' | 'conditional' | 'not-ready';
  recommendations: string[];
  legalBasis: string[];
}

export interface CrossCheckIssue {
  severity: Severity;
  doc1Id: number;
  doc2Id: number;
  field: string;
  description: string;
}
```

**Test strategy:**
- Unit: `crossCheck()` phát hiện ngày Hợp đồng < ngày phê duyệt kết quả
- Unit: `complianceScore` = 100 với fixture `pkgS1Wins` hợp lệ
- Unit: `auditReadiness = 'not-ready'` khi có findings CRITICAL
- Integration: `broadcast` findings → `SpecificationAgent` nhận và tự sửa spec
- Integration: `broadcast` findings → `RiskAgent` nhận để tạo risk report

**Dependencies:** `ai/legalReviewer.ts`, `docTemplates.ts`, `AgentRegistry`

**Độ phức tạp:** Cao

---

### P6-04 — Risk Agent

**Mục tiêu:**  
Tổng hợp rủi ro kiểm toán từ tất cả các agent, tạo báo cáo rủi ro có cấu trúc theo chuẩn Kiểm toán Nhà nước, và phát hiện các mẫu rủi ro hệ thống (ví dụ: chia nhỏ gói thầu lặp lại theo năm, sai phương thức LCNT xuyên suốt).

**Phát triển từ:** Mới hoàn toàn — aggregate layer trên P5-03 + P6-03.

**Chức năng chính:**
- `assessRisk(pkg, dossierReview, plannerOutput)` → báo cáo rủi ro tổng hợp
- `detectSystemicRisk(packages[])` → phát hiện mẫu vi phạm lặp lại
- `generateAuditReport(pkg)` → báo cáo định dạng chuẩn kiểm toán (có thể xuất DOCX)
- `prioritizeFindings(findings[])` → sắp xếp ưu tiên khắc phục theo tác động
- `estimateAuditExposure(pkg)` → ước tính mức độ rủi ro nếu bị kiểm toán phát hiện

**Files:**
```
app/src/agents/RiskAgent.ts
app/src/agents/__tests__/risk-agent.test.ts
```

**API:**
```typescript
export interface RiskInput {
  pkg: ProcurementPackage;
  dossierReview: DossierReviewOutput;    // từ P6-03
  plannerOutput?: PlannerOutput;         // từ P6-01 (có chia nhỏ không?)
  historicalPackages?: ProcurementPackage[]; // để phát hiện mẫu hệ thống
}

export interface RiskOutput {
  overallRisk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN';
  riskMatrix: RiskMatrixEntry[];
  systemicRisks: SystemicRisk[];
  auditExposure: {
    probability: 'high' | 'medium' | 'low';
    potentialFindings: string[];
    estimatedImpact: string;
  };
  mitigationPlan: MitigationStep[];
  auditReportDocx?: () => Document; // async DOCX export
}

export interface RiskMatrixEntry {
  category: 'legal' | 'procedural' | 'financial' | 'technical' | 'timeline';
  severity: Severity;
  finding: LegalFinding;
  likelihood: number;   // 1–5
  impact: number;       // 1–5
  riskScore: number;    // likelihood × impact
}
```

**Test strategy:**
- Unit: `overallRisk = 'CRITICAL'` khi có bất kỳ finding CRITICAL nào
- Unit: `detectSystemicRisk()` phát hiện 3 gói cùng loại có ngày phê duyệt trùng nhau
- Unit: `riskMatrix` được sắp xếp theo `riskScore` giảm dần
- Unit: `estimateAuditExposure` = high khi phương thức LCNT sai
- Integration: output từ `LegalReviewerAgent` → `RiskAgent` → `auditReport`

**Dependencies:** `ai/legalReviewer.ts`, `LegalReviewerAgent`, `PlannerAgent`, `AgentRegistry`

**Độ phức tạp:** Cao

---

### P6-05 — Conversational Chat Agent

**Mục tiêu:**  
Cung cấp giao diện hỏi đáp đa lượt (multi-turn) bằng tiếng Việt tự nhiên, hiểu ngữ cảnh gói thầu hiện tại, và trả lời câu hỏi pháp luật đấu thầu với trích dẫn căn cứ chính xác. Không fabricate nội dung pháp lý.

**Phát triển từ:** `ai/legalKnowledgeBase.ts` (P5-04, `answerQuestion()`) — thêm conversation history, context awareness, và multi-turn reasoning.

**Chức năng chính:**
- `chat(message, context)` → `ChatResponse` có `answer`, `sources`, `followUpSuggestions`
- `setContext(pkg)` → gắn context gói thầu hiện tại vào mọi câu hỏi tiếp theo
- `getHistory()` → lịch sử hội thoại có thể xuất (phục vụ kiểm toán)
- `reset()` → xóa context và lịch sử
- `suggestNextActions(pkg, findings)` → gợi ý hành động tiếp theo dựa trên tình trạng hiện tại

**Giới hạn quan trọng (tuân thủ CLAUDE.md):**
- KB nguồn là `LEGAL_KB` tĩnh (15 entries Phase 5 + mở rộng Phase 6)
- Câu trả lời luôn kèm `sources[]` — không có nguồn thì confidence = 'low'
- Không sử dụng LLM để tạo ra căn cứ pháp lý mới
- Nếu tích hợp LLM: chỉ dùng để paraphrase câu trả lời từ KB, không để tạo nội dung pháp lý

**Files:**
```
app/src/agents/ChatAgent.ts
app/src/components/AgentChat/ChatPanel.tsx
app/src/components/AgentChat/ChatMessage.tsx
app/src/components/AgentChat/ChatInput.tsx
app/src/agents/__tests__/chat-agent.test.ts
```

**API:**
```typescript
export interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  sources: string[];
  confidence: 'high' | 'medium' | 'low';
  timestamp: number;
  relatedFindings?: LegalFinding[];
}

export interface ChatInput {
  message: string;
  packageContext?: ProcurementPackage;  // optional — enriches answers
  history: ChatMessage[];               // for multi-turn context
}

export interface ChatOutput {
  answer: string;
  sources: string[];
  confidence: 'high' | 'medium' | 'low';
  followUpSuggestions: string[];  // suggested next questions
  relatedKBEntries: SearchResult[];
  relatedFindings?: LegalFinding[]; // if context package has relevant findings
}
```

**Luồng xử lý nội bộ:**
1. Tokenize + normalize query (kế thừa từ `legalKnowledgeBase.ts`)
2. Tìm kiếm trong KB → `SearchResult[]`
3. Nếu có context package → bổ sung findings liên quan từ P6-03
4. Tổng hợp `ChatOutput` — KHÔNG fabricate nếu KB score < threshold
5. Đề xuất follow-up questions dựa trên KB category

**Test strategy:**
- Unit: `chat()` với câu hỏi về ngưỡng → trả lời đúng theo `LEGAL_KB`
- Unit: `chat()` câu hỏi không liên quan → `confidence = 'low'`, `sources = []`
- Unit: multi-turn — câu hỏi 2 tham chiếu "gói thầu đó" → agent hiểu từ `history`
- Unit: `setContext(pkg)` → câu hỏi "phương thức nào phù hợp?" → agent dùng giá trị của pkg
- Integration: `ChatAgent` gọi `LegalReviewerAgent` khi câu hỏi liên quan đến rủi ro

**Dependencies:** `ai/legalKnowledgeBase.ts`, `ai/legalReviewer.ts`, `AgentRegistry`

**Độ phức tạp:** Cao

---

### P6-06 — Autonomous Procurement Agent

**Mục tiêu:**  
Master orchestrator điều phối toàn bộ 5 agent còn lại theo một state machine để tự động hoàn thành quy trình mua sắm đầu-cuối — từ mô tả yêu cầu đến bộ hồ sơ ký kết — với khả năng dừng và hỏi người dùng khi gặp quyết định ngưỡng.

**Phát triển từ:** `ai/workflowOrchestrator.ts` (P5-05) — từ pipeline 5 bước tuyến tính lên state machine với điều kiện, retry, và agent collaboration.

**Chức năng chính:**
- `run(goal)` → khởi động quy trình tự động, trả về `AgentSession`
- `pause()` / `resume(answer)` → dừng tại điểm cần người dùng quyết định
- `getStatus()` → trạng thái hiện tại của state machine
- `getTrace()` → toàn bộ audit trail: mọi message giữa các agent
- `exportSession()` → xuất session dưới dạng JSON (lưu trữ, chia sẻ, kiểm toán)
- `generateReport()` → báo cáo tóm tắt quy trình cho Ban lãnh đạo

**State Machine:**
```
IDLE
  ↓ run(goal)
PLANNING        [PlannerAgent]       → nếu ambiguous → ASK_USER
  ↓
SPECIFYING      [SpecificationAgent] → nếu brand lock detected → SPECIFYING (loop)
  ↓
LEGAL_REVIEW    [LegalReviewerAgent] → nếu CRITICAL → ASK_USER hoặc SPECIFYING
  ↓
RISK_ASSESSMENT [RiskAgent]          → nếu risk CRITICAL → ASK_USER
  ↓
READY_FOR_EXPORT                     → người dùng xác nhận
  ↓
EXPORTING       → ZIP generation
  ↓
DONE
```

**Điểm dừng bắt buộc (ASK_USER):**
- Khi ngưỡng phương thức LCNT không xác định được rõ ràng
- Khi phát hiện nguy cơ chia nhỏ gói thầu [CRITICAL]
- Khi rủi ro kiểm toán ở mức CRITICAL và chưa có kế hoạch khắc phục
- Khi LLM (nếu bật) muốn tạo căn cứ pháp lý mà không có trong KB

**Files:**
```
app/src/agents/AutonomousAgent.ts
app/src/agents/AgentRegistry.ts
app/src/agents/types.ts
app/src/components/AutonomousWorkflow/AutonomousPanel.tsx
app/src/components/AutonomousWorkflow/StepTimeline.tsx
app/src/agents/__tests__/autonomous-agent.test.ts
```

**API:**
```typescript
export type WorkflowState =
  | 'idle' | 'planning' | 'specifying' | 'legal-review'
  | 'risk-assessment' | 'ask-user' | 'ready-for-export'
  | 'exporting' | 'done' | 'error';

export interface AgentSession {
  sessionId: string;         // UUID — audit identifier
  state: WorkflowState;
  goal: string;
  pkg?: ProcurementPackage;
  plannerOutput?: PlannerOutput;
  dossierReview?: DossierReviewOutput;
  riskOutput?: RiskOutput;
  messageLog: AgentMessage[]; // full trace
  pendingQuestion?: UserQuestion;
  startedAt: number;
  completedAt?: number;
}

export interface UserQuestion {
  questionId: string;
  agentId: AgentId;
  question: string;
  options?: string[];        // multiple-choice nếu có
  required: boolean;
  legalContext?: string;
}
```

**Cơ chế retry:**
- Nếu `SpecificationAgent` liên tục sinh spec có brand lock sau 3 lần → escalate lên user
- Nếu `LegalReviewerAgent` tìm thấy CRITICAL không thể tự khắc phục → pause và hỏi
- Tất cả retry phải ghi vào `messageLog` để truy vết

**Test strategy:**
- Unit: state machine transitions đúng thứ tự: IDLE → PLANNING → SPECIFYING → ...
- Unit: `pause()` dừng đúng tại trạng thái `ASK_USER`
- Unit: `resume(answer)` tiếp tục từ trạng thái `ASK_USER` với đáp án người dùng
- Unit: `getTrace()` chứa tất cả `AgentMessage` của session
- Integration: full flow — goal "20 máy tính" → DONE với bộ hồ sơ ZIP
- Integration: CRITICAL finding → ASK_USER → resume → DONE
- Regression: toàn bộ 269 tests Phase 5 không bị phá vỡ

**Dependencies:** Tất cả P6-01 đến P6-05, `ai/workflowOrchestrator.ts`, `AgentRegistry`, `docTemplates.ts`

**Độ phức tạp:** Rất cao

---

### Bảng tóm tắt Phase 6

| Mã | Tên | File chính | Phát triển từ | Độ phức tạp | Ưu tiên |
|---|---|---|---|---|---|
| P6-01 | Procurement Planner Agent | `agents/PlannerAgent.ts` | P5-01 | Trung bình-Cao | 1 |
| P6-02 | Specification Agent | `agents/SpecificationAgent.ts` | P5-02 | Trung bình | 2 |
| P6-03 | Legal Reviewer Agent | `agents/LegalReviewerAgent.ts` | P5-03 | Cao | 3 |
| P6-04 | Risk Agent | `agents/RiskAgent.ts` | Mới | Cao | 4 |
| P6-05 | Conversational Chat Agent | `agents/ChatAgent.ts` | P5-04 | Cao | 5 |
| P6-06 | Autonomous Procurement Agent | `agents/AutonomousAgent.ts` | P5-05 | Rất cao | 6 |

**Thứ tự thực hiện khuyến nghị:** P6-01 → P6-02 → P6-03 → P6-04 → P6-05 → P6-06  
(Mỗi agent trước là dependency của agent sau; P6-06 là integration point của tất cả.)

---

### Infrastructure triển khai thực tế

| Thành phần | Mục đích | Trạng thái |
|---|---|---|
| `agents/types.ts` | Định nghĩa `AgentMessage`, `IAgent`, `AgentId` | ✅ Done |
| `agents/AgentRegistry.ts` | Message broker, routing, audit trace log | ✅ Done |
| `agents/index.ts` | Barrel export — public API cho toàn bộ agent layer | ✅ Done (wired via AgentProviderPanel — Phase 7) |
| P6-10x providers (10 modules) | LLM providers, runtime, session, memory, multi-agent coordinator, UI panels | ✅ Done |
| P6-11x utilities (9 modules) | Logger, EventBus, CacheStore, ConfigStore, MetricsCollector, StateStore, TaskQueue, ResourcePool, RetryManager | ✅ Done |
| P6-12x network (10 modules) | RestClient, RateLimiter, HttpInterceptor, WebSocketClient, Scheduler, Pipeline, MiddlewareChain, HookManager, PluginManager, ServiceLocator | ✅ Done |

**Nguyên tắc LLM (nếu tích hợp Claude API):**
- LLM chỉ được phép: paraphrase, tóm tắt, định dạng văn phong hành chính
- LLM không được phép: tạo căn cứ pháp lý, bịa số văn bản, đặt ngưỡng giá trị
- Mọi output của LLM phải được `LegalReviewerAgent` kiểm tra trước khi đưa vào hồ sơ
- Nếu API không khả dụng: fallback về rule-based (Phase 5 logic) — hệ thống không bị gián đoạn

---

### Chiến lược testing Phase 6 — Kết quả thực tế

```
Tổng test đạt được: 3655 tests (82 test files)
├── Agent tests (56-test standard):  341 tests — 6 agents × ~57 avg
├── Provider tests (P6-10x/11x/12x): 2352 tests — 42 modules × 56
├── E2E + integration tests:          ~300 tests (e2e-workflow a/b/c/d, providers-e2e)
├── Phase 7 UI tests:                 168 tests — 3 tasks × 56 tests
│   ├── agent-provider-panel.test.ts  56 tests (Task A — 566592a)
│   ├── autonomous-workflow-panel.test.ts 56 tests (Task B — e9ec23b)
│   └── chat-interface-panel.test.ts  56 tests (Task C — beb2d5b)
├── Phase 7 E2E tests:                56 tests — e2e-phase7-ui.test.ts (Task E — 5f61a19)
└── Regression (Phase 1–5):           269+ tests tiếp tục pass
```

**Tiêu chuẩn 56-test per module (áp dụng từ Phase 6):**
- 12 nhóm test × ~4–5 tests mỗi nhóm
- Bao phủ: identity, state machine, pure functions (×3–4), process() paths, error paths, legal citations
- Mọi `AgentMessage` trong tests phải có `traceId` hợp lệ (AgentRegistry.log() throws on empty)

---

### Rủi ro kỹ thuật Phase 6

| Rủi ro | Mức | Kế hoạch giảm thiểu |
|---|---|---|
| Agent loop (A→B→A vô hạn) | [HIGH] | Giới hạn retry = 3, sau đó escalate to user |
| LLM fabricate căn cứ pháp lý | [CRITICAL] | LegalReviewerAgent review mọi LLM output; KB-only for legal citations |
| State machine stuck ở ASK_USER | [MEDIUM] | Timeout 30 phút → tự động IDLE; session lưu IndexedDB |
| docTemplates.ts (132KB) quá lớn | [MEDIUM] | Hoàn thành P4-02 trước khi bắt đầu Phase 6 |
| Browser memory với nhiều AgentSession | [LOW] | Giới hạn 10 sessions trong IndexedDB; xuất và xóa sessions cũ |

---

## Nguyên tắc duy trì (cập nhật cho Phase 6+)

1. **Audit trail bắt buộc:** Mọi `AgentMessage` phải có `traceId` — `AgentRegistry.log()` throws on empty `traceId`
2. **Floor test count:** Không được giảm dưới 4452 passing tests khi phát triển Phase 9+
3. **KB-first cho pháp lý:** Mọi căn cứ pháp lý phải có trong `LEGAL_KB` trước khi agent sử dụng; không fabricate
4. **Placeholder data:** Demo data vẫn dùng `[Tổ trưởng tổ chuyên gia]`, `[Nhà cung cấp số 1]`, v.v.
5. **Không breaking change:** Phase 5 API (`runWorkflow`, `reviewPackage`, `searchLegalKB`...) phải tiếp tục hoạt động
6. **Wiring pattern Phase 7:** UI components import từ `agents/index.ts` barrel (không import trực tiếp từ agent file)

---

## Phase 7 — UI Wiring ✅ DONE

> **Trạng thái:** Hoàn thành — branch `develop` (18/06/2026)  
> **Kết quả thực tế:**  
> - 3 component mới + 56 tests mỗi component  
> - 1 bộ E2E tests (56 tests)  
> - Tổng: 3655 tests passing / 82 test files / 0 regressions  
> - TypeScript: `tsc --noEmit` clean — 0 errors  

### Các task Phase 7

| Task | Nội dung | Trạng thái | Commit |
|---|---|---|---|
| Task A | AgentProviderPanel — createAgentSystem(), AgentSystemBundle | ✅ DONE | `566592a` |
| Task B | AutonomousWorkflowPanel — wire AutonomousAgent + WorkflowPanel | ✅ DONE | `e9ec23b` |
| Task C | ChatInterfacePanel — wire ChatAgent + AgentChatPanel, import vào App.tsx | ✅ DONE | `beb2d5b` |
| Task D | Tái cấu trúc thư mục components | ⏭ Intentionally skipped — không cần thiết |  |
| Task E | E2E UI tests — cover 3 panel mới + App.tsx integration | ✅ DONE | `5f61a19` |

### Kiến trúc wiring Phase 7

```
App.tsx
├── AgentProviderPanel (createAgentSystem → AgentSystemBundle)
│   ├── AgentRegistry (shared message broker)
│   ├── PlannerAgent, SpecificationAgent, LegalReviewerAgent
│   ├── RiskAgent, ChatAgent, AutonomousAgent
│   └── AgentStatusDashboard (status display)
├── AutonomousWorkflowPanel (bundle.autonomous)
│   └── WorkflowPanel (step timeline, session display)
└── ChatInterfacePanel (bundle.chat)
    └── AgentChatPanel (message bubbles, loading, error)
```

---

## Phase 8 — Audit Dashboard ✅ DONE

> **Trạng thái:** Hoàn thành — branch `develop` (19/06/2026)  
> **Kết quả thực tế:**  
> - 17 task hoàn thành (8-A đến 8-Q), đóng Phase với 8-R  
> - 14 component/module mới + 797 tests mới  
> - Tổng: 4452 tests passing / 96 test files / 0 regressions  
> - TypeScript: `tsc --noEmit` clean — 0 errors, 0 suppressions  

### Các task Phase 8

| Task | Nội dung | Trạng thái | Commit |
|---|---|---|---|
| 8-A | Wire packageContext vào ChatInterfacePanel | ✅ DONE | `40ff586` |
| 8-B | AgentOutputPanel — expose 4 specialist agents từ bundle | ✅ DONE | `b59982e` |
| 8-C | Mở rộng Legal KB từ 15 lên 21 entries (kb-016 đến kb-021) | ✅ DONE | `d73ad64` |
| 8-D | LegalKBPanel — surface live KB search results trong UI | ✅ DONE | `08b8b63` |
| 8-E | PackageLegalReviewPanel — surface P5-03 legal findings trong UI | ✅ DONE | `d9c8416` |
| 8-F | e2e-phase8-ui — 56 E2E tests cho 8-A đến 8-E | ✅ DONE | `f3f391e` |
| 8-G | llmBridge — LLM provider bridge với rule-based fallback | ✅ DONE | `474d475` |
| 8-H | AgentAuditExporter — HTML audit summary cho ZIP export | ✅ DONE | `5c3637e` |
| 8-I | PlannerBridge — route AiAssistantPanel qua P6-01 PlannerAgent | ✅ DONE | `fb48bae` |
| 8-J | Phase8DashboardPanel — collapsible dashboard 9 sections | ✅ DONE | `7955e94` |
| 8-K | AgentTracePanel — chronological audit trail từ AgentRegistry | ✅ DONE | `08df17f` |
| 8-L | AgentRegistryPanel — multi-trace registry overview | ✅ DONE | `74bad83` |
| 8-M | AgentFlowPanel — routing/flow summary theo cặp (from, to) | ✅ DONE | `8537c5c` |
| 8-N | AgentLegalCitationPanel — tần suất trích dẫn pháp lý | ✅ DONE | `9feb05d` |
| 8-O | AgentErrorPanel — chi tiết lỗi agent cross-trace | ✅ DONE | `d6a3ec8` |
| 8-P | e2e-phase8-agent-panels — 56 E2E tests cho 8-K đến 8-O | ✅ DONE | `0133434` |
| 8-Q | Wire 8-K đến 8-O vào Phase8DashboardPanel và App.tsx | ✅ DONE | `bf9f06b` |
| 8-R | Đóng Phase 8 — cập nhật tài liệu, xác nhận hoàn thành | ✅ DONE | _(commit này)_ |

### Kiến trúc wiring Phase 8

```
App.tsx
├── Phase8DashboardPanel (toggle "Dashboard Phase 8")   ← 8-Q
│   ├── [1] AgentOutputPanel (8-B) — 4 specialist agents
│   ├── [2] LegalKBPanel (8-D) — live KB results
│   ├── [3] PackageLegalReviewPanel (8-E) — legal findings
│   ├── [4] audit-report section (8-H) — overallRisk, auditReadiness
│   ├── [5] AgentTracePanel (8-K) — chronological message trace
│   ├── [6] AgentRegistryPanel (8-L) — multi-trace registry overview
│   ├── [7] AgentFlowPanel (8-M) — routing/flow summary
│   ├── [8] AgentLegalCitationPanel (8-N) — citation frequency
│   └── [9] AgentErrorPanel (8-O) — error-only view
├── AgentOutputPanel (toggle "Tác nhân chuyên biệt")    ← 8-B (standalone)
├── LegalKBPanel (toggle "Tra cứu pháp lý")            ← 8-D (standalone)
└── PackageLegalReviewPanel (toggle "Kiểm tra pháp lý") ← 8-E (standalone)
```

### Chiến lược testing Phase 8 — Kết quả thực tế

```
Tests thêm trong Phase 8: +797 tests (3655 → 4452)
├── UI panels (56-test standard):      784 tests — 14 module × 56
│   ├── agent-output-panel.test.ts     56 tests (8-B — b59982e)
│   ├── ai-legal-kb.test.ts            56 tests (8-C — d73ad64)
│   ├── legal-kb-panel.test.ts         56 tests (8-D — 08b8b63)
│   ├── package-legal-review-panel.test.ts 56 tests (8-E — d9c8416)
│   ├── llm-bridge.test.ts             56 tests (8-G — 474d475)
│   ├── agent-audit-exporter.test.ts   56 tests (8-H — 5c3637e)
│   ├── planner-bridge.test.ts         56 tests (8-I — fb48bae)
│   ├── phase8-dashboard-panel.test.ts 56 tests (8-J — 7955e94)
│   ├── agent-trace-panel.test.ts      56 tests (8-K — 08df17f)
│   ├── agent-registry-panel.test.ts   56 tests (8-L — 74bad83)
│   ├── agent-flow-panel.test.ts       56 tests (8-M — 8537c5c)
│   ├── agent-legal-citation-panel.test.ts 56 tests (8-N — 9feb05d)
│   ├── agent-error-panel.test.ts      56 tests (8-O — d6a3ec8)
│   └── (8-A wiring only, 8-Q wiring — updated existing tests)
└── E2E tests:                         112 tests
    ├── e2e-phase8-ui.test.ts          56 tests (8-F — f3f391e)  ← covers 8-A through 8-E
    └── e2e-phase8-agent-panels.test.ts 56 tests (8-P — 0133434) ← covers 8-K through 8-O
```

### Nợ kỹ thuật còn lại sau Phase 8

| Hạng mục | Mức | Ghi chú |
|---|---|---|
| `fmtTs`/`fmtPayload` trùng lặp | [MEDIUM] | Private helpers trong AgentRegistryPanel + AgentErrorPanel vs `formatTimestamp`/`formatPayload` exported từ AgentTracePanel. Resolve khi tạo `app/src/utils/agentFormatters.ts` |
| `traceMessages=[]` tĩnh trong App.tsx | [LOW] | Phase8DashboardPanel nhận `traceMessages=[]` — cần wire với registry.getTrace() khi có active trace |
| Standalone panels không xóa khi dùng Dashboard | [LOW] | AgentOutputPanel/LegalKBPanel/PackageLegalReviewPanel vẫn render độc lập song song với Dashboard — không gây lỗi nhưng có thể gây nhầm lẫn UX |

---

## Backlog Phase 9 (chưa lên kế hoạch)

| Hạng mục | Mô tả | Phụ thuộc |
|---|---|---|
| Active trace wiring | Wire `registry.log()` output vào `traceMessages` trong real-time | Phase 8 complete |
| LLM API integration | Kết nối Claude API thực cho ChatAgent + LegalReviewerAgent | 8-G (llmBridge) |
| IndexedDB persistence | Lưu AgentSession qua IndexedDB; giới hạn 10 sessions | Phase 6 session design |
| E2E browser tests | Playwright/Cypress cho golden path qua UI thực | Phase 8 component stable |
| Export agent output | Tích hợp output agent vào dossier ZIP export | 8-H (AgentAuditExporter) |
| Shared formatter utilities | `app/src/utils/agentFormatters.ts` — resolve [MEDIUM] tech debt | 8-K, 8-L, 8-O |
