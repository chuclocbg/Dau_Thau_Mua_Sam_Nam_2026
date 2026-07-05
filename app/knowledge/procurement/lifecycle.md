# Full Procurement Lifecycle

All stages from initial need identification to final settlement.

---

## Stage Map

```
1. NEED IDENTIFICATION (Xác định nhu cầu)
   Entity: ProcurementNeed (embedded in ProcurementRequest)
   Module: Planning (E)
   Legal: 22/2023/QH15 Điều 48

2. PROCUREMENT REQUEST (Yêu cầu mua sắm)
   Entity: ProcurementRequest
   Module: Planning (E)
   Legal: 22/2023/QH15 Điều 48

3. PROCUREMENT PLAN (Kế hoạch đấu thầu)
   Entity: ProcurementPlan
   Module: Planning (E)
   Legal: 22/2023/QH15 Điều 49

4. PLAN APPROVAL (Phê duyệt kế hoạch)
   Entity: ApprovalRequest (type: PLAN_APPROVAL)
   Module: Approval (F)
   Legal: 104/2026/NĐ-CP Điều 76

5. PACKAGE DEFINITION (Lập hồ sơ gói thầu)
   Entity: ProcurementPackage
   Module: Package (D)
   Legal: 22/2023/QH15 Điều 4 khoản 23

6. PACKAGE APPROVAL (Phê duyệt gói thầu)
   Entity: ApprovalRequest (type: PACKAGE_APPROVAL)
   Module: Approval (F)
   Legal: 104/2026/NĐ-CP Điều 76

7. SUPPLIER QUALIFICATION (Năng lực nhà thầu) ← Phase O
   Entity: Supplier
   Module: Supplier Registry (O)
   Legal: 22/2023/QH15 Điều 5-6

8. TENDER ANNOUNCEMENT (Thông báo mời thầu) ← Phase P
   Entity: TenderAnnouncement
   Module: Tender (P)
   Legal: 22/2023/QH15 Điều 8

9. BID PREPARATION & SUBMISSION (Nộp hồ sơ dự thầu) ← Phase Q
   Entity: BidSubmission
   Module: Bid (Q)
   Legal: 22/2023/QH15 Điều 29-38

10. BID OPENING (Mở thầu) ← Phase R
    Entity: BidOpening
    Module: Bid Opening (R)
    Legal: 22/2023/QH15 Điều 39

11. BID EVALUATION (Đánh giá hồ sơ dự thầu) ← Phase R
    Entity: BidEvaluation
    Module: Evaluation (R)
    Legal: 22/2023/QH15 Điều 40-43

12. APPROVAL OF EVALUATION RESULT (Phê duyệt kết quả) ← Phase S
    Entity: ApprovalRequest (type: EVALUATION_RESULT_APPROVAL)
    Module: Approval (F) + Contractor Selection (S)
    Legal: 22/2023/QH15 Điều 49

13. CONTRACTOR SELECTION NOTIFICATION (Thông báo kết quả) ← Phase S
    Entity: ContractorSelectionDecision
    Module: Contractor Selection (S)
    Legal: 22/2023/QH15 Điều 46

14. CONTRACT NEGOTIATION & SIGNING (Đàm phán, ký hợp đồng)
    Entity: Contract
    Module: Contract (G) — FROZEN
    Legal: 22/2023/QH15 Chương VI

15. CONTRACT EXECUTION (Thực hiện hợp đồng) ← Phase T
    Entity: ContractPerformance
    Module: Performance Monitoring (T)
    Legal: 22/2023/QH15 Điều 65-72

16. ACCEPTANCE & HANDOVER (Nghiệm thu, bàn giao)
    Entity: AcceptanceRequest
    Module: Acceptance (H) — FROZEN
    Legal: 22/2023/QH15 Điều 73

17. PAYMENT (Thanh toán)
    Entity: PaymentRequest
    Module: Payment (I) — FROZEN
    Legal: 79/2025/TT-BTC

18. FINAL SETTLEMENT (Quyết toán) ← Phase U
    Entity: FinalSettlement
    Module: Final Settlement (U)
    Legal: 104/2026/NĐ-CP

19. PROJECT CLOSURE (Kết thúc dự án)
    Archives all records. Generates final audit report.
```

---

## Cross-Module Dependencies

```
Planning (E) → creates ProcurementRequests → aggregates into ProcurementPlan
  ↓
Approval (F) → approves Plan → unlocks Package creation
  ↓
Package (D) → defines ProcurementPackage → triggers workflow
  ↓
Approval (F) → approves Package → unlocks Tender creation
  ↓
Supplier (O) [Phase O] → validates bidder eligibility for Tender
  ↓
Tender (P) [Phase P] → publishes TenderAnnouncement → notifies suppliers
  ↓
Bid (Q) [Phase Q] → receives BidSubmissions → deadline enforced
  ↓
Evaluation (R) [Phase R] → opens bids → scores → ranks
  ↓
Approval (F) → approves evaluation result
  ↓
Contractor Selection (S) [Phase S] → selects winner → notifies all
  ↓
Contract (G) [FROZEN] → creates Contract → links to winner
  ↓
Performance (T) [Phase T] → tracks milestones
  ↓
Acceptance (H) [FROZEN] → acceptance committee → minutes
  ↓
Payment (I) [FROZEN] → advance → progress → final payment → treasury
  ↓
Final Settlement (U) [Phase U] → project financial closure
```

---

## Currently Implemented Stages

| Stage | Status |
|-------|--------|
| 1–6 (Need → Package Approval) | COMPLETE (Phases D, E, F) |
| 14 (Contract) | COMPLETE (Phase G) |
| 16 (Acceptance) | COMPLETE (Phase H) |
| 17 (Payment) | COMPLETE (Phase I) |
| 7–13 (Supplier → Award) | NOT YET (Phases O–S, after infra) |
| 15 (Performance) | NOT YET (Phase T) |
| 18 (Settlement) | NOT YET (Phase U) |
