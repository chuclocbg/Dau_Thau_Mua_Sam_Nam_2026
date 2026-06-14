# P6-01 Procurement Planner Agent — Thiết Kế Chi Tiết

> **Tài liệu:** Thiết kế kiến trúc, không phải implementation  
> **Ngày:** 14/06/2026  
> **Phụ thuộc Phase 5:** `ai/packageGenerator.ts`, `ai/legalReviewer.ts`, `ai/workflowOrchestrator.ts`  
> **Phụ thuộc Phase 6 (cần thiết trước):** `agents/types.ts`, `agents/AgentRegistry.ts`  
> **Không thay đổi code hiện tại**

---

## 1. Vị trí trong kiến trúc Phase 6

```
User / AutonomousAgent (P6-06)
        │
        │  PlannerRequest message (traceId = "abc-123")
        ▼
┌─────────────────────────────────────────────────────────┐
│                  PlannerAgent (P6-01)                   │
│                                                         │
│  IDLE → PARSING_GOAL → DETECTING_SPLIT                  │
│       → VALIDATING_AUTHORITY → BUILDING_CALENDAR        │
│       → COMPOSING_RESPONSE → IDLE                       │
│                                                         │
│  Calls (read-only, no side effects):                    │
│    ├── generatePackageSuggestion()   [P5-01]            │
│    ├── reviewPackage()               [P5-03]            │
│    └── runWorkflow()                 [P5-05] (optional) │
│                                                         │
│  Emits to AgentRegistry:                                │
│    ├── event: "split-warning"  → broadcast              │
│    └── response: PlannerOutput → caller                 │
└─────────────────────────────────────────────────────────┘
        │
        │  PlannerResponse message (traceId = "abc-123")
        ▼
AgentRegistry trace log (persisted, auditable)
```

**Điểm khác biệt so với P5-01 (`generatePackageSuggestion`):**

| Khía cạnh | P5-01 (packageGenerator) | P6-01 (PlannerAgent) |
|---|---|---|
| Đầu vào | 1 NL request → 1 gói thầu | 1 mục tiêu ngân sách → N gói thầu |
| Phát hiện chia nhỏ | Không | Có — [CRITICAL] |
| Kiểm tra thẩm quyền | Không | Có — theo TT 13/2026/TT-BCT |
| Lịch mua sắm | Không | Có — phân bổ theo quý |
| Giao tiếp | Hàm thuần túy | Agent message-passing |
| Audit trail | Không | traceId xuyên suốt |
| Trạng thái | Stateless | Stateful (state machine) |

---

## 2. State Machine

### Các trạng thái

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  IDLE ──── receive PlannerRequest ────► PARSING_GOAL                │
│                                              │                      │
│                              generatePackageSuggestion()            │
│                              cho từng item trong goal               │
│                                              │                      │
│                                              ▼                      │
│                                     DETECTING_SPLIT                 │
│                                              │                      │
│                            groupBy(category, fundingSource)         │
│                            sum per group vs threshold               │
│                                              │                      │
│                    ┌─────────────────────────┴───────────────────┐  │
│                    │ split detected                no split       │  │
│                    ▼                                   ▼          │  │
│            emit "split-warning"          VALIDATING_AUTHORITY     │  │
│            (broadcast)                       │                    │  │
│                    │                  per-package authority check  │  │
│                    └──────────────────────────┘                   │  │
│                                              │                    │  │
│                                              ▼                    │  │
│                                    BUILDING_CALENDAR              │  │
│                                              │                    │  │
│                                    assign quarters Q1-Q4          │  │
│                                    based on lead time + priority   │  │
│                                              │                    │  │
│                                              ▼                    │  │
│                                   COMPOSING_RESPONSE              │  │
│                                              │                    │  │
│                                    assemble PlannerOutput         │  │
│                                    attach legalBasis[]            │  │
│                                              │                    │  │
│                                              ▼                    │  │
│                              emit PlannerResponse → caller        │  │
│                                              │                    │  │
│                                              ▼                    │  │
│                                           IDLE                    │  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Bảng chuyển trạng thái

| Trạng thái hiện tại | Điều kiện | Trạng thái tiếp theo | Hành động |
|---|---|---|---|
| IDLE | nhận `PlannerRequest` | PARSING_GOAL | khởi tạo session, ghi log |
| PARSING_GOAL | tất cả items phân tích xong | DETECTING_SPLIT | tạo `AISuggestion[]` |
| PARSING_GOAL | input rỗng | IDLE | emit lỗi |
| DETECTING_SPLIT | không có split | VALIDATING_AUTHORITY | tiếp tục |
| DETECTING_SPLIT | có split | VALIDATING_AUTHORITY | emit "split-warning" broadcast |
| VALIDATING_AUTHORITY | tất cả packages đã kiểm tra | BUILDING_CALENDAR | tạo `AuthorityCheck[]` |
| BUILDING_CALENDAR | lịch đã xây xong | COMPOSING_RESPONSE | tạo `ProcurementCalendar` |
| COMPOSING_RESPONSE | response đã lắp ráp | IDLE | emit `PlannerResponse` |
| Bất kỳ | lỗi nội bộ | IDLE | emit error message, log stack |

### Bất biến trạng thái (state invariants)

- `IDLE`: `currentTraceId` = null; không có session đang chạy
- `PARSING_GOAL` → `COMPOSING_RESPONSE`: `currentTraceId` phải là traceId từ request ban đầu
- Mỗi chuyển trạng thái phải ghi 1 `AgentMessage` vào AgentRegistry với `type: 'event'`
- Trạng thái `IDLE` sau khi hoàn thành: mọi internal state đã xóa sạch

---

## 3. Interfaces TypeScript đầy đủ

### 3.1 Infrastructure — types.ts (cần implement trước)

```typescript
// app/src/agents/types.ts

export type AgentId =
  | 'planner'
  | 'specification'
  | 'legal-reviewer'
  | 'risk'
  | 'chat'
  | 'autonomous';

/** Every message flowing through the system must have a traceId. */
export interface AgentMessage {
  traceId: string;              // UUID v4 — required, never empty
  from: AgentId | 'user';
  to: AgentId | 'broadcast';
  type: 'request' | 'response' | 'event' | 'error';
  payload: unknown;
  timestamp: number;            // Date.now()
  legalBasis?: string[];        // citations emitted or consumed by this message
  parentTraceId?: string;       // if this message is a child of another trace
}

/** Base interface every agent implements. */
export interface IAgent {
  readonly id: AgentId;
  readonly name: string;
  process(msg: AgentMessage): Promise<AgentMessage>;
  getCapabilities(): string[];
}
```

### 3.2 PlannerAgent interfaces

