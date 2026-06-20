# Quy Trình Sử Dụng Hệ Thống — Hồ Sơ Mua Sắm Nam 2026

## Tổng quan

Hệ thống hỗ trợ soạn thảo tự động bộ **24 văn bản pháp lý** cho các gói thầu mua sắm tài sản công của Trường Cao đẳng Kỹ thuật Công nghiệp. Người dùng nhập thông tin gói thầu một lần, hệ thống tự động điền vào tất cả các văn bản liên quan.

---

## Quy trình tổng thể

```
Bước 1: Chọn hoặc cấu hình gói thầu
         ↓
Bước 2: Nhập thông tin chung
         ↓
Bước 3: Nhập mốc thời gian
         ↓
Bước 4: Nhập danh mục hàng hóa và báo giá
         ↓
Bước 5: Xem kết quả phân tích tự động
         ↓
Bước 6: Kiểm tra và xem trước từng văn bản
         ↓
Bước 7: Tải xuống (từng file hoặc toàn bộ ZIP)
         ↓
Bước 8: Hoàn thiện và ký ban hành văn bản thật
```

---

## Bước 1 — Chọn gói thầu mẫu

Tại **Panel trái**, mục "Chọn Gói Thầu Mẫu", chọn một trong 4 gói thầu được tích hợp sẵn:

| Gói | Mã | Nội dung mẫu |
|---|---|---|
| Gói 1 | MS-2026-MT01 | Máy tính, thiết bị mạng — Khoa CNTT |
| Gói 2 | SC-2026-DH02 | Bảo trì, sửa chữa điều hòa không khí |
| Gói 3 | MS-2026-HC03 | Hóa chất, thiết bị đo — Khoa Công nghệ hóa chất |
| Gói 4 | MS-2026-VPP04 | Văn phòng phẩm kỳ thi tuyển sinh |

Mỗi gói mẫu đã có đầy đủ dữ liệu minh họa. Người dùng có thể:
- Sử dụng nguyên mẫu để học cách hệ thống vận hành
- Chọn gói mẫu gần nhất với nhu cầu thực tế rồi chỉnh sửa

> Khi chọn gói mẫu, hệ thống tạo **bản sao độc lập** (deep copy). Các thay đổi không ảnh hưởng đến dữ liệu gốc.

---

## Bước 2 — Nhập thông tin chung

Tab **"Thông tin chung"** — các trường cần điền:

| Trường | Mô tả | Ví dụ |
|---|---|---|
| Tên gói thầu | Tên đầy đủ của gói thầu | "Mua sắm máy tính..." |
| Mã gói thầu | Mã tra cứu nội bộ | MS-2026-MT01 |
| Năm ngân sách | Năm kế hoạch ngân sách | 2026 |
| Nguồn vốn | Chọn 1 trong 3 loại (xem bảng dưới) | Quỹ phát triển SN |
| Tên phòng/khoa đề xuất | Đơn vị có nhu cầu mua sắm | Phòng Tổ chức Hành chính - Quản trị |
| Mã viết tắt phòng | Dùng cho số hiệu văn bản | TCHC-QT |
| Hiệu trưởng | Họ tên người ký phê duyệt | ThS. Đào Đức Quảng |
| Thời gian thực hiện (ngày) | Thời hạn hợp đồng | 15 |

**Ba loại nguồn vốn và ý nghĩa pháp lý:**

| Nguồn vốn | Mã | Thẩm quyền phê duyệt |
|---|---|---|
| Quỹ phát triển hoạt động sự nghiệp | `autonomy_fund` | Hiệu trưởng tự quyết, không giới hạn hạn mức (QĐ 541/2026) |
| Ngân sách nhà nước cấp | `state_budget` | Hiệu trưởng phê duyệt tổng giá trị dưới 45 tỷ (TT 13/2026/TT-BCT) |
| Thu sự nghiệp hợp pháp khác | `other_revenue` | Hiệu trưởng tự quyết, không giới hạn hạn mức (QĐ 541/2026) |

---

## Bước 3 — Nhập mốc thời gian

Tab **"Mốc thời gian"** — 17 ngày cần điền theo đúng trình tự:

