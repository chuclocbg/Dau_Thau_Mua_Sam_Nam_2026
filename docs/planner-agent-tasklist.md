# P6-01 Planner Agent — Execution Task List

> **Tài liệu:** Danh sách nhiệm vụ thực thi (atomic, có thể check-off từng mục)  
> **Căn cứ:** `docs/planner-agent-implementation-plan.md`, `docs/planner-agent-design.md`  
> **Ngày:** 14/06/2026  
> **Quy ước:** Mỗi task là 1 đơn vị công việc hoàn chỉnh, có thể verify độc lập.  
> **Ràng buộc tuyệt đối:** Không sửa bất kỳ file nào trong `app/src/ai/` hoặc `app/src/demoData.ts`.

---

## Chuỗi thực thi bắt buộc

```
PRE-GATE ──► P6-01A ──► P6-01B ──► P6-01C ──► P6-01D ──► P6-01E ──► P6-01F ──► POST-GATE
```

Mỗi gate (PRE, POST) và mỗi phần phải pass hoàn toàn trước khi bước tiếp theo bắt đầu.

---

## PRE-GATE — Kiểm tra trước khi bắt đầu

| ID | Task | Lệnh kiểm tra | Pass khi |
|---|---|---|---|
| PRE-01 | Verify tất cả P5 tests pass | `npm test` (trong `app/`) | Không có test nào fail |
| PRE-02 | Verify TypeScript compile sạch | `npx tsc --noEmit` | 0 errors |
| PRE-03 | Verify không có uncommitted changes trong `ai/` | `git status app/src/ai/` | Không có changes |
| PRE-04 | Verify thư mục `app/src/agents/` chưa tồn tại | `ls app/src/agents/` | Not found hoặc rỗng |
| PRE-05 | Verify đang ở branch `develop` | `git branch --show-current` | `develop` |

**Nếu bất kỳ PRE task nào fail → DỪNG, không tiếp tục.**

---

## P6-01A — Message Contracts

**Mục tiêu:** Tạo 2 files nền tảng. Không có logic nghiệp vụ.  
**Files tạo mới:** `app/src/agents/types.ts`, `app/src/agents/AgentRegistry.ts`  
**Files sửa đổi:** Không có  
**LOC tổng:** ~200  

---

### A-01 — Tạo thư mục agents/

| Thuộc tính | Giá trị |
|---|---|
| **File tạo mới** | `app/src/agents/` (directory) |
| **LOC** | 0 |
| **Phụ thuộc** | PRE-04 pass |
| **Rủi ro** | Không có |

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| A-01-T1 | Thư mục tồn tại | `ls app/src/agents/` không trả về lỗi |

---

### A-02 — Tạo types.ts: AgentId

| Thuộc tính | Giá trị |
|---|---|
| **File tạo mới** | `app/src/agents/types.ts` |
| **LOC** | ~15 |
| **Phụ thuộc** | A-01 |
| **Rủi ro** | Không có |

**Nội dung:**
```typescript
// app/src/agents/types.ts

/** Identifies which agent a message is routed to or from. */
export type AgentId =
  | 'planner'
  | 'specification'
  | 'legal-reviewer'
  | 'risk'
  | 'chat'
  | 'autonomous';
```

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| A-02-T1 | File tồn tại và export `AgentId` | `npx tsc --noEmit` pass |

---

### A-03 — Thêm AgentMessage vào types.ts

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/types.ts` |
| **LOC thêm** | ~20 |
| **Phụ thuộc** | A-02 |
| **Rủi ro** | `legalBasis?: string[]` phải là optional array (không phải `string`) — nhất quán với response message |

**Nội dung thêm vào:**
```typescript
/**
 * Every message flowing through the multi-agent system.
 * traceId is REQUIRED — registry throws if missing.
 */
export interface AgentMessage {
  traceId: string;              // UUID v4, không được rỗng
  from: AgentId | 'user';
  to: AgentId | 'broadcast';
  type: 'request' | 'response' | 'event' | 'error';
  payload: unknown;
  timestamp: number;            // Date.now()
  legalBasis?: string[];        // citations emitted by this message
  parentTraceId?: string;       // for child traces
}
```

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| A-03-T1 | `AgentMessage` exportable | `npx tsc --noEmit` pass |
| A-03-T2 | `AgentMessage.traceId` là `string` (không phải `string \| undefined`) | Type check bằng tsc |

---

### A-04 — Thêm IAgent vào types.ts

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/types.ts` |
| **LOC thêm** | ~12 |
| **Phụ thuộc** | A-03 |
| **Rủi ro** | `process()` trả về `Promise<AgentMessage>` — phải là async (không sync) |

**Nội dung thêm vào:**
```typescript
/** Contract every P6 agent must implement. */
export interface IAgent {
  readonly id: AgentId;
  readonly name: string;
  process(msg: AgentMessage): Promise<AgentMessage>;
  getCapabilities(): string[];
}
```

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| A-04-T1 | `IAgent` exportable | `npx tsc --noEmit` pass |
| A-04-T2 | types.ts tổng số dòng ≈ 47 | Line count kiểm tra |

---

### A-05 — Tạo AgentRegistry.ts: class skeleton + constructor

| Thuộc tính | Giá trị |
|---|---|
| **File tạo mới** | `app/src/agents/AgentRegistry.ts` |
| **LOC** | ~25 |
| **Phụ thuộc** | A-04 |
| **Rủi ro** | Registry là instance (không phải module-level singleton) — constructor không có tham số |

**Nội dung:**
```typescript
// app/src/agents/AgentRegistry.ts

import type { AgentId, AgentMessage, IAgent } from './types';

export class AgentRegistry {
  private readonly agents   = new Map<AgentId, IAgent>();
  private readonly traces   = new Map<string, AgentMessage[]>();
  private readonly subs     = new Map<string, Array<(msg: AgentMessage) => void>>();

  constructor() {}
}
```

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| A-05-T1 | File tồn tại và class export | `npx tsc --noEmit` pass |

---

### A-06 — Implement AgentRegistry.log() với traceId guard

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/AgentRegistry.ts` |
| **LOC thêm** | ~12 |
| **Phụ thuộc** | A-05 |
| **Rủi ro** | Guard phải throw (không warn) — đây là audit invariant |

**Nội dung thêm vào class:**
```typescript
  log(msg: AgentMessage): void {
    if (!msg.traceId) {
      throw new Error('AgentMessage.traceId is required — audit invariant violated');
    }
    const existing = this.traces.get(msg.traceId) ?? [];
    this.traces.set(msg.traceId, [...existing, msg]);
  }
