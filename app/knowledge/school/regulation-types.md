# School / Institutional Regulation Types

Domain: `school` — managed by SchoolRegulationProvider

"School" in this context means the procuring organization's own internal regulations. These are first-class knowledge items alongside national law.

---

## Why a Separate Domain

Internal regulations are:
- Often more restrictive than national law (organizations may impose tighter limits)
- Specific to the organization (a university has different limits than a hospital)
- Not part of the Vietnamese legal hierarchy (not in src/legal/)
- Changed by internal decision, not by government decree
- The most directly actionable source of truth for staff

A procurement officer at Organization X needs to know: "Our internal rule says advance payment must not exceed 20% regardless of what the national circular says." This comes from the `school` domain, not the `legal` domain.

---

## Regulation Types

| Code | Vietnamese | English |
|------|-----------|---------|
| `SPENDING_RULE` | Quy chế chi tiêu nội bộ | Internal spending regulation |
| `PROCUREMENT_PROC` | Quy trình đấu thầu nội bộ | Internal procurement procedure |
| `ASSET_MGMT` | Quy định quản lý tài sản | Asset management regulation |
| `ADVANCE_POLICY` | Chính sách tạm ứng nội bộ | Internal advance payment policy |
| `APPROVAL_MATRIX` | Ma trận phê duyệt nội bộ | Internal approval authority matrix |
| `BUDGET_POLICY` | Chính sách ngân sách | Budget allocation policy |
| `ETHICS_CODE` | Quy tắc đạo đức | Code of conduct / ethics |
| `CONFLICT_POLICY` | Chính sách xung đột lợi ích | Conflict of interest policy |
| `VENDOR_POLICY` | Chính sách nhà cung cấp | Vendor management policy |

---

## Regulation Item Metadata Schema

```
{
  regulationType:   string        // code from table above
  issuingBody:      string        // 'Hội đồng quản trị' | 'Ban giám hiệu' | etc.
  decisionNumber:   string        // internal reference number
  scope:            string        // which departments/units this applies to
  supersedes?:      string        // itemId of prior regulation this replaces
  overridesLaw:     boolean       // false = consistent with law; true = more restrictive
  keyProvisions:    string[]      // plain-language summary of key rules
  legalAlignment:   string[]      // national law articles this aligns with
}
```

---

## Interaction with Legal Domain

When the platform resolves applicable knowledge for a procurement decision, BOTH the `legal` and `school` domains are queried:

```
platform.resolveKnowledge({
  question: 'What is the maximum advance payment rate?',
  domains: ['legal', 'school'],
  context: { packageType: 'GOODS', fundSource: 'STATE' }
})
```

The AI Advisory Layer must know to apply the more restrictive of the two:
- Legal: up to 30% STATE (79/2025/TT-BTC Điều 15)
- School: up to 20% (internal policy)
- Applied: 20% (school is more restrictive)

This precedence logic lives in the AI Advisory Layer (Phase X), not in the Knowledge Platform. The platform returns all applicable items from all requested domains.
