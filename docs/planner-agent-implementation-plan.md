# P6-01 Planner Agent — Implementation Plan

> **Tài liệu:** Kế hoạch triển khai chi tiết (không phải thiết kế, không phải code)  
> **Căn cứ:** `docs/planner-agent-design.md`  
> **Ngày:** 14/06/2026  
> **Ràng buộc:** Không thay đổi code Phase 1–5. Tất cả P5 tests phải tiếp tục pass.

---

## Chuỗi phụ thuộc

```
P6-01A  ──►  P6-01B  ──►  P6-01C  ──►  P6-01D  ──►  P6-01E
  │             │                          │
  │             └──────────────────────────┤
  │                                        ▼
  └───────────────────────────────────►  P6-01F
```

**Quy tắc chặn (blocking rule):** Mỗi phần phải qua acceptance criteria trước khi phần tiếp theo bắt đầu. P6-01F chỉ chạy sau khi tất cả P6-01A → P6-01E đã xanh.

---

## P6-01A — Message Contracts

### Mục tiêu

Định nghĩa kiểu dữ liệu nền tảng cho toàn bộ hệ thống multi-agent Phase 6. Không có logic nghiệp vụ. Chỉ là type definitions + một lớp registry tối giản.

### Files

| File | Trạng thái | Vai trò |
|---|---|---|
| `app/src/agents/types.ts` | **Mới tạo** | `AgentId`, `AgentMessage`, `IAgent` |
| `app/src/agents/AgentRegistry.ts` | **Mới tạo** | Singleton registry — log, getTrace, subscribe |

Không tạo thêm file nào khác trong phần này.

### Interfaces được tạo ra

**`types.ts`:**

```typescript
export type AgentId =
  | 'planner' | 'specification' | 'legal-reviewer'
  | 'risk' | 'chat' | 'autonomous';

export interface AgentMessage {
  traceId: string;           // UUID v4, không được rỗng
  from: AgentId | 'user';
  to: AgentId | 'broadcast';
  type: 'request' | 'response' | 'event' | 'error';
  payload: unknown;
  timestamp: number;         // Date.now()
  legalBasis?: string[];
  parentTraceId?: string;
}

export interface IAgent {
  readonly id: AgentId;
  readonly name: string;
  process(msg: AgentMessage): Promise<AgentMessage>;
  getCapabilities(): string[];
}
```

**`AgentRegistry.ts`:**

```typescript
export class AgentRegistry {
  private agents: Map<AgentId, IAgent>
  private traces: Map<string, AgentMessage[]>
  private subscribers: Map<string, Array<(msg: AgentMessage) => void>>

  register(agent: IAgent): void
  process(msg: AgentMessage): Promise<AgentMessage>   // route to agent by msg.to
  log(msg: AgentMessage): void                        // append to traces[traceId]
  getTrace(traceId: string): AgentMessage[]
  subscribe(event: string, handler: (msg: AgentMessage) => void): void
  notifySubscribers(event: string, msg: AgentMessage): void
}
```

**Điểm quyết định quan trọng — singleton vs instance:**  
AgentRegistry phải là **instance được inject vào constructor của mỗi agent**, không phải global singleton. Lý do: global singleton gây test pollution (state giữa các test case bị chia sẻ). Các test trong P6-01F sẽ tạo `new AgentRegistry()` riêng cho mỗi test group.

**Kiểm tra traceId trong `log()`:**  
Registry phải throw `Error('AgentMessage.traceId is required')` nếu `msg.traceId` là rỗng hoặc undefined. Đây là bất biến kiểm toán.

### Dependencies

- Không phụ thuộc vào bất kỳ file Phase 1–5 nào
- TypeScript 5.x strict mode (đã có trong tsconfig.json của dự án)
- Không import bất kỳ thư viện ngoài nào

### Acceptance Criteria

| # | Tiêu chí | Cách kiểm tra |
|---|---|---|
| A1 | `app/src/agents/types.ts` compile không lỗi | `tsc --noEmit` pass |
| A2 | `app/src/agents/AgentRegistry.ts` compile không lỗi | `tsc --noEmit` pass |
| A3 | `AgentRegistry.log()` throw khi `traceId` rỗng | Unit test (inline, không cần file riêng) |
| A4 | `AgentRegistry.getTrace(id)` trả về `[]` cho traceId chưa có | Unit test |
| A5 | Tất cả P5 tests vẫn pass (269+ tests) | `npm test` |
| A6 | Không có `import` nào từ `agents/` trong các file P5 hiện tại | `grep -r "from.*agents/"` trả về rỗng trong `ai/` folder |

### Estimated Complexity

| Thuộc tính | Ước lượng |
|---|---|
| Lines of code | ~200 (types.ts: ~80, AgentRegistry.ts: ~120) |
| Story points | 2 SP (~1 ngày) |
| Risk | **Thấp** — thuần type definitions + Map operations |
| Blocker tiềm năng | Không có |

---

## P6-01B — PlannerOutput Schema

### Mục tiêu