```

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| A-06-T1 | `registry.log({ traceId: '' })` throws | Manual verify hoặc inline test |
| A-06-T2 | `registry.log(validMsg)` không throws | Pass không exception |

---

### A-07 — Implement AgentRegistry.getTrace()

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/AgentRegistry.ts` |
| **LOC thêm** | ~5 |
| **Phụ thuộc** | A-06 |
| **Rủi ro** | Phải trả về `[]` (không phải `undefined`) cho traceId chưa có |

**Nội dung thêm vào class:**
```typescript
  getTrace(traceId: string): AgentMessage[] {
    return this.traces.get(traceId) ?? [];
  }
```

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| A-07-T1 | `registry.getTrace('nonexistent')` trả về `[]` | `[].length === 0` |
| A-07-T2 | Sau `log()`, `getTrace()` trả về đúng message | Array contain check |

---

### A-08 — Implement AgentRegistry.register()

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/AgentRegistry.ts` |
| **LOC thêm** | ~5 |
| **Phụ thuộc** | A-07 |
| **Rủi ro** | Overwrite silent nếu cùng AgentId — acceptable (last-write-wins) |

**Nội dung thêm vào class:**
```typescript
  register(agent: IAgent): void {
    this.agents.set(agent.id, agent);
  }
```

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| A-08-T1 | `npx tsc --noEmit` pass | 0 errors |

---

### A-09 — Implement AgentRegistry.process()

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/AgentRegistry.ts` |
| **LOC thêm** | ~18 |
| **Phụ thuộc** | A-08 |
| **Rủi ro** | `msg.to === 'broadcast'` không route qua `process()` — broadcast chỉ qua `notifySubscribers()` |

**Nội dung thêm vào class:**
```typescript
  async process(msg: AgentMessage): Promise<AgentMessage> {
    this.log(msg);
    if (msg.to === 'broadcast') {
      this.notifySubscribers(msg.type, msg);
      return msg;  // broadcast có no single response
    }
    const agent = this.agents.get(msg.to as AgentId);
    if (!agent) {
      throw new Error(`No agent registered for id: ${msg.to}`);
    }
    return agent.process(msg);
  }
```

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| A-09-T1 | `npx tsc --noEmit` pass | 0 errors |
| A-09-T2 | process() với unknown `to` throws Error | Exception với message chứa agent id |

---

### A-10 — Implement AgentRegistry.subscribe() và notifySubscribers()

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/AgentRegistry.ts` |
| **LOC thêm** | ~14 |
| **Phụ thuộc** | A-09 |
| **Rủi ro** | `notifySubscribers` gọi handlers synchronously — phù hợp với async process() |

**Nội dung thêm vào class:**
```typescript
  subscribe(event: string, handler: (msg: AgentMessage) => void): void {
    const existing = this.subs.get(event) ?? [];
    this.subs.set(event, [...existing, handler]);
  }

  notifySubscribers(event: string, msg: AgentMessage): void {
    const handlers = this.subs.get(event) ?? [];
    for (const h of handlers) {
      h(msg);
    }
  }
```

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| A-10-T1 | `npx tsc --noEmit` pass | 0 errors |
| A-10-T2 | `subscribe()` + `notifySubscribers()` gọi handler đúng 1 lần | Handler call count = 1 |

---

### A-GATE — Verification gate P6-01A

| # | Kiểm tra | Lệnh | Pass khi |
|---|---|---|---|
| AG-1 | TypeScript compile | `npx tsc --noEmit` | 0 errors |
| AG-2 | Tất cả P5 tests vẫn pass | `npm test` | 0 failures trong `src/__tests__/` |
| AG-3 | Không có import từ `agents/` trong `ai/` | `grep -r "from.*agents" app/src/ai/` | Rỗng |
| AG-4 | AgentRegistry.ts tổng dòng ≈ 79–85 | Line count | Trong khoảng |
| AG-5 | types.ts tổng dòng ≈ 47–55 | Line count | Trong khoảng |

**Nếu AG-2 fail → DỪNG. Xác định P5 regression trước khi tiếp tục.**

---

## P6-01B — PlannerOutput Schema

**Mục tiêu:** Tạo `PlannerAgent.ts` với đầy đủ type declarations. Class body là stub.  
**Files tạo mới:** `app/src/agents/PlannerAgent.ts`  
**Files sửa đổi:** Không có  
**LOC tổng:** ~140  

---

### B-01 — Tạo PlannerAgent.ts: imports

| Thuộc tính | Giá trị |
|---|---|
| **File tạo mới** | `app/src/agents/PlannerAgent.ts` |
| **LOC** | ~10 |
| **Phụ thuộc** | A-GATE pass |
| **Rủi ro** | Chỉ dùng `import type` ở phần này — không có runtime imports |

**Nội dung:**
```typescript
// app/src/agents/PlannerAgent.ts

import type { AgentId, AgentMessage, IAgent } from './types';
import type { AgentRegistry }                 from './AgentRegistry';
import type { AISuggestion }                  from '../ai/packageGenerator';
import type { LegalFinding }                  from '../ai/legalReviewer';
import type { WorkflowResult }                from '../ai/workflowOrchestrator';
```

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| B-01-T1 | File tồn tại, `npx tsc --noEmit` pass | 0 errors |

---

### B-02 — Thêm PlannerInput interface

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/PlannerAgent.ts` |
| **LOC thêm** | ~14 |
| **Phụ thuộc** | B-01 |
| **Rủi ro** | `deepAnalysis?: boolean` là bổ sung so với design doc gốc — phải có |

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| B-02-T1 | `PlannerInput` có 6 fields đúng kiểu | `npx tsc --noEmit` pass |
| B-02-T2 | Field `deepAnalysis?: boolean` hiện diện | Grep file |

---

### B-03 — Thêm AuthorityCheck interface

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/PlannerAgent.ts` |
| **LOC thêm** | ~14 |
| **Phụ thuộc** | B-02 |
| **Rủi ro** | `approvalLevel` literal union phải match chính xác: `'rector_direct' \| 'rector_with_khlcnt' \| 'ministry'` |

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| B-03-T1 | `AuthorityCheck.legalBasis` là `string[]` (không phải `string`) | tsc |
| B-03-T2 | 3 literal values cho `approvalLevel` đúng | Grep `rector_direct`, `rector_with_khlcnt`, `ministry` |

---

### B-04 — Thêm Quarter type, CalendarEntry, ProcurementCalendar

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/PlannerAgent.ts` |
| **LOC thêm** | ~28 |
| **Phụ thuộc** | B-03 |
| **Rủi ro** | `totalByQuarter: Record<Quarter, number>` yêu cầu tất cả 4 keys (Q1–Q4) luôn có mặt — không optional |

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| B-04-T1 | `Quarter` type = `'Q1' \| 'Q2' \| 'Q3' \| 'Q4'` | tsc |
| B-04-T2 | `ProcurementCalendar.khlcntSubmissionDate` là `string` (ISO 8601 — format enforced by runtime, không phải type) | tsc |