| STT | Trường | Mô tả văn bản tương ứng |
|---|---|---|
| 1 | Ngày Tờ trình mua sắm | Doc 1: Tờ trình đề nghị của phòng/khoa |
| 2 | Ngày Biên bản khảo sát giá | Doc 5: Biên bản khảo sát giá thị trường |
| 3 | Ngày trên Báo giá | Ngày ghi trên 3 báo giá của nhà cung cấp |
| 4 | Ngày Bảng so sánh báo giá | Doc 6: Bảng so sánh 3 báo giá |
| 5 | Ngày trình KHLCNT | Doc 10: Tờ trình phê duyệt KHLCNT |
| 6 | Ngày phê duyệt KHLCNT | Doc 11: Quyết định phê duyệt KHLCNT |
| 7 | Ngày thành lập Tổ chuyên gia | Doc 13: Quyết định thành lập Tổ CG |
| 8 | Ngày phát hành HSYC/HSMT | Doc 12: Hồ sơ yêu cầu/mời thầu |
| 9 | Ngày đóng thầu | Thời hạn nhận hồ sơ dự thầu |
| 10 | Ngày Báo cáo đánh giá | Doc 14: Báo cáo đánh giá của Tổ CG |
| 11 | Ngày Báo cáo thẩm định | Doc 15: Báo cáo thẩm định của Phòng TC-KH |
| 12 | Ngày Tờ trình phê duyệt kết quả | Doc 16: Tờ trình đề xuất trúng thầu |
| 13 | Ngày phê duyệt kết quả | Doc 17: Quyết định phê duyệt kết quả |
| 14 | Ngày ký Hợp đồng | Doc 18: Hợp đồng kinh tế |
| 15 | Ngày nghiệm thu bàn giao | Doc 19, 20: Biên bản bàn giao + Nghiệm thu |
| 16 | Ngày thanh lý | Doc 21: Biên bản thanh lý hợp đồng |
| 17 | Ngày ghi tăng tài sản | Doc 22: Phiếu ghi tăng tài sản công |

> **Quan trọng:** Hệ thống kiểm tra và cảnh báo nếu ngày ở hàng trên lớn hơn ngày ở hàng dưới. Bất kỳ vi phạm thứ tự nào đều hiển thị trong panel "Mâu thuẫn trình tự ngày tháng" màu đỏ.

**Yêu cầu khoảng cách tối thiểu (pháp lý):**

| Khoảng cách | Yêu cầu tối thiểu |
|---|---|
| Phát hành HSYC → Đóng thầu | Ít nhất **5 ngày làm việc** (Nghị định 214/2025) |
| Phê duyệt KHLCNT → Phát hành HSYC | Ít nhất **1 ngày làm việc** |
| Đóng thầu → Báo cáo đánh giá | Ít nhất **1 ngày làm việc** |
| Ngày bàn giao → Ngày nghiệm thu | Cần khoảng thời gian lắp đặt, chạy thử |

---

## Bước 4 — Nhập danh mục hàng hóa và báo giá

Tab **"Hàng hóa / Báo giá"** — quản lý từng dòng mặt hàng:

**Thêm/xóa mặt hàng:**
- Nhấn **"+ Thêm vật tư"** để thêm dòng mới
- Nhấn biểu tượng thùng rác để xóa dòng

**Thông tin mỗi mặt hàng:**

| Trường | Mô tả |
|---|---|
| Tên thiết bị | Tên đầy đủ, rõ ràng (dùng trong Bảng tổng hợp, HSYC) |
| Số lượng | Số lượng theo đơn vị tính |
| Đơn vị tính | Bộ, Cái, Cái, Kg, Ram, ... |
| Báo giá 1 (VND) | Đơn giá từ nhà cung cấp 1 — **dùng làm giá dự toán** |
| Báo giá 2 (VND) | Đơn giá từ nhà cung cấp 2 |
| Báo giá 3 (VND) | Đơn giá từ nhà cung cấp 3 |
| Yêu cầu quy cách kỹ thuật | Thông số tối thiểu (dùng trong HSYC, Yêu cầu KT) |

> Khi thay đổi **Báo giá 1**, hệ thống tự động cập nhật **Đơn giá dự toán** theo giá đó. Giá dự toán (Báo giá 1) được dùng để tính tổng giá trị gói thầu và xác định hình thức lựa chọn nhà thầu.

---

## Bước 5 — Xem kết quả phân tích tự động

**Panel giữa** — Card "Phân Tích Quy Trình & Căn Cứ Pháp Lý" hiển thị:

### 5a. Tổng giá trị dự toán

Hệ thống tự tính: `Σ (số lượng × báo giá 1)` trên tất cả mặt hàng.