Định nghĩa tất cả interface liên quan đến PlannerAgent dưới dạng TypeScript types. Không có logic nào — chỉ là khai báo kiểu dữ liệu. Tạo phần header của file `PlannerAgent.ts`.

### Files

| File | Trạng thái | Vai trò |
|---|---|---|
| `app/src/agents/PlannerAgent.ts` | **Mới tạo** (chỉ phần type) | Exports tất cả interfaces + types |

File được tạo với phần class body để **trống** (placeholder stub `process() { throw new Error('not yet implemented') }`). Logic được điền trong P6-01C và P6-01D.

### Interfaces được tạo ra

Tất cả exported từ `PlannerAgent.ts`:

```typescript
// ─── Input ────────────────────────────────────────────────────────────────────
export interface PlannerInput {
  naturalLanguageGoal: string;     // không được rỗng
  budgetYear: number;              // 4 chữ số (2024–2030)
  totalBudget?: number;            // tổng ngân sách năm (optional)
  fundingSource?: 'autonomy_fund' | 'state_budget' | 'other_revenue';
  existingPackages?: AISuggestion[];  // cho split detection với gói đã có
  deepAnalysis?: boolean;          // nếu true: gọi runWorkflow() cho từng gói
}

// ─── Authority ────────────────────────────────────────────────────────────────
export interface AuthorityCheck {
  packageCode: string;
  packageName: string;
  estimatedTotal: number;
  approvalLevel: 'rector_direct' | 'rector_with_khlcnt' | 'ministry';
  approvalAuthority: string;       // mô tả tiếng Việt
  khlcntRequired: boolean;
  ministerialApproval: boolean;
  legalBasis: string[];
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface CalendarEntry {
  packageCode: string;
  packageName: string;
  quarter: Quarter;
  estimatedMonth: number;          // 1–12
  leadTimeDays: number;
  rationale: string;               // lý do phân quý
  procurementMethod: string;
  estimatedTotal: number;
}

export interface ProcurementCalendar {
  budgetYear: number;
  entries: CalendarEntry[];
  totalByQuarter: Record<Quarter, number>;
  totalAnnual: number;
  khlcntSubmissionDate: string;    // ISO 8601 (e.g. "2026-01-15")
}

// ─── Split warning payload ────────────────────────────────────────────────────
export interface SplitWarningPayload {
  category: string;
  packages: Pick<AISuggestion, 'packageCode' | 'packageName' | 'estimatedTotal'>[];
  combinedTotal: number;
  thresholdCrossed: number;
  finding: LegalFinding;
}

// ─── State machine ────────────────────────────────────────────────────────────
export type PlannerState =
  | 'idle'
  | 'parsing-goal'
  | 'detecting-split'
  | 'validating-authority'
  | 'building-calendar'
  | 'composing-response';

export interface PlannerStateEvent {
  previousState: PlannerState;
  nextState: PlannerState;
  timestamp: number;
  detail?: string;
}

// ─── Output ───────────────────────────────────────────────────────────────────
export interface PlannerOutput {
  packages: AISuggestion[];
  splitWarnings: LegalFinding[];       // severity phải là 'CRITICAL'
  authorityChecks: AuthorityCheck[];   // length = packages.length
  calendar: ProcurementCalendar;       // entries.length = packages.length
  totalEstimated: number;
  budgetUtilization: number;           // -1 nếu không có totalBudget
  legalBasis: string[];                // ≥ 1 phần tử
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
  workflowResults?: WorkflowResult[];  // chỉ có khi deepAnalysis = true
}
```

**Ràng buộc bất biến** (phải được validate khi compose response):

| Field | Ràng buộc |
|---|---|
| `packages.length` | ≥ 1 |
| `packages[*].estimatedTotal` | > 0 |
| `splitWarnings[*].severity` | `=== 'CRITICAL'` |
| `authorityChecks.length` | `=== packages.length` |
| `calendar.entries.length` | `=== packages.length` |
| `calendar.totalAnnual` | `=== packages.reduce(sum, 0)` |
| `legalBasis.length` | ≥ 1 |

### Dependencies

| Phụ thuộc | Loại | Lý do |
|---|---|---|
| P6-01A (`types.ts`) | **Bắt buộc** | `AgentMessage` dùng trong `process()` stub |
| `ai/packageGenerator.ts` | Import type (`AISuggestion`) | Không thay đổi file P5 |
| `ai/legalReviewer.ts` | Import type (`LegalFinding`) | Không thay đổi file P5 |
| `ai/workflowOrchestrator.ts` | Import type (`WorkflowResult`) | Không thay đổi file P5 |

**Lưu ý:** Chỉ dùng `import type` — không có runtime dependency ở phần schema này.

### Acceptance Criteria

| # | Tiêu chí | Cách kiểm tra |
|---|---|---|
| B1 | Tất cả 9 interfaces + 2 types export đúng từ `PlannerAgent.ts` | `tsc --noEmit` pass |
| B2 | `PlannerInput` có field `deepAnalysis?: boolean` (không trong design doc gốc — bổ sung ở đây) | Manual inspection |
| B3 | `PlannerOutput.budgetUtilization` là `-1` khi không có `totalBudget` (documented behavior) | Comment trong code |
| B4 | Class stub `PlannerAgent` implements `IAgent` (TypeScript phải verify) | `tsc --noEmit` |
| B5 | Tất cả P5 tests vẫn pass | `npm test` |