```typescript
// app/src/agents/PlannerAgent.ts (type section)

import type { AISuggestion } from '../ai/packageGenerator';
import type { LegalFinding } from '../ai/legalReviewer';
import type { WorkflowResult } from '../ai/workflowOrchestrator';
import type { AgentMessage } from './types';

// ─── Input ────────────────────────────────────────────────────────────────────

/**
 * What the caller sends to PlannerAgent.
 * Placed in AgentMessage.payload when type = 'request'.
 */
export interface PlannerInput {
  /** e.g. "Trang bị phòng máy mới cho Khoa CNTT, mua bàn ghế văn phòng phẩm" */
  naturalLanguageGoal: string;
  budgetYear: number;
  totalBudget?: number;           // tổng ngân sách năm (nếu có)
  fundingSource?: 'autonomy_fund' | 'state_budget' | 'other_revenue';
  /** Existing packages from previous calls — used for split detection */
  existingPackages?: AISuggestion[];
}

// ─── Output ───────────────────────────────────────────────────────────────────

/** Authority approval requirements per package */
export interface AuthorityCheck {
  packageCode: string;
  packageName: string;
  estimatedTotal: number;
  approvalLevel: 'rector_direct' | 'rector_with_khlcnt' | 'ministry';
  approvalAuthority: string;      // human-readable description
  khlcntRequired: boolean;
  ministerialApproval: boolean;
  legalBasis: string[];
}

/** Quarter slot in the annual procurement calendar */
export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface CalendarEntry {
  packageCode: string;
  packageName: string;
  quarter: Quarter;
  estimatedMonth: number;         // 1–12
  leadTimeDays: number;           // procurement method lead time
  rationale: string;              // why this quarter
  procurementMethod: string;
  estimatedTotal: number;
}

export interface ProcurementCalendar {
  budgetYear: number;
  entries: CalendarEntry[];
  totalByQuarter: Record<Quarter, number>;
  totalAnnual: number;
  khlcntSubmissionDate: string;   // recommended KHLCNT submission date (ISO 8601)
}

/**
 * Full output returned by PlannerAgent.
 * Placed in AgentMessage.payload when type = 'response'.
 */
export interface PlannerOutput {
  packages: AISuggestion[];
  splitWarnings: LegalFinding[];      // [CRITICAL] if package splitting detected
  authorityChecks: AuthorityCheck[];
  calendar: ProcurementCalendar;
  totalEstimated: number;
  budgetUtilization: number;          // totalEstimated / totalBudget (0–1), or -1 if no budget given
  legalBasis: string[];               // all citations used in this plan
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];                 // non-critical human-readable notes
  /** Optional: runWorkflow() results per package, if deep analysis requested */
  workflowResults?: WorkflowResult[];
}

// ─── Agent-specific message payloads ──────────────────────────────────────────

/** Broadcast event emitted when splitting is detected */
export interface SplitWarningPayload {
  category: string;
  packages: Pick<AISuggestion, 'packageCode' | 'packageName' | 'estimatedTotal'>[];
  combinedTotal: number;
  thresholdCrossed: number;
  finding: LegalFinding;
}

/** Internal state transition event (type = 'event') */
export interface PlannerStateEvent {
  previousState: PlannerState;
  nextState: PlannerState;
  timestamp: number;
  detail?: string;
}

export type PlannerState =
  | 'idle'
  | 'parsing-goal'
  | 'detecting-split'
  | 'validating-authority'
  | 'building-calendar'
  | 'composing-response';
```

---

## 4. AgentMessage Schema

### 4.1 Request (caller → PlannerAgent)

```typescript
const requestMessage: AgentMessage = {
  traceId: "550e8400-e29b-41d4-a716-446655440000",  // UUID v4
  from: "autonomous",       // hoặc "user" nếu gọi trực tiếp
  to: "planner",
  type: "request",
  payload: {                // PlannerInput
    naturalLanguageGoal: "Trang bị 20 máy tính và văn phòng phẩm cho năm 2026",
    budgetYear: 2026,
    totalBudget: 500_000_000,
    fundingSource: "autonomy_fund",
    existingPackages: [],
  } satisfies PlannerInput,
  timestamp: 1718366400000,
  legalBasis: [],
};
```

### 4.2 State transition event (PlannerAgent → PlannerAgent, internal)

```typescript
const stateEvent: AgentMessage = {
  traceId: "550e8400-e29b-41d4-a716-446655440000",  // SAME traceId
  from: "planner",
  to: "planner",
  type: "event",
  payload: {                // PlannerStateEvent
    previousState: "parsing-goal",
    nextState: "detecting-split",
    timestamp: 1718366400100,
    detail: "Phân tích xong 2 gói thầu từ mục tiêu",
  } satisfies PlannerStateEvent,
  timestamp: 1718366400100,
};
```

### 4.3 Split-warning broadcast (PlannerAgent → broadcast)

```typescript
const splitWarning: AgentMessage = {
  traceId: "550e8400-e29b-41d4-a716-446655440000",  // SAME traceId
  from: "planner",
  to: "broadcast",
  type: "event",
  payload: {                // SplitWarningPayload
    category: "Văn phòng phẩm và đồ dùng tiêu hao",
    packages: [
      { packageCode: "VPP-2026-01", packageName: "Mua sắm VPP Q1", estimatedTotal: 200_000_000 },
      { packageCode: "VPP-2026-02", packageName: "Mua sắm VPP Q3", estimatedTotal: 350_000_000 },
    ],
    combinedTotal: 550_000_000,
    thresholdCrossed: 500_000_000,
    finding: {
      severity: "CRITICAL",
      code: "PA-001",
      category: "package-splitting",
      message: "2 gói 'Văn phòng phẩm' tổng cộng 550 triệu — vượt ngưỡng chỉ định thầu rút gọn 500 triệu nhưng từng gói dưới ngưỡng.",
      legalBasis: "Điều 44 khoản 6 Luật Đấu thầu 22/2023/QH15 — nghiêm cấm chia nhỏ gói thầu để lẩn tránh thủ tục lựa chọn nhà thầu.",
      recommendation: "Hợp nhất thành 1 gói, áp dụng chào hàng cạnh tranh.",
    },
  } satisfies SplitWarningPayload,
  timestamp: 1718366400200,
  legalBasis: ["Điều 44 khoản 6 Luật Đấu thầu 22/2023/QH15"],
};
```

### 4.4 Response (PlannerAgent → caller)