---

### B-05 — Thêm SplitWarningPayload, PlannerState, PlannerStateEvent

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/PlannerAgent.ts` |
| **LOC thêm** | ~24 |
| **Phụ thuộc** | B-04 |
| **Rủi ro** | `SplitWarningPayload.finding: LegalFinding` — `LegalFinding.legalBasis` là `string` (single), không phải `string[]`. Phải đúng kiểu từ legalReviewer.ts |

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| B-05-T1 | `PlannerState` có đủ 6 literal values | Grep file |
| B-05-T2 | `SplitWarningPayload` compile đúng với `LegalFinding` type từ P5 | `npx tsc --noEmit` pass |

---

### B-06 — Thêm PlannerOutput interface

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/PlannerAgent.ts` |
| **LOC thêm** | ~18 |
| **Phụ thuộc** | B-05 |
| **Rủi ro** | `workflowResults?: WorkflowResult[]` là optional (chỉ có khi `deepAnalysis: true`) |

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| B-06-T1 | `PlannerOutput.budgetUtilization: number` (bao gồm giá trị `-1`) | tsc |
| B-06-T2 | `PlannerOutput.legalBasis: string[]` (không phải `string`) | tsc |

---

### B-07 — Thêm PlannerAgent class stub

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/PlannerAgent.ts` |
| **LOC thêm** | ~20 |
| **Phụ thuộc** | B-06 |
| **Rủi ro** | Class phải implement `IAgent` — TypeScript sẽ error nếu signature sai |

**Nội dung:**
```typescript
export class PlannerAgent implements IAgent {
  readonly id = 'planner' as const;
  readonly name = 'Procurement Planner Agent';

  constructor(_registry: AgentRegistry) {}

  async process(_msg: AgentMessage): Promise<AgentMessage> {
    throw new Error('PlannerAgent.process() not yet implemented — complete P6-01D first');
  }

  getCapabilities(): string[] {
    return ['annual-procurement-planning', 'package-split-detection',
            'authority-validation', 'procurement-calendar'];
  }
}
```

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| B-07-T1 | `PlannerAgent implements IAgent` compile không lỗi | `npx tsc --noEmit` pass |
| B-07-T2 | `getCapabilities()` trả về array 4 strings | Runtime check |

---

### B-GATE — Verification gate P6-01B

| # | Kiểm tra | Lệnh | Pass khi |
|---|---|---|---|
| BG-1 | TypeScript compile | `npx tsc --noEmit` | 0 errors |
| BG-2 | Tất cả P5 tests vẫn pass | `npm test` | 0 failures |
| BG-3 | PlannerAgent.ts có đủ 11 exports (9 interfaces + 2 types + 1 class) | Grep `export` | ≥ 11 export statements |
| BG-4 | PlannerAgent.ts tổng dòng ≈ 130–150 | Line count | Trong khoảng |

---

## P6-01C — Core Algorithms

**Mục tiêu:** Implement 7 pure functions. Tất cả phải export. Không có side effects.  
**Files sửa đổi:** `app/src/agents/PlannerAgent.ts` (thêm vào sau phần type declarations)  
**LOC thêm:** ~240  

---

### C-01 — Thêm CONNECTOR_PATTERN, COMMA_PATTERN constants

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/PlannerAgent.ts` |
| **LOC thêm** | ~8 |
| **Phụ thuộc** | B-GATE pass |
| **Rủi ro** | Regex phải có flag `gi` để match case-insensitive và globally |

**Nội dung:**
```typescript
// ─── Constants: parseGoalIntoItems ────────────────────────────────────────────

const CONNECTOR_PATTERN =
  /\s+(và|cùng với|cùng|cộng với|thêm|bao gồm)\s+/gi;
const COMMA_PATTERN = /\s*[,;]\s*/g;
```

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| C-01-T1 | `'a và b'.split(CONNECTOR_PATTERN)` cho kết quả có 'a' và 'b' | Không phải mục tiêu test trực tiếp — xác nhận qua T01 |

---

### C-02 — Implement generateTraceId()

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/PlannerAgent.ts` |
| **LOC thêm** | ~8 |
| **Phụ thuộc** | C-01 |
| **Rủi ro** | `crypto.randomUUID` không available trong Vitest test environment (Node.js) — fallback phải hoạt động |

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| C-02-T1 | `generateTraceId()` trả về string không rỗng | `result.length > 0` |
| C-02-T2 | Hai lần gọi trả về giá trị khác nhau | `id1 !== id2` |

---

### C-03 — Implement parseGoalIntoItems()

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/PlannerAgent.ts` |
| **LOC thêm** | ~22 |
| **Phụ thuộc** | C-02 |
| **Rủi ro** | Vietnamese text: "máy tính để bàn" không được tách nhầm ở "và" trong "để" |

**Algorithm chi tiết:**
1. `goal.trim()` rỗng → return `[]`
2. Chuẩn hóa: `.replace(/\s+/g, ' ').trim()`
3. Tách bằng CONNECTOR_PATTERN: `goal.split(CONNECTOR_PATTERN)`
4. Flatten và tách tiếp bằng COMMA_PATTERN
5. Filter: fragment phải `.trim().length >= 3`
6. Return filtered fragments

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| C-03-T1 (=T01) | `parseGoalIntoItems('20 máy tính và văn phòng phẩm')` → length 2 | `result.length === 2` |
| C-03-T2 (=T02) | `parseGoalIntoItems('a, b, c')` → length 3 | `result.length === 3` |
| C-03-T3 (=T03) | `parseGoalIntoItems('20 máy tính để bàn')` → length 1 | `result.length === 1` |
| C-03-T4 (=T04) | `parseGoalIntoItems('')` → `[]` | `result.length === 0` |
| C-03-T5 (=T05) | `parseGoalIntoItems('a cùng với b')` → length 2 | `result.length === 2` |

---