### 5b. Hình thức lựa chọn nhà thầu

Tự động xác định theo ngưỡng giá trị (hàm `getProcurementMethod`):

| Tổng giá trị | Hình thức | Căn cứ pháp lý |
|---|---|---|
| ≤ 50.000.000 VND | Mua sắm trực tiếp (không qua thầu) | Khoản 4 Điều 80 NĐ 214/2025 |
| 50M – 500M VND | Chỉ định thầu rút gọn | Điều 23(1)(m) Luật ĐT 22/2023; Điều 80 NĐ 214/2025 |
| 500M – 5 tỷ VND | Chào hàng cạnh tranh | Điều 24 Luật ĐT 22/2023; Điều 81 NĐ 214/2025 |
| > 5 tỷ VND | Đấu thầu rộng rãi qua mạng | Luật ĐT 22/2023; NĐ 214/2025; TT 79/2025/TT-BTC |

### 5c. Thẩm quyền phê duyệt

Hiển thị khác nhau theo nguồn vốn:
- **Nguồn ngân sách nhà nước:** Hiệu trưởng phê duyệt giá trị dưới 45 tỷ (TT 13/2026/TT-BCT)
- **Quỹ phát triển / Thu sự nghiệp:** Hiệu trưởng tự quyết toàn bộ (QĐ 541/2026)

### 5d. Trình tự thời gian

- **Xanh lá:** Tất cả 17 ngày đã được sắp xếp đúng trình tự
- **Đỏ:** Có N điểm mâu thuẫn cần kiểm tra — hiện chi tiết bên dưới

---

## Bước 6 — Xem trước và kiểm tra văn bản

**Panel phải** liệt kê 24 văn bản với badge trạng thái:

| Badge | Ý nghĩa |
|---|---|
| **Bắt buộc** (xanh) | Phải có trong hồ sơ theo quy định |
| **Khuyến nghị** (vàng) | Nên có, giúp hồ sơ đầy đủ hơn |
| **Không áp dụng** (đỏ) | Không cần cho hình thức LCNT hiện tại |

Nhấn vào tên văn bản để xem bản xem trước HTML trong **Panel giữa**.

Panel giữa hiển thị **cảnh báo rủi ro kiểm toán** (màu đỏ) đặc thù cho từng văn bản nếu dữ liệu gói thầu có dấu hiệu rủi ro.

**Bộ lọc tab:**
- **Tất cả** — xem toàn bộ 24 văn bản
- **Bắt buộc** — chỉ xem các văn bản bắt buộc
- **Khuyến nghị** — chỉ xem các văn bản khuyến nghị
- **Không áp dụng** — xem các văn bản không dùng cho hình thức hiện tại

---

## Bước 7 — Tải xuống file

**Tải một văn bản:**
Nhấn nút **"Tải file .docx"** ở phần xem trước để tải văn bản đang xem.

Tên file: `01_HSMS_To_trinh_de_nghi_mua_sam.docx` (theo quy tắc `ID_HSMS_TenVanBan.docx`)

**Tải toàn bộ 24 văn bản (ZIP):**
Nhấn nút **"Tải trọn bộ 24 hồ sơ (ZIP)"** ở header. Hệ thống:
1. Tạo từng file .docx cho 24 văn bản
2. Nén thành file ZIP
3. Tải xuống với tên `Bo_Ho_So_Mua_Sam_{mã_gói_thầu}.zip`

---

## Bước 8 — Hoàn thiện sau khi tải

Các bước bắt buộc sau khi tải file:

1. **Điền số văn bản thực tế** — các số hiệu như `.../QĐ-CĐKTCN` cần được thay bằng số chính thức theo sổ văn bản đi của trường.

2. **Bổ sung các tài liệu hệ thống chưa tạo được:**
   - 3 báo giá gốc (bản gốc từ nhà cung cấp)
   - Biên bản mở thầu
   - Thông báo mời chào hàng
   - Cam kết/Tuyên bố không xung đột lợi ích của Tổ chuyên gia
   - Hóa đơn GTGT điện tử
   - Chứng từ thanh toán kho bạc/ngân hàng

3. **In, ký ban hành** theo đúng thẩm quyền và đóng dấu.

4. **Đăng tải lên Hệ thống mạng đấu thầu quốc gia** (với gói ≥ 50M VND) trong vòng 5 ngày làm việc sau khi phê duyệt KHLCNT và kết quả trúng thầu.