```typescript
const responseMessage: AgentMessage = {
  traceId: "550e8400-e29b-41d4-a716-446655440000",  // SAME traceId
  from: "planner",
  to: "autonomous",         // hoặc "user"
  type: "response",
  payload: {                // PlannerOutput
    packages: [...],        // AISuggestion[]
    splitWarnings: [...],   // LegalFinding[] — CRITICAL nếu có
    authorityChecks: [...], // AuthorityCheck[]
    calendar: {...},        // ProcurementCalendar
    totalEstimated: 480_000_000,
    budgetUtilization: 0.96,
    legalBasis: [
      "Thông tư 13/2026/TT-BCT Điều 4 — phân cấp thẩm quyền phê duyệt",
      "Điều 44 khoản 6 Luật Đấu thầu 22/2023/QH15 — cấm chia nhỏ gói thầu",
      "Điều 38-41 Luật Đấu thầu 22/2023/QH15 — lập KHLCNT",
    ],
    confidence: "high",
    warnings: [],
  } satisfies PlannerOutput,
  timestamp: 1718366400500,
  legalBasis: [
    "Thông tư 13/2026/TT-BCT Điều 4",
    "Điều 44 khoản 6 Luật Đấu thầu 22/2023/QH15",
  ],
};
```

### 4.5 Error message

```typescript
const errorMessage: AgentMessage = {
  traceId: "550e8400-e29b-41d4-a716-446655440000",
  from: "planner",
  to: "autonomous",
  type: "error",
  payload: {
    code: "PLANNER_EMPTY_INPUT",
    message: "naturalLanguageGoal không được rỗng",
    state: "parsing-goal",
  },
  timestamp: 1718366400050,
};
```

---

## 5. PlannerResult Schema (chi tiết)

### 5.1 Toàn bộ PlannerOutput có dữ liệu mẫu

```typescript
const exampleOutput: PlannerOutput = {
  // ── Packages ──────────────────────────────────────────────────────────────
  packages: [
    {
      packageName: "Mua sắm 20 máy tính phục vụ đào tạo thực hành",
      packageCode: "MS-2026-MT01",
      fundingSource: "autonomy_fund",
      fundingSourceName: "Quỹ phát triển hoạt động sự nghiệp của nhà trường",
      packageType: "goods_fixed_asset",
      contractType: "lump_sum",
      estimatedTotal: 400_000_000,   // 20 × 20M
      contractDurationDays: 30,
      procurementMethodHint: "DIRECT_SELECTION_SIMPLIFIED — Chỉ định thầu rút gọn",
      detectedCategory: "Máy tính và thiết bị tin học",
      confidence: "high",
      notes: [
        "Tài sản cố định ≥10 triệu/đơn vị → ghi tăng tài sản theo TT 45/2018/TT-BTC.",
        "[HIGH] Tổng >200 triệu → cần đăng tải KHLCNT trên hệ thống mạng đấu thầu."
      ],
    },
    {
      packageName: "Mua sắm văn phòng phẩm phục vụ hoạt động",
      packageCode: "MS-2026-VPP01",
      fundingSource: "autonomy_fund",
      fundingSourceName: "Quỹ phát triển hoạt động sự nghiệp của nhà trường",
      packageType: "goods_consumable",
      contractType: "lump_sum",
      estimatedTotal: 80_000_000,
      contractDurationDays: 14,
      procurementMethodHint: "DIRECT_SELECTION_SIMPLIFIED — Chỉ định thầu rút gọn",
      detectedCategory: "Văn phòng phẩm và đồ dùng tiêu hao",
      confidence: "high",
      notes: [
        "Vật tư tiêu hao: không ghi tăng tài sản cố định — hạch toán chi phí theo TT 45/2018/TT-BTC."
      ],
    },
  ],

  // ── Split warnings ────────────────────────────────────────────────────────
  // Empty in this example — no splitting detected
  splitWarnings: [],

  // ── Authority checks ──────────────────────────────────────────────────────
  authorityChecks: [
    {
      packageCode: "MS-2026-MT01",
      packageName: "Mua sắm 20 máy tính...",
      estimatedTotal: 400_000_000,
      approvalLevel: "rector_with_khlcnt",
      approvalAuthority: "Hiệu trưởng (cần lập KHLCNT nội bộ trước khi triển khai)",
      khlcntRequired: true,
      ministerialApproval: false,
      legalBasis: [
        "Thông tư 13/2026/TT-BCT Điều 4 — thẩm quyền Hiệu trưởng",
        "Khoản 2 Điều 80 Nghị định 214/2025/NĐ-CP",
      ],
    },
    {
      packageCode: "MS-2026-VPP01",
      packageName: "Mua sắm văn phòng phẩm...",
      estimatedTotal: 80_000_000,
      approvalLevel: "rector_with_khlcnt",
      approvalAuthority: "Hiệu trưởng (cần lập KHLCNT nội bộ trước khi triển khai)",
      khlcntRequired: true,
      ministerialApproval: false,
      legalBasis: [
        "Thông tư 13/2026/TT-BCT Điều 4",
        "Khoản 2 Điều 80 Nghị định 214/2025/NĐ-CP",
      ],
    },
  ],

  // ── Procurement calendar ──────────────────────────────────────────────────
  calendar: {
    budgetYear: 2026,
    entries: [
      {
        packageCode: "MS-2026-VPP01",
        packageName: "Mua sắm văn phòng phẩm...",
        quarter: "Q1",
        estimatedMonth: 2,             // tháng 2 — khởi đầu năm
        leadTimeDays: 28,              // DIRECT_SELECTION_SIMPLIFIED: ~4 tuần
        rationale: "VPP có nhu cầu ngay đầu năm học; thời gian thực hiện ngắn",
        procurementMethod: "DIRECT_SELECTION_SIMPLIFIED",
        estimatedTotal: 80_000_000,
      },
      {
        packageCode: "MS-2026-MT01",
        packageName: "Mua sắm 20 máy tính...",
        quarter: "Q2",
        estimatedMonth: 4,             // tháng 4 — cần thời gian chuẩn bị KHLCNT
        leadTimeDays: 45,              // DIRECT_SELECTION_SIMPLIFIED + delivery: ~6 tuần
        rationale: "Tài sản cố định cần KHLCNT → thực hiện Q2 để có đủ thời gian chuẩn bị",
        procurementMethod: "DIRECT_SELECTION_SIMPLIFIED",
        estimatedTotal: 400_000_000,
      },
    ],
    totalByQuarter: {
      Q1: 80_000_000,
      Q2: 400_000_000,
      Q3: 0,
      Q4: 0,
    },
    totalAnnual: 480_000_000,
    khlcntSubmissionDate: "2026-01-15",  // khuyến nghị nộp KHLCNT trước 15/01
  },

  // ── Aggregates ────────────────────────────────────────────────────────────
  totalEstimated: 480_000_000,
  budgetUtilization: 0.96,             // 480M / 500M
  legalBasis: [
    "Điều 38-41 Luật Đấu thầu 22/2023/QH15 — lập và phê duyệt KHLCNT",
    "Điều 44 khoản 6 Luật Đấu thầu 22/2023/QH15 — cấm chia nhỏ gói thầu",
    "Thông tư 13/2026/TT-BCT Điều 4 — phân cấp thẩm quyền phê duyệt",
    "Nghị định 214/2025/NĐ-CP Điều 80 — thủ tục chỉ định thầu rút gọn",
    "Thông tư 45/2018/TT-BTC Điều 3 — phân loại tài sản cố định",
  ],
  confidence: "high",
  warnings: [],
  workflowResults: undefined,  // chưa chạy deep analysis
};
```