### C-04 — Thêm SPLIT_THRESHOLDS constant và implement detectPackageSplitting()

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/PlannerAgent.ts` |
| **LOC thêm** | ~45 |
| **Phụ thuộc** | C-03 |
| **Rủi ro** | `LegalFinding.legalBasis` là `string` (single string) — không phải `string[]`. Phải assign đúng kiểu. |

**Constants:**
```typescript
const SPLIT_THRESHOLDS = [
  { value: 50_000_000,    label: '50 triệu (ngưỡng mua sắm trực tiếp)' },
  { value: 500_000_000,   label: '500 triệu (ngưỡng chỉ định thầu rút gọn)' },
  { value: 5_000_000_000, label: '5 tỷ (ngưỡng chào hàng cạnh tranh)' },
] as const;
```

**LegalFinding phải có:**
- `severity: 'CRITICAL'`
- `code: 'PA-001'`
- `category: 'package-splitting'`
- `legalBasis: 'Điều 44 khoản 6 Luật Đấu thầu 22/2023/QH15 — nghiêm cấm chia nhỏ gói thầu...'` (string, không phải array)
- `recommendation: 'Hợp nhất tất cả N gói...'`

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| C-04-T1 (=T06) | 1 gói dưới ngưỡng → `[]` | `result.length === 0` |
| C-04-T2 (=T07) | 2 gói cùng category tổng 550M → 1 CRITICAL | `result[0].severity === 'CRITICAL'` |
| C-04-T3 (=T08) | 2 gói khác category → `[]` | `result.length === 0` |
| C-04-T4 (=T09) | Tổng 55M (ngưỡng 50M) → CRITICAL | `result[0].code === 'PA-001'` |
| C-04-T5 (=T10) | Tổng 5.5B (ngưỡng 5B) → CRITICAL | `result.length >= 1` |
| C-04-T6 (=T11) | `existingPackages` cộng vào group | Split detected khi combined |
| C-04-T7 (=T12) | `finding.legalBasis` chứa 'Điều 44 khoản 6' | `includes('Điều 44 khoản 6')` |
| C-04-T8 (=T13) | `finding.recommendation` chứa 'hợp nhất' | `.toLowerCase().includes('hợp nhất')` |

---

### C-05 — Thêm AUTHORITY_LEGAL_BASIS và implement validateAuthority()

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/PlannerAgent.ts` |
| **LOC thêm** | ~55 |
| **Phụ thuộc** | C-04 |
| **Rủi ro** | Boundary: `total === 50_000_000` → `rector_direct` (≤ không phải <). `total === 500_000_000` → `rector_with_khlcnt`. Phải test cả 2 boundaries. |

**Constants:**
```typescript
const AUTHORITY_BASIS_DIRECT = [
  'Điểm m Khoản 1 Điều 23 Luật Đấu thầu 22/2023/QH15',
  'Khoản 4 Điều 80 Nghị định 214/2025/NĐ-CP',
  'Thông tư 13/2026/TT-BCT Điều 4',
] as const;

const AUTHORITY_BASIS_KHLCNT = [
  'Điều 38-41 Luật Đấu thầu 22/2023/QH15 — lập KHLCNT',
  'Khoản 2 và 3 Điều 80 Nghị định 214/2025/NĐ-CP',
  'Thông tư 13/2026/TT-BCT Điều 4',
] as const;

const AUTHORITY_BASIS_MINISTRY = [
  'Điều 38-41 Luật Đấu thầu 22/2023/QH15 — KHLCNT',
  'Nghị định 214/2025/NĐ-CP',
  'Thông tư 13/2026/TT-BCT Điều 4 — thẩm quyền Bộ Công Thương',
] as const;
```

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| C-05-T1 (=T14) | `validateAuthority(pkg{50M})` → `rector_direct`, `khlcntRequired: false` | Exact field match |
| C-05-T2 (=T15) | `validateAuthority(pkg{51M})` → `rector_with_khlcnt`, `khlcntRequired: true` | Exact field match |
| C-05-T3 (=T16) | `validateAuthority(pkg{500M})` → `rector_with_khlcnt` (boundary) | Exact field match |
| C-05-T4 (=T17) | `validateAuthority(pkg{501M})` → `ministry`, `ministerialApproval: true` | Exact field match |
| C-05-T5 (=T18) | `legalBasis` chứa '13/2026' | `some(b => b.includes('13/2026'))` |
| C-05-T6 (=T19) | `packageCode` và `packageName` được copy đúng | Field equality |

---

### C-06 — Thêm LEAD_TIME_DAYS, QUARTER_MONTH_MAP, implement getProcurementLeadTime() và assignQuarter()

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/PlannerAgent.ts` |
| **LOC thêm** | ~40 |
| **Phụ thuộc** | C-05 |
| **Rủi ro** | `methodHint.includes()` phải dùng substring check (không phải `===`) vì `procurementMethodHint` chứa text dài: `"DIRECT_SELECTION_SIMPLIFIED — Chỉ định thầu rút gọn"` |

**Constants:**
```typescript
const LEAD_TIME_DAYS: Record<string, number> = {
  DIRECT_50: 14,
  DIRECT_SELECTION_SIMPLIFIED: 28,
  COMPETITIVE_SHOPPING: 45,
  OPEN_BIDDING: 90,
};

const QUARTER_MONTH_MAP: Record<Quarter, number> = {
  Q1: 2, Q2: 4, Q3: 7, Q4: 10,
};
```

**assignQuarter rules (theo thứ tự ưu tiên):**
1. `packageType === 'goods_consumable'` → `'Q1'`
2. `packageType === 'service'` → `'Q1'`
3. `packageType === 'goods_fixed_asset'` và `estimatedTotal > 500_000_000` → `'Q3'`
4. Mọi trường hợp còn lại → `'Q2'`

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| C-06-T1 | `getProcurementLeadTime('OPEN_BIDDING')` → 90 | `=== 90` |
| C-06-T2 | `getProcurementLeadTime('DIRECT_SELECTION_SIMPLIFIED — Chỉ định thầu')` → 28 | `=== 28` (substring match) |
| C-06-T3 | `getProcurementLeadTime('unknown_method')` → 30 (default) | `=== 30` |
| C-06-T4 | `assignQuarter({packageType:'service'})` → `'Q1'` | `=== 'Q1'` |
| C-06-T5 | `assignQuarter({packageType:'goods_fixed_asset', estimatedTotal: 1_000_000_000})` → `'Q3'` | `=== 'Q3'` |

---

### C-07 — Implement buildCalendar()

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/PlannerAgent.ts` |
| **LOC thêm** | ~42 |
| **Phụ thuộc** | C-06 |
| **Rủi ro** | `totalByQuarter` phải có tất cả 4 keys (`Q1`, `Q2`, `Q3`, `Q4`) kể cả khi = 0. Phải khởi tạo `{ Q1: 0, Q2: 0, Q3: 0, Q4: 0 }` |

