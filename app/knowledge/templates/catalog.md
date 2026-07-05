# Template Catalog

Domain: `templates` — managed by TemplateProvider

---

## Template Types

| Template Code | Vietnamese Name | Applicable Method | Phase | Format |
|---------------|----------------|------------------|-------|--------|
| `HSMT_OPEN` | Hồ sơ mời thầu (đấu thầu rộng rãi) | OPEN_TENDER | Tender | DOCX |
| `HSMT_RESTRICTED` | Hồ sơ mời thầu (đấu thầu hạn chế) | RESTRICTED_TENDER | Tender | DOCX |
| `HSYC_QUOTE` | Hồ sơ yêu cầu (chào hàng cạnh tranh) | COMPETITIVE_QUOTATION | Tender | DOCX |
| `HSYC_DIRECT` | Hồ sơ yêu cầu (mua sắm trực tiếp) | DIRECT_SHOPPING | Tender | DOCX |
| `KHLCNT` | Kế hoạch lựa chọn nhà thầu | ALL | Planning | DOCX |
| `CONTRACT_LUMP` | Hợp đồng trọn gói | ALL | Contract | DOCX |
| `CONTRACT_UNIT` | Hợp đồng theo đơn giá | ALL | Contract | DOCX |
| `CONTRACT_TIME` | Hợp đồng theo thời gian | CONSULTING | Contract | DOCX |
| `ACCEPTANCE_PARTIAL` | Biên bản nghiệm thu bộ phận | ALL | Acceptance | DOCX |
| `ACCEPTANCE_FINAL` | Biên bản nghiệm thu hoàn thành | ALL | Acceptance | DOCX |
| `PAYMENT_ADVANCE` | Đề nghị tạm ứng | ALL | Payment | DOCX |
| `PAYMENT_PROGRESS` | Đề nghị thanh toán theo tiến độ | ALL | Payment | DOCX |
| `PAYMENT_FINAL` | Đề nghị thanh toán lần cuối | ALL | Payment | DOCX |
| `GUARANTEE_ADVANCE` | Bảo lãnh tạm ứng | ALL | Contract | DOCX |
| `GUARANTEE_PERFORMANCE` | Bảo lãnh thực hiện hợp đồng | ALL | Contract | DOCX |
| `AUDIT_CHECKLIST_PLAN` | Danh mục kiểm tra kế hoạch đấu thầu | ALL | Audit | XLSX |
| `AUDIT_CHECKLIST_BID` | Danh mục kiểm tra hồ sơ dự thầu | ALL | Audit | XLSX |
| `AUDIT_CHECKLIST_CONTRACT` | Danh mục kiểm tra hợp đồng | ALL | Audit | XLSX |
| `APPROVAL_REQUEST` | Phiếu đề nghị phê duyệt | ALL | Approval | DOCX |
| `CONFLICT_DISCLOSURE` | Tờ khai xung đột lợi ích | ALL | ALL | DOCX |

---

## Template Applicability Rules

Templates carry `KnowledgeApplicabilityRule` records (same model as legal document applicability):

| Template | Rule Dimension | Operator | Values |
|----------|---------------|---------|--------|
| `HSMT_OPEN` | PROCUREMENT_METHOD | IN | ['OPEN_TENDER'] |
| `HSYC_QUOTE` | PROCUREMENT_METHOD | IN | ['COMPETITIVE_QUOTATION'] |
| `CONTRACT_TIME` | PACKAGE_TYPE | IN | ['CONSULTING'] |
| `PAYMENT_ADVANCE` | PAYMENT_TYPE | IN | ['ADVANCE'] |

---

## Template Item Metadata Schema

```
{
  templateCode:    string           // e.g. 'HSMT_OPEN'
  format:          'DOCX' | 'XLSX' | 'PDF' | 'HTML'
  requiredFields:  string[]         // must be provided when resolving
  optionalFields:  string[]
  procurementPhase: string          // 'PLANNING' | 'TENDER' | 'CONTRACT' | etc.
  legalBasis:      string           // document symbol this template implements
  version:         string           // template version number
  attachmentId?:   string           // actual template file via Storage service
}
```