### Estimated Complexity

| Thuộc tính | Ước lượng |
|---|---|
| Lines of code | ~140 (type declarations + imports + class stub) |
| Story points | 1 SP (~4 giờ) |
| Risk | **Thấp** — không có logic |
| Blocker tiềm năng | `LegalFinding.legalBasis` là `string` (không phải `string[]`) trong file P5 hiện tại → `SplitWarningPayload.finding.legalBasis` phải khớp kiểu |

---

## P6-01C — Core Algorithms

### Mục tiêu

Implement 7 hàm nghiệp vụ thuần túy (pure functions) trong `PlannerAgent.ts`. Đây là phần chứa toàn bộ logic domain. Không có class state. Không có side effects. Tất cả hàm phải **được export** để P6-01F có thể test trực tiếp.

### Files

| File | Trạng thái | Thay đổi |
|---|---|---|
| `app/src/agents/PlannerAgent.ts` | **Sửa đổi** | Thêm 7 exported functions vào sau phần type declarations |

### Functions được implement

#### 1. `generateTraceId(): string`
Sinh UUID v4 hoặc fallback. Dùng `crypto.randomUUID()` nếu available.

```typescript
export function generateTraceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `planner-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
```

Không test riêng (quá đơn giản), nhưng được dùng trong T25–T30.

#### 2. `parseGoalIntoItems(goal: string): string[]`
Tách NL goal thành các fragment items.

**Algorithm:**
1. Nếu `goal.trim()` rỗng → trả về `[]`
2. Chuẩn hóa whitespace
3. Tách bằng CONNECTOR_PATTERN: `/\s+(và|cùng với|cùng|cộng với|thêm|bao gồm)\s+/gi`
4. Tách tiếp bằng COMMA_PATTERN: `/\s*[,;]\s*/g`
5. Với mỗi fragment: trim, bỏ fragment rỗng, bỏ fragment < 3 ký tự
6. Trả về mảng fragments đã lọc

**Export:** `export function parseGoalIntoItems(goal: string): string[]`

#### 3. `detectPackageSplitting(packages: AISuggestion[], existingPackages?: AISuggestion[]): LegalFinding[]`
Phát hiện vi phạm Điều 44 khoản 6 Luật ĐT 22/2023.

**Algorithm:**
1. Gộp `[...existingPackages, ...packages]`
2. GroupBy `detectedCategory` (key = category string, fallback = `'unknown'`)
3. Với mỗi group có ≥ 2 packages:
   - Tính `groupTotal = sum(estimatedTotal)`
   - Tính `maxSingle = max(estimatedTotal)`
   - Kiểm tra 3 ngưỡng tăng dần: 50M, 500M, 5B
   - Nếu `maxSingle ≤ threshold && groupTotal > threshold` → tạo `LegalFinding` CRITICAL với code `PA-001`
   - `break` sau ngưỡng đầu tiên bị vi phạm (chỉ báo cáo 1 finding / group)
4. Trả về `LegalFinding[]` (có thể rỗng)

**Quan trọng:** `LegalFinding.legalBasis` là `string` (single citation) — không phải `string[]`. Giá trị:  
`'Điều 44 khoản 6 Luật Đấu thầu 22/2023/QH15 — nghiêm cấm chia nhỏ gói thầu nhằm lẩn tránh quy trình lựa chọn nhà thầu.'`

**Export:** `export function detectPackageSplitting(...): LegalFinding[]`

#### 4. `validateAuthority(pkg: AISuggestion): AuthorityCheck`
Kiểm tra thẩm quyền phê duyệt theo TT 13/2026/TT-BCT.

**Decision table:**

| Ngưỡng | `approvalLevel` | `khlcntRequired` | `ministerialApproval` |
|---|---|---|---|
| `total ≤ 50_000_000` | `'rector_direct'` | `false` | `false` |
| `50M < total ≤ 500M` | `'rector_with_khlcnt'` | `true` | `false` |
| `total > 500_000_000` | `'ministry'` | `true` | `true` |

**Boundary test:** `total === 50_000_000` → `rector_direct`; `total === 500_000_000` → `rector_with_khlcnt`.

`legalBasis` là `string[]` (AuthorityCheck.legalBasis là array — khác với LegalFinding.legalBasis là string).

**Export:** `export function validateAuthority(pkg: AISuggestion): AuthorityCheck`

#### 5. `getProcurementLeadTime(methodHint: string): number`
Trả về lead time (ngày) dựa trên procurementMethodHint.

```
DIRECT_50                   → 14
DIRECT_SELECTION_SIMPLIFIED → 28
COMPETITIVE_SHOPPING        → 45
OPEN_BIDDING                → 90
(mặc định)                  → 30
```

Dùng `methodHint.includes(key)` để tránh phụ thuộc vào format chính xác của chuỗi.

**Export:** `export function getProcurementLeadTime(methodHint: string): number`

#### 6. `assignQuarter(pkg: AISuggestion): Quarter`
Phân gói vào quý dựa trên packageType và estimatedTotal.

**Priority rules:**
1. `goods_consumable` hoặc `service` → `'Q1'`
2. `goods_fixed_asset` với `total ≤ 200_000_000` → `'Q2'`
3. `goods_fixed_asset` với `total > 200_000_000` → `'Q2'` (nếu `≤ 500M`) hoặc `'Q3'` (nếu `> 500M`)
4. `mixed` → `'Q2'`
5. Fallback → `'Q2'`

**Export:** `export function assignQuarter(pkg: AISuggestion): Quarter`

#### 7. `buildCalendar(packages: AISuggestion[], budgetYear: number): ProcurementCalendar`
Xây dựng lịch mua sắm năm.

**Algorithm:**
1. Với mỗi package: gọi `assignQuarter(pkg)` và `getProcurementLeadTime(pkg.procurementMethodHint)`
2. Map quarter → estimatedMonth: `{ Q1: 2, Q2: 4, Q3: 7, Q4: 10 }`
3. Tạo `CalendarEntry` cho từng package
4. Tính `totalByQuarter` bằng cách group và sum
5. `totalAnnual = packages.reduce((s, p) => s + p.estimatedTotal, 0)`
6. `khlcntSubmissionDate = \`${budgetYear}-01-15\`` (khuyến nghị theo Điều 38 Luật ĐT 22/2023)
7. Sắp xếp `entries` theo `estimatedMonth` tăng dần