**Algorithm đầy đủ:**
```
1. Khởi tạo totalByQuarter = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
2. entries = packages.map(pkg => {
     quarter = assignQuarter(pkg)
     month   = QUARTER_MONTH_MAP[quarter]
     lead    = getProcurementLeadTime(pkg.procurementMethodHint)
     totalByQuarter[quarter] += pkg.estimatedTotal
     return { packageCode, packageName, quarter, estimatedMonth: month,
              leadTimeDays: lead, rationale: buildRationale(pkg, quarter),
              procurementMethod: pkg.procurementMethodHint, estimatedTotal: pkg.estimatedTotal }
   })
3. Sort entries by estimatedMonth ASC
4. totalAnnual = packages.reduce((s, p) => s + p.estimatedTotal, 0)
5. khlcntSubmissionDate = `${budgetYear}-01-15`
```

**`buildRationale()` — private helper, không export:**
- Trả về string tiếng Việt giải thích lý do phân quý
- `goods_consumable` → `'Vật tư tiêu hao cần ngay đầu năm học'`
- `service` → `'Dịch vụ triển khai đầu năm'`
- `goods_fixed_asset > 500M` → `'Tài sản lớn cần chuẩn bị KHLCNT dài'`
- Mặc định → `'Tài sản cố định phân vào Q2 để chuẩn bị KHLCNT'`

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| C-07-T1 (=T20) | `entries.length === packages.length` | Equality |
| C-07-T2 (=T21) | `totalAnnual === sum(estimatedTotals)` | Arithmetic |
| C-07-T3 (=T22) | `goods_consumable` → quarter `'Q1'` | `entries[*].quarter === 'Q1'` |
| C-07-T4 (=T23) | `khlcntSubmissionDate` match `/^\d{4}-\d{2}-\d{2}$/` | Regex test |
| C-07-T5 (=T24) | `sum(Object.values(totalByQuarter)) === totalAnnual` | Arithmetic |

---

### C-GATE — Verification gate P6-01C

| # | Kiểm tra | Lệnh | Pass khi |
|---|---|---|---|
| CG-1 | TypeScript compile | `npx tsc --noEmit` | 0 errors |
| CG-2 | Tất cả P5 tests vẫn pass | `npm test` | 0 failures trong P5 |
| CG-3 | 7 functions đều có `export` keyword | `grep "^export function" app/src/agents/PlannerAgent.ts` | 7 kết quả |
| CG-4 | PlannerAgent.ts tổng dòng ≈ 360–390 | Line count | Trong khoảng |
| CG-5 | `detectPackageSplitting` có code `PA-001` | `grep "PA-001" app/src/agents/PlannerAgent.ts` | 1 kết quả |

---

## P6-01D — PlannerAgent Class

**Mục tiêu:** Điền body của class PlannerAgent. State machine đầy đủ.  
**Files sửa đổi:** `app/src/agents/PlannerAgent.ts` (thay class stub bằng implementation)  
**LOC thêm:** ~180  

---

### D-01 — Thêm private fields và constructor vào PlannerAgent

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/PlannerAgent.ts` — thay class stub |
| **LOC thay thế** | ~20 (stub ~8 → implementation ~28) |
| **Phụ thuộc** | C-GATE pass |
| **Rủi ro** | `registry` phải là `readonly` để tránh reassign |

**Nội dung thay thế class stub:**
```typescript
export class PlannerAgent implements IAgent {
  readonly id = 'planner' as const;
  readonly name = 'Procurement Planner Agent';

  private state: PlannerState = 'idle';
  private currentTraceId: string | null = null;
  private readonly registry: AgentRegistry;

  constructor(registry: AgentRegistry) {
    this.registry = registry;
  }

  getCapabilities(): string[] {
    return ['annual-procurement-planning', 'package-split-detection',
            'authority-validation', 'procurement-calendar'];
  }
  // process() và private helpers được thêm trong D-02 → D-07
}
```

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| D-01-T1 | `new PlannerAgent(registry)` không throw | Instantiation OK |
| D-01-T2 | `agent.id === 'planner'` | Field check |

---

### D-02 — Implement private emit() và private transition()

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/PlannerAgent.ts` |
| **LOC thêm** | ~28 |
| **Phụ thuộc** | D-01 |
| **Rủi ro** | `emit()` phải tự điền `traceId`, `from`, `timestamp` — không để caller tự điền |

**Nội dung:**
```typescript
  private emit(partial: Omit<AgentMessage, 'traceId' | 'from' | 'timestamp'>): void {
    const msg: AgentMessage = {
      traceId: this.currentTraceId!,
      from: 'planner',
      timestamp: Date.now(),
      ...partial,
    };
    this.registry.log(msg);
    if (msg.to === 'broadcast') {
      this.registry.notifySubscribers(msg.type, msg);
    }
  }

  private transition(next: PlannerState, detail?: string): void {
    const event: PlannerStateEvent = {
      previousState: this.state,
      nextState: next,
      timestamp: Date.now(),
      detail,
    };
    this.emit({ to: 'planner', type: 'event', payload: event });
    this.state = next;
  }
```

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| D-02-T1 | `emit()` tự điền `traceId` từ `currentTraceId` | Kiểm tra qua D-05 |
| D-02-T2 | `transition()` gọi `registry.log()` | Registry nhận event |

---

### D-03 — Implement buildErrorResponse() và buildResponse()

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/PlannerAgent.ts` |
| **LOC thêm** | ~28 |
| **Phụ thuộc** | D-02 |
| **Rủi ro** | `buildErrorResponse` phải reset `this.state = 'idle'` và `this.currentTraceId = null` |

**Nội dung:**
```typescript
  private buildErrorResponse(
    code: string,
    message: string,
    inState: PlannerState,
    to: AgentId | 'user' = 'user',
  ): AgentMessage {
    this.state = 'idle';
    this.currentTraceId = null;
    return {
      traceId: this.currentTraceId ?? generateTraceId(),
      from: 'planner',
      to,
      type: 'error',
      payload: { code, message, state: inState },
      timestamp: Date.now(),
    };
  }

  private buildResponse(to: AgentId | 'user', output: PlannerOutput): AgentMessage {
    return {
      traceId: this.currentTraceId!,
      from: 'planner',
      to,
      type: 'response',
      payload: output,
      timestamp: Date.now(),
      legalBasis: output.legalBasis,
    };
  }
