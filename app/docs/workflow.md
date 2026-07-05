# Procurement Workflow Engine

Module: `src/procurement/workflow/`  
Legal basis: Luật 22/2023/QH15, NĐ 214/2025/NĐ-CP, NĐ 104/2026/NĐ-CP, TT 79/2025/TT-BTC, TT 13/2026/TT-BCT

---

## State Diagram

```
DRAFT
  │  Cán bộ lập hồ sơ
  ▼
PROCUREMENT_REQUEST
  │  Trưởng đơn vị
  ▼
FUND_CONFIRMED
  │  Phòng Tài chính - Kế toán
  ▼
METHOD_SELECTED  ◄─── [requires: ke-hoach-lua-chon-nha-thau]
  │  Phòng Kế hoạch - Đấu thầu
  ▼
PLAN_APPROVED
  │  Thủ trưởng đơn vị
  ▼
DOCUMENT_PREPARATION  ◄─── [requires: ho-so-moi-thau]
  │  Phòng KH-ĐT / Tư vấn
  ▼
DOCUMENT_APPROVED
  │  Thủ trưởng đơn vị
  ▼
INVITATION
  │  Phòng Kế hoạch - Đấu thầu
  ▼
BID_RECEIPT
  │  Tổ tiếp nhận hồ sơ
  ▼
BID_OPENING
  │  Tổ mở thầu
  ▼
EVALUATION  ◄─── [requires: bien-ban-danh-gia]
  │  Tổ chuyên gia
  ▼
APPROVAL  ◄─── [requires: quyet-dinh-phe-duyet-ket-qua]
  │  Người có thẩm quyền  [authority check: value < limit for role]
  ▼
CONTRACT_SIGNED
  │  Thủ trưởng đơn vị
  ▼
IMPLEMENTATION
  │  Nhà thầu / BQL dự án
  ▼
ACCEPTANCE  ◄─── [requires: bien-ban-nghiem-thu]
  │  Hội đồng nghiệm thu
  ▼
PAYMENT
  │  Phòng Tài chính - Kế toán
  ▼
COMPLETED

At any non-COMPLETED state: ──► CANCELLED (status change, not a state transition)
Rollback allowed from any state except DRAFT and COMPLETED (one step back).
```

---

## Sequence Diagram (Happy Path — Open Tender)

```
Officer          Finance          Expert Panel     Authority
  │                │                  │                │
  │ createWorkflow()
  │──────────────────────────────────────────────────►│
  │ startWorkflow() → PROCUREMENT_REQUEST
  │ advance() → FUND_CONFIRMED
  │              │ confirm funds
  │◄─────────────┤
  │ advance() → METHOD_SELECTED + upload KHLCNT
  │ advance() → PLAN_APPROVED
  │ advance() → DOCUMENT_PREPARATION + upload HSMT
  │ advance() → DOCUMENT_APPROVED
  │ advance() → INVITATION   [published on national procurement portal]
  │ advance() → BID_RECEIPT
  │ advance() → BID_OPENING
  │ advance() → EVALUATION
  │                               │ upload bien-ban-danh-gia
  │◄──────────────────────────────┤
  │ advance() → APPROVAL
  │                                                │ upload quyet-dinh-phe-duyet-ket-qua
  │◄───────────────────────────────────────────────┤
  │ advance() → CONTRACT_SIGNED  [authority check passes]
  │ advance() → IMPLEMENTATION
  │ advance() → ACCEPTANCE + upload bien-ban-nghiem-thu
  │ advance() → PAYMENT
  │              │ process payment
  │◄─────────────┤
  │ advance() → COMPLETED
```

---

## Workflow Table