**Bất biến phải thỏa mãn:**
- `entries.length === packages.length`
- `Object.values(totalByQuarter).reduce(sum) === totalAnnual`

**Export:** `export function buildCalendar(packages: AISuggestion[], budgetYear: number): ProcurementCalendar`

### Dependencies

| Phụ thuộc | Loại |
|---|---|
| P6-01B (PlannerAgent.ts — type section) | **Bắt buộc** (Quarter, AuthorityCheck, CalendarEntry, ProcurementCalendar) |
| `ai/packageGenerator.ts` (AISuggestion) | Import type (không thay đổi) |
| `ai/legalReviewer.ts` (LegalFinding) | Import type (không thay đổi) |

### Acceptance Criteria

| # | Tiêu chí | Cách kiểm tra |
|---|---|---|
| C1 | `tsc --noEmit` pass sau khi thêm 7 functions | `npm run build` hoặc tsc |
| C2 | `parseGoalIntoItems('')` trả về `[]` | Test T04 |
| C3 | `parseGoalIntoItems('a và b')` trả về `['a', 'b']` | Test T01 |
| C4 | `detectPackageSplitting` với 2 gói cùng category tổng > 500M → 1 CRITICAL finding | Test T07 |
| C5 | `detectPackageSplitting` với 2 gói khác category → `[]` | Test T08 |
| C6 | `validateAuthority` với `50_000_000` → `rector_direct` (boundary) | Test T14 |
| C7 | `validateAuthority` với `500_000_000` → `rector_with_khlcnt` (boundary) | Test T16 |
| C8 | `validateAuthority` với `501_000_000` → `ministry` | Test T17 |
| C9 | `buildCalendar` → `totalAnnual === sum(packages[*].estimatedTotal)` | Test T21 |
| C10 | `buildCalendar` → `goods_consumable` package phân vào Q1 | Test T22 |
| C11 | `buildCalendar` → `totalByQuarter` sum = `totalAnnual` | Test T24 |
| C12 | Tất cả P5 tests vẫn pass | `npm test` |

**Tests áp dụng cho phần này:** T01–T24 từ `planner-agent.test.ts` (sẽ implement trong P6-01F nhưng AC được verify ở đây).

### Estimated Complexity

| Thuộc tính | Ước lượng |
|---|---|
| Lines of code | ~240 (7 functions + constants + comments) |
| Story points | 3 SP (~1.5 ngày) |
| Risk | **Trung bình** — business logic chứa thresholds pháp lý phải chính xác |
| Blocker tiềm năng | `LegalFinding.legalBasis` là `string` (không phải `string[]`) — phải khớp kiểu từ legalReviewer.ts |

---

## P6-01D — PlannerAgent Class

### Mục tiêu

Implement body của class `PlannerAgent`. State machine, message routing, registry interaction. Đây là lớp orchestration — gọi các hàm P6-01C, phát messages qua registry, quản lý trạng thái.

### Files

| File | Trạng thái | Thay đổi |
|---|---|---|
| `app/src/agents/PlannerAgent.ts` | **Sửa đổi** | Điền body class `PlannerAgent` |

### Class structure