```

**Lưu ý:** `buildErrorResponse` cần lưu `traceId` trước khi reset — xem D-09 để biết cách xử lý.

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| D-03-T1 | `buildErrorResponse` trả về `type === 'error'` | Type check |
| D-03-T2 | `buildResponse` trả về `type === 'response'` | Type check |

---

### D-04 — Implement collectAllLegalBasis() (private, không export)

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/PlannerAgent.ts` |
| **LOC thêm** | ~20 |
| **Phụ thuộc** | D-03 |
| **Rủi ro** | `splitWarning.legalBasis` là `string` (không phải `string[]`) — phải wrap thành `[str]` trước khi push vào Set |

**Logic:**
```
Set<string> citations
- fixed: 'Điều 38-41 Luật Đấu thầu 22/2023/QH15 — lập và phê duyệt KHLCNT'
- từ splitWarnings[*].legalBasis: mỗi finding.legalBasis là string → citations.add(str)
- từ authorityChecks[*].legalBasis: mỗi element là string → citations.add(str)
return [...citations]
```

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| D-04-T1 | Result luôn chứa Điều 38-41 citation | `includes('Điều 38-41')` |
| D-04-T2 | Dedup: 2 authority checks cùng citation → 1 entry trong result | Set dedup |

---

### D-05 — Implement determineConfidence() (private, không export)

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/PlannerAgent.ts` |
| **LOC thêm** | ~12 |
| **Phụ thuộc** | D-04 |
| **Rủi ro** | Logic: any `low` → `'low'`; all `high` → `'high'`; else `'medium'` |

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| D-05-T1 | All packages `confidence: 'high'` → returns `'high'` | `=== 'high'` |
| D-05-T2 | Any package `confidence: 'low'` → returns `'low'` | `=== 'low'` |

---

### D-06 — Implement process(): validation + PARSING_GOAL

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/PlannerAgent.ts` |
| **LOC thêm** | ~40 |
| **Phụ thuộc** | D-05 |
| **Rủi ro** | Phải lưu `traceId` và `callerFrom` trước khi bất kỳ transition nào — state machine cần chúng sau khi error |

**Nội dung process() đầu:**
```typescript
  async process(msg: AgentMessage): Promise<AgentMessage>  {
    const traceId   = msg.traceId;
    const callerFrom = msg.from;
    this.currentTraceId = traceId;
    this.registry.log(msg);

    const input = msg.payload as PlannerInput;

    if (!input?.naturalLanguageGoal?.trim()) {
      return this.buildErrorResponse('PLANNER_EMPTY_INPUT',
        'naturalLanguageGoal không được rỗng', 'idle',
        callerFrom === 'user' ? 'user' : callerFrom as AgentId);
    }

    try {
      this.transition('parsing-goal', 'Bắt đầu phân tích mục tiêu');
      const items = parseGoalIntoItems(input.naturalLanguageGoal);
      if (items.length === 0) {
        return this.buildErrorResponse('PLANNER_NO_ITEMS',
          'Không tách được item từ mục tiêu', 'parsing-goal',
          callerFrom === 'user' ? 'user' : callerFrom as AgentId);
      }
      const packages = items.map(item =>
        generatePackageSuggestion(item, input.budgetYear)
      );
      // ... tiếp tục trong D-07
    } catch (err) {
      return this.buildErrorResponse('PLANNER_INTERNAL_ERROR',
        String(err), this.state,
        callerFrom === 'user' ? 'user' : callerFrom as AgentId);
    }
  }
```

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| D-06-T1 (=T30) | `process()` với goal rỗng → `type === 'error'` | `response.type === 'error'` |
| D-06-T2 (=T30) | Error response có cùng `traceId` | `response.traceId === request.traceId` |

---

### D-07 — Implement process(): DETECTING_SPLIT → COMPOSING_RESPONSE → cleanup

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/PlannerAgent.ts` |
| **LOC thêm** | ~55 |
| **Phụ thuộc** | D-06 |
| **Rủi ro** | State PHẢI reset về `'idle'` và `currentTraceId` về `null` kể cả khi có exception trong try block |

**Completion của process() body (trong try block):**
```
// Step: DETECTING_SPLIT
transition('detecting-split')
splitWarnings = detectPackageSplitting(packages, input.existingPackages ?? [])
if (splitWarnings.length > 0) {
  emit({ to: 'broadcast', type: 'event', payload: { category, packages: [...], finding: splitWarnings[0] } })
}

// Step: VALIDATING_AUTHORITY
transition('validating-authority')
authorityChecks = packages.map(pkg => validateAuthority(pkg))

// Step: BUILDING_CALENDAR
transition('building-calendar')
calendar = buildCalendar(packages, input.budgetYear)

// Step: COMPOSING_RESPONSE
transition('composing-response')
totalEstimated = packages.reduce((s, p) => s + p.estimatedTotal, 0)
budgetUtilization = input.totalBudget ? totalEstimated / input.totalBudget : -1
legalBasis = collectAllLegalBasis(splitWarnings, authorityChecks)
confidence  = determineConfidence(packages)
output = { packages, splitWarnings, authorityChecks, calendar,
           totalEstimated, budgetUtilization, legalBasis, confidence,
           warnings: [], workflowResults: undefined }
response = buildResponse(callerFrom === 'user' ? 'user' : callerFrom as AgentId, output)
registry.log(response)
this.state = 'idle'
this.currentTraceId = null
return response
```

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| D-07-T1 (=T25) | `process()` valid request → `type === 'response'`, traceId preserved | Both checks pass |
| D-07-T2 (=T26) | Registry nhận ≥ 3 events | `events.length >= 3` |
| D-07-T3 (=T27) | Split input → broadcast event `to === 'broadcast'` | `broadcast` found in trace |
| D-07-T4 (=T28) | Response payload có `packages`, `calendar`, `authorityChecks` | Defined checks |
| D-07-T5 (=T29) | `agent.state === 'idle'` sau khi xong | State check |

---

### D-GATE — Verification gate P6-01D

| # | Kiểm tra | Lệnh | Pass khi |
|---|---|---|---|
| DG-1 | TypeScript compile | `npx tsc --noEmit` | 0 errors |
| DG-2 | Tất cả P5 tests vẫn pass | `npm test` | 0 failures |
| DG-3 | `process()` stub đã bị xóa | `grep "not yet implemented" PlannerAgent.ts` | Rỗng |
| DG-4 | PlannerAgent.ts tổng dòng ≈ 530–570 | Line count | Trong khoảng |

---

## P6-01E — P5 Integration

**Mục tiêu:** Bridge function + deep analysis wiring. Không có logic nghiệp vụ mới.  
**Files sửa đổi:** `app/src/agents/PlannerAgent.ts`  
**LOC thêm:** ~95  

---

### E-01 — Chuyển import type thành runtime imports + thêm imports mới

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/PlannerAgent.ts` — phần imports đầu file |
| **LOC thay đổi** | ~8 |
| **Phụ thuộc** | D-GATE pass |
| **Rủi ro** | `runWorkflow` từ workflowOrchestrator.ts là synchronous — không cần await |