| # | State ID | Tên tiếng Việt | Vai trò | Tài liệu bắt buộc | Căn cứ pháp lý |
|---|----------|----------------|---------|-------------------|----------------|
| 0 | DRAFT | Dự thảo gói thầu | Cán bộ lập hồ sơ | — | Điều 4, 49 Luật 22/2023 |
| 1 | PROCUREMENT_REQUEST | Yêu cầu mua sắm | Trưởng đơn vị | — | Điều 49 k1 Luật; Điều 50 NĐ 214 |
| 2 | FUND_CONFIRMED | Xác nhận nguồn vốn | Phòng TC-KT | — | Điều 49 k2 Luật; Điều 51 NĐ 214; Điều 5 TT 79 |
| 3 | METHOD_SELECTED | Lựa chọn hình thức ĐT | Phòng KH-ĐT | ke-hoach-lua-chon-nha-thau | Điều 21-22 Luật; Điều 56 NĐ 214 |
| 4 | PLAN_APPROVED | Kế hoạch phê duyệt | Thủ trưởng ĐV | — | Điều 49 k5 Luật; Điều 52 NĐ 214 |
| 5 | DOCUMENT_PREPARATION | Chuẩn bị HSMT | Phòng KH-ĐT | ho-so-moi-thau | Điều 34 Luật; Điều 57 NĐ 214; Điều 8 TT 13 |
| 6 | DOCUMENT_APPROVED | HSMT phê duyệt | Thủ trưởng ĐV | — | Điều 34 k3 Luật; Điều 58 NĐ 214 |
| 7 | INVITATION | Phát hành mời thầu | Phòng KH-ĐT | — | Điều 35-36 Luật; Điều 59 NĐ 214 |
| 8 | BID_RECEIPT | Tiếp nhận HSDT | Tổ tiếp nhận | — | Điều 38 Luật; Điều 60 NĐ 214 |
| 9 | BID_OPENING | Mở thầu | Tổ mở thầu | — | Điều 39 Luật; Điều 61 NĐ 214 |
| 10 | EVALUATION | Đánh giá HSDT | Tổ chuyên gia | bien-ban-danh-gia | Điều 40-41 Luật; Điều 62 NĐ 214 |
| 11 | APPROVAL | Phê duyệt kết quả | Người có thẩm quyền | quyet-dinh-phe-duyet-ket-qua | Điều 45 Luật; Điều 63 NĐ 214 |
| 12 | CONTRACT_SIGNED | Ký kết hợp đồng | Thủ trưởng ĐV | — | Điều 46 Luật; Điều 64 NĐ 214 |
| 13 | IMPLEMENTATION | Thực hiện hợp đồng | Nhà thầu / BQL | — | Điều 47 Luật; Điều 65 NĐ 214 |
| 14 | ACCEPTANCE | Nghiệm thu | Hội đồng NT | bien-ban-nghiem-thu | Điều 47 k3 Luật; Điều 66 NĐ 214 |
| 15 | PAYMENT | Thanh toán | Phòng TC-KT | — | Điều 47 k4 Luật; Điều 12 TT 79 |
| 16 | COMPLETED | Hoàn thành | Phòng KH-ĐT | — | Điều 47 k5 Luật; Điều 67 NĐ 214 |

---

## Approval Authority Thresholds (NĐ 214/2025 Điều 76)

| Authority | Max Value |
|-----------|-----------|
| UNIT_HEAD | < 5 tỷ VNĐ |
| MINISTER | < 50 tỷ VNĐ |
| PRIME_MINISTER | unlimited |

---

## API Specification

All functions in `workflowEngine.ts` are pure: input `WorkflowInstance` → output `EngineResult<WorkflowInstance>` or value type. No side effects.

### `createWorkflow(params)`
Creates a new workflow in DRAFT state.

```typescript
createWorkflow({
  packageId:         string,
  packageType:       string,      // 'GOODS' | 'SERVICE' | 'CONSULTING' | 'CONSTRUCTION' | 'MIXED'
  estimatedValue:    number,      // VNĐ
  procurementMethod: string,      // 'OPEN_TENDER' | 'COMPETITIVE_QUOTE' | ...
  approvalAuthority: string,      // 'UNIT_HEAD' | 'MINISTER' | 'PRIME_MINISTER'
  performedBy:       string,
}): WorkflowInstance
```