```typescript
export class PlannerAgent implements IAgent {
  readonly id = 'planner' as const;
  readonly name = 'Procurement Planner Agent';

  private state: PlannerState = 'idle';
  private currentTraceId: string | null = null;
  private readonly registry: AgentRegistry;

  constructor(registry: AgentRegistry) { ... }

  // ─── Public API (IAgent) ──────────────────────────────────────────────────
  async process(msg: AgentMessage): Promise<AgentMessage>
  getCapabilities(): string[]

  // ─── Private helpers ──────────────────────────────────────────────────────
  private transition(next: PlannerState, detail?: string): void
  private emit(partial: Omit<AgentMessage, 'traceId' | 'from' | 'timestamp'>): void
  private buildErrorResponse(code: string, message: string, inState: PlannerState): AgentMessage
  private buildResponse(to: AgentId | 'user', output: PlannerOutput): AgentMessage
}
```

### `process()` implementation blueprint

```
1. Validate: msg.traceId phải không rỗng → nếu rỗng, throw (registry sẽ catch)
2. Validate: msg.type phải là 'request'
3. this.currentTraceId = msg.traceId
4. registry.log(msg)  ← log incoming request
5. input = msg.payload as PlannerInput

6. Validate input.naturalLanguageGoal:
   → nếu rỗng: transition('idle'), return buildErrorResponse('PLANNER_EMPTY_INPUT', ...)

7. transition('parsing-goal')
   items = parseGoalIntoItems(input.naturalLanguageGoal)
   → nếu items.length === 0: transition('idle'), return error
   packages = items.map(item => generatePackageSuggestion(item, input.budgetYear))

8. transition('detecting-split')
   splitWarnings = detectPackageSplitting(packages, input.existingPackages ?? [])
   → nếu splitWarnings.length > 0:
     emit({ to: 'broadcast', type: 'event', payload: SplitWarningPayload, legalBasis: [...] })

9. transition('validating-authority')
   authorityChecks = packages.map(pkg => validateAuthority(pkg))

10. transition('building-calendar')
    calendar = buildCalendar(packages, input.budgetYear)

11. transition('composing-response')
    totalEstimated = packages.reduce((s, p) => s + p.estimatedTotal, 0)
    budgetUtilization = input.totalBudget
      ? totalEstimated / input.totalBudget
      : -1
    confidence = xác định dựa trên packages[*].confidence (xem bên dưới)
    legalBasis = collectAllLegalBasis(splitWarnings, authorityChecks)

12. output: PlannerOutput = { packages, splitWarnings, authorityChecks, calendar,
                              totalEstimated, budgetUtilization, legalBasis,
                              confidence, warnings: [], workflowResults: undefined }

13. response = buildResponse(msg.from === 'user' ? 'user' : msg.from as AgentId, output)
    registry.log(response)
    this.state = 'idle'
    this.currentTraceId = null
    return response
```

**Xác định confidence:**
- Nếu tất cả packages đều `confidence === 'high'` → `'high'`
- Nếu có ≥ 1 package `confidence === 'low'` → `'low'`
- Còn lại → `'medium'`

**`collectAllLegalBasis()`** — private helper, không export:
```
Gom legalBasis từ:
  - splitWarnings[*].legalBasis (string → string[1])
  - authorityChecks[*].legalBasis (string[])
  - Thêm fixed citations bắt buộc:
    'Điều 38-41 Luật Đấu thầu 22/2023/QH15 — lập và phê duyệt KHLCNT'
Dedup bằng Set<string>
Trả về string[]
```

**`transition()`** — private method:
```
1. Tạo PlannerStateEvent { previousState: this.state, nextState: next, ... }
2. emit({ to: 'planner', type: 'event', payload: event })  ← self-event
3. this.state = next
```

**Error handling:**
- Bất kỳ exception nào từ `generatePackageSuggestion()` hoặc các hàm P6-01C → catch, `this.state = 'idle'`, `this.currentTraceId = null`, return `buildErrorResponse('PLANNER_INTERNAL_ERROR', ...)`
- Không để exception truyền ra ngoài `process()`

### Dependencies

| Phụ thuộc | Loại |
|---|---|
| P6-01A (AgentRegistry, AgentMessage, IAgent, AgentId) | **Bắt buộc** |
| P6-01B (PlannerInput, PlannerOutput, PlannerState, PlannerStateEvent, SplitWarningPayload, AuthorityCheck) | **Bắt buộc** |
| P6-01C (parseGoalIntoItems, detectPackageSplitting, validateAuthority, buildCalendar, generateTraceId) | **Bắt buộc** |
| `ai/packageGenerator.ts` → `generatePackageSuggestion()` | Runtime call (không thay đổi) |

### Acceptance Criteria

| # | Tiêu chí | Cách kiểm tra |
|---|---|---|
| D1 | `PlannerAgent` implements `IAgent` (TypeScript verify) | `tsc --noEmit` |
| D2 | `process()` với request hợp lệ trả về message có `type === 'response'` | Test T25 |
| D3 | `response.traceId === request.traceId` | Test T25 |
| D4 | `agent.state === 'idle'` sau khi `process()` hoàn thành | Test T29 |
| D5 | Registry nhận ≥ 3 event messages cho request hợp lệ | Test T26 |
| D6 | Split detected → broadcast event với `to === 'broadcast'` | Test T27 |
| D7 | `response.payload` có đủ `packages`, `calendar`, `authorityChecks` | Test T28 |
| D8 | `process()` với input rỗng trả về `type === 'error'` | Test T30 |
| D9 | Exception trong `generatePackageSuggestion()` không propagate ra ngoài | Test với mock throwing |
| D10 | Tất cả P5 tests vẫn pass | `npm test` |