**Thay thế/bổ sung imports:**
```typescript
// Runtime imports (không còn là import type):
import { generatePackageSuggestion }   from '../ai/packageGenerator';
import { reviewPackage }               from '../ai/legalReviewer';
import { runWorkflow }                 from '../ai/workflowOrchestrator';
import type { ProcurementPackage }     from '../demoData';

// Giữ nguyên:
import type { AISuggestion }           from '../ai/packageGenerator';
import type { LegalFinding }           from '../ai/legalReviewer';
import type { WorkflowResult }         from '../ai/workflowOrchestrator';
```

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| E-01-T1 | `npx tsc --noEmit` pass với runtime imports | 0 errors |
| E-01-T2 | `generatePackageSuggestion` không còn `import type` | Grep |

---

### E-02 — Định nghĩa PEOPLE_PLACEHOLDERS constant

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/PlannerAgent.ts` — sau phần constants hiện có |
| **LOC thêm** | ~22 |
| **Phụ thuộc** | E-01 |
| **Rủi ro** | Placeholder strings phải khớp chính xác CLAUDE.md demo data rules. Không dùng tên thật. |

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| E-02-T1 | Không có tên thật trong PEOPLE_PLACEHOLDERS | Code review — chỉ có `[...]` format |
| E-02-T2 | Có đủ 17 supplier/people placeholder fields | Count fields |

---

### E-03 — Implement buildMinimalProcurementPackage()

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/PlannerAgent.ts` |
| **LOC thêm** | ~55 |
| **Phụ thuộc** | E-02 |
| **Rủi ro** | `ProcurementPackage` có ~40 fields — TypeScript strict mode sẽ error nếu thiếu field bắt buộc. Phải kiểm tra đúng `demoData.ts` |

**Key fields:**
- `id`: `planner-preview-${suggestion.packageCode}`
- `items`: 1 item với `unitPrice = estimatedTotal`, `quantity = 1`
- `warrantyMonths`: `suggestion.packageType === 'goods_fixed_asset' ? 12 : 0`
- Tất cả date fields: `''` (rỗng)
- Tất cả people fields: từ `PEOPLE_PLACEHOLDERS`

**Export:** `export function buildMinimalProcurementPackage(...)` — exported để test E-03-T3

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| E-03-T1 | `npx tsc --noEmit` pass | 0 errors (tsc verify tất cả fields) |
| E-03-T2 | `buildMinimalProcurementPackage(s, 2026).items.length === 1` | Length check |
| E-03-T3 | `reviewPackage(buildMinimalProcurementPackage(s, 2026))` không throw | No exception |

---

### E-04 — Thêm deep analysis block vào process()

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/PlannerAgent.ts` — trong process(), sau `authorityChecks`, trước compose |
| **LOC thêm** | ~18 |
| **Phụ thuộc** | E-03 |
| **Rủi ro** | Deep analysis với nhiều packages có thể chậm vì `runWorkflow()` lặp — acceptable cho prototype |

**Vị trí chèn:** Sau step `validating-authority`, trước step `composing-response`.

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| E-04-T1 | `deepAnalysis: false` (default) → `output.workflowResults === undefined` | Undefined check |
| E-04-T2 | `deepAnalysis: true` → `output.workflowResults.length === packages.length` | Length check |

---

### E-GATE — Verification gate P6-01E

| # | Kiểm tra | Lệnh | Pass khi |
|---|---|---|---|
| EG-1 | TypeScript compile | `npx tsc --noEmit` | 0 errors |
| EG-2 | Tất cả P5 tests vẫn pass | `npm test` | 0 failures — KHÔNG có import cycle |
| EG-3 | Không có tên thật trong `PlannerAgent.ts` | Grep cho common Vietnamese names | Rỗng |
| EG-4 | PlannerAgent.ts tổng dòng ≈ 625–665 | Line count | Trong khoảng |

---

## P6-01F — Tests

**Mục tiêu:** 30 unit tests (baseline) + 5 bổ sung (tùy chọn) = 30–35 tests.  
**Files tạo mới:** `app/src/agents/__tests__/planner-agent.test.ts`  
**Files sửa đổi:** Không có  
**LOC tổng:** ~280  

---

### F-01 — Tạo thư mục __tests__ và file test với imports

| Thuộc tính | Giá trị |
|---|---|
| **File tạo mới** | `app/src/agents/__tests__/planner-agent.test.ts` |
| **LOC** | ~18 |
| **Phụ thuộc** | E-GATE pass |
| **Rủi ro** | Vitest discover pattern: `src/**/__tests__/**/*.test.ts` — thư mục mới phải nằm đúng pattern |

**Nội dung:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseGoalIntoItems,
  detectPackageSplitting,
  validateAuthority,
  getProcurementLeadTime,
  assignQuarter,
  buildCalendar,
  buildMinimalProcurementPackage,
  PlannerAgent,
} from '../PlannerAgent';
import type { AISuggestion } from '../../ai/packageGenerator';
import type { AgentMessage, AgentId } from '../types';
import type { PlannerInput, PlannerOutput } from '../PlannerAgent';
```

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| F-01-T1 | File được Vitest discover | `npm test` không có "no test files found" |
| F-01-T2 | Imports compile | `npx tsc --noEmit` pass |

---

### F-02 — Viết fixtures: makeSuggestion(), makePlannerRequest(), createTestRegistry()

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/__tests__/planner-agent.test.ts` |
| **LOC thêm** | ~60 |
| **Phụ thuộc** | F-01 |
| **Rủi ro** | `createTestRegistry()` phải return fresh object mỗi lần gọi — không phải module-level singleton. Test phải gọi `createTestRegistry()` trong `beforeEach()`. |

**Acceptance tests:**

| # | Kiểm hear | Pass khi |
|---|---|---|
| F-02-T1 | `makeSuggestion('computer', 200_000_000).detectedCategory === 'computer'` | Field check |
| F-02-T2 | `makePlannerRequest('test', 'trace-001').traceId === 'trace-001'` | Field check |
| F-02-T3 | `createTestRegistry().getTrace('x')` trả về `[]` | Empty array |

---

### F-03 — Viết Group 1: parseGoalIntoItems (T01–T05)

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/__tests__/planner-agent.test.ts` |
| **LOC thêm** | ~35 |
| **Phụ thuộc** | F-02 |
| **Rủi ro** | T01: kết quả split có thể chứa connector word nếu regex không đúng — verify `items[0]` không chứa "và" |