### 5.2 Schema validation rules

| Field | Constraint | Lý do |
|---|---|---|
| `packages.length` | ≥ 1 | Không trả về kế hoạch rỗng |
| `packages[*].estimatedTotal` | > 0 | Không phép value 0 — không thể xác định phương thức LCNT |
| `splitWarnings[*].severity` | phải là `'CRITICAL'` | Chia nhỏ gói thầu luôn là CRITICAL |
| `authorityChecks.length` | = `packages.length` | Mỗi gói phải có 1 authority check |
| `calendar.entries.length` | = `packages.length` | Mỗi gói phải có slot trong lịch |
| `calendar.totalAnnual` | = sum of `packages[*].estimatedTotal` | Bảo toàn số học |
| `legalBasis.length` | ≥ 1 | Audit requirement: phải có ít nhất 1 căn cứ |
| `traceId` trong response | = traceId của request | Truy vết phải nhất quán |

---

## 6. traceId Flow

### 6.1 Sơ đồ luồng traceId

```
─────────────────────────────────────────────────────────────────
Time →

T+0ms   User/Autonomous creates:
        { traceId: "abc-123", type: "request", payload: PlannerInput }
        Sent to → PlannerAgent

T+1ms   AgentRegistry.log(msg) → trace["abc-123"][0] = requestMsg
        PlannerAgent.process(msg) called

T+2ms   PlannerAgent emits STATE EVENT (internal):
        { traceId: "abc-123", type: "event", payload: { state: "parsing-goal" } }
        AgentRegistry.log → trace["abc-123"][1]

T+15ms  generatePackageSuggestion() runs for each item
        PlannerAgent emits STATE EVENT:
        { traceId: "abc-123", type: "event", payload: { state: "detecting-split" } }
        AgentRegistry.log → trace["abc-123"][2]

T+16ms  [if split detected]
        PlannerAgent emits BROADCAST:
        { traceId: "abc-123", to: "broadcast", type: "event", payload: SplitWarningPayload }
        AgentRegistry.log → trace["abc-123"][3]
        AgentRegistry.notifySubscribers("split-warning", payload)
        → RiskAgent subscribes and receives this (Phase 6 integration)

T+20ms  PlannerAgent emits STATE EVENT:
        { traceId: "abc-123", type: "event", payload: { state: "validating-authority" } }
        AgentRegistry.log → trace["abc-123"][4]

T+25ms  PlannerAgent emits STATE EVENT:
        { traceId: "abc-123", type: "event", payload: { state: "building-calendar" } }
        AgentRegistry.log → trace["abc-123"][5]

T+30ms  PlannerAgent emits RESPONSE:
        { traceId: "abc-123", type: "response", payload: PlannerOutput }
        AgentRegistry.log → trace["abc-123"][6]
        → Returned to caller

─────────────────────────────────────────────────────────────────
AgentRegistry.getTrace("abc-123") = [msg0, msg1, msg2, msg3, msg4, msg5, msg6]
                                    (full audit trail, 7 messages)
```

### 6.2 Nguyên tắc traceId

1. **Bất biến:** traceId KHÔNG ĐƯỢC thay đổi trong suốt vòng đời của 1 request
2. **Duy nhất:** mỗi `PlannerInput.process()` call tạo ra 1 traceId riêng (nếu gọi trực tiếp, không qua agent)
3. **Kế thừa:** nếu PlannerAgent gọi `runWorkflow()` (P5-05) để deep-analyze, workflowResults ghi rõ traceId nguồn
4. **Không phép `undefined`:** AgentRegistry reject bất kỳ message nào thiếu traceId
5. **Lưu trữ:** AgentRegistry giữ trace log trong bộ nhớ (Map<string, AgentMessage[]>); AutonomousAgent (P6-06) có thể persist vào IndexedDB

### 6.3 Sinh traceId

```typescript
// Trong PlannerAgent.process(), nếu message đến đã có traceId thì dùng lại:
const traceId = incomingMessage.traceId;

// Nếu gọi plan() trực tiếp (không qua message), sinh mới:
function generateTraceId(): string {
  // crypto.randomUUID() nếu available (browsers hiện đại):
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback:
  return `planner-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
```

---

## 7. Logic nghiệp vụ cốt lõi

### 7.1 Phân tích mục tiêu tự nhiên (PARSING_GOAL)

Thuật toán tách một NL goal thành nhiều items:

```
Input: "Trang bị 20 máy tính và 5 điều hòa và văn phòng phẩm cho năm 2026"

Bước 1: Tách bởi connector words: "và", "cùng với", ","
  → ["20 máy tính", "5 điều hòa", "văn phòng phẩm"]

Bước 2: Với mỗi fragment, gọi generatePackageSuggestion(fragment, budgetYear)
  → AISuggestion[0] = { detectedCategory: "Máy tính...", estimatedTotal: 400M, ... }
  → AISuggestion[1] = { detectedCategory: "Điều hòa...", estimatedTotal: 90M, ... }
  → AISuggestion[2] = { detectedCategory: "Văn phòng phẩm...", estimatedTotal: ?, ... }

Bước 3: Nếu fragment không nhận dạng được → confidence = 'low', ghi note
```

**Regex tách connector (cần implement):**
```typescript
const CONNECTOR_PATTERN = /\s+(và|cùng với|cùng|cộng với|thêm|bao gồm|plus)\s+/gi;
const COMMA_PATTERN = /\s*[,;]\s*/g;
```

### 7.2 Phát hiện chia nhỏ gói thầu (DETECTING_SPLIT)

```typescript
/**
 * Phát hiện vi phạm khoản 6 Điều 44 Luật ĐT 22/2023:
 * chia nhỏ gói thầu để lẩn tránh phương thức LCNT cao hơn.
 *
 * Thuật toán:
 * 1. Group packages by detectedCategory
 * 2. Cộng tổng từng group
 * 3. Kiểm tra xem từng package riêng lẻ có dưới threshold
 *    nhưng tổng group lại vượt threshold không
 */