### `startWorkflow(instance, performedBy)`
Shortcut for `advance(instance, 'PROCUREMENT_REQUEST', performedBy)`.

### `advance(instance, targetState, performedBy, notes?)`
Moves to a specific next state. Returns `ok=false` if:
- Not the immediate next state (skip)
- Required documents missing
- Workflow cancelled or completed
- Authority insufficient (at APPROVAL → CONTRACT_SIGNED)

### `rollback(instance, performedBy, notes?)`
Returns to the previous state. Returns `ok=false` from DRAFT or on cancelled workflows.

### `cancel(instance, performedBy, notes?)`
Sets `status='CANCELLED'`. Returns `ok=false` if already completed or cancelled.

### `validate(instance)`
Returns `ValidationResult` for the next potential advance — no state change.

### `getPendingTasks(instance): readonly WorkflowStateId[]`
All states not yet reached.

### `getRequiredDocuments(instance): readonly string[]`
Document IDs required by the current state before advancing.

### `getHistory(instance): WorkflowHistory`
Full immutable audit trail of all state changes.

### `getWorkflowResult(instance): WorkflowResult`
Returns the full status object:
```typescript
{
  currentState:         StateDefinition,
  progress:             number,          // 0–100
  completedSteps:       WorkflowStateId[],
  pendingSteps:         WorkflowStateId[],
  blockingErrors:       string[],
  warnings:             string[],
  legalBasis:           WorkflowLegalRef[],
  requiredDocuments:    string[],
  responsibleRole:      string,
  nextAvailableActions: string[],
}
```

### Uploading documents

Documents are stored in `WorkflowContext.documents`. Use `uploadDocument()` from `workflowContext.ts`:

```typescript
import { uploadDocument } from '../workflow/workflowContext';

const updatedCtx = uploadDocument(instance.context, 'ho-so-moi-thau', 'Hồ sơ mời thầu');
const updatedInstance = { ...instance, context: updatedCtx };
```

---

## Acceptance Criteria

1. ✅ All 17 lifecycle states are defined with legal basis, required role, and document requirements
2. ✅ `advance()` rejects any transition that is not the immediate next sequential state
3. ✅ `advance()` rejects when required documents for the current state are missing
4. ✅ `advance()` rejects at APPROVAL → CONTRACT_SIGNED when authority is insufficient for the value
5. ✅ `rollback()` reverts one step; blocked at DRAFT (first state) and on cancelled workflows
6. ✅ `cancel()` sets status=CANCELLED on any non-COMPLETED workflow
7. ✅ `getWorkflowResult()` returns progress %, completed steps, pending steps, blocking errors, warnings, and legal basis
8. ✅ `getHistory()` records every state change with performer, timestamp, and notes
9. ✅ All functions are pure — no mutable state, no I/O, no framework dependency
10. ✅ 156 unit tests across 4 test files (WS, WT, WV, WE — 13 groups × 3 tests each)

---

## Migration Guide

This module is self-contained and adds no dependencies on existing modules.

To wire into an HTTP API (Express example):
```typescript
import { createWorkflow, advance, getWorkflowResult } from './workflow/workflowEngine';

app.post('/workflows', (req, res) => {
  const instance = createWorkflow({ ...req.body, performedBy: req.user.id });
  res.json({ id: instance.context.id, result: getWorkflowResult(instance) });
});

app.post('/workflows/:id/advance', (req, res) => {
  const instance = await loadInstance(req.params.id);  // from your store
  const result = advance(instance, req.body.targetState, req.user.id, req.body.notes);
  if (!result.ok) return res.status(422).json({ errors: result.errors });
  await saveInstance(result.data!);                    // to your store
  res.json(getWorkflowResult(result.data!));
});
```

The `WorkflowInstance` object is plain JSON — serialise/deserialise with `JSON.stringify` / `JSON.parse`.