**Tests: T01, T02, T03, T04, T05** (chi tiết tại §9.1 của design doc).

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| F-03-T1 | 5/5 tests trong Group 1 pass | `npm test` — Group 1 green |

---

### F-04 — Viết Group 2: detectPackageSplitting (T06–T13)

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/__tests__/planner-agent.test.ts` |
| **LOC thêm** | ~60 |
| **Phụ thuộc** | F-03 |
| **Rủi ro** | T12: `finding.legalBasis.contains('Điều 44 khoản 6')` — `legalBasis` là `string`, không phải `string[]`, nên dùng `.includes()` không phải `.some()` |

**Tests: T06, T07, T08, T09, T10, T11, T12, T13**.

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| F-04-T1 | 8/8 tests trong Group 2 pass | `npm test` — Group 2 green |

---

### F-05 — Viết Group 3: validateAuthority (T14–T19)

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/__tests__/planner-agent.test.ts` |
| **LOC thêm** | ~45 |
| **Phụ thuộc** | F-04 |
| **Rủi ro** | T18: `legalBasis.some(b => b.includes('13/2026'))` — `AuthorityCheck.legalBasis` là `string[]` → dùng `.some()` đúng |

**Tests: T14, T15, T16, T17, T18, T19**.

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| F-05-T1 | 6/6 tests trong Group 3 pass | `npm test` — Group 3 green |

---

### F-06 — Viết Group 4: buildCalendar (T20–T24)

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/__tests__/planner-agent.test.ts` |
| **LOC thêm** | ~40 |
| **Phụ thuộc** | F-05 |
| **Rủi ro** | T22: `makeSuggestion` mặc định dùng `packageType: 'goods_fixed_asset'` — phải override sang `'goods_consumable'` cho test này |

**Tests: T20, T21, T22, T23, T24**.

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| F-06-T1 | 5/5 tests trong Group 4 pass | `npm test` — Group 4 green |

---

### F-07 — Viết Group 5: PlannerAgent.process() (T25–T30)

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/__tests__/planner-agent.test.ts` |
| **LOC thêm** | ~55 |
| **Phụ thuộc** | F-06 |
| **Rủi ro** | T27 (split via NL): dùng input tiếng Việt đầy đủ: `'văn phòng phẩm 300 triệu và văn phòng phẩm 300 triệu'` để đảm bảo `generatePackageSuggestion()` detect cùng category |

**Tests: T25, T26, T27, T28, T29, T30**.

Mỗi test phải dùng `registry = createTestRegistry()` riêng (trong `beforeEach`) để tránh state leak.

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| F-07-T1 | 6/6 tests trong Group 5 pass | `npm test` — Group 5 green |
| F-07-T2 | T29 verify `agent['state'] === 'idle'` (private field access) | Vitest không restrict private access |

---

### F-08 — (Tùy chọn) Viết 5 tests bổ sung TB-01 → TB-05

| Thuộc tính | Giá trị |
|---|---|
| **File sửa đổi** | `app/src/agents/__tests__/planner-agent.test.ts` |
| **LOC thêm** | ~35 |
| **Phụ thuộc** | F-07 |
| **Rủi ro** | Không có — tất cả test bổ sung là straightforward |

**Tests:** TB-01 (`generateTraceId`), TB-02–TB-03 (`getProcurementLeadTime`), TB-04–TB-05 (`assignQuarter`).

**Acceptance tests:**

| # | Kiểm tra | Pass khi |
|---|---|---|
| F-08-T1 | 5/5 optional tests pass | `npm test` — tất cả green |

---

### F-GATE — Verification gate P6-01F

| # | Kiểm tra | Lệnh | Pass khi |
|---|---|---|---|
| FG-1 | Toàn bộ test suite pass | `npm test` | 0 failures |
| FG-2 | Tổng số tests ≥ 299 (269 P5 + 30 P6-01F) | `npm test \| grep "Tests:"` | ≥ 299 |
| FG-3 | Không có P5 regression | `npm test \| grep "FAIL"` | Chỉ có file trong `agents/__tests__/` (nếu có fail) |
| FG-4 | Không có `vi.fn()` hay `vi.mock()` trên P5 functions | `grep "vi.fn\|vi.mock" planner-agent.test.ts` | Rỗng |
| FG-5 | Test suite chạy < 30 giây | Timing output | < 30s |

---

## POST-GATE — Kiểm tra cuối

| ID | Task | Lệnh kiểm tra | Pass khi |
|---|---|---|---|
| POST-01 | Full test suite pass | `npm test` | 0 failures |
| POST-02 | TypeScript compile clean | `npx tsc --noEmit` | 0 errors |
| POST-03 | Không có file P5 bị sửa | `git diff --name-only app/src/ai/ app/src/demoData.ts` | Rỗng |
| POST-04 | Đúng 3 files mới trong `app/src/agents/` | `ls app/src/agents/` | types.ts, AgentRegistry.ts, PlannerAgent.ts |
| POST-05 | Đúng 1 test file mới | `ls app/src/agents/__tests__/` | planner-agent.test.ts |
| POST-06 | Không có commit nào được tạo | `git log --oneline -1` | Cùng commit với lúc bắt đầu |

---

## Tổng hợp tasks

| Part | Tasks | LOC | SP | Gate |
|---|---|---|---|---|
| PRE | 5 tasks | 0 | 0 | PRE-GATE |
| P6-01A | A-01 → A-10 | ~200 | 2 | A-GATE |
| P6-01B | B-01 → B-07 | ~140 | 1 | B-GATE |
| P6-01C | C-01 → C-07 | ~240 | 3 | C-GATE |
| P6-01D | D-01 → D-07 | ~180 | 2 | D-GATE |
| P6-01E | E-01 → E-04 | ~95 | 2 | E-GATE |
| P6-01F | F-01 → F-08 | ~280 | 3 | F-GATE |
| POST | 6 tasks | 0 | 0 | — |
| **Tổng** | **47 tasks + 6 gates** | **~1135** | **13 SP** | |

**Thứ tự thực thi tuyệt đối:**
```
PRE (5) → A-01..A-10 → A-GATE
        → B-01..B-07 → B-GATE
        → C-01..C-07 → C-GATE
        → D-01..D-07 → D-GATE
        → E-01..E-04 → E-GATE
        → F-01..F-08 → F-GATE
        → POST (6)
```