function detectPackageSplitting(
  packages: AISuggestion[],
  existingPackages: AISuggestion[] = [],
): LegalFinding[] {
  const allPackages = [...existingPackages, ...packages];
  const groups = new Map<string, AISuggestion[]>();

  for (const pkg of allPackages) {
    const key = pkg.detectedCategory || 'unknown';
    groups.set(key, [...(groups.get(key) ?? []), pkg]);
  }

  const THRESHOLDS = [
    { value: 50_000_000,    name: '50 triệu (ngưỡng mua sắm trực tiếp)' },
    { value: 500_000_000,   name: '500 triệu (ngưỡng chỉ định thầu rút gọn)' },
    { value: 5_000_000_000, name: '5 tỷ (ngưỡng chào hàng cạnh tranh)' },
  ];

  const findings: LegalFinding[] = [];
  for (const [category, pkgs] of groups) {
    if (pkgs.length < 2) continue;
    const groupTotal = pkgs.reduce((s, p) => s + p.estimatedTotal, 0);
    const maxSingle  = Math.max(...pkgs.map(p => p.estimatedTotal));

    for (const threshold of THRESHOLDS) {
      if (maxSingle <= threshold.value && groupTotal > threshold.value) {
        findings.push({
          severity: 'CRITICAL',
          code: 'PA-001',
          category: 'package-splitting',
          field: category,
          message:
            `Phát hiện ${pkgs.length} gói "${category}": ` +
            `tổng ${groupTotal.toLocaleString('vi-VN')} đồng vượt ngưỡng ${threshold.name} ` +
            `nhưng từng gói riêng lẻ đều ≤ ngưỡng. Đây là dấu hiệu chia nhỏ gói thầu.`,
          legalBasis:
            'Điều 44 khoản 6 Luật Đấu thầu 22/2023/QH15 — nghiêm cấm chia nhỏ gói thầu ' +
            'nhằm lẩn tránh quy trình lựa chọn nhà thầu.',
          recommendation:
            `Hợp nhất tất cả ${pkgs.length} gói "${category}" thành 1 gói, ` +
            `áp dụng phương thức LCNT tương ứng với tổng giá trị.`,
        });
        break; // chỉ báo cáo vi phạm threshold thấp nhất
      }
    }
  }
  return findings;
}
```

### 7.3 Kiểm tra thẩm quyền (VALIDATING_AUTHORITY)

Dựa trên Thông tư 13/2026/TT-BCT và NĐ 214/2025/NĐ-CP:

| Giá trị gói | Cấp phê duyệt | KHLCNT | Bộ duyệt |
|---|---|---|---|
| ≤ 50 triệu VND | Hiệu trưởng (trực tiếp) | Không bắt buộc nội bộ | Không |
| 50M – 500 triệu VND | Hiệu trưởng + KHLCNT nội bộ | Bắt buộc | Không |
| > 500 triệu VND | Hiệu trưởng + KHLCNT trình Bộ CT | Bắt buộc | **Có** |

```typescript
function validateAuthority(pkg: AISuggestion): AuthorityCheck {
  const total = pkg.estimatedTotal;

  if (total <= 50_000_000) {
    return {
      packageCode: pkg.packageCode,
      packageName: pkg.packageName,
      estimatedTotal: total,
      approvalLevel: 'rector_direct',
      approvalAuthority: 'Hiệu trưởng (quyết định trực tiếp, không qua quy trình thầu)',
      khlcntRequired: false,
      ministerialApproval: false,
      legalBasis: [
        'Điểm m Khoản 1 Điều 23 Luật Đấu thầu 22/2023/QH15',
        'Khoản 4 Điều 80 Nghị định 214/2025/NĐ-CP',
        'Thông tư 13/2026/TT-BCT Điều 4',
      ],
    };
  }

  if (total <= 500_000_000) {
    return {
      packageCode: pkg.packageCode,
      packageName: pkg.packageName,
      estimatedTotal: total,
      approvalLevel: 'rector_with_khlcnt',
      approvalAuthority: 'Hiệu trưởng (cần lập và phê duyệt KHLCNT nội bộ trước khi triển khai)',
      khlcntRequired: true,
      ministerialApproval: false,
      legalBasis: [
        'Điều 38-41 Luật Đấu thầu 22/2023/QH15 — lập KHLCNT',
        'Khoản 2 và 3 Điều 80 Nghị định 214/2025/NĐ-CP',
        'Thông tư 13/2026/TT-BCT Điều 4',
      ],
    };
  }

  return {
    packageCode: pkg.packageCode,
    packageName: pkg.packageName,
    estimatedTotal: total,
    approvalLevel: 'ministry',
    approvalAuthority: 'Hiệu trưởng trình Bộ Công Thương phê duyệt KHLCNT trước khi tổ chức LCNT',
    khlcntRequired: true,
    ministerialApproval: true,
    legalBasis: [
      'Điều 38-41 Luật Đấu thầu 22/2023/QH15 — KHLCNT',
      'Nghị định 214/2025/NĐ-CP',
      'Thông tư 13/2026/TT-BCT Điều 4 — thẩm quyền Bộ Công Thương',
    ],
  };
}
```

### 7.4 Xây dựng lịch mua sắm (BUILDING_CALENDAR)

**Lead time theo phương thức LCNT:**
```typescript
const LEAD_TIME_DAYS: Record<string, number> = {
  DIRECT_50:                      14,   // 2 tuần
  DIRECT_SELECTION_SIMPLIFIED:    28,   // 4 tuần
  COMPETITIVE_SHOPPING:           45,   // 6 tuần
  OPEN_BIDDING:                   90,   // 3 tháng
};
```

**Quy tắc phân bổ theo quý:**
```
Q1 (tháng 1-3): Vật tư tiêu hao, văn phòng phẩm, dịch vụ hàng năm
Q2 (tháng 4-6): Tài sản cố định trung bình (≤500M), thiết bị lab
Q3 (tháng 7-9): Tài sản cố định lớn (>500M), thiết bị nặng
Q4 (tháng 10-12): Dự phòng, hoàn thiện tài sản còn lại
```

**Ưu tiên khi quý bị quá tải:**
1. `goods_consumable` → ưu tiên Q1 (cần ngay đầu năm)
2. `service` → phân bổ đều theo nhu cầu
3. `goods_fixed_asset` ≤ 200M → Q2
4. `goods_fixed_asset` > 200M → Q2-Q3 (cần thêm thời gian chuẩn bị KHLCNT)
5. `mixed` → tách thành 2 phần nếu cần

**Khuyến nghị ngày nộp KHLCNT:**
Theo Điều 38 Luật ĐT 22/2023: KHLCNT phải được phê duyệt trước khi bắt đầu gói đầu tiên trong năm. Khuyến nghị nộp trước **15 tháng 1** của năm ngân sách.

---

## 8. Files

```
app/src/agents/
├── types.ts                          ← PHẢI implement trước PlannerAgent
│   └── Exports: AgentId, AgentMessage, IAgent
│
├── AgentRegistry.ts                  ← PHẢI implement trước PlannerAgent
│   └── Exports: AgentRegistry class (singleton)
│       ├── register(agent: IAgent): void
│       ├── process(msg: AgentMessage): Promise<AgentMessage>
│       ├── getTrace(traceId: string): AgentMessage[]
│       ├── subscribe(event: string, handler: (msg: AgentMessage) => void): void
│       └── log(msg: AgentMessage): void
│
├── PlannerAgent.ts                   ← P6-01 implementation
│   └── Exports:
│       ├── PlannerAgent class (implements IAgent)
│       │   ├── id: 'planner'
│       │   ├── name: 'Procurement Planner Agent'
│       │   ├── process(msg): Promise<AgentMessage>
│       │   └── getCapabilities(): string[]
│       ├── PlannerInput interface
│       ├── PlannerOutput interface
│       ├── AuthorityCheck interface
│       ├── ProcurementCalendar interface
│       ├── CalendarEntry interface
│       ├── SplitWarningPayload interface
│       └── PlannerState type
│
└── __tests__/
    └── planner-agent.test.ts         ← P6-01 tests