### Estimated Complexity

| Thuộc tính | Ước lượng |
|---|---|
| Lines of code | ~180 (process: ~90, private helpers: ~90) |
| Story points | 2 SP (~1 ngày) |
| Risk | **Trung bình** — state machine phải xử lý đúng cleanup khi có lỗi |
| Blocker tiềm năng | `generatePackageSuggestion()` là synchronous — `process()` là async → không cần `await` nhưng phải wrap try/catch đúng |

---

## P6-01E — P5 Integration

### Mục tiêu

Thêm hàm bridge `buildMinimalProcurementPackage()` để kết nối `AISuggestion` (P6-01 format) với `ProcurementPackage` (P5 format). Wiring deep analysis nếu `input.deepAnalysis === true`. Đây là lớp mỏng nhất — không có logic nghiệp vụ mới.

### Files

| File | Trạng thái | Thay đổi |
|---|---|---|
| `app/src/agents/PlannerAgent.ts` | **Sửa đổi** | Thêm `buildMinimalProcurementPackage()` + deep analysis block trong `process()` |

Không thay đổi bất kỳ file nào trong `app/src/ai/` hoặc `app/src/demoData.ts`.

### Hàm được implement

#### `buildMinimalProcurementPackage(suggestion: AISuggestion, budgetYear: number): ProcurementPackage`

**Mục đích:** Tạo skeleton `ProcurementPackage` đủ để `reviewPackage()` (P5-03) validate.

**Quan trọng — `BASE_PKG_DEFAULTS` không được export từ `workflowOrchestrator.ts`:**  
File P5 giữ `BASE_PKG_DEFAULTS` là private const. Không thể import nó. Giải pháp: inline tất cả placeholder values theo CLAUDE.md demo data rules trực tiếp trong `buildMinimalProcurementPackage()`.

```typescript
// Các placeholder theo CLAUDE.md — neutral, không phải tên thật
const PEOPLE_PLACEHOLDERS = {
  rectorName:               '[Tên Hiệu trưởng]',
  departmentName:           '[Tên đơn vị đề xuất]',
  departmentCode:           '[Mã phòng]',
  expertTeamLeader:         '[Tổ trưởng tổ chuyên gia]',
  expertTeamMember1:        '[Thành viên tổ chuyên gia]',
  expertTeamMember2:        '[Thành viên tổ chuyên gia]',
  appraisalLeader:          '[Tổ trưởng thẩm định độc lập]',
  appraisalMember:          '[Thành viên thẩm định độc lập]',
  supplier1Name:            '[Nhà cung cấp số 1]',
  supplier1Address:         '[Địa chỉ nhà cung cấp 1]',
  supplier1TaxCode:         '[Mã số thuế]',
  supplier1Representative:  '[Người đại diện]',
  supplier1Position:        '[Chức vụ]',
  supplier2Name:            '[Nhà cung cấp số 2]',
  supplier2Address:         '[Địa chỉ nhà cung cấp 2]',
  supplier3Name:            '[Nhà cung cấp số 3]',
  supplier3Address:         '[Địa chỉ nhà cung cấp 3]',
};
```

**Phần items:**
```typescript
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
}]
```

Tất cả date fields → `''` (rỗng). Package này chỉ dùng cho `reviewPackage()` — không dùng để export DOCX.

**Export:** `export function buildMinimalProcurementPackage(suggestion: AISuggestion, budgetYear: number): ProcurementPackage`

#### Deep analysis block trong `process()`

Chèn vào giữa bước 11 và 12 (sau khi `authorityChecks` đã có, trước khi compose output):

```typescript
let workflowResults: WorkflowResult[] | undefined;
if (input.deepAnalysis) {
  workflowResults = [];
  for (const pkg of packages) {
    const result = runWorkflow(pkg.packageName, input.budgetYear);
    workflowResults.push(result);
    // emit progress event per package (same traceId)
    this.emit({
      to: 'planner',
      type: 'event',
      payload: { phase: 'deep-analysis', packageCode: pkg.packageCode, done: true },
    });
  }
}
```

`runWorkflow` là synchronous — không cần await. Import: `import { runWorkflow } from '../ai/workflowOrchestrator';`

### Dependencies

| Phụ thuộc | Loại |
|---|---|
| P6-01D (PlannerAgent class) | **Bắt buộc** |
| `demoData.ts` (`ProcurementPackage`, `ProcurementItem`) | Import type (không thay đổi) |
| `ai/legalReviewer.ts` (`reviewPackage`) | Runtime call — read-only, không thay đổi P5 |
| `ai/workflowOrchestrator.ts` (`runWorkflow`) | Runtime call — read-only, không thay đổi P5 |
| CLAUDE.md demo data rules | Placeholder strings |