5. **Lưu trữ hồ sơ** theo quy định (tối thiểu 5 năm đối với tài sản công).

---

## Danh sách đầy đủ 24 văn bản theo trình tự

| STT | Tên văn bản | Người ký | Mốc ngày |
|---|---|---|---|
| 1 | Tờ trình đề nghị mua sắm | Trưởng phòng/khoa | dateProposal |
| 2 | Bảng tổng hợp nhu cầu | Trưởng phòng/khoa | dateProposal |
| 3 | Thuyết minh sự cần thiết | Trưởng phòng/khoa | dateProposal |
| 4 | Quyết định phê duyệt dự toán | Hiệu trưởng | dateProposal |
| 5 | Biên bản khảo sát giá thị trường | Tổ khảo sát giá | dateSurvey |
| 6 | Bảng so sánh tối thiểu 3 báo giá | Tổ khảo sát | dateCompare |
| 7 | Danh mục hàng hóa chi tiết | Tổ chuyên gia | dateKhlcnt |
| 8 | Yêu cầu kỹ thuật | Tổ chuyên gia | dateKhlcnt |
| 9 | Tiêu chuẩn đánh giá | Tổ chuyên gia | dateKhlcnt |
| 10 | Tờ trình phê duyệt KHLCNT | Trưởng phòng TC-KH | dateKhlcnt |
| 11 | Quyết định phê duyệt KHLCNT | Hiệu trưởng | dateKhlcntApprove |
| 12 | Hồ sơ mời thầu / Hồ sơ yêu cầu | Hiệu trưởng | dateDocIssue |
| 13 | Quyết định thành lập Tổ chuyên gia | Hiệu trưởng | dateExpertEstablish |
| 14 | Báo cáo đánh giá hồ sơ dự thầu | Tổ chuyên gia | dateEvaluate |
| 15 | Báo cáo thẩm định kết quả LCNT | Trưởng phòng TC-KH | dateAppraise |
| 16 | Tờ trình phê duyệt kết quả | Trưởng phòng TCHC-QT | dateResultProposal |
| 17 | Quyết định phê duyệt kết quả LCNT | Hiệu trưởng | dateResultApprove |
| 18 | Hợp đồng kinh tế | Hiệu trưởng + Nhà thầu | dateContractSign |
| 19 | Biên bản bàn giao thiết bị | Đại diện 2 bên | dateDelivery |
| 20 | Biên bản nghiệm thu đưa vào sử dụng | Đại diện 2 bên + Tổ KM | dateAcceptance |
| 21 | Biên bản thanh lý hợp đồng | Hiệu trưởng + Nhà thầu | dateLiquidation |
| 22 | Phiếu đề nghị ghi tăng tài sản công | Kế toán trưởng | dateAssetIncrease |
| 23 | Checklist kiểm toán (tự kiểm tra) | Cán bộ pháp lý | dateAssetIncrease |
| 24 | Checklist đăng tải mạng đấu thầu | Cán bộ đăng tải | dateAssetIncrease |

---

## Sơ đồ quyết định hình thức LCNT

```
Tổng giá trị gói thầu
         │
         ▼
    ≤ 50 triệu?
    ├─ CÓ → DIRECT_50: Mua sắm trực tiếp
    │        Docs bắt buộc: 1–8, 18–20, 23
    │        Docs không áp dụng: 9–17, 21, 24
    │
    └─ KHÔNG → ≤ 500 triệu?
               ├─ CÓ → DIRECT_SELECTION_SIMPLIFIED: Chỉ định thầu rút gọn
               │        Docs bắt buộc: 1–12, 17–21, 23–24
               │        Docs khuyến nghị: 13–16, 22
               │
               └─ KHÔNG → ≤ 5 tỷ?
                          ├─ CÓ → COMPETITIVE_SHOPPING: Chào hàng cạnh tranh
                          │        Docs bắt buộc: 1–21, 23–24
                          │        Docs khuyến nghị: 22
                          │
                          └─ KHÔNG → OPEN_BIDDING: Đấu thầu rộng rãi qua mạng
                                     Docs bắt buộc: 1–21, 23–24
                                     Docs khuyến nghị: 22
```

---

## Quy trình AI Assistant Panel (Tab "Trợ lý AI")

Tab **"Trợ lý AI"** là luồng **một chạm** để tạo hồ sơ từ yêu cầu tiếng Việt tự nhiên, thay thế Bước 1–7 bằng pipeline tự động.