```

### 8.1 Cấu trúc nội bộ PlannerAgent.ts

```typescript
// app/src/agents/PlannerAgent.ts

import { generatePackageSuggestion }   from '../ai/packageGenerator';
import { reviewPackage }                from '../ai/legalReviewer';
import { runWorkflow }                  from '../ai/workflowOrchestrator';  // optional
import type { IAgent, AgentMessage }   from './types';

// ─── Interfaces (exported) ────────────────────────────────────────────────────
export interface PlannerInput { ... }
export interface PlannerOutput { ... }
export interface AuthorityCheck { ... }
export interface ProcurementCalendar { ... }
export interface CalendarEntry { ... }
export interface SplitWarningPayload { ... }
export type PlannerState = ...;

// ─── Private helpers (not exported) ──────────────────────────────────────────
function parseGoalIntoItems(goal: string): string[] { ... }
function detectPackageSplitting(...): LegalFinding[] { ... }
function validateAuthority(pkg: AISuggestion): AuthorityCheck { ... }
function buildCalendar(packages: AISuggestion[], year: number): ProcurementCalendar { ... }
function getProcurementLeadTime(methodHint: string): number { ... }
function assignQuarter(pkg: AISuggestion): Quarter { ... }

// ─── Agent class ──────────────────────────────────────────────────────────────
export class PlannerAgent implements IAgent {
  readonly id = 'planner' as const;
  readonly name = 'Procurement Planner Agent';

  private state: PlannerState = 'idle';
  private currentTraceId: string | null = null;
  private registry: AgentRegistry;

  constructor(registry: AgentRegistry) {
    this.registry = registry;
  }

  async process(msg: AgentMessage): Promise<AgentMessage> {
    // Validate traceId
    // Transition: idle → parsing-goal
    // Call private helpers
    // Emit events to registry
    // Return response message
  }

  getCapabilities(): string[] {
    return [
      'annual-procurement-planning',
      'package-split-detection',
      'authority-validation',
      'procurement-calendar',
    ];
  }
}
```

---

## 9. Test Strategy

### 9.1 Danh sách test (30 tests)

**Group 1: parseGoalIntoItems (5 tests)**

```typescript
// planner-agent.test.ts

it('T01: tách đúng goal có 2 items nối bằng "và"', () => {
  const items = parseGoalIntoItems('20 máy tính và văn phòng phẩm');
  expect(items).toHaveLength(2);
  expect(items[0]).toContain('máy tính');
});

it('T02: tách đúng goal có 3 items nối bằng dấu phẩy', () => {
  const items = parseGoalIntoItems('máy tính, điều hòa, văn phòng phẩm');
  expect(items).toHaveLength(3);
});

it('T03: goal 1 item không bị tách', () => {
  const items = parseGoalIntoItems('20 máy tính để bàn');
  expect(items).toHaveLength(1);
});

it('T04: goal rỗng trả về mảng rỗng', () => {
  const items = parseGoalIntoItems('');
  expect(items).toHaveLength(0);
});

it('T05: connector "cùng với" được nhận dạng', () => {
  const items = parseGoalIntoItems('máy chiếu cùng với bảng trắng');
  expect(items).toHaveLength(2);
});
```

**Group 2: detectPackageSplitting (8 tests)**

```typescript
it('T06: không có split khi 1 gói dưới ngưỡng', () => {
  const pkgs = [makeSuggestion('stationery', 200_000_000)];
  expect(detectPackageSplitting(pkgs)).toHaveLength(0);
});

it('T07: [CRITICAL] 2 gói cùng loại tổng vượt 500M', () => {
  const pkgs = [
    makeSuggestion('stationery', 300_000_000),
    makeSuggestion('stationery', 250_000_000),
  ];
  const findings = detectPackageSplitting(pkgs);
  expect(findings).toHaveLength(1);
  expect(findings[0].severity).toBe('CRITICAL');
  expect(findings[0].code).toBe('PA-001');
});

it('T08: không báo split khi 2 gói khác loại', () => {
  const pkgs = [
    makeSuggestion('computer', 300_000_000),
    makeSuggestion('stationery', 300_000_000),
  ];
  expect(detectPackageSplitting(pkgs)).toHaveLength(0);
});

it('T09: phát hiện split ở ngưỡng 50M', () => {
  const pkgs = [
    makeSuggestion('stationery', 30_000_000),
    makeSuggestion('stationery', 25_000_000),
  ];
  const findings = detectPackageSplitting(pkgs);
  expect(findings[0].severity).toBe('CRITICAL');
});

it('T10: phát hiện split ở ngưỡng 5B', () => {
  const pkgs = [
    makeSuggestion('lab_equipment', 3_000_000_000),
    makeSuggestion('lab_equipment', 2_500_000_000),
  ];
  const findings = detectPackageSplitting(pkgs);
  expect(findings[0].severity).toBe('CRITICAL');
});

it('T11: existingPackages được cộng vào group', () => {
  const newPkgs = [makeSuggestion('computer', 300_000_000)];
  const existing = [makeSuggestion('computer', 300_000_000)];
  const findings = detectPackageSplitting(newPkgs, existing);
  expect(findings).toHaveLength(1);
  expect(findings[0].code).toBe('PA-001');
});

it('T12: finding chứa legalBasis Điều 44 khoản 6', () => {
  const pkgs = [
    makeSuggestion('furniture', 300_000_000),
    makeSuggestion('furniture', 250_000_000),
  ];
  const findings = detectPackageSplitting(pkgs);
  expect(findings[0].legalBasis).toContain('Điều 44 khoản 6');
});

it('T13: finding recommendation đề nghị hợp nhất', () => {
  const pkgs = [
    makeSuggestion('furniture', 300_000_000),
    makeSuggestion('furniture', 250_000_000),
  ];
  const findings = detectPackageSplitting(pkgs);
  expect(findings[0].recommendation.toLowerCase()).toContain('hợp nhất');
});
```

**Group 3: validateAuthority (6 tests)**

```typescript
it('T14: ≤50M → rector_direct, khlcntRequired=false', () => {
  const pkg = makeSuggestion('stationery', 40_000_000);
  const check = validateAuthority(pkg);
  expect(check.approvalLevel).toBe('rector_direct');
  expect(check.khlcntRequired).toBe(false);
  expect(check.ministerialApproval).toBe(false);
});