### Acceptance Criteria

| # | Tiêu chí | Cách kiểm tra |
|---|---|---|
| E1 | `buildMinimalProcurementPackage()` trả về object hợp lệ `ProcurementPackage` | `tsc --noEmit` |
| E2 | Tất cả `ProcurementPackage` fields bắt buộc được điền (không undefined) | `tsc --noEmit` strict |
| E3 | `reviewPackage(buildMinimalProcurementPackage(suggestion, 2026))` không throw | Manual test hoặc integration test |
| E4 | Không có tên thật, tên tổ chức, hoặc thương hiệu trong placeholders | Code review theo CLAUDE.md |
| E5 | Tất cả P5 tests vẫn pass sau khi thêm imports | `npm test` |
| E6 | `deepAnalysis: true` trong PlannerInput → `workflowResults` có trong output | Test thủ công hoặc thêm 1 test case mở rộng |
| E7 | `deepAnalysis: false` hoặc undefined → `workflowResults === undefined` | Code path inspection |

### Estimated Complexity

| Thuộc tính | Ước lượng |
|---|---|
| Lines of code | ~95 (buildMinimalProcurementPackage: ~60, deep analysis block: ~25, imports: ~10) |
| Story points | 2 SP (~1 ngày) |
| Risk | **Trung bình** — `ProcurementPackage` có ~40 fields, phải điền đúng tất cả |
| Blocker tiềm năng | `ProcurementPackage` interface thêm fields mới trong tương lai sẽ làm `buildMinimalProcurementPackage()` fail TypeScript strict — acceptable risk |

---

## P6-01F — Tests

### Mục tiêu

Viết 30 unit tests + fixtures cho P6-01. Tất cả tests gọi trực tiếp exported functions (không mock nội bộ). `PlannerAgent.process()` tests dùng lightweight registry mock — không dùng real `AgentRegistry` để tránh test pollution.

### Files

| File | Trạng thái | Nội dung |
|---|---|---|
| `app/src/agents/__tests__/planner-agent.test.ts` | **Mới tạo** | 30 tests + fixtures |

**Lưu ý về thư mục:** Vitest (cấu hình hiện tại) tìm test trong `src/**/__tests__/`. Thư mục `app/src/agents/__tests__/` được tạo mới — không có file nào ở đó hiện tại.

### Test fixtures

```typescript
// ─── Fixtures (module-level, dùng chung) ──────────────────────────────────────

function makeSuggestion(
  category: string,
  total: number,
  overrides?: Partial<AISuggestion>
): AISuggestion {
  return {
    packageName: `Mua sắm ${category}`,
    packageCode: `${category.toUpperCase().slice(0,8)}-2026-01`,
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
    ...overrides,
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

// Lightweight mock registry — fresh per describe block via beforeEach
function createTestRegistry() {
  const log_ = new Map<string, AgentMessage[]>();
  const broadcasts: AgentMessage[] = [];
  return {
    log(msg: AgentMessage) {
      if (!msg.traceId) throw new Error('traceId required');
      log_.set(msg.traceId, [...(log_.get(msg.traceId) ?? []), msg]);
      if (msg.to === 'broadcast') broadcasts.push(msg);
    },
    getTrace(traceId: string): AgentMessage[] { return log_.get(traceId) ?? []; },
    notifySubscribers(_: string, __: unknown) {},
    getBroadcasts(): AgentMessage[] { return broadcasts; },
    reset() { log_.clear(); broadcasts.length = 0; },
  };
}
```

### Test groups và mapping với design doc

| Group | Tests | Hàm được test | IDs từ design |
|---|---|---|---|
| 1 — parseGoalIntoItems | 5 | `parseGoalIntoItems` | T01–T05 |
| 2 — detectPackageSplitting | 8 | `detectPackageSplitting` | T06–T13 |
| 3 — validateAuthority | 6 | `validateAuthority` | T14–T19 |
| 4 — buildCalendar | 5 | `buildCalendar` | T20–T24 |
| 5 — PlannerAgent.process() | 6 | `PlannerAgent` class | T25–T30 |
| **Tổng** | **30** | | |

### Tests bổ sung ngoài design doc (khuyến nghị)

Những test này không có trong design doc nhưng cần để đảm bảo robustness:

| ID | Mô tả | Group | Lý do |
|---|---|---|---|
| TB-01 | `generateTraceId()` trả về string không rỗng | Utility | Audit trail |
| TB-02 | `getProcurementLeadTime('OPEN_BIDDING')` → `90` | Utility | Threshold accuracy |
| TB-03 | `getProcurementLeadTime('unknown')` → `30` (default) | Utility | Fallback |
| TB-04 | `assignQuarter` với `service` → `'Q1'` | Calendar | Service rule |
| TB-05 | `assignQuarter` với `goods_fixed_asset` `1B` → `'Q3'` | Calendar | Large asset rule |

Nếu bổ sung: tổng lên đến 35 tests. Số lượng không bắt buộc theo design doc.