### Luồng AI một chạm

```
Người dùng nhập yêu cầu (tiếng Việt tự nhiên)
         │
         ▼
[Bước 1] P8-I PlannerBridge.runPlannerWorkflow()
         ├── Thử route qua P6-01 PlannerAgent (nếu AgentRegistry khả dụng)
         │   └── PlannerAgent → SpecificationAgent → LegalReviewerAgent
         └── Fallback: P5-05 workflowOrchestrator (rule-based)
         │
         ▼
[Bước 2] P5-02 specGenerator — tạo thông số kỹ thuật cho từng hạng mục
         │
         ▼
[Bước 3] P5-03 legalReviewer — rà soát pháp lý (CRITICAL / HIGH / MEDIUM / LOW)
         │
         ▼
[Bước 4] P5-04 legalKnowledgeBase — tra cứu 21 KB entries liên quan
         │
         ▼
[Bước 5] Hiển thị kết quả: ProcurementPackage, findings, KB results, selectedDocumentIds
         │
         ├── Nút "Áp dụng vào biểu mẫu" → copy dữ liệu vào biểu mẫu chính (Bước 1–7)
         └── Nút "Tải ZIP" → xuất hồ sơ ZIP (chỉ khi không có lỗi CRITICAL)
```

**Điều kiện xuất ZIP:** `readyForExport = true` — không có finding nào có `severity === 'CRITICAL'`.

**Nguồn dữ liệu hiển thị:**
- `data-source="planner-agent"`: qua P6-01 PlannerAgent (có `traceId`)
- `data-source="workflow"`: qua P5-05 fallback (không có agent trace)

---

## Hệ thống đa tác nhân — Agent Panels (Phase 7–8)

App.tsx cung cấp 6 panel có thể bật/tắt qua toggle nút ở header:

| Panel | Toggle | Nội dung |
|---|---|---|
| Trợ lý AI | "Trợ lý AI" | AI one-click workflow (mô tả ở trên) |
| Tác nhân chuyên biệt | "Tác nhân chuyên biệt" | AgentOutputPanel: chạy 4 agent (Planner, Spec, Risk, Autonomous) với packageContext hiện tại |
| Tra cứu pháp lý | "Tra cứu pháp lý" | LegalKBPanel: tìm kiếm BM25-lite trong 21 KB entries |
| Kiểm tra pháp lý | "Kiểm tra pháp lý" | PackageLegalReviewPanel: P5-03 legal review findings cho package hiện tại |
| Hội thoại AI | "Chat" | ChatInterfacePanel: chat với ChatAgent (hỏi đáp về quy trình mua sắm) |
| Dashboard Phase 8 | "Dashboard Phase 8" | Phase8DashboardPanel: 9 audit sections (xem bên dưới) |

### Phase8DashboardPanel — 9 sections

| # | Section | Nội dung |
|---|---|---|
| 1 | AgentOutputPanel | Chạy 4 agent chuyên biệt, hiển thị output |
| 2 | LegalKBPanel | Live KB search |
| 3 | PackageLegalReviewPanel | Legal findings |
| 4 | Audit Report | `overallRisk`, `auditReadiness`, cảnh báo lỗi |
| 5 | AgentTracePanel | Trace chronological từng message theo `traceId` |
| 6 | AgentRegistryPanel | Tổng quan tất cả trace: message count, agent usage |
| 7 | AgentFlowPanel | Ma trận routing: số lần (from agent → to agent) |
| 8 | AgentLegalCitationPanel | Tần suất trích dẫn pháp lý trong toàn bộ trace |
| 9 | AgentErrorPanel | Lọc tất cả message có `type === 'error'` cross-trace |

### AutonomousWorkflowPanel

Chạy `AutonomousAgent` (P6-06) theo state machine:

```
IDLE → PLANNING → SPECIFYING → REVIEWING → AWAITING_APPROVAL → EXECUTING → DONE
                                                     ↓
                                              ASK_USER (khi cần xác nhận người dùng)
```

Agent sẽ tự động:
1. Phân tích yêu cầu (PlannerAgent)
2. Tạo thông số kỹ thuật (SpecificationAgent)
3. Rà soát pháp lý (LegalReviewerAgent)
4. Đánh giá rủi ro (RiskAgent)
5. Chờ người dùng phê duyệt trước khi xuất hồ sơ

Mọi message đều có `traceId` — có thể xem lại trong AgentTracePanel.