it('T15: 51M → rector_with_khlcnt', () => {
  const pkg = makeSuggestion('stationery', 51_000_000);
  const check = validateAuthority(pkg);
  expect(check.approvalLevel).toBe('rector_with_khlcnt');
  expect(check.khlcntRequired).toBe(true);
  expect(check.ministerialApproval).toBe(false);
});

it('T16: 500M boundary → rector_with_khlcnt (≤500M)', () => {
  const pkg = makeSuggestion('computer', 500_000_000);
  const check = validateAuthority(pkg);
  expect(check.approvalLevel).toBe('rector_with_khlcnt');
});

it('T17: 501M → ministry level', () => {
  const pkg = makeSuggestion('computer', 501_000_000);
  const check = validateAuthority(pkg);
  expect(check.approvalLevel).toBe('ministry');
  expect(check.ministerialApproval).toBe(true);
});

it('T18: authority check legalBasis không rỗng', () => {
  const pkg = makeSuggestion('lab_equipment', 2_000_000_000);
  const check = validateAuthority(pkg);
  expect(check.legalBasis.length).toBeGreaterThan(0);
  expect(check.legalBasis.some(b => b.includes('13/2026'))).toBe(true);
});

it('T19: packageCode và packageName được copy đúng', () => {
  const pkg = makeSuggestion('computer', 100_000_000);
  pkg.packageCode = 'TEST-001';
  pkg.packageName = 'Test Package';
  const check = validateAuthority(pkg);
  expect(check.packageCode).toBe('TEST-001');
  expect(check.packageName).toBe('Test Package');
});
```

**Group 4: buildCalendar (5 tests)**

```typescript
it('T20: calendar.entries.length = packages.length', () => {
  const pkgs = [makeSuggestion('computer', 200_000_000), makeSuggestion('stationery', 50_000_000)];
  const cal = buildCalendar(pkgs, 2026);
  expect(cal.entries).toHaveLength(2);
});

it('T21: totalAnnual = sum of estimatedTotals', () => {
  const pkgs = [makeSuggestion('computer', 300_000_000), makeSuggestion('stationery', 80_000_000)];
  const cal = buildCalendar(pkgs, 2026);
  expect(cal.totalAnnual).toBe(380_000_000);
});

it('T22: goods_consumable phân vào Q1', () => {
  const pkgs = [makeSuggestion('stationery', 50_000_000)];
  const cal = buildCalendar(pkgs, 2026);
  expect(cal.entries[0].quarter).toBe('Q1');
});

