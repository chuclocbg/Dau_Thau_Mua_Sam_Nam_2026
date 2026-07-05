# Common Procurement Mistakes

Domain: `audit` — managed by AuditKnowledgeProvider

Source: State Audit findings, Inspector-General conclusions, internal compliance reviews.

---

## Mistake Item Metadata Schema

```
{
  mistakeCode:      string                               // e.g. 'DOC-001'
  category:         string                               // mistake category
  severity:         'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  frequency:        'VERY_COMMON' | 'COMMON' | 'OCCASIONAL' | 'RARE'
  description:      string                               // what was done wrong
  correctPractice:  string                               // what should be done
  legalReference:   string                               // violated article
  detectionPhase:   string                               // when this is typically caught
  remediation:      string                               // how to fix if already made
}
```

---

## Planning Mistakes

| Code | Description | Severity | Frequency |
|------|-------------|---------|-----------|
| `PLAN-001` | Procurement plan not submitted to approving authority before implementation begins | HIGH | VERY_COMMON |
| `PLAN-002` | Estimated value set below actual market price (to avoid higher authority threshold) | CRITICAL | COMMON |
| `PLAN-003` | Package split into smaller packages to avoid open tender requirement | CRITICAL | COMMON |
| `PLAN-004` | Fund source not verified before plan approval (unfunded plan) | HIGH | COMMON |
| `PLAN-005` | Procurement request created without documented justification of need | MEDIUM | VERY_COMMON |

---

## Tender Document Mistakes

| Code | Description | Severity | Frequency |
|------|-------------|---------|-----------|
| `TENDER-001` | Technical specification references specific brand or product name without allowing equivalents | HIGH | COMMON |
| `TENDER-002` | Minimum bid validity period not stated | MEDIUM | COMMON |
| `TENDER-003` | Evaluation criteria not published in bidding document | HIGH | OCCASIONAL |
| `TENDER-004` | Tender period shorter than minimum required by law | HIGH | OCCASIONAL |
| `TENDER-005` | Performance guarantee percentage not stated | MEDIUM | COMMON |

---

## Evaluation Mistakes

| Code | Description | Severity | Frequency |
|------|-------------|---------|-----------|
| `EVAL-001` | Evaluator has undisclosed financial relationship with bidder | CRITICAL | OCCASIONAL |
| `EVAL-002` | Minor technical deviation used to disqualify lower-priced bidder | HIGH | COMMON |
| `EVAL-003` | Evaluation completed without all required committee members present | HIGH | COMMON |
| `EVAL-004` | Evaluation report not signed by all committee members | MEDIUM | VERY_COMMON |
| `EVAL-005` | Price correction arithmetic errors not documented | MEDIUM | COMMON |

---

## Contract Mistakes

| Code | Description | Severity | Frequency |
|------|-------------|---------|-----------|
| `CONTRACT-001` | Contract value differs from approved selection result without amendment approval | CRITICAL | OCCASIONAL |
| `CONTRACT-002` | Advance payment disbursed before guarantee received | HIGH | COMMON |
| `CONTRACT-003` | Contract signed by person without authority | CRITICAL | OCCASIONAL |
| `CONTRACT-004` | Performance guarantee amount below legal minimum percentage | HIGH | COMMON |
| `CONTRACT-005` | Contract does not specify payment milestones | MEDIUM | COMMON |

---

## Acceptance Mistakes

| Code | Description | Severity | Frequency |
|------|-------------|---------|-----------|
| `ACCEPT-001` | Acceptance committee formed after delivery (should be formed before) | HIGH | VERY_COMMON |
| `ACCEPT-002` | Acceptance quantity exceeds contracted quantity | CRITICAL | OCCASIONAL |
| `ACCEPT-003` | Acceptance conducted without technical expert where required | HIGH | COMMON |
| `ACCEPT-004` | Acceptance minute backdated | CRITICAL | RARE |
| `ACCEPT-005` | Warranty start date not recorded in acceptance minute | MEDIUM | COMMON |

---

## Payment Mistakes

| Code | Description | Severity | Frequency |
|------|-------------|---------|-----------|
| `PAY-001` | Advance payment not deducted from subsequent progress payments | HIGH | COMMON |
| `PAY-002` | Payment made before formal acceptance | CRITICAL | COMMON |
| `PAY-003` | Duplicate payment for same invoice | CRITICAL | OCCASIONAL |
| `PAY-004` | Retention amount incorrect (below or above legal rate) | HIGH | COMMON |
| `PAY-005` | Guarantee released before warranty period expires | HIGH | OCCASIONAL |
