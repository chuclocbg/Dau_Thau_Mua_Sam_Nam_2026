# Procurement Risk Taxonomy

Domain: `risk` — managed by RiskKnowledgeProvider

---

## Risk Categories

| Category | Code | Description |
|----------|------|-------------|
| Conflict of Interest | `COI` | Relationships between evaluators, approvers, and bidders |
| Bid Manipulation | `BID_MANIP` | Coordination between bidders, bid splitting, bid rigging |
| Document Fraud | `DOC_FRAUD` | Forged certificates, fake financial statements |
| Procurement Splitting | `SPLITTING` | Dividing packages to avoid threshold requirements |
| Authority Abuse | `AUTH_ABUSE` | Exceeding approval authority, unauthorized approvals |
| Supplier Collusion | `COLLUSION` | Price fixing, market allocation among suppliers |
| Advance Payment Risk | `ADVANCE` | Non-recoverable advances, guarantee inadequacy |
| Retention Risk | `RETENTION` | Premature retention release, guarantee substitution fraud |
| Contract Manipulation | `CONTRACT` | Post-award scope changes, price adjustments |
| Acceptance Fraud | `ACCEPTANCE` | False acceptance records, quantity overstatement |
| Payment Irregularity | `PAYMENT` | Duplicate payments, payments before delivery |
| Budget Irregularity | `BUDGET` | Unauthorized commitments, off-budget spending |

---

## Severity Levels

| Level | Code | Description |
|-------|------|-------------|
| Critical | `CRITICAL` | Potential criminal liability; always escalate |
| High | `HIGH` | Significant legal exposure; requires senior review |
| Medium | `MEDIUM` | Process violation; correctable |
| Low | `LOW` | Administrative gap; document and monitor |

---

## Risk Item Metadata Schema

All risk knowledge items carry this metadata structure:
```
{
  riskType:        string               // category code above
  severity:        'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  frequency:       'COMMON' | 'OCCASIONAL' | 'RARE'
  indicators:      string[]             // observable red flags
  mitigations:     string[]             // recommended controls
  legalConsequence: string              // relevant law citation (legalBasis reference)
  relatedRiskTypes: string[]            // other risk categories that often co-occur
  detectionMethod: string[]             // how to detect this risk pattern
}
```

---

## Common Red Flags by Phase

### Planning Phase
- Procurement need created same day as procurement package (no planning gap)
- Estimated value just below approval authority threshold
- Specification written in language that matches only one known supplier

### Tender Phase
- Tender period shorter than legal minimum
- Technical requirements that only one bidder can meet
- Tender announcement published on government holiday

### Evaluation Phase
- Evaluator has prior relationship with winning bidder
- Evaluation completed in unusually short time
- Non-material deviations used to disqualify lower-priced bidders

### Contract Phase
- Contract value significantly below tender estimate (padding)
- Contract amendments increasing scope after award
- Advance payment without proper guarantee

### Acceptance Phase
- Acceptance committee formed after delivery (not before)
- Acceptance minutes signed by unauthorized personnel
- Quantity accepted exceeds contracted quantity

### Payment Phase
- Payment before formal acceptance
- Advance not recovered from final payment
- Multiple payments for same delivery