it('T23: khlcntSubmissionDate có định dạng ISO', () => {
  const pkgs = [makeSuggestion('computer', 200_000_000)];
  const cal = buildCalendar(pkgs, 2026);
  expect(cal.khlcntSubmissionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

it('T24: totalByQuarter cộng đúng cho 4 quý', () => {
  const pkgs = [makeSuggestion('stationery', 50_000_000), makeSuggestion('computer', 200_000_000)];
  const cal = buildCalendar(pkgs, 2026);
  const quarterSum = Object.values(cal.totalByQuarter).reduce((a, b) => a + b, 0);
  expect(quarterSum).toBe(cal.totalAnnual);
});
```

**Group 5: PlannerAgent.process() integration (6 tests)**

```typescript
const TODAY = new Date('2026-06-14');

it('T25: process() trả về response message với cùng traceId', async () => {
  const agent = new PlannerAgent(testRegistry);
  const msg = makePlannerRequest('20 máy tính', 'abc-001');
  const response = await agent.process(msg);
  expect(response.traceId).toBe('abc-001');
  expect(response.type).toBe('response');
});

it('T26: process() emit ít nhất 3 event messages vào registry', async () => {
  const agent = new PlannerAgent(testRegistry);
  const msg = makePlannerRequest('máy tính và văn phòng phẩm', 'abc-002');
  await agent.process(msg);
  const trace = testRegistry.getTrace('abc-002');
  const events = trace.filter(m => m.type === 'event');
  expect(events.length).toBeGreaterThanOrEqual(3); // state transitions
});

it('T27: split detected → event broadcast với type="event"', async () => {
  const agent = new PlannerAgent(testRegistry);
  const msg = makePlannerRequest('300M stationery và 300M stationery', 'abc-003');
  await agent.process(msg);
  const trace = testRegistry.getTrace('abc-003');
  const broadcast = trace.find(m => m.to === 'broadcast');
  expect(broadcast).toBeDefined();
});

it('T28: response payload có packages, calendar, authorityChecks', async () => {
  const agent = new PlannerAgent(testRegistry);
  const msg = makePlannerRequest('5 máy chiếu', 'abc-004');
  const response = await agent.process(msg);
  const output = response.payload as PlannerOutput;
  expect(output.packages.length).toBeGreaterThan(0);
  expect(output.calendar).toBeDefined();
  expect(output.authorityChecks.length).toBe(output.packages.length);
});

it('T29: agent state trở về idle sau khi process xong', async () => {
  const agent = new PlannerAgent(testRegistry);
  await agent.process(makePlannerRequest('máy tính', 'abc-005'));
  expect(agent['state']).toBe('idle');
});

it('T30: process() error message khi input rỗng', async () => {
  const agent = new PlannerAgent(testRegistry);
  const msg = makePlannerRequest('', 'abc-006');
  const response = await agent.process(msg);
  expect(response.type).toBe('error');
  expect(response.traceId).toBe('abc-006');
});
```

### 9.2 Test fixtures

```typescript
// planner-agent.test.ts — helpers

function makeSuggestion(category: string, total: number): AISuggestion {
  return {
    packageName: `Mua sắm ${category}`,
    packageCode: `${category.toUpperCase()}-2026-01`,
    fundingSource: 'autonomy_fund',
    fundingSourceName: 'Quỹ phát triển hoạt động sự nghiệp',
    packageType: 'goods_fixed_asset',
    contractType: 'lump_sum',
    estimatedTotal: total,
    contractDurationDays: 30,
    procurementMethodHint: 'DIRECT_SELECTION_SIMPLIFIED',
    detectedCategory: category,
    confidence: 'high',
    notes: [],
  };
}

function makePlannerRequest(goal: string, traceId: string): AgentMessage {
  return {
    traceId,
    from: 'user',
    to: 'planner',
    type: 'request',
    payload: {
      naturalLanguageGoal: goal,
      budgetYear: 2026,
      totalBudget: 2_000_000_000,
      fundingSource: 'autonomy_fund',
    } satisfies PlannerInput,
    timestamp: Date.now(),
  };
}

// Lightweight AgentRegistry for tests (no IndexedDB dependency)
const testRegistry = {
  _log: new Map<string, AgentMessage[]>(),
  log(msg: AgentMessage) {
    const arr = this._log.get(msg.traceId) ?? [];
    arr.push(msg);
    this._log.set(msg.traceId, arr);
  },
  getTrace(traceId: string): AgentMessage[] {
    return this._log.get(traceId) ?? [];
  },
  notifySubscribers(_event: string, _payload: unknown) {},
};
```

---

## 10. Integration với P5 Orchestrator

### 10.1 Quan hệ

```
PlannerAgent (P6-01) uses P5 components as READ-ONLY tools:

  generatePackageSuggestion()  ← P5-01: per-item NLP parsing
  reviewPackage()              ← P5-03: validate each suggested package
  runWorkflow()                ← P5-05: optional deep analysis

P5 components are NOT modified.
P5 test suite (269 tests) must continue passing unchanged.
```

### 10.2 Luồng tích hợp chuẩn

```typescript
// Inside PlannerAgent.process() — PARSING_GOAL state

const items = parseGoalIntoItems(input.naturalLanguageGoal);

const packages: AISuggestion[] = items.map(item =>
  generatePackageSuggestion(item, input.budgetYear)  // P5-01
);

// Optional: P5-03 quick review of each package to surface CRITICAL issues early
const quickReviews = packages.map(pkg => {
  const mockPkg = buildMinimalProcurementPackage(pkg, input.budgetYear);
  return reviewPackage(mockPkg);  // P5-03
});
```

### 10.3 Luồng tích hợp sâu (khi `deepAnalysis: true`)

```typescript
// PlannerAgent với deepAnalysis flag

if (input.deepAnalysis) {
  const workflowResults: WorkflowResult[] = [];
  for (const pkg of packages) {
    const result = runWorkflow(
      pkg.packageName,
      input.budgetYear,
      new Date(),
    );  // P5-05 — chains P5-01 → P5-02 → P5-03 → P5-04
    workflowResults.push(result);

    // Emit progress event per package
    this.registry.log({
      traceId: this.currentTraceId!,
      from: 'planner',
      to: 'planner',
      type: 'event',
      payload: { phase: 'deep-analysis', packageCode: pkg.packageCode, done: true },
      timestamp: Date.now(),
    });
  }
  output.workflowResults = workflowResults;
}
```

### 10.4 Hàm bridge: P5 AISuggestion → P5 ProcurementPackage

Cần để `reviewPackage()` (P5-03) có thể validate một `AISuggestion` ngay trong bước PARSING_GOAL:

```typescript
function buildMinimalProcurementPackage(
  suggestion: AISuggestion,
  budgetYear: number,
): ProcurementPackage {
  // Creates a skeleton ProcurementPackage from AISuggestion
  // Uses same placeholder defaults as workflowOrchestrator.ts (BASE_PKG_DEFAULTS)
  // Fields not inferable from suggestion → placeholder '[...]'
  // This is for quick validation only — not for export
  return {
    id: `planner-preview-${suggestion.packageCode}`,
    packageName: suggestion.packageName,
    packageCode: suggestion.packageCode,
    fundingSource: suggestion.fundingSource,
    fundingSourceName: suggestion.fundingSourceName,
    budgetYear,
    packageType: suggestion.packageType,
    contractType: suggestion.contractType,
    contractDurationDays: suggestion.contractDurationDays,
    warrantyMonths: suggestion.packageType === 'goods_fixed_asset' ? 12 : 0,
    // All people/supplier fields → neutral placeholders per CLAUDE.md
    rectorName: '[Tên Hiệu trưởng]',
    ...BASE_PKG_DEFAULTS_PEOPLE,
    // Minimal item for value calculation
    items: [{
      id: 'planner-item-001',
      name: suggestion.packageName,
      unit: 'Bộ',
      quantity: 1,
      unitPrice: suggestion.estimatedTotal,
      specs: '',
      supplier1Price: Math.round(suggestion.estimatedTotal * 0.97),
      supplier2Price: suggestion.estimatedTotal,
      supplier3Price: Math.round(suggestion.estimatedTotal * 1.02),
    }],
    // Dates → empty (will be populated by workflowOrchestrator if needed)
    dateProposal: '', dateSurvey: '', dateQuotes: '', dateCompare: '',
    dateKhlcnt: '', dateKhlcntApprove: '', dateExpertEstablish: '',
    dateDocIssue: '', dateBidClose: '', dateEvaluate: '', dateAppraise: '',
    dateResultProposal: '', dateResultApprove: '', dateContractSign: '',
    dateDelivery: '', dateAcceptance: '', dateLiquidation: '', dateAssetIncrease: '',
  };
}
```

---

## 11. Phụ lục: Dependency Graph đầy đủ

```
P6-01 PlannerAgent
  │
  ├── HARD DEPENDENCIES (must exist before P6-01):
  │   ├── app/src/agents/types.ts             ← AgentId, AgentMessage, IAgent
  │   ├── app/src/agents/AgentRegistry.ts     ← log(), getTrace(), notifySubscribers()
  │   ├── app/src/ai/packageGenerator.ts      ← generatePackageSuggestion() [P5-01]
  │   ├── app/src/ai/legalReviewer.ts         ← reviewPackage(), LegalFinding [P5-03]
  │   └── app/src/demoData.ts                 ← ProcurementPackage, ProcurementItem
  │
  ├── OPTIONAL DEPENDENCIES (deepAnalysis mode):
  │   └── app/src/ai/workflowOrchestrator.ts  ← runWorkflow() [P5-05]
  │
  └── DOWNSTREAM CONSUMERS (will use PlannerAgent):
      ├── app/src/agents/RiskAgent.ts         ← PlannerOutput.splitWarnings [P6-04]
      └── app/src/agents/AutonomousAgent.ts   ← PlannerOutput → drives workflow [P6-06]
```

---

## 12. Checklist trước khi implement

- [ ] `app/src/agents/types.ts` đã có: `AgentId`, `AgentMessage`, `IAgent`
- [ ] `app/src/agents/AgentRegistry.ts` đã có: `log()`, `getTrace()`, `notifySubscribers()`
- [ ] `app/src/ai/packageGenerator.ts` không bị thay đổi (P5 regression: 26 tests pass)
- [ ] `app/src/ai/legalReviewer.ts` không bị thay đổi (P5 regression: 16 tests pass)
- [ ] Tất cả 269 P5 tests vẫn pass trước khi bắt đầu implement P6-01
- [ ] `crypto.randomUUID` fallback được implement (xem §6.3)
- [ ] Test fixture `makeSuggestion()` và `makePlannerRequest()` được viết trước tests
- [ ] 30 test cases được approve trước khi code implementation