### Quyết định về exported functions

Thiết kế doc ghi "private helpers (not exported)" nhưng điều đó mâu thuẫn với yêu cầu test T01–T24 gọi trực tiếp. **Quyết định cho implementation:** Tất cả 7 hàm trong P6-01C được `export` (named export). Đây là pattern chuẩn trong codebase này (xem `packageGenerator.ts`, `legalReviewer.ts` — tất cả functions đều được export).

### Dependencies

- P6-01A + P6-01B + P6-01C + P6-01D + P6-01E đều phải đã implement
- Vitest (đã cấu hình — dùng cùng `vite.config.ts` hiện tại)
- Không có thêm npm packages

### Acceptance Criteria

| # | Tiêu chí | Cách kiểm tra |
|---|---|---|
| F1 | 30/30 tests pass (hoặc 35/35 nếu có bổ sung) | `npm test` |
| F2 | Tổng test suite ≥ 299 tests (269 P5 + 30 P6-01F) | Output của `npm test` |
| F3 | Không có test nào fail từ P5 (regression zero) | `npm test` — không có fail ngoài `agents/__tests__/` |
| F4 | Không có bất kỳ `mock()` hay `vi.fn()` nào trên hàm P5 | Code review |
| F5 | Test T27 (split detected → broadcast) không phụ thuộc vào real `AgentRegistry` | `createTestRegistry()` được dùng |
| F6 | `npm test` chạy < 30 giây (không có timeout issues) | CI timing |

### Estimated Complexity

| Thuộc tính | Ước lượng |
|---|---|
| Lines of code | ~280 (fixtures: ~60, 30 tests: ~180, describe blocks: ~40) |
| Story points | 3 SP (~1.5 ngày) |
| Risk | **Thấp** — tests follow well-defined spec; biggest risk là T27 (split detection via NL goal) |
| Blocker tiềm năng | T27 dùng NL goal "300M stationery và 300M stationery" — `generatePackageSuggestion()` phải detect category "stationery" từ đó mới có split. Nếu NLP không detect đúng → T27 không pass. Workaround: dùng real Vietnamese text "văn phòng phẩm 300 triệu và văn phòng phẩm 300 triệu" |

---

## Tổng hợp

### Roadmap triển khai

| Part | Tên | Files mới | LoC | SP | Risk | Blocks |
|---|---|---|---|---|---|---|
| P6-01A | Message Contracts | `types.ts`, `AgentRegistry.ts` | ~200 | 2 | Thấp | P6-01B, D, F |
| P6-01B | PlannerOutput Schema | `PlannerAgent.ts` (partial) | ~140 | 1 | Thấp | P6-01C, D, E, F |
| P6-01C | Core Algorithms | `PlannerAgent.ts` (extended) | ~240 | 3 | Trung bình | P6-01D, F |
| P6-01D | PlannerAgent Class | `PlannerAgent.ts` (class body) | ~180 | 2 | Trung bình | P6-01E, F |
| P6-01E | P5 Integration | `PlannerAgent.ts` (bridge fn) | ~95 | 2 | Trung bình | P6-01F |
| P6-01F | Tests | `agents/__tests__/planner-agent.test.ts` | ~280 | 3 | Thấp | — |
| **Tổng** | | **3 files mới** | **~1135** | **13 SP** | | |

### Files được tạo mới (không có file P5 nào bị sửa)

```
app/src/agents/
├── types.ts                              ← P6-01A
├── AgentRegistry.ts                      ← P6-01A
├── PlannerAgent.ts                       ← P6-01B, C, D, E (cumulative)
└── __tests__/
    └── planner-agent.test.ts             ← P6-01F
```

### Rủi ro toàn phần

| Rủi ro | Xác suất | Tác động | Giảm thiểu |
|---|---|---|---|
| `BASE_PKG_DEFAULTS` không export được | Đã xảy ra | Trung bình | Inline placeholders trong P6-01E |
| T27 NL split detection không chính xác | Trung bình | Thấp | Dùng tiếng Việt đầy đủ trong test input |
| `LegalFinding.legalBasis` là string, không phải string[] | Đã xác nhận | Thấp | Implement đúng trong `detectPackageSplitting()` |
| AgentRegistry singleton gây test pollution | Tiềm năng | Cao | `createTestRegistry()` fresh per test group (P6-01F) |
| P5 regression nếu import cycle | Tiềm năng | Cao | `PlannerAgent.ts` chỉ import từ `ai/` và `agents/` — không có circular |

### Gate: Điều kiện để bắt đầu implement

Trước khi viết bất kỳ dòng code nào cho P6-01:

- [ ] `npm test` trên branch hiện tại (develop): tất cả tests pass
- [ ] `tsc --noEmit` không có lỗi
- [ ] Không có uncommitted changes trong `app/src/ai/` hoặc `app/src/demoData.ts`
- [ ] `docs/planner-agent-design.md` đã được review và approved
- [ ] Thư mục `app/src/agents/` chưa tồn tại (hoặc rỗng) — sẽ tạo mới hoàn toàn
